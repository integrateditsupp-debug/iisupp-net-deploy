// SENTINEL TRIAL GATING 2026-07-02 — pure per-tab enable/lock decision core for the 30-day-trial model.
// Shared by the renderer (applies the classes) AND the tests (assert the matrix without a DOM). PURE: no
// node/electron imports. 🔒 R11 — describes tab availability only; never a filesystem path.
//
// The three states (packet SENTINEL-TRIAL-GATING-WALKTHROUGH-ENTITLEMENT):
//   1. active trial       → activePlan = Pro   → every tab enabled.
//   2. trial expired, no paid plan, Walk-Through entitled (Concierge buyer) → ONLY Walk-Through enabled;
//      the other tabs lock behind an honest upsell; the buy path (Settings) stays open.
//   3. paid Sentinel plan → every tab enabled again.
import { activePlan, isWalkthroughEntitled, FREE_PLAN } from "./license-features.mjs";

// The Walk-Through tab survives trial expiry (it was paid for in the Concierge package).
export const WALKTHROUGH_TAB = "walkthrough";
// Settings hosts About / License / Subscribe + the plan picker — the buy path must ALWAYS stay reachable so
// a user can subscribe out of a locked state. Never locked.
export const ALWAYS_OPEN_TABS = Object.freeze(["settings"]);
// Every other nav tab follows the plan gate: after expiry with no paid plan the plan is FREE_PLAN → these lock.
export const GATED_TABS = Object.freeze([
  "dashboard", "aria", "control-center", "recipes", "compliance-privacy",
  "reports", "knowledge", "system", "servicenow"
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
 *   - Walk-Through tab: enabled iff isWalkthroughEntitled(status) (active trial · paid plan · Concierge grant).
 *   - Settings (buy path): ALWAYS enabled.
 *   - every other tab: enabled iff appUnlocked(status).
 * Returns { <tab>: boolean, ... }.
 */
export function tabGateMap(licenseStatus = {}) {
  const unlocked = appUnlocked(licenseStatus);
  const map = { [WALKTHROUGH_TAB]: isWalkthroughEntitled(licenseStatus) };
  for (const tab of ALWAYS_OPEN_TABS) map[tab] = true;
  for (const tab of GATED_TABS) map[tab] = unlocked;
  return map;
}

/** True when `tab` is locked for this status. Unknown tabs are treated as open (never over-lock the UI). */
export function isTabLocked(tab, licenseStatus = {}) {
  return tabGateMap(licenseStatus)[tab] === false;
}

/** The buy path (Settings → About/License/Subscribe + the plan picker) is NEVER locked. */
export function buyPathTabs() {
  return [...ALWAYS_OPEN_TABS];
}
