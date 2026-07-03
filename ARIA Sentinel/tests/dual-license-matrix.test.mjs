// DUAL-LICENSE TEST PASS (2026-07-03) — proves, per license state (admin · pro · smb · personal · active
// trial · expired-trial free floor · expired-trial + Walk-Through entitlement), what each tier resolves to:
// the active plan, whether the paid surface is unlocked, admin, Walk-Through entitlement, the per-tab
// navigable/locked map, and the key feature gates. This is the machine-checked backbone of
// documents/product-engineering/SENTINEL-DUAL-LICENSE-TEST-MATRIX-2026-07-03.md. PURE — no DOM, no I/O.
import assert from "node:assert/strict";
import { activePlan, enabledFeatures, licenseIsAdmin, isWalkthroughEntitled, FREE_PLAN, TRIAL_PLAN } from "../src/shared/license-features.mjs";
import { tabGateMap, appUnlocked, GATED_TABS, BASELINE_TABS, WALKTHROUGH_TAB } from "../src/shared/tab-gating.mjs";

// The license states a real user can be in (admin/pro/personal/smb licensed, plus the 3 trial states).
export const STATES = {
  admin:           { licensed: true, plan: "admin" },
  pro:             { licensed: true, plan: "pro" },
  smb:             { licensed: true, plan: "smb" },
  personal:        { licensed: true, plan: "personal" },
  trialActive:     { licensed: false, trial: { state: "active" } },
  trialExpired:    { licensed: false, plan: null, trial: { state: "expired" } },
  trialExpiredEnt: { licensed: false, plan: null, trial: { state: "expired" }, walkthroughEntitled: true }
};

// Expected resolution per state. This IS the contract the matrix doc renders.
const EXPECT = {
  admin:           { plan: "admin",     unlocked: true,  admin: true,  walkthrough: true,  paidTabs: true,  walkTab: true  },
  pro:             { plan: "pro",       unlocked: true,  admin: false, walkthrough: true,  paidTabs: true,  walkTab: true  },
  smb:             { plan: "smb",       unlocked: true,  admin: false, walkthrough: true,  paidTabs: true,  walkTab: true  },
  personal:        { plan: "personal",  unlocked: true,  admin: false, walkthrough: false, paidTabs: true,  walkTab: false },
  trialActive:     { plan: TRIAL_PLAN,  unlocked: true,  admin: false, walkthrough: true,  paidTabs: true,  walkTab: true  },
  trialExpired:    { plan: FREE_PLAN,   unlocked: false, admin: false, walkthrough: false, paidTabs: false, walkTab: false },
  trialExpiredEnt: { plan: FREE_PLAN,   unlocked: false, admin: false, walkthrough: true,  paidTabs: false, walkTab: true  }
};

for (const [name, status] of Object.entries(STATES)) {
  const e = EXPECT[name];
  const map = tabGateMap(status);
  assert.equal(activePlan(status), e.plan, `${name}: activePlan → ${e.plan}`);
  assert.equal(appUnlocked(status), e.unlocked, `${name}: appUnlocked → ${e.unlocked}`);
  assert.equal(licenseIsAdmin(status), e.admin, `${name}: admin → ${e.admin}`);
  assert.equal(isWalkthroughEntitled(status), e.walkthrough, `${name}: walkthrough entitlement → ${e.walkthrough}`);
  assert.equal(map[WALKTHROUGH_TAB], e.walkTab, `${name}: Walk-Through tab → ${e.walkTab}`);
  for (const tab of GATED_TABS) assert.equal(map[tab], e.paidTabs, `${name}: paid tab ${tab} → ${e.paidTabs}`);
  // THE UN-BRICK GUARANTEE: the baseline (Dashboard · ARIA · Settings) is navigable in EVERY state — no dead shell.
  for (const tab of BASELINE_TABS) assert.equal(map[tab], true, `${name}: baseline ${tab} is ALWAYS navigable (never a locked shell)`);
}

// Free floor is a STRICT subset of the lowest paid tier (buying Personal is a real upgrade over the expired floor).
const free = enabledFeatures(STATES.trialExpired);
const personal = enabledFeatures(STATES.personal);
assert.equal(free.modes.length, 0, "free floor has no execution modes");
assert.equal(free.recipesCount, 0, "free floor has no recipes");
assert.ok(personal.modes.length >= 1 && personal.recipesCount > 0, "Personal (paid) unlocks modes + recipes over the free floor");

// Admin is the ONLY state with the admin console (fail-closed for every client tier).
for (const name of ["pro", "smb", "personal", "trialActive"]) {
  assert.equal(enabledFeatures(STATES[name]).adminConsole, false, `${name}: no admin console (fail-closed)`);
}
assert.equal(enabledFeatures(STATES.admin).adminConsole, true, "admin: admin console ON");

console.log(`dual-license-matrix test passed (${Object.keys(STATES).length} states · activePlan/unlock/admin/walkthrough/tab-map/feature gates · baseline always navigable · free ⊊ Personal · admin-only console).`);
