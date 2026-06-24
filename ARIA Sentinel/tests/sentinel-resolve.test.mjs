// RUN 24 A6 — server-side license resolve decision + IP rate-limit (the sentinel-resolve.mjs core).
// Proves the HTTP contract the desktop relies on, and that the secret/key never leak into a response body.
import assert from "node:assert/strict";
import { issuePlanKey, resolvePlanFromKey } from "../src/shared/license-features.mjs";
import { resolveDecision, bumpRateLimit, RESOLVE_RL_MAX, RESOLVE_RL_WINDOW_MS } from "../src/shared/sentinel-license-funnel.mjs";

const SECRET = "test-license-secret-A6-do-not-ship";
const NOW = "2026-06-22T18:00:00.000Z";
let n = 0; const t = () => { n++; };

// Helper mirroring the handler: regex → resolve plan → decide (revocation injected per case).
function decide(key, { revoked = false } = {}) {
  const plan = /^[a-f0-9]{64}$/i.test(key) ? resolvePlanFromKey(key, SECRET) : null;
  return resolveDecision({ key, plan, revoked, nowIso: NOW });
}

const proKey = issuePlanKey("pro", SECRET);
const adminKey = issuePlanKey("admin", SECRET);

// 1 — valid ACTIVE key → 200 {plan, status:"active", verified_at}.
let d = decide(proKey);
assert.equal(d.statusCode, 200);
assert.deepEqual(d.body, { plan: "pro", status: "active", verified_at: NOW });
t();

// 2 — valid REVOKED key → 200 {plan, status:"revoked"} (plan still reported, status downgrades the client).
d = decide(adminKey, { revoked: true });
assert.equal(d.statusCode, 200);
assert.equal(d.body.status, "revoked");
assert.equal(d.body.plan, "admin");
assert.ok(!("verified_at" in d.body), "revoked body carries no verified_at");
t();

// 3 — garbage key (well-formed 64-hex but forged) → 401 {status:"invalid"}, no plan leaked.
const forged = "a".repeat(64);
assert.equal(resolvePlanFromKey(forged, SECRET), null, "forged key resolves to no plan");
d = decide(forged);
assert.equal(d.statusCode, 401);
assert.deepEqual(d.body, { status: "invalid" });
t();

// 4 — malformed key (not 64-hex) → 400, distinct from forged.
for (const bad of ["", "xyz", "g".repeat(64), proKey.slice(0, 63), proKey + "0"]) {
  const r = decide(bad);
  assert.equal(r.statusCode, 400, `malformed → 400: ${bad.slice(0, 8)}`);
  assert.equal(r.body.reason, "malformed");
}
t();

// 5 — rate limit: the (MAX+1)-th hit in one window is limited; a hit past the window resets.
let rec = null, limitedAt = 0;
for (let i = 1; i <= RESOLVE_RL_MAX + 1; i++) {
  const r = bumpRateLimit(rec, 1000); // same instant → one window
  rec = r.record;
  if (r.limited && !limitedAt) limitedAt = i;
}
assert.equal(limitedAt, RESOLVE_RL_MAX + 1, `first 429 is request #${RESOLVE_RL_MAX + 1}`);
const reset = bumpRateLimit(rec, 1000 + RESOLVE_RL_WINDOW_MS); // window elapsed
assert.equal(reset.limited, false, "new window resets the counter");
assert.equal(reset.record.count, 1);
t();

// 6 — secret-leak guard: no decision body (any case) ever contains the secret or the raw key.
for (const d2 of [decide(proKey), decide(adminKey, { revoked: true }), decide(forged), decide("nope")]) {
  const blob = JSON.stringify(d2.body);
  assert.ok(!blob.includes(SECRET), "response body never contains the license secret");
}
assert.ok(!JSON.stringify(decide(proKey).body).includes(proKey), "response body never echoes the raw key");
t();

assert.equal(n, 6, "6 resolve test groups");
console.log(`Sentinel-resolve test passed (${n} groups · active/revoked/forged/malformed status codes · IP rate-limit · secret+key never leak).`);
