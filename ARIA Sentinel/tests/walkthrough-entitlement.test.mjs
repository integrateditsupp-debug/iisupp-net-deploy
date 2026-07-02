// SENTINEL TRIAL GATING 2026-07-02 — the Walk-Through entitlement is INDEPENDENT of the Sentinel plan.
// isWalkthroughEntitled(status) is true for an active trial (Pro), any paid plan that includes the walkthrough
// feature, and the server-set walkthroughEntitled flag (Concierge buyer); false only for an expired trial with
// no paid plan and no entitlement. activePlan is unchanged for those states. Pure — no DOM, no I/O.
import assert from "node:assert/strict";
import { isWalkthroughEntitled, activePlan, TRIAL_PLAN, FREE_PLAN } from "../src/shared/license-features.mjs";
import { getFeatures } from "../src/shared/pricing-tiers.mjs";

let n = 0; const t = () => { n++; };

// 1 — active trial → Pro → walkthrough feature on → entitled. activePlan unchanged (still TRIAL_PLAN).
const trialStatus = { licensed: false, plan: null, trial: { state: "active" } };
assert.equal(activePlan(trialStatus), TRIAL_PLAN, "active trial resolves to the Pro trial plan");
assert.equal(isWalkthroughEntitled(trialStatus), true, "active trial → Walk-Through entitled");
t();

// 2 — a paid plan that INCLUDES walkthrough (pro/smb/enterprise/admin) → entitled via the plan feature.
for (const plan of ["pro", "smb", "midsize", "enterprise", "admin"]) {
  const s = { licensed: true, plan };
  assert.equal(getFeatures(plan).walkthrough, true, `${plan} tier includes walkthrough`);
  assert.equal(isWalkthroughEntitled(s), true, `${plan} paid plan → Walk-Through entitled`);
  assert.equal(activePlan(s), plan, `${plan} activePlan unchanged`);
}
t();

// 3 — the server-set walkthroughEntitled flag alone → entitled, even at FREE_PLAN / expired trial (Concierge
// buyer after their 30-day trial: only the Walk-Through survives). activePlan is still the free tier.
const conciergeExpired = { licensed: false, plan: null, trial: { state: "expired" }, walkthroughEntitled: true };
assert.equal(activePlan(conciergeExpired), FREE_PLAN, "expired concierge trial → FREE_PLAN");
assert.equal(getFeatures(FREE_PLAN).walkthrough, false, "the free Personal tier does NOT include walkthrough");
assert.equal(isWalkthroughEntitled(conciergeExpired), true, "walkthroughEntitled flag → entitled regardless of plan");
t();

// 4 — expired trial + no paid plan + NOT entitled → NOT entitled (nothing to unlock the Walk-Through).
const plainExpired = { licensed: false, plan: null, trial: { state: "expired" } };
assert.equal(activePlan(plainExpired), FREE_PLAN, "plain expired trial → FREE_PLAN");
assert.equal(isWalkthroughEntitled(plainExpired), false, "expired + no plan + not entitled → NOT entitled");
// Also: a bare no-license status (never started a trial) is not entitled.
assert.equal(isWalkthroughEntitled({}), false, "empty status → not entitled");
assert.equal(isWalkthroughEntitled({ licensed: true, plan: "personal" }), false, "paid Personal (no walkthrough feature) + no flag → not entitled");
t();

// 5 — 🔒 the flag must be an EXACT boolean true (never coerced) — a truthy string / 1 does not grant it.
assert.equal(isWalkthroughEntitled({ walkthroughEntitled: "yes" }), false, "non-true value never grants entitlement");
assert.equal(isWalkthroughEntitled({ walkthroughEntitled: 1 }), false, "1 is not true → not entitled");
t();

assert.equal(n, 5, "5 entitlement-matrix groups");
console.log(`walkthrough-entitlement test passed (${n} groups · active-trial/paid-plan/flag → entitled · expired+no-plan+no-flag → not · activePlan unchanged · flag is strict-true).`);
