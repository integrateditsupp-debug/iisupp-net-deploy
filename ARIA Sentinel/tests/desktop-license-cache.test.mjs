// RUN 24 A6b — desktop license cache: offline-tier degradation (24h fresh / 72h hard-stale) + revocation.
// The desktop never sees the secret; it caches sentinel-resolve's verdict and degrades gracefully offline.
import assert from "node:assert/strict";
import {
  buildCache, cacheIsFresh, cacheMatchesKey, effectiveFromCache, FREE_PLAN, CACHE_FRESH_MS, CACHE_HARD_MS
} from "../src/main/license-cache.mjs";
import { keyHash } from "../src/shared/license-features.mjs";

const KEY = "b".repeat(64);
const T0 = Date.parse("2026-06-22T18:00:00.000Z");
const H = 60 * 60 * 1000;
let n = 0; const t = () => { n++; };

// 1 — a fresh verify writes a cache: key HASH (never the raw key), plan, status, verified_at + expires_at.
const cache = buildCache(KEY, { plan: "pro", status: "active" }, T0);
assert.equal(cache.key_sha256, keyHash(KEY));
assert.ok(!JSON.stringify(cache).includes(KEY), "raw key never stored in the cache");
assert.equal(cache.plan, "pro");
assert.equal(cache.status, "active");
assert.equal(Date.parse(cache.expires_at) - Date.parse(cache.verified_at), CACHE_FRESH_MS, "expires_at = verified_at + 24h");
t();

// 2 — cached read within 24h → fresh → a silent launch can skip the network; effective plan is the cached tier.
assert.equal(cacheIsFresh(cache, T0 + 23 * H), true, "23h old → fresh, no network call");
let eff = effectiveFromCache(cache, T0 + 23 * H);
assert.equal(eff.plan, "pro");
assert.equal(eff.action, "use");
assert.equal(cacheMatchesKey(cache, KEY), true);
assert.equal(cacheMatchesKey(cache, "c".repeat(64)), false, "different key → re-verify");
t();

// 3 — stale 25h (24–72h) → keep the cached plan but toast "Reconnect to verify license".
assert.equal(cacheIsFresh(cache, T0 + 25 * H), false, "25h → not fresh (needs re-verify when online)");
eff = effectiveFromCache(cache, T0 + 25 * H);
assert.equal(eff.plan, "pro", "stale keeps the paid tier");
assert.equal(eff.action, "toast");
assert.match(eff.message, /reconnect/i);
t();

// 4 — hard-stale 73h (>72h) → degrade to Personal, show the unverified banner.
eff = effectiveFromCache(cache, T0 + 73 * H);
assert.equal(eff.plan, FREE_PLAN, "hard-stale degrades to Personal");
assert.equal(eff.action, "banner");
assert.match(eff.message, /unverified/i);
assert.ok((T0 + 73 * H) - Date.parse(cache.verified_at) > CACHE_HARD_MS, "past the 72h threshold");
t();

// 5 — no cache + no network → Personal (fail-closed). Also: a revoked verdict overrides freshness.
eff = effectiveFromCache(null, T0);
assert.equal(eff.plan, FREE_PLAN);
assert.equal(eff.action, "personal");
const revokedCache = buildCache(KEY, { plan: "pro", status: "revoked" }, T0);
eff = effectiveFromCache(revokedCache, T0 + 1 * H); // even 1h-fresh, revoked wins
assert.equal(eff.plan, FREE_PLAN, "revoked → Personal regardless of freshness");
assert.equal(eff.action, "banner");
assert.equal(cacheIsFresh(revokedCache, T0 + 1 * H), false, "a revoked cache is never 'fresh' for skip-network");
t();

assert.equal(n, 5, "5 cache test groups");
console.log(`Desktop-license-cache test passed (${n} groups · fresh/stale/hard-stale tiers · revoked override · key hashed not stored).`);
