// BLOCK 4 test — ServiceNow connector: body shape, content-blindness, queue+retry.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildIncidentPayload,
  createIncident,
  drainQueue,
  listMyIncidents,
  postComment,
  ping,
  queueDepth,
  getServiceNowConfig,
  hashIdentifier
} from "../src/shared/servicenow.mjs";

const LIVE = { SN_INSTANCE_URL: "https://acme.service-now.com", SN_USER: "svc", SN_PASS: "secret" };
const cfgLive = getServiceNowConfig(LIVE);
assert.equal(cfgLive.configured, true, "live config detected");
assert.equal(getServiceNowConfig({}).configured, false, "missing creds = not configured");
// non-service-now hosts are rejected outright
assert.equal(getServiceNowConfig({ SN_INSTANCE_URL: "https://evil.example.com", SN_USER: "a", SN_PASS: "b" }).instanceUrl, "");

// PII canaries that MUST NOT survive into the incident payload.
const PII = ["jdoe@acme.com", "C:\\Users\\jdoe\\secret.docx", "https://intra.acme.com/x?t=zzz", "4111111111111111"];
const payload = buildIncidentPayload({
  symbolicCode: "DISK.LOW_SPACE",
  recipeIds: ["disk-low-space-v1", "bad id!@#"],
  dryRun: true,
  shortDesc: PII[0],
  caller: PII[0],
  iisInternalId: "iis-" + PII[1]
});
const payloadText = JSON.stringify(payload);
for (const c of PII) assert.ok(!payloadText.includes(c), `payload leaked PII: ${c}`);
assert.match(payload.short_description, /DISK\.LOW_SPACE/);
assert.match(payload.description, /Attempted recipes: disk-low-space-v1/);
assert.match(payload.caller_id, /^sid-/, "caller must be an opaque sid hash");
assert.equal(hashIdentifier("jdoe@acme.com").startsWith("sid-"), true);

// Mock fetch factory
function mockFetch(sequence) {
  const calls = [];
  let i = 0;
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const step = typeof sequence === "function" ? sequence(url, init, i) : sequence[Math.min(i, sequence.length - 1)];
    i++;
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      json: async () => step.body || {},
      clone() {
        return this;
      }
    };
  };
  fn.calls = calls;
  return fn;
}

// not configured → dry-run, no network
let netHit = false;
const dry = await createIncident(
  { symbolicCode: "NET.DNS.FAIL", recipeId: "dns-fail-v1" },
  { env: {}, fetch: () => ((netHit = true), {}) }
);
assert.equal(dry.dryRun, true);
assert.equal(netHit, false, "dry-run must not touch the network");

// configured + 201 → ok, returns number/sysId, body carries no PII
const okFetch = mockFetch([{ status: 201, body: { result: { number: "INC0042781", sys_id: "abc123" } } }]);
const created = await createIncident(
  { symbolicCode: "DISK.LOW_SPACE", recipeId: "disk-low-space-v1", caller: "jdoe@acme.com" },
  { config: cfgLive, fetch: okFetch }
);
assert.equal(created.ok, true);
assert.equal(created.number, "INC0042781");
assert.equal(created.sysId, "abc123");
const sentBody = okFetch.calls[0].init.body;
for (const c of PII) assert.ok(!String(sentBody).includes(c), `wire body leaked ${c}`);
assert.match(okFetch.calls[0].url, /acme\.service-now\.com\/api\/now\/table\/incident$/);

// 503 → queued for retry (use a temp queue file)
const qfile = path.join(os.tmpdir(), `aria-sn-queue-${Date.now()}.json`);
try {
  fs.rmSync(qfile, { force: true });
} catch {
  /* ignore */
}
const failFetch = mockFetch([{ status: 503 }]);
const queued = await createIncident(
  { symbolicCode: "PRINT.OFFLINE", recipeId: "printer-spooler-v1" },
  { config: cfgLive, fetch: failFetch, queuePath: qfile }
);
assert.equal(queued.queued, true, "503 must enqueue");
assert.equal(queueDepth({ queuePath: qfile }), 1, "queue depth is 1 after a 503");

// drain succeeds on next connect
const drainFetch = mockFetch([{ status: 201, body: { result: { number: "INC9", sys_id: "z" } } }]);
const drained = await drainQueue({ config: cfgLive, fetch: drainFetch, queuePath: qfile });
assert.equal(drained.drained, 1);
assert.equal(queueDepth({ queuePath: qfile }), 0, "queue empty after drain");
fs.rmSync(qfile, { force: true });

// list maps + sorts newest first
const listFetch = mockFetch([
  {
    status: 200,
    body: {
      result: [
        { number: "INC1", sys_id: "1", state: "2", priority: "3", assignment_group: { display_value: "Desktop Support" }, sys_updated_on: "2026-06-01 10:00:00", short_description: "A", work_notes: "n1\n\nn2" },
        { number: "INC2", sys_id: "2", state: "6", priority: "2", assignment_group: "Network Team", sys_updated_on: "2026-06-19 09:00:00", short_description: "B" }
      ]
    }
  }
]);
const list = await listMyIncidents({ caller: "jdoe@acme.com", limit: 10 }, { config: cfgLive, fetch: listFetch });
assert.equal(list.length, 2);
assert.equal(list[0].number, "INC2", "newest first");
assert.equal(list[0].state, "Resolved");
assert.equal(list[1].state, "In Progress");
assert.deepEqual(list[1].workNotes, ["n1", "n2"]);
assert.match(listFetch.calls[0].url, /caller_id%3Dsid-/, "caller filtered by opaque sid");

// ping reports latency
let clock = 1000;
const pingFetch = mockFetch([{ status: 200 }]);
const pong = await ping(LIVE.SN_INSTANCE_URL, LIVE.SN_USER, LIVE.SN_PASS, { fetch: pingFetch, now: () => (clock += 25) });
assert.equal(pong.ok, true);
assert.ok(pong.latency_ms >= 0);

// comment passes the user's own words to their own ticket
const commentFetch = mockFetch([{ status: 200 }]);
const posted = await postComment({ incidentSysId: "abc123", comment: "Any update please?" }, { config: cfgLive, fetch: commentFetch });
assert.equal(posted.ok, true);
assert.equal(commentFetch.calls[0].init.method, "PATCH");

console.log("ServiceNow connector test passed (payload content-blind, queue+retry, list+comment).");
