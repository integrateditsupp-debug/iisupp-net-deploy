// RUN 24 A6b — desktop license cache (pure decision core for ~/.aria-sentinel/license-cache.json).
// The desktop never holds SENTINEL_LICENSE_SECRET: it asks sentinel-resolve for { plan, status } and caches
// the verdict so it keeps working offline. This module owns the staleness policy; main.mjs does the fetch +
// file I/O. 🔒 R11 — the cache stores only a key HASH + plan + timestamps (no raw key, no paths, no PII).
//
// REVIEW P1-3 (2026-10-14) — the cache is no longer believed because it exists. The review wrote
// { key_sha256, plan:"admin", status:"active", verified_at:"2099-…" } by hand next to a license.json holding any
// 64-hex string: the cache was "fresh" (the network re-check was skipped) and the admin tier unlocked. A cached
// verdict now counts only when
//   (a) it is SIGNED: `sig` verifies (Ed25519, the embedded sentinel-resolve public key) over the stored `verdict`,
//       `verdict.device` is THIS device's hash and `verdict.key_sha256` is the stored key hash — then the plan comes
//       from the signed verdict alone (24 h fresh / 72 h stale tiers, as before); or
//   (b) it is UNSIGNED (the server's signing key is unconfigured, or it withheld the signature): it counts for at most
//       1 hour, never grants the admin tier, and only in the run that received it — a later launch re-checks it with
//       the server before it counts again (an unsigned verdict read back from disk is a claim, not an answer).
// A `verified_at` in the future is refused (an edited file or a clock rolled back). Writes keep `verdict` + `sig`
// VERBATIM (the signed bytes are re-derived from them). The age of a verdict is measured against the monotonic
// last-seen high-water mark too, so a rolled-back clock cannot make an old verdict look young.
import { keyHash } from "../shared/license-features.mjs";
import { isAdmin } from "../shared/pricing-tiers.mjs";
import { verifyResolveSignature } from "../shared/sentinel-resolve-pubkey.mjs";

// 2026-07-02 — the fail-closed degrade target is the FREE FLOOR (not paid "personal"): a no-cache / revoked /
// hard-stale user drops to a genuine free tier (strictly below paid Personal), never inheriting paid features.
export const FREE_PLAN = "free";
export const CACHE_FRESH_MS = 24 * 60 * 60 * 1000; // ≤24h: trust the cached plan, no network needed.
export const CACHE_HARD_MS = 72 * 60 * 60 * 1000;  // 24–72h: keep plan but nudge; >72h: degrade to the free floor.
export const UNSIGNED_MAX_MS = 60 * 60 * 1000;      // REVIEW P1-3 — an unsigned verdict counts for at most 1 hour.
export const CLOCK_SKEW_MS = 5 * 60 * 1000;         // REVIEW P1-3 — tolerated clock difference before "in the future".
export const VERDICT_STATUSES = Object.freeze(["active", "revoked", "expired", "past_due"]);

const isObj = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const msOf = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const t = Date.parse(String(v == null ? "" : v));
  return Number.isFinite(t) ? t : NaN;
};
const isoOrNull = (v) => { const t = msOf(v); return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : null; };

// One verification per distinct (verdict, sig): licenseStatus() runs on every state broadcast.
let lastVerify = { verify: null, payload: "", sig: "", ok: false };
function verifiedBy(verify, verdict, sig) {
  const payload = JSON.stringify(verdict);
  if (lastVerify.verify === verify && lastVerify.payload === payload && lastVerify.sig === sig) return lastVerify.ok;
  let ok = false;
  try { ok = verify(verdict, sig) === true; } catch { ok = false; }
  lastVerify = { verify, payload, sig, ok };
  return ok;
}
const defaultVerify = (verdict, sig) => verifyResolveSignature(verdict, sig);

/**
 * Build the cache record from a sentinel-resolve answer. `verdict` and `sig` are stored VERBATIM (a signed cache
 * trusts nothing else); the top-level plan/status are the unsigned convenience copy the shipped 0.2.0 shape had.
 * `resolve.signing` ("unconfigured" | "withheld") says why an answer is unsigned.
 */
export function buildCache(key, resolve = {}, nowMs = Date.now()) {
  const verdict = isObj(resolve.verdict) ? resolve.verdict : null;
  const sig = verdict && typeof resolve.sig === "string" ? resolve.sig : null;
  const at = new Date(nowMs).toISOString();
  return {
    key_sha256: keyHash(key),
    verdict,
    sig,
    signing: sig ? "signed" : String(resolve.signing || "absent").slice(0, 20),
    plan: resolve.plan || null,
    status: resolve.status || "active",
    // SENTINEL TRIAL GATING 2026-07-02 — the server-authoritative Walk-Through entitlement + the real 30-day
    // trial end (Concierge buyers). Cached so the Walk-Through tab survives offline; no secret, no raw key.
    // (REVIEW P1-3: honoured only alongside a verdict that is trusted — they sit outside the signed payload.)
    walkthroughEntitled: Boolean(resolve.walkthroughEntitled),
    trialEndsAt: resolve.trialEndsAt || null,
    // REVIEW P1-3 — the server's first sight of this device (the trial anchor); can only make the trial start earlier.
    trialStartedAt: isoOrNull(resolve.trialStartedAt),
    verified_at: at,
    expires_at: new Date(nowMs + (sig ? CACHE_FRESH_MS : UNSIGNED_MAX_MS)).toISOString(),
    last_seen: at
  };
}

/** True when the cache belongs to this key (hash match) — a different pasted key always re-verifies. */
export function cacheMatchesKey(cache, key) {
  return Boolean(cache && cache.key_sha256 && cache.key_sha256 === keyHash(key));
}

/**
 * REVIEW P1-3 — the identity of an UNSIGNED answer, so main can trust exactly the one it received in this run (and
 * not a look-alike written to disk). Covers every field an unsigned verdict grants anything with.
 */
export function unsignedFingerprint(cache) {
  if (!isObj(cache)) return "";
  return JSON.stringify([cache.key_sha256 || "", cache.plan || "", cache.status || "", cache.verified_at || "", Boolean(cache.walkthroughEntitled), cache.trialEndsAt || null]);
}

/**
 * REVIEW P1-3 — does the cache carry a signed verdict that is trustworthy HERE? { ok, reason }:
 * "unsigned" (no verdict/sig) · "bad-signature" · "other-device" · "other-key". `verify(verdict, sig)` is the test seam
 * (default: the embedded production public key); `deviceHash` is this device's X-Sentinel-Device value.
 */
export function signedVerdictCheck(cache, { deviceHash = "", verify = defaultVerify } = {}) {
  if (!isObj(cache) || !isObj(cache.verdict) || typeof cache.sig !== "string" || !cache.sig) return { ok: false, reason: "unsigned" };
  const v = cache.verdict;
  if (!verifiedBy(typeof verify === "function" ? verify : defaultVerify, v, cache.sig)) return { ok: false, reason: "bad-signature" };
  if (!deviceHash || typeof v.device !== "string" || v.device !== String(deviceHash)) return { ok: false, reason: "other-device" };
  if (!cache.key_sha256 || v.key_sha256 !== cache.key_sha256) return { ok: false, reason: "other-key" };
  return { ok: true, reason: "signed" };
}

const UNVERIFIED_MESSAGE = {
  "bad-signature": "License could not be verified — this answer was not signed by the licence server. Connect to restore your tier.",
  "other-device": "License not verified on this device yet — connect to restore your tier.",
  "other-key": "License not verified for this key yet — connect to restore your tier.",
  future: "License check refused: this device's clock is behind the licence server's. Set the correct date and time, then reconnect.",
  "bad-time": "License unverified — connect to restore your tier.",
  "unsigned-recheck": "License not verified yet — ARIA re-checks it with the licence server before it counts.",
  "unsigned-expired": "License unverified — connect to restore your tier.",
  "unsigned-admin": "Admin access needs a signed answer from the licence server — nothing admin-level is unlocked.",
  "unknown-status": "License unverified — connect to restore your tier."
};

/**
 * Effective plan + UI signal from the cache alone (no network), per the offline policy:
 *   - no cache                       → free floor, action "personal" (fail-closed)
 *   - a cache that is not trustworthy (bad signature · another device/key · verified_at in the future · an unsigned
 *     verdict this run did not receive · an unsigned verdict older than 1 h · an unsigned admin claim)
 *                                    → free floor, action "banner" (reason says which)
 *   - revoked / expired / past_due   → free floor, action "banner" (a non-active status never grants the plan)
 *   - fresh (≤24h, signed)           → the SIGNED plan, action "use"   (an unsigned verdict: ≤1 h, never admin)
 *   - stale (24–72h, signed)         → the signed plan, action "toast" ("Reconnect to verify license")
 *   - hard-stale (>72h)              → free floor, action "banner"
 * opts: { deviceHash, verify, highWaterMs, trustedUnsigned (an unsignedFingerprint) }.
 * Returns { plan, status, ageMs, action, message, walkthroughEntitled, trialEndsAt, signed, reason }.
 */
export function effectiveFromCache(cache, nowMs = Date.now(), opts = {}) {
  const o = isObj(opts) ? opts : {};
  const none = (extra = {}) => ({ plan: FREE_PLAN, status: "none", ageMs: Infinity, action: "personal", message: "",
    walkthroughEntitled: false, trialEndsAt: null, signed: false, reason: "no-cache", ...extra });
  if (!isObj(cache) || (!cache.plan && !isObj(cache.verdict))) return none();
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const hw = Number(o.highWaterMs);
  const effNow = Math.max(now, Number.isFinite(hw) ? hw : 0); // a rolled-back clock cannot make a verdict younger
  const refuse = (reason, status = "unverified") => none({ status, action: "banner", message: UNVERIFIED_MESSAGE[reason] || UNVERIFIED_MESSAGE["bad-time"], reason });

  const check = signedVerdictCheck(cache, o);
  if (!check.ok && check.reason !== "unsigned") return refuse(check.reason); // a verdict that does not verify = no verdict
  const signed = check.ok;
  const src = signed ? cache.verdict : cache;
  const verifiedMs = msOf(src.verified_at);
  if (!Number.isFinite(verifiedMs)) return refuse("bad-time");
  if (verifiedMs > now + CLOCK_SKEW_MS) return refuse("future");
  const ageMs = Math.max(0, effNow - verifiedMs);

  if (!signed) {
    // (b) unsigned: only the answer THIS run received, for ≤1 h, never admin — anything else is re-checked first.
    if (!o.trustedUnsigned || o.trustedUnsigned !== unsignedFingerprint(cache)) return refuse("unsigned-recheck");
    if (ageMs > UNSIGNED_MAX_MS) return refuse("unsigned-expired");
  }
  // SENTINEL TRIAL GATING 2026-07-02 — the Walk-Through entitlement is PERMANENT (paid for in the Concierge
  // package), so echo it through every branch of a TRUSTED verdict, even when the Sentinel plan degrades offline.
  const extras = { walkthroughEntitled: Boolean(cache.walkthroughEntitled), trialEndsAt: cache.trialEndsAt || null, signed, reason: signed ? "signed" : "unsigned" };
  const status = String(src.status || "");
  if (status === "revoked") return { plan: FREE_PLAN, status: "revoked", ageMs, action: "banner", message: "License revoked — contact support to restore access.", ...extras };
  if (status === "expired") return { plan: FREE_PLAN, status: "expired", ageMs, action: "banner", message: "License expired — renew to restore your plan.", ...extras };
  if (status === "past_due") return { plan: FREE_PLAN, status: "past_due", ageMs, action: "banner", message: "Payment overdue — update your billing to restore your plan.", ...extras };
  if (status !== "active") return { plan: FREE_PLAN, status: "unverified", ageMs, action: "banner", message: UNVERIFIED_MESSAGE["unknown-status"], ...extras, reason: "unknown-status" };
  // A key with its own end date (a trial key) stops at that date even inside the 24 h window.
  const keyEndsMs = signed ? msOf(src.expires_at) : NaN;
  if (Number.isFinite(keyEndsMs) && effNow >= keyEndsMs) return { plan: FREE_PLAN, status: "expired", ageMs, action: "banner", message: "License expired — renew to restore your plan.", ...extras };
  const plan = src.plan || FREE_PLAN;
  if (!signed && isAdmin(plan)) return { ...refuse("unsigned-admin"), walkthroughEntitled: extras.walkthroughEntitled, trialEndsAt: extras.trialEndsAt, reason: "unsigned-admin" };
  if (ageMs <= CACHE_FRESH_MS) return { plan, status: "active", ageMs, action: "use", message: "", ...extras };
  if (ageMs <= CACHE_HARD_MS) return { plan, status: "stale", ageMs, action: "toast", message: "Reconnect to verify license.", ...extras };
  return { plan: FREE_PLAN, status: "unverified", ageMs, action: "banner", message: "License unverified — connect to restore your tier.", ...extras };
}

/**
 * True when a cache is fresh enough that a silent launch can skip the network re-verify: ONLY a trustworthy SIGNED,
 * active verdict ≤24 h old. An unsigned cache is never fresh (it is re-checked at every launch).
 */
export function cacheIsFresh(cache, nowMs = Date.now(), opts = {}) {
  const r = effectiveFromCache(cache, nowMs, { ...(isObj(opts) ? opts : {}), trustedUnsigned: "" });
  return r.signed === true && r.action === "use" && r.status === "active";
}

/** REVIEW P1-3 — the monotonic last-seen high-water mark: the latest valid time among the inputs (ms; 0 when none). */
export function highWaterOf(...values) {
  let best = 0;
  for (const v of values.flat()) { const t = msOf(v); if (Number.isFinite(t) && t > best) best = t; }
  return best;
}
