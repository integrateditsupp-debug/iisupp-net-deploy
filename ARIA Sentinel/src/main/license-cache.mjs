// RUN 24 A6b — desktop license cache (pure decision core for ~/.aria-sentinel/license-cache.json).
// The desktop never holds SENTINEL_LICENSE_SECRET: it asks sentinel-resolve for { plan, status } and caches
// the verdict so it keeps working offline. This module owns the staleness policy; main.mjs does the fetch +
// file I/O. 🔒 R11 — the cache stores only a key HASH + plan + timestamps (no raw key, no paths, no PII).
import { keyHash } from "../shared/license-features.mjs";

export const FREE_PLAN = "personal";
export const CACHE_FRESH_MS = 24 * 60 * 60 * 1000; // ≤24h: trust the cached plan, no network needed.
export const CACHE_HARD_MS = 72 * 60 * 60 * 1000;  // 24–72h: keep plan but nudge; >72h: degrade to Personal.

/** Build the cache record from a successful sentinel-resolve response. `status` ∈ "active" | "revoked". */
export function buildCache(key, resolve = {}, nowMs = Date.now()) {
  return {
    key_sha256: keyHash(key),
    plan: resolve.plan || null,
    status: resolve.status || "active",
    verified_at: new Date(nowMs).toISOString(),
    expires_at: new Date(nowMs + CACHE_FRESH_MS).toISOString()
  };
}

/** True when a cache is fresh enough that a silent launch can skip the network re-verify. */
export function cacheIsFresh(cache, nowMs = Date.now()) {
  return Boolean(
    cache && cache.plan && cache.status === "active" &&
    (nowMs - Date.parse(cache.verified_at || 0)) <= CACHE_FRESH_MS
  );
}

/** True when the cache belongs to this key (hash match) — a different pasted key always re-verifies. */
export function cacheMatchesKey(cache, key) {
  return Boolean(cache && cache.key_sha256 && cache.key_sha256 === keyHash(key));
}

/**
 * Effective plan + UI signal from the cache alone (no network), per the offline policy:
 *   - revoked verdict      → Personal,  action "banner"  (revocation overrides freshness)
 *   - fresh (≤24h)         → cached plan, action "use"    (silent)
 *   - stale (24–72h)       → cached plan, action "toast"  ("Reconnect to verify license")
 *   - hard-stale (>72h)    → Personal,   action "banner"  ("License unverified — connect to restore your tier")
 *   - no cache             → Personal,   action "personal" (fail-closed)
 * Returns { plan, status, ageMs, action, message }.
 */
export function effectiveFromCache(cache, nowMs = Date.now()) {
  if (!cache || !cache.plan) {
    return { plan: FREE_PLAN, status: "none", ageMs: Infinity, action: "personal", message: "" };
  }
  if (cache.status === "revoked") {
    return { plan: FREE_PLAN, status: "revoked", ageMs: 0, action: "banner",
      message: "License revoked — contact support to restore access." };
  }
  const ageMs = nowMs - Date.parse(cache.verified_at || 0);
  if (ageMs <= CACHE_FRESH_MS) {
    return { plan: cache.plan, status: "active", ageMs, action: "use", message: "" };
  }
  if (ageMs <= CACHE_HARD_MS) {
    return { plan: cache.plan, status: "stale", ageMs, action: "toast",
      message: "Reconnect to verify license." };
  }
  return { plan: FREE_PLAN, status: "unverified", ageMs, action: "banner",
    message: "License unverified — connect to restore your tier." };
}
