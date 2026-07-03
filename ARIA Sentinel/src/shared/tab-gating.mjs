// SENTINEL TRIAL GATING 2026-07-02 — pure per-tab enable/lock decision core for the 30-day-trial model.
// Shared by the renderer (applies the classes) AND the tests (assert the matrix without a DOM). PURE: no
// node/electron imports. 🔒 R11 — describes tab availability only; never a filesystem path.
//
// The three states (packet SENTINEL-TRIAL-GATING-WALKTHROUGH-ENTITLEMENT):
//   1. active trial       → activePlan = Pro   → every tab enabled.
//   2. trial expired, no paid plan, Walk-Through entitled (Concierge buyer) → ONLY Walk-Through enabled;
//      the other tabs lock behind an honest upsell; the buy path (Settings) stays open.
//   3. paid Sentinel plan → every tab enabled again.
// 2026-07-02 P0 DEAD-SHELL FIX — import the PURE plan logic (crypto-free) so the renderer graph never pulls
// node:crypto (its CSP blocks it, which bricked every click). license-features.mjs re-exports these node-side.
import { activePlan, isWalkthroughEntitled, FREE_PLAN } from "./license-plan.mjs";

// The Walk-Through tab survives trial expiry (it was paid for in the Concierge package).
export const WALKTHROUGH_TAB = "walkthrough";
// 2026-07-02 DEAD-SHELL FIX — a free tier must NEVER be a locked shell. These stay navigable at EVERY tier,
// including the free floor / expired trial: Dashboard (honest overview — no fake KPIs), ARIA (the KB chat, the
// core free value), and Settings (the buy path). Paid FEATURES inside them are still gated by
// enabledFeatures(activePlan) — we gate features, not the whole app. This is what un-bricks the app.
export const BASELINE_TABS = Object.freeze(["dashboard", "aria", "settings"]);
// Settings hosts About / License / Subscribe + the plan picker — the buy path must ALWAYS stay reachable so
// a user can subscribe out of a locked state. Never locked. (Subset of the baseline; kept for callers.)
export const ALWAYS_OPEN_TABS = Object.freeze(["settings"]);
// PAID tabs — gated by plan: locked at the free floor (expired trial + no paid plan), unlocked on an active
// trial or any paid plan. A locked click shows a DISMISSIBLE upsell (never a wall); the baseline stays usable.
export const GATED_TABS = Object.freeze([
  "control-center", "recipes", "compliance-privacy",
  "reports", "knowledge", "system", "integrations"
]);

// Honest locked-tab copy (Rule 14 — no fabricated urgency; real days-left is filled in by the renderer).
export const LOCKED_TAB_MESSAGE =
  "Your 30-day ARIA Sentinel trial has ended. Subscribe to a Sentinel plan to unlock monitoring, auto-fix, " +
  "and the rest — or keep using your Walk-Through, it's yours.";

/**
 * Do the NON-Walk-Through tabs stay unlocked? True during an active trial (Pro) and on any paid plan above
 * the free Personal tier; false once the plan degrades to FREE_PLAN (expired trial + no paid plan). Mirrors
 * "every other tab follows enabledFeatures(activePlan(status))" — FREE_PLAN is the locked/free state.
 */
export function appUnlocked(licenseStatus = {}) {
  return activePlan(licenseStatus) !== FREE_PLAN;
}

/**
 * The per-tab enabled map for a license/gate status:
 *   - BASELINE tabs (Dashboard · ARIA · Settings): ALWAYS enabled — the app is never a locked shell.
 *   - Walk-Through tab: enabled iff isWalkthroughEntitled(status) (active trial · paid plan · Concierge grant).
 *   - PAID tabs: enabled iff appUnlocked(status).
 * Returns { <tab>: boolean, ... }.
 */
export function tabGateMap(licenseStatus = {}) {
  const unlocked = appUnlocked(licenseStatus);
  const map = { [WALKTHROUGH_TAB]: isWalkthroughEntitled(licenseStatus) };
  for (const tab of BASELINE_TABS) map[tab] = true;   // navigable at every tier — the un-brick guarantee
  for (const tab of GATED_TABS) map[tab] = unlocked;
  return map;
}

/** The tabs that are navigable in the given state (always ⊇ the baseline — the app is never a dead shell). */
export function navigableTabs(licenseStatus = {}) {
  const map = tabGateMap(licenseStatus);
  return Object.keys(map).filter((tab) => map[tab] === true);
}

/** True when `tab` is locked for this status. Unknown tabs are treated as open (never over-lock the UI). */
export function isTabLocked(tab, licenseStatus = {}) {
  return tabGateMap(licenseStatus)[tab] === false;
}

/** The buy path (Settings → About/License/Subscribe + the plan picker) is NEVER locked. */
export function buyPathTabs() {
  return [...ALWAYS_OPEN_TABS];
}
