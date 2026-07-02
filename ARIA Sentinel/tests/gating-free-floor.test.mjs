// FIX 2 (COMPANION-ONDEVICE-STT-AND-GATING-FIX) — gating correctness: the FREE / expired-trial / unlicensed
// feature set must be STRICTLY a subset of the lowest PAID tier (Personal), so a paid entry plan is a REAL
// upgrade over the free state. Previously FREE_PLAN was "personal", which both locked a PAYING Personal
// subscriber AND made the paid entry tier unlock nothing. This locks the split: free < personal, each paid tier
// keeps its designed set, unlicensed+entitled → Walk-Through only, and the buy path is always reachable. Pure.
import assert from "node:assert/strict";
import { getFeatures, TIERS, CLIENT_PLANS, PLAN_ORDER } from "../src/shared/pricing-tiers.mjs";
import { FREE_PLAN, activePlan, enabledFeatures } from "../src/shared/license-features.mjs";
import { tabGateMap, appUnlocked, buyPathTabs, ALWAYS_OPEN_TABS, GATED_TABS, WALKTHROUGH_TAB } from "../src/shared/tab-gating.mjs";
let n = 0; const t = () => { n++; };

// how many boolean features are ON + how many modes are enabled (a simple "power" measure).
function power(f) {
  const bools = Object.entries(f).filter(([k, v]) => k !== "modes" && k !== "recipesCount" && v === true).length;
  return bools + f.modes.length + (f.recipesCount > 0 ? 1 : 0);
}
function isSubset(sub, sup) {
  if (![...sub.modes].every((m) => sup.modes.includes(m))) return false;
  for (const [k, v] of Object.entries(sub)) {
    if (k === "modes") continue;
    if (k === "recipesCount") { if (v > sup.recipesCount) return false; continue; }
    if (v === true && sup[k] !== true) return false; // an ON feature in sub must be ON in sup
  }
  return true;
}

// 1 — the free floor is its own tier, distinct from paid "personal", and NOT purchasable.
assert.equal(FREE_PLAN, "free", "FREE_PLAN is the dedicated free floor, not paid personal");
assert.ok(TIERS.free, "a free tier exists");
assert.equal(TIERS.free.purchasable, false, "free is not purchasable");
assert.ok(!CLIENT_PLANS.includes("free"), "free is not offered in the plan picker");
assert.ok(!PLAN_ORDER.includes("free"), "free is not in the purchasable plan order");
t();

// 2 — THE FIX: the free floor is STRICTLY a subset of the lowest paid tier (Personal), and genuinely weaker.
const free = getFeatures("free");
const personal = getFeatures("personal");
assert.ok(isSubset(free, personal), "free feature set ⊆ personal feature set");
assert.ok(power(free) < power(personal), "free is STRICTLY weaker than paid Personal (a real upgrade on purchase)");
assert.deepEqual(free.modes, [], "free has no execution modes");
assert.deepEqual(personal.modes, ["manual"], "paid Personal keeps Manual mode");
assert.equal(free.systemInventory, false);
assert.equal(personal.systemInventory, true, "paid Personal unlocks system inventory the free floor lacks");
t();

// 3 — a LICENSED entry tier (Personal) enables strictly MORE than the unlicensed / expired-trial state.
const unlicensed = enabledFeatures({ licensed: false });                 // → free floor
const expired = enabledFeatures({ licensed: false, trial: { state: "expired" } });
const paidEntry = enabledFeatures({ licensed: true, plan: "personal" }); // → personal
assert.deepEqual(unlicensed, free, "unlicensed → the free floor");
assert.deepEqual(expired, free, "expired trial → the free floor");
assert.ok(power(paidEntry) > power(unlicensed), "licensed entry tier > unlicensed");
assert.ok(power(paidEntry) > power(expired), "licensed entry tier > expired trial");
assert.equal(appUnlocked({ licensed: true, plan: "personal" }), true, "paid Personal unlocks the app");
assert.equal(appUnlocked({ licensed: false }), false, "the free floor stays locked");
t();

// 4 — each paid tier still maps to its OWN designed feature set (each tier keeps its limits).
assert.deepEqual(getFeatures("personal").modes, ["manual"], "Personal = Manual only");
assert.deepEqual(getFeatures("pro").modes, ["manual", "confirmed", "autonomous"], "Pro = all modes");
assert.equal(getFeatures("personal").fleetView, false, "Personal has no fleet view");
assert.equal(getFeatures("smb").fleetView, true, "Business tiers have fleet view");
assert.equal(getFeatures("pro").fleetView, false, "Pro (single-team) has no fleet view — tiers keep their limits");
t();

// 5 — unlicensed + Walk-Through entitled (Concierge buyer, trial over): Walk-Through stays; the PAID tabs lock;
// but the NAVIGABLE BASELINE (Dashboard · ARIA · Settings) stays open — a free floor is never a locked shell.
const conciergeExpired = { licensed: false, walkthroughEntitled: true, trialEndsAt: "2020-01-01T00:00:00.000Z" };
assert.equal(activePlan(conciergeExpired), "free", "Concierge buyer after the trial → the free floor");
const map = tabGateMap(conciergeExpired);
assert.equal(map[WALKTHROUGH_TAB], true, "Walk-Through stays (it was paid for)");
for (const tab of GATED_TABS) assert.equal(map[tab], false, `${tab} (paid) is locked at the free floor`);
for (const tab of ["dashboard", "aria", "settings"]) assert.equal(map[tab], true, `${tab} stays navigable at the free floor (baseline)`);
for (const tab of ALWAYS_OPEN_TABS) assert.equal(map[tab], true, `buy path ${tab} stays open`);
assert.deepEqual(buyPathTabs(), [...ALWAYS_OPEN_TABS], "the buy path is never locked");
t();

assert.equal(n, 5, "5 gating-free-floor groups");
console.log(`gating-free-floor test passed (${n} groups · free floor ⊊ paid Personal · licensed entry > unlicensed/expired · each paid tier keeps its set · unlicensed+entitled → Walk-Through only · buy path always open).`);
