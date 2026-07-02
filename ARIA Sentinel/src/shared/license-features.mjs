// RUN 23e — runtime bridge between a stored license and the tier feature gates in pricing-tiers.mjs.
// The 64-hex license KEY itself determines the plan: a key is HMAC_SHA256(SENTINEL_LICENSE_SECRET,
// "sentinel-license:v1:<plan>"). resolvePlanFromKey() recomputes that HMAC for each known plan and
// timing-safe-compares — so the admin tier unlocks ONLY for the exact admin key (a non-admin key can
// never forge it without the secret). Key VALUES are never embedded in code; only the algorithm + the
// plan names are. 🔒 R11 — never touches a filesystem path.
//
// 🔒 RUN 24 A6 — SECRET BOUNDARY: issuePlanKey / resolvePlanFromKey / verifyLicenseStatus require
// SENTINEL_LICENSE_SECRET and are therefore SERVER-SIDE ONLY (the Stripe webhook, sentinel-licenses, and
// sentinel-resolve netlify functions). The desktop NEVER imports them and NEVER holds the secret — baking
// it into the .exe is extractable, so anyone could mint admin keys. The desktop instead POSTs the pasted
// key to /.netlify/functions/sentinel-resolve and caches the returned { plan, status } (see
// src/main/license-cache.mjs). keyHash() is the one helper here that is safe on the client (no secret).
import crypto from "node:crypto";
import { PLAN_ORDER, normalizePlan, getFeatures, getTier, isAdmin } from "./pricing-tiers.mjs";

// RUN 23e (Ahmad 2026-06-22) — an ACTIVE trial demos the paid modes, so it unlocks the Pro tier.
// An EXPIRED trial / no license falls back to the free Personal (Manual-only) tier — never Pro, never admin.
export const TRIAL_PLAN = "pro";
export const FREE_PLAN = "personal";

/** Canonical signed message for a plan. Keep in lockstep with the key generator (issuePlanKey). */
export function licenseMessage(plan) {
  return `sentinel-license:v1:${normalizePlan(plan)}`;
}

/** Mint the license key for a plan (used by Cowork's key generator + the tests — NOT Ahmad's real keys). */
export function issuePlanKey(plan, secret) {
  return crypto.createHmac("sha256", String(secret || "")).update(licenseMessage(plan)).digest("hex");
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

/**
 * Resolve a pasted key to its plan by recomputing HMAC(secret, msg(plan)) for each known plan and
 * timing-safe-comparing. Returns the canonical plan name, or null when nothing matches (or no secret).
 * Fail-closed: an unrecognized key is NEVER admin.
 */
export function resolvePlanFromKey(key, secret) {
  const candidate = String(key || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(candidate) || !secret) return null;
  for (const plan of PLAN_ORDER) {
    if (timingSafeEqualHex(candidate, issuePlanKey(plan, secret))) return plan;
  }
  return null;
}

/**
 * The active plan for a license/gate status:
 *  - a valid license uses its stored (key-resolved) plan;
 *  - an ACTIVE trial unlocks TRIAL_PLAN (Pro — demos the paid modes);
 *  - an expired trial / no license falls back to FREE_PLAN (Personal / Manual).
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

// RUN 24 A1 — the SHA-256 of a key. The revocation check is keyed by this hash so the raw key is NEVER
// sent off-device (the server stores keyHash → revoked, not the key itself).
export function keyHash(key) {
  return crypto.createHash("sha256").update(String(key || "")).digest("hex");
}

/**
 * RUN 24 A1 — verify a pasted/stored key end-to-end: resolve its plan via HMAC, then (optionally) check
 * revocation. `fetchIsRevoked` is an async (keyHash) => boolean; it receives the HASH, never the key.
 *   - bad/forged key            → { plan: null, status: "invalid" }
 *   - authentic but revoked      → { plan: null, status: "revoked" }
 *   - authentic + active         → { plan, status: "active" }
 * Fail-OPEN on a revocation-check error (offline / server down): an authentic key keeps working so a
 * network blip never locks a paying customer out. Revocation only takes effect when the server answers
 * affirmatively. Never returns admin for a non-admin key (resolvePlanFromKey is fail-closed).
 */
export async function verifyLicenseStatus(key, secret, fetchIsRevoked) {
  const plan = resolvePlanFromKey(key, secret);
  if (!plan) return { plan: null, status: "invalid" };
  if (typeof fetchIsRevoked === "function") {
    try {
      if (await fetchIsRevoked(keyHash(key))) return { plan: null, status: "revoked" };
    } catch {
      // offline / server error → fail-open (treat as active); revocation re-checks on the next refresh.
    }
  }
  return { plan, status: "active" };
}
