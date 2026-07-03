// P1 DEAD-SHELL REGRESSION (2026-07-02) — the app must NEVER be a locked shell. Across EVERY license/gate
// state, a navigable baseline (Dashboard · ARIA · Settings, plus Walk-Through when entitled) is ALWAYS unlocked,
// while paid-only gating still holds. This locks the fix for the batch-7abc555 bug where an expired-trial,
// unlicensed machine had every tab (incl. Settings) locked. Pure — no DOM, no I/O.
import assert from "node:assert/strict";
import { tabGateMap, navigableTabs, appUnlocked, BASELINE_TABS, GATED_TABS, WALKTHROUGH_TAB } from "../src/shared/tab-gating.mjs";
import { isWalkthroughEntitled } from "../src/shared/license-features.mjs";
let n = 0; const t = () => { n++; };

const BASELINE = ["dashboard", "aria", "settings"];

// The seven states the packet enumerates. `paidUnlocked` = should the paid tabs be reachable.
const STATES = [
  { name: "active-trial",       gate: { licensed: false, trial: { state: "active" } },                                  paidUnlocked: true  },
  { name: "expired+entitled",   gate: { licensed: false, trial: { state: "expired" }, walkthroughEntitled: true },      paidUnlocked: false },
  { name: "expired+unentitled", gate: { licensed: false, trial: { state: "expired" } },                                 paidUnlocked: false }, // ← the dead-shell state
  { name: "not-started",        gate: { licensed: false, trial: { state: "not-started" } },                             paidUnlocked: false },
  { name: "licensed-personal",  gate: { licensed: true, plan: "personal" },                                             paidUnlocked: true  },
  { name: "licensed-pro",       gate: { licensed: true, plan: "pro" },                                                  paidUnlocked: true  },
  { name: "admin",              gate: { licensed: true, plan: "admin" },                                                paidUnlocked: true  }
];

// 1 — the navigable baseline is defined and is exactly Dashboard · ARIA · Settings.
assert.deepEqual([...BASELINE_TABS].sort(), [...BASELINE].sort(), "baseline = Dashboard · ARIA · Settings");
assert.ok(!GATED_TABS.includes("dashboard") && !GATED_TABS.includes("aria") && !GATED_TABS.includes("settings"),
  "the baseline tabs are NOT in the paid-gated set");
t();

// 2 — in EVERY state the baseline is navigable (the core un-brick guarantee).
for (const s of STATES) {
  const map = tabGateMap(s.gate);
  for (const tab of BASELINE) assert.equal(map[tab], true, `${s.name}: ${tab} is navigable (never a locked shell)`);
  const nav = navigableTabs(s.gate);
  for (const tab of BASELINE) assert.ok(nav.includes(tab), `${s.name}: ${tab} in navigableTabs`);
  assert.ok(nav.length >= 3, `${s.name}: at least the 3 baseline tabs are navigable`);
}
t();

// 3 — paid-only gating still holds: paid tabs follow the plan (locked at the free floor, open on trial/paid).
for (const s of STATES) {
  const map = tabGateMap(s.gate);
  for (const tab of GATED_TABS) assert.equal(map[tab], s.paidUnlocked, `${s.name}: paid tab ${tab} = ${s.paidUnlocked}`);
  assert.equal(appUnlocked(s.gate), s.paidUnlocked, `${s.name}: appUnlocked = ${s.paidUnlocked}`);
}
t();

// 4 — Walk-Through follows entitlement (active trial · paid-with-feature · Concierge flag), never the shell lock.
assert.equal(tabGateMap(STATES[0].gate)[WALKTHROUGH_TAB], true, "active trial → Walk-Through");
assert.equal(tabGateMap(STATES[1].gate)[WALKTHROUGH_TAB], true, "expired + Concierge entitlement → Walk-Through");
assert.equal(tabGateMap(STATES[2].gate)[WALKTHROUGH_TAB], false, "expired + unentitled → no Walk-Through (but baseline still navigable)");
assert.equal(tabGateMap(STATES[5].gate)[WALKTHROUGH_TAB], true, "Pro → Walk-Through (plan feature)");
assert.equal(isWalkthroughEntitled(STATES[4].gate), false, "plain paid Personal (no flag) → not Walk-Through entitled");
t();

// 5 — THE dead-shell state specifically: expired trial + unlicensed + unentitled still has a usable app.
const dead = STATES[2].gate;
const deadMap = tabGateMap(dead);
assert.equal(deadMap.dashboard, true, "dead-shell state: Dashboard navigable");
assert.equal(deadMap.aria, true, "dead-shell state: ARIA (KB chat) navigable");
assert.equal(deadMap.settings, true, "dead-shell state: Settings (buy path) navigable — the exact bug that bricked the app");
t();

assert.equal(n, 5, "5 nav-baseline groups");
console.log(`nav-baseline-navigable test passed (${n} groups · Dashboard/ARIA/Settings navigable in ALL 7 states · paid gating still holds · Walk-Through by entitlement · the expired-unlicensed dead-shell is now usable).`);
