// SENTINEL TRIAL GATING 2026-07-02 — the per-tab enable/lock map. After the 30-day trial expires with NO paid
// plan but the Walk-Through entitlement, the Walk-Through tab STAYS enabled and every other tab locks; the buy
// path (Settings → About/License/Subscribe + the plan picker) is NEVER locked. Paid plan / active trial → all on.
import assert from "node:assert/strict";
import {
  tabGateMap, isTabLocked, appUnlocked, buyPathTabs, GATED_TABS, ALWAYS_OPEN_TABS, WALKTHROUGH_TAB, LOCKED_TAB_MESSAGE
} from "../src/shared/tab-gating.mjs";

let n = 0; const t = () => { n++; };

// 1 — STATE 2: expired trial + no paid plan + walkthroughEntitled → Walk-Through ENABLED, all others LOCKED.
const expiredEntitled = { licensed: false, plan: null, trial: { state: "expired" }, walkthroughEntitled: true };
const map2 = tabGateMap(expiredEntitled);
assert.equal(map2[WALKTHROUGH_TAB], true, "Walk-Through survives trial expiry (entitled)");
for (const tab of GATED_TABS) assert.equal(map2[tab], false, `${tab} locks after expiry with no paid plan`);
assert.equal(appUnlocked(expiredEntitled), false, "the rest of the app is locked in state 2");
t();

// 2 — the BUY PATH is never locked: Settings stays open so the user can always subscribe out of the lock.
for (const tab of ALWAYS_OPEN_TABS) {
  assert.equal(map2[tab], true, `${tab} (buy path) is never locked`);
  assert.equal(isTabLocked(tab, expiredEntitled), false, `${tab} never reports locked`);
}
assert.deepEqual(buyPathTabs(), ["settings"], "the buy path is Settings (About/License/Subscribe live there)");
assert.ok(!GATED_TABS.includes("settings"), "Settings is never in the gated set");
t();

// 3 — STATE 3: a paid Sentinel plan → EVERY tab enabled (walkthrough + all gated + settings).
for (const plan of ["pro", "smb", "midsize", "enterprise", "admin"]) {
  const paid = { licensed: true, plan };
  const map = tabGateMap(paid);
  assert.equal(map[WALKTHROUGH_TAB], true, `${plan}: Walk-Through enabled`);
  for (const tab of GATED_TABS) assert.equal(map[tab], true, `${plan}: ${tab} enabled`);
  assert.equal(appUnlocked(paid), true, `${plan}: app unlocked`);
}
t();

// 4 — STATE 1: an active trial (→ Pro) → every tab enabled.
const trial = { licensed: false, plan: null, trial: { state: "active" } };
const map1 = tabGateMap(trial);
assert.equal(map1[WALKTHROUGH_TAB], true, "active trial: Walk-Through enabled");
for (const tab of GATED_TABS) assert.equal(map1[tab], true, `active trial: ${tab} enabled`);
assert.equal(appUnlocked(trial), true, "active trial unlocks the app");
t();

// 5 — a PLAIN expired trial (no entitlement) → Walk-Through ALSO locked (nothing paid for it); buy path open.
const plainExpired = { licensed: false, plan: null, trial: { state: "expired" } };
const map5 = tabGateMap(plainExpired);
assert.equal(map5[WALKTHROUGH_TAB], false, "no entitlement → Walk-Through locked too");
for (const tab of GATED_TABS) assert.equal(map5[tab], false, `${tab} locked`);
assert.equal(map5.settings, true, "buy path still open even with no entitlement");
t();

// 6 — the locked-tab copy is honest: names the real 30-day trial + offers the buy path AND keeping the Walk-Through.
assert.match(LOCKED_TAB_MESSAGE, /30-day ARIA Sentinel trial/i, "honest: names the real 30-day trial");
assert.match(LOCKED_TAB_MESSAGE, /subscribe/i, "offers the subscribe path");
assert.match(LOCKED_TAB_MESSAGE, /Walk-Through/i, "offers keeping the Walk-Through");
assert.ok(!/you're all set|guaranteed|act now|expires in/i.test(LOCKED_TAB_MESSAGE), "no fabricated urgency / fake reassurance");
t();

assert.equal(n, 6, "6 tab-gating groups");
console.log(`tab-gating-post-trial test passed (${n} groups · Walk-Through survives expiry · others lock · buy path always open · paid/trial unlock all · honest copy).`);
