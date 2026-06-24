// RUN 23e — license→feature resolution + the security-critical key→plan gate. A key is
// HMAC(secret, "sentinel-license:v1:<plan>"); admin unlocks ONLY for the admin key.
import assert from "node:assert/strict";
import {
  TRIAL_PLAN, FREE_PLAN, licenseMessage, issuePlanKey, resolvePlanFromKey,
  activePlan, enabledFeatures, activeTier, licenseIsAdmin, verifyLicenseStatus, keyHash
} from "../src/shared/license-features.mjs";
import { PLAN_ORDER } from "../src/shared/pricing-tiers.mjs";

const SECRET = "test-license-secret-not-ahmads";
let n = 0; const t = () => { n++; };

// 1 — every plan key round-trips back to its plan under the right secret.
for (const plan of PLAN_ORDER) {
  const key = issuePlanKey(plan, SECRET);
  assert.match(key, /^[a-f0-9]{64}$/, `${plan} key is 64-hex`);
  assert.equal(resolvePlanFromKey(key, SECRET), plan, `${plan} key resolves to ${plan}`);
}
t();

// 2 — 🔒 SECURITY: a NON-admin key never resolves to admin, and the admin key resolves ONLY to admin.
const adminKey = issuePlanKey("admin", SECRET);
assert.equal(resolvePlanFromKey(adminKey, SECRET), "admin", "admin key → admin");
for (const plan of ["personal", "pro", "smb", "midsize", "enterprise"]) {
  const clientKey = issuePlanKey(plan, SECRET);
  assert.notEqual(resolvePlanFromKey(clientKey, SECRET), "admin", `${plan} key must NOT resolve admin`);
  assert.notEqual(clientKey, adminKey, `${plan} key differs from the admin key`);
}
t();

// 3 — wrong secret resolves nothing (admin cannot be forged without the real secret).
assert.equal(resolvePlanFromKey(adminKey, "WRONG-secret"), null, "wrong secret → null");
assert.equal(resolvePlanFromKey(adminKey, ""), null, "no secret → null");
t();

// 4 — non-hex / tampered / empty keys resolve to null (never admin).
assert.equal(resolvePlanFromKey("not-a-key", SECRET), null);
assert.equal(resolvePlanFromKey("", SECRET), null);
assert.equal(resolvePlanFromKey(adminKey.replace(/.$/, adminKey.endsWith("0") ? "1" : "0"), SECRET), null, "1-char tamper → null");
t();

// 5 — the signed message is plan-canonicalized + versioned.
assert.equal(licenseMessage("pro"), "sentinel-license:v1:pro");
assert.equal(licenseMessage("Small Business"), "sentinel-license:v1:smb");
t();

// 6 — enabledFeatures gates on the resolved plan.
assert.deepEqual(enabledFeatures({ licensed: true, plan: "pro" }).modes, ["manual", "confirmed", "autonomous"]);
assert.deepEqual(enabledFeatures({ licensed: true, plan: "personal" }).modes, ["manual"]);
assert.equal(enabledFeatures({ licensed: true, plan: "admin" }).adminConsole, true);
assert.equal(enabledFeatures({ licensed: true, plan: "smb" }).fleetView, true);
t();

// 7 — 🔒 SECURITY: a licensed-but-unknown plan fails closed to Personal (manual only, never admin).
const unknown = enabledFeatures({ licensed: true, plan: "hacker-tier" });
assert.deepEqual(unknown.modes, ["manual"], "unknown plan → manual only");
assert.equal(unknown.adminConsole, false, "unknown plan → no admin console");
t();

// 8 — trial tier (Ahmad 2026-06-22): an ACTIVE trial unlocks Pro (demo paid modes); an expired/absent
// trial falls back to free Personal (Manual only). Neither is ever admin.
assert.equal(TRIAL_PLAN, "pro");
assert.equal(FREE_PLAN, "personal");
assert.equal(activePlan({ licensed: false, trial: { state: "active" } }), "pro", "active trial → Pro");
assert.deepEqual(enabledFeatures({ licensed: false, trial: { state: "active" } }).modes, ["manual", "confirmed", "autonomous"], "active trial → full modes");
assert.equal(activePlan({ licensed: false, trial: { state: "expired" } }), "personal", "expired trial → free Personal");
assert.deepEqual(enabledFeatures({ licensed: false }).modes, ["manual"], "no license/trial → manual only");
assert.equal(enabledFeatures({ licensed: false, trial: { state: "active" } }).adminConsole, false, "trial → never admin");
assert.equal(enabledFeatures({ licensed: false }).adminConsole, false, "free → no admin");
t();

// 9 — licenseIsAdmin: admin license true; every other state false.
assert.equal(licenseIsAdmin({ licensed: true, plan: "admin" }), true);
assert.equal(licenseIsAdmin({ licensed: true, plan: "pro" }), false);
assert.equal(licenseIsAdmin({ licensed: true, plan: "enterprise" }), false);
assert.equal(licenseIsAdmin({ licensed: false, plan: "admin" }), false, "no license → not admin even if plan says admin");
t();

// 10 — activeTier exposes label/price for display.
assert.equal(activeTier({ licensed: true, plan: "pro" }).label, "Pro");
assert.equal(activeTier({ licensed: false }).label, "Personal");
t();

// 11 — RUN 24 A1: verifyLicenseStatus + keyHash (revocation-aware verification).
const proKey = issuePlanKey("pro", SECRET);
// keyHash is a stable 64-hex sha256 of the key (never the raw key downstream).
assert.match(keyHash(proKey), /^[a-f0-9]{64}$/, "keyHash is sha256 hex");
assert.equal(keyHash(proKey), keyHash(proKey), "keyHash is deterministic");
assert.notEqual(keyHash(proKey), proKey, "keyHash differs from the raw key");
// authentic key, no revocation check → active with the resolved plan.
assert.deepEqual(await verifyLicenseStatus(proKey, SECRET), { plan: "pro", status: "active" });
// forged/invalid key → invalid, no plan (never admin).
assert.deepEqual(await verifyLicenseStatus("nope", SECRET), { plan: null, status: "invalid" });
assert.deepEqual(await verifyLicenseStatus(issuePlanKey("admin", "WRONG"), SECRET), { plan: null, status: "invalid" }, "wrong-secret admin key is invalid");
// authentic + server says revoked → revoked, no plan.
assert.deepEqual(await verifyLicenseStatus(proKey, SECRET, async () => true), { plan: null, status: "revoked" });
// 🔒 SECURITY: the revocation callback receives the HASH, never the raw key.
let sawArg = null;
await verifyLicenseStatus(proKey, SECRET, async (h) => { sawArg = h; return false; });
assert.equal(sawArg, keyHash(proKey), "fetchIsRevoked receives the key HASH");
assert.notEqual(sawArg, proKey, "raw key is never passed to the revocation check");
// fail-OPEN: a revocation-check error keeps an authentic key active (no lockout on a network blip).
assert.deepEqual(await verifyLicenseStatus(proKey, SECRET, async () => { throw new Error("offline"); }), { plan: "pro", status: "active" });
t();

console.log(`License-features test passed (${n} groups · key round-trip · admin-only gate · fail-closed · trial=pro/free=personal · verify+revocation).`);
