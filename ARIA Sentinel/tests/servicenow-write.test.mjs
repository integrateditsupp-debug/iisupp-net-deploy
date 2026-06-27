// MODULE 1 — gated ServiceNow WRITE ticket lifecycle. Locks the four invariants: gated (no write
// without approval — and no network call), honest (missing instance / 403 surfaced, never faked),
// read-back-verified (the returned number comes from a real GET; an unconfirmed write is reported as
// unverified, never an invented number), and the resolve step only confirms 'resolved' on a real state.
import assert from "node:assert/strict";
import {
  createInteraction, createIncidentFromInteraction, updateIncident, resolveIncident, closeInteraction, getRecord
} from "../src/shared/servicenow.mjs";

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

const CFG = { configured: true, instanceUrl: "https://dev12345.service-now.com", user: "aria.write", pass: "p" };

function mkRes({ status = 200, ok, body = {} }) {
  return { ok: ok == null ? status >= 200 && status < 300 : ok, status, json: async () => body };
}
// Scripted fetch: each rule { match(url,opts), res }. Records every call.
function fakeFetch(rules) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, method: (opts.method || "GET").toUpperCase(), body: opts.body });
    for (const r of rules) if (r.match(url, opts)) return mkRes(r.res);
    return mkRes({ status: 404, ok: false });
  };
  fn.calls = calls;
  return fn;
}

// ── 1 · Gated: no approval → needsApproval AND zero network calls ──
{
  const fetch = fakeFetch([]);
  const r = await createInteraction({ approved: false, issue: "x" }, { config: CFG, fetch });
  assert.equal(r.needsApproval, true, "blocked without approval");
  assert.equal(fetch.calls.length, 0, "no network call when not approved");
  ok("gated: unapproved write makes no network call");
}

// ── 2 · Honest: not configured → notConfigured (flagged, not faked) ──
{
  const r = await createInteraction({ approved: true }, { config: { configured: false }, fetch: fakeFetch([]) });
  assert.equal(r.notConfigured, true, "missing instance/write-user flagged");
  ok("honest: missing ServiceNow instance/write-user is flagged, not faked");
}

// ── 3 · Happy path: POST → read-back GET → real number (Interaction) ──
{
  const fetch = fakeFetch([
    { match: (u, o) => o.method === "POST" && u.includes("/table/interaction"), res: { status: 201, body: { result: { sys_id: "ia1", number: "IMS0001001" } } } },
    { match: (u, o) => (o.method || "GET") === "GET" && u.includes("/table/interaction/ia1"), res: { status: 200, body: { result: { sys_id: "ia1", number: "IMS0001001", state: "new" } } } }
  ]);
  const r = await createInteraction({ approved: true, symbolicCode: "WIFI.DROP" }, { config: CFG, fetch });
  assert.equal(r.ok, true);
  assert.equal(r.number, "IMS0001001", "number comes from the verified record");
  assert.equal(r.sysId, "ia1");
  assert.ok(fetch.calls.some((c) => c.method === "GET"), "performed a read-back GET");
  ok("read-back verified: Interaction number is the real GETd value");
}

// ── 4 · Incident links to the interaction via correlation_id (content-blind) ──
{
  const fetch = fakeFetch([
    { match: (u, o) => o.method === "POST" && u.includes("/table/incident"), res: { status: 201, body: { result: { sys_id: "in1", number: "INC0002002" } } } },
    { match: (u, o) => (o.method || "GET") === "GET" && u.includes("/table/incident/in1"), res: { status: 200, body: { result: { sys_id: "in1", number: "INC0002002", state: "1" } } } }
  ]);
  const r = await createIncidentFromInteraction({ approved: true, symbolicCode: "WIFI.DROP", interactionSysId: "ia1", interactionNumber: "IMS0001001" }, { config: CFG, fetch });
  assert.equal(r.ok, true);
  const postBody = JSON.parse(fetch.calls.find((c) => c.method === "POST").body);
  assert.equal(postBody.correlation_id, "ia1", "incident correlates to the interaction sys_id");
  ok("Incident opens from the Interaction (correlation_id link, content-blind body)");
}

// ── 5 · Forbidden: a 403 from the write user is surfaced honestly (never a fake ticket) ──
{
  const fetch = fakeFetch([{ match: (u, o) => o.method === "POST", res: { status: 403, ok: false } }]);
  const r = await createInteraction({ approved: true }, { config: CFG, fetch });
  assert.equal(r.ok, false);
  assert.equal(r.forbidden, true);
  assert.equal(r.status, 403);
  assert.ok(!r.number, "no invented number on a permission failure");
  ok("honest: 403 write-permission failure surfaced, no fake number");
}

// ── 6 · Unverified: POST succeeds but read-back fails → unverified, number not trusted ──
{
  const fetch = fakeFetch([
    { match: (u, o) => o.method === "POST", res: { status: 201, body: { result: { sys_id: "x9", number: "INC9" } } } },
    { match: (u, o) => (o.method || "GET") === "GET", res: { status: 500, ok: false } }
  ]);
  const r = await createInteraction({ approved: true }, { config: CFG, fetch });
  assert.equal(r.ok, false);
  assert.equal(r.unverified, true, "write not trusted without a read-back");
  ok("read-back-verify: an unconfirmed write is 'unverified', never reported as success");
}

// ── 7 · Resolve: PATCH state=6 + read-back confirms Resolved → resolvedConfirmed ──
{
  const fetch = fakeFetch([
    { match: (u, o) => o.method === "PATCH", res: { status: 200, body: { result: { sys_id: "in1", number: "INC0002002", state: "6" } } } },
    { match: (u, o) => (o.method || "GET") === "GET", res: { status: 200, body: { result: { sys_id: "in1", number: "INC0002002", state: "6" } } } }
  ]);
  const r = await resolveIncident("in1", { approved: true, closeNotes: "fixed via gated pipeline", recipeId: "wifi.reset" }, { config: CFG, fetch });
  assert.equal(r.ok, true);
  assert.equal(r.resolvedConfirmed, true, "only confirms resolved when read-back state is Resolved");
  ok("resolve: confirmed only when the read-back state is actually Resolved");
}

// ── 8 · getRecord is read-only + returns the real fields ──
{
  const fetch = fakeFetch([{ match: (u, o) => (o.method || "GET") === "GET", res: { status: 200, body: { result: { sys_id: "z1", number: "INC1", state: "2" } } } }]);
  const r = await getRecord("incident", "z1", { config: CFG, fetch });
  assert.equal(r.ok, true);
  assert.equal(r.record.number, "INC1");
  assert.equal(fetch.calls[0].method, "GET", "read-back is GET-only");
  ok("getRecord read-back is GET-only and returns real fields");
}

assert.equal(tests, 8, "servicenow-write runs exactly 8 cases");
console.log(`ServiceNow-write test passed (${tests}/8 · gated · honest 403/not-configured · read-back-verified · resolve-confirmed · no fake numbers).`);
