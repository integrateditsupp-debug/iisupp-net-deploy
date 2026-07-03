// PURE plan/feature logic — the part of the license system the RENDERER (and tab-gating) needs. 2026-07-02
// P0 DEAD-SHELL FIX: this module deliberately has NO `node:crypto` import. It was extracted out of
// license-features.mjs because that file imports node:crypto (for the server-side key HMAC), and the renderer's
// CSP (`script-src 'self'`) BLOCKS loading node:crypto in the browser — which made license-features.mjs (and
// therefore tab-gating.mjs → renderer.js) fail to load, bricking every click in the main window. Keeping the
// pure plan logic crypto-free lets the renderer import it safely. Node-side callers re-export these from
// license-features.mjs unchanged. 🔒 R11 — never touches a filesystem path.
import { normalizePlan, getFeatures, getTier, isAdmin } from "./pricing-tiers.mjs";

// RUN 23e (Ahmad 2026-06-22) — an ACTIVE trial demos the paid modes, so it unlocks the Pro tier. An EXPIRED
// trial / no license falls back to the FREE FLOOR — a genuine free tier whose feature set is STRICTLY a subset
// of the lowest PAID tier (Personal), so buying Personal is a real upgrade. Never admin.
export const TRIAL_PLAN = "pro";
export const FREE_PLAN = "free";

/**
 * The active plan for a license/gate status:
 *  - a valid license uses its stored (key-resolved) plan;
 *  - an ACTIVE trial unlocks TRIAL_PLAN (Pro — demos the paid modes);
 *  - an expired trial / no license falls back to FREE_PLAN (the free floor).
 * Never returns admin unless the stored plan is genuinely admin. Accepts the gate shape
 * ({licensed, plan, trial:{state}}) or a bare {licensed, plan, trialState}.
 */
export function activePlan(licenseStatus = {}) {
  if (licenseStatus && licenseStatus.licensed) return normalizePlan(licenseStatus.plan);
  const trialState = (licenseStatus && licenseStatus.trial && licenseStatus.trial.state) || (licenseStatus && licenseStatus.trialState);
  if (trialState === "active") return TRIAL_PLAN;
  return FREE_PLAN;
}

/** The feature object for the active plan — the single thing the whole app gates on. */
export function enabledFeatures(licenseStatus = {}) {
  return getFeatures(activePlan(licenseStatus));
}

/** Convenience: the full tier record (label/price/seats/features) for the active plan. */
export function activeTier(licenseStatus = {}) {
  return getTier(activePlan(licenseStatus));
}

/** Admin gate for a license status — admin console + OTA publish. Fail-closed for every client tier. */
export function licenseIsAdmin(licenseStatus = {}) {
  return Boolean(licenseStatus && licenseStatus.licensed) && isAdmin(activePlan(licenseStatus));
}

/**
 * Walk-Through entitlement — INDEPENDENT of the Sentinel plan. The AI Setup Walk-Through package (Concierge
 * purchase) grants a permanent Walk-Through: even at FREE_PLAN / expired-trial, walkthroughEntitled === true
 * keeps the Walk-Through tab usable. A paid plan (or an active trial → Pro) that already lists the walkthrough
 * feature also passes — so a Sentinel subscriber never loses the tab. Server-authoritative: the flag is set
 * by sentinel-resolve / the Stripe webhook on a real Concierge order (never assumed client-side). Pure.
 */
export function isWalkthroughEntitled(licenseStatus = {}) {
  if (licenseStatus && licenseStatus.walkthroughEntitled === true) return true;
  return getFeatures(activePlan(licenseStatus)).walkthrough === true;
}
