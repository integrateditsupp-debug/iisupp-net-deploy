// RUN-CU / CU4 (audit P0 #5) — local bridge policy: empty Origin rejected on every state-changing route (and every
// POST), extension/loopback origins kept for /detect and /chat, /run-recipe routed through runSupervisedFix with
// caller flags stripped, /state scrubbed (no transparency log, no license key, no contacts/prefs).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isAllowedBridgeOrigin, isStateChangingRoute, sanitizeRunRecipeBody, scrubPublicState, BRIDGE_STATE_CHANGING_ROUTES, BRIDGE_READ_ROUTES } from "../src/shared/bridge-auth.mjs";

let n = 0; const t = () => { n++; };
const PORT = 37841;
const ext = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

// 1 — empty origin: GET /health, /state, /dist-info allowed; every POST refused; other GETs refused.
{
  for (const p of BRIDGE_READ_ROUTES) assert.equal(isAllowedBridgeOrigin({ origin: "", method: "GET", pathname: p, port: PORT }).ok, true, `GET ${p} with no origin is a read route`);
  for (const p of [...BRIDGE_STATE_CHANGING_ROUTES, "/detect", "/chat", "/signature"]) {
    const r = isAllowedBridgeOrigin({ origin: "", method: "POST", pathname: p, port: PORT });
    assert.equal(r.ok, false, `POST ${p} with an empty origin is refused`); assert.equal(r.reason, "origin_required");
  }
  assert.equal(isAllowedBridgeOrigin({ origin: "null", method: "POST", pathname: "/run-recipe", port: PORT }).ok, false, "opaque 'null' origin is not an identity");
  assert.equal(isAllowedBridgeOrigin({ origin: "", method: "GET", pathname: "/anything", port: PORT }).ok, false);
}
t();

// 2 — extension + loopback origins keep every route (incl. /detect and /chat for the extension); foreign origins never pass.
{
  for (const o of [ext, "edge-extension://abc", `http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]) {
    for (const p of ["/detect", "/chat", "/run-recipe", "/incident", "/scan"]) assert.equal(isAllowedBridgeOrigin({ origin: o, method: "POST", pathname: p, port: PORT }).ok, true, `${o} POST ${p}`);
    assert.equal(isAllowedBridgeOrigin({ origin: o, method: "GET", pathname: "/state", port: PORT }).ok, true);
  }
  for (const o of ["https://evil.example", "http://127.0.0.1:9999", "http://localhost:3000", "file://"]) {
    assert.equal(isAllowedBridgeOrigin({ origin: o, method: "GET", pathname: "/health", port: PORT }).ok, false, `${o} refused even on /health`);
    assert.equal(isAllowedBridgeOrigin({ origin: o, method: "POST", pathname: "/detect", port: PORT }).reason, "origin_blocked");
  }
  assert.equal(isAllowedBridgeOrigin({ origin: "", method: "OPTIONS", pathname: "/run-recipe", port: PORT }).ok, true, "CORS preflight passes (it does nothing)");
}
t();

// 3 — /run-recipe body: dryRun / confirmed / mode / approved are STRIPPED; only the recipe id (+ process hint) survives.
{
  assert.deepEqual(isStateChangingRoute("/run-recipe"), true); assert.equal(isStateChangingRoute("/detect"), false);
  const b = sanitizeRunRecipeBody({ recipeId: "restart-print-spooler", dryRun: false, confirmed: true, mode: "autonomous", approved: true, approvalId: "x", processName: "spoolsv", pid: 123, extra: "y" });
  assert.deepEqual(b, { recipeId: "restart-print-spooler", source: "bridge", processName: "spoolsv", pid: 123 });
  assert.deepEqual(sanitizeRunRecipeBody(null), { recipeId: "", source: "bridge" });
}
t();

// 4 — /state is scrubbed: operational facts + counts only.
{
  const full = {
    version: "0.2.0", mode: "confirmed", dryRun: true, platform: "win32", agentState: "idle", paused: false, killed: false,
    transparencyLog: [{ ts: "x", tag: "RUN", text: "secret-ish" }], license: { licensed: true, plan: "pro", email: "owner@acme.com", key: "k".repeat(64) },
    setupPrefs: { deviceUser: { email: "sam@acme.com", phone: "+1" } }, approvals: { pending: [{ id: "a", title: "T" }], decided: [], pendingCount: 1 },
    detections: [1, 2], incidents: [1], recipes: [1, 2, 3], restorePoints: [{ id: "r" }], deletePrefs: { skipTripleFor: [".pdf"] }, serviceNow: { instanceUrl: "https://x" },
    healthScore: { score: 91, ts: "t", detail: "x" }, bridgeStatus: { listening: true, conflict: false, port: 37841, lastError: "e" }, autonomy: { level: "safe-auto", mode: "confirmed", reason: "r" },
    externalAiCalls: true, auditIntegrity: { ok: true, verifiedAt: "x" }, gate: { email: "owner@acme.com" }, stopCodes: [1]
  };
  const pub = scrubPublicState(full);
  const text = JSON.stringify(pub);
  assert.ok(!text.includes("secret-ish") && !text.includes("owner@acme.com") && !text.includes("sam@acme.com") && !text.includes("k".repeat(64)) && !text.includes("+1"), "no log text, email, key, phone");
  assert.ok(!("transparencyLog" in pub) && !("license" in pub) && !("setupPrefs" in pub) && !("restorePoints" in pub) && !("deletePrefs" in pub) && !("serviceNow" in pub) && !("stopCodes" in pub) && !("gate" in pub));
  assert.deepEqual(pub.counts, { detections: 2, incidents: 1, auditEvents: 1, recipes: 3, approvalsPending: 1 });
  assert.equal(pub.licensed, true); assert.equal(pub.plan, "pro"); assert.equal(pub.mode, "confirmed"); assert.equal(pub.healthScore.score, 91); assert.equal(pub.autonomy.level, "safe-auto");
  assert.equal(pub.bridgeStatus.lastError, undefined, "bridge error text is not echoed");
  assert.equal(pub.contentBlind, true);
  assert.deepEqual(scrubPublicState(null).counts, { detections: 0, incidents: 0, auditEvents: 0, recipes: 0, approvalsPending: 0 });
}
t();

// 5 — main.mjs wiring: the policy gates every request first, /state serves the scrubbed slice, /run-recipe → runSupervisedFix.
{
  const main = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "main.mjs"), "utf8");
  const bridge = main.slice(main.indexOf("function startBridge()"), main.indexOf("function sendJson("));
  assert.match(bridge, /bridgeOriginAllowed\(\{ origin: req\.headers\.origin, method: req\.method, pathname: url\.pathname, port: BRIDGE_PORT \}\)/, "pure policy consulted for every request");
  assert.match(bridge, /if \(!isAllowedBridgeOrigin\(req\)\)/, "the legacy origin check is kept as a second gate (Rule 15)");
  assert.match(bridge, /url\.pathname === "\/state"\) return sendJson\(res, 200, scrubPublicState\(getState\(\)\)\)/, "/state is scrubbed");
  assert.match(bridge, /sanitizeRunRecipeBody\(await readJson\(req\)\)/, "/run-recipe strips caller flags");
  // 2026-10-14 (review P0-2) — EXPECTATION CHANGED ON PURPOSE: the route now goes through bridgeRunRecipe, which checks the
  // kill gate FIRST (Ctrl+Alt+K / Stop ARIA / fleet kill / pause → "blocked") and only then calls runSupervisedFix.
  assert.match(bridge, /url\.pathname === "\/run-recipe"\) \{[\s\S]*?bridgeRunRecipe\(sanitizeRunRecipeBody\(await readJson\(req\)\)\)/, "/run-recipe goes through bridgeRunRecipe");
  const bridgeFn = main.slice(main.indexOf("async function bridgeRunRecipe("), main.indexOf("function startBridge()"));
  assert.ok(bridgeFn.indexOf("if (!killGateOpen())") > -1 && bridgeFn.indexOf("if (!killGateOpen())") < bridgeFn.indexOf("runSupervisedFix("), "…which checks the kill gate before the supervised pipeline");
  assert.match(bridgeFn, /return runSupervisedFix\(\{ \.\.\.body, mode: "confirmed"/, "/run-recipe goes through the supervised pipeline");
  assert.doesNotMatch(bridge, /runRecipe\(body\.recipeId, body\)/, "the raw runRecipe(body) bridge path is gone");
  assert.match(bridge, /url\.pathname === "\/detect"/); assert.match(bridge, /url\.pathname === "\/chat"/); assert.match(bridge, /url\.pathname === "\/dist-info"/);
}
t();

assert.equal(n, 5, "5 bridge-auth groups");
console.log(`bridge-auth test passed (${n} groups · empty origin refused on every POST/state-changing route · extension+loopback keep /detect+/chat · /run-recipe flags stripped → supervised · /state scrubbed · main wiring).`);
