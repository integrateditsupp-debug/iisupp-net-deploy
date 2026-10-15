// RUN 24 A6b — desktop license cache: offline-tier degradation (24h fresh / 72h hard-stale) + revocation.
// The desktop never sees the secret; it caches sentinel-resolve's verdict and degrades gracefully offline.
//
// REVIEW P1-3 (2026-10-14) — expectations changed on purpose: a cached verdict is believed only when the server SIGNED it
// for this device + key (or, unsigned, for ≤1 h in the run that received it, never as admin). The 24 h / 72 h tiers are
// unchanged but now apply to a SIGNED verdict, so groups 2–5 sign theirs with a throwaway Ed25519 pair through the
// module's `verify` seam (the production key is embedded; its private half is never in the repo). The full P1-3 rules
// (forgeries, unsigned, device/key binding, clock) are in tests/license-verdict-trust.test.mjs.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  buildCache, cacheIsFresh, cacheMatchesKey, effectiveFromCache, FREE_PLAN, CACHE_FRESH_MS, CACHE_HARD_MS, UNSIGNED_MAX_MS
} from "../src/main/license-cache.mjs";
import { keyHash } from "../src/shared/license-features.mjs";
import { verdictPayload, verifyResolveSignature } from "../src/shared/sentinel-resolve-pubkey.mjs";

const KEY = "b".repeat(64);
const T0 = Date.parse("2026-06-22T18:00:00.000Z");
const H = 60 * 60 * 1000;
const DEVICE = "0123456789abcdef0123456789abcdef";
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const SPKI = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const verify = (v, s) => verifyResolveSignature(v, s, SPKI);
const OPTS = { deviceHash: DEVICE, verify };
/** What sentinel-resolve answers: the convenience fields + the signed verdict (contract order) + its signature. */
function answer(plan, status, at = T0) {
  const verdict = { key_sha256: keyHash(KEY), plan, status, seats: null, expires_at: null, verified_at: new Date(at).toISOString(), device: DEVICE };
  return { plan, status, verdict, sig: crypto.sign(null, Buffer.from(verdictPayload(verdict), "utf8"), privateKey).toString("base64url") };
}
let n = 0; const t = () => { n++; };

// 1 — a fresh verify writes a cache: key HASH (never the raw key), plan, status, verified_at + expires_at.
const cache = buildCache(KEY, answer("pro", "active"), T0);
assert.equal(cache.key_sha256, keyHash(KEY));
assert.ok(!JSON.stringify(cache).includes(KEY), "raw key never stored in the cache");
assert.equal(cache.plan, "pro");
assert.equal(cache.status, "active");
assert.equal(Date.parse(cache.expires_at) - Date.parse(cache.verified_at), CACHE_FRESH_MS, "expires_at = verified_at + 24h (signed)");
// REVIEW P1-3 — the verdict + signature are stored VERBATIM; an UNSIGNED answer is stamped to last 1 hour, not 24.
assert.deepEqual(cache.verdict, answer("pro", "active").verdict);
assert.equal(typeof cache.sig, "string");
const unsignedCache = buildCache(KEY, { plan: "pro", status: "active" }, T0);
assert.equal(unsignedCache.sig, null);
assert.equal(Date.parse(unsignedCache.expires_at) - Date.parse(unsignedCache.verified_at), UNSIGNED_MAX_MS, "unsigned: expires_at = verified_at + 1h");
t();

// 2 — cached read within 24h → fresh → a silent launch can skip the network; effective plan is the cached tier.
assert.equal(cacheIsFresh(cache, T0 + 23 * H, OPTS), true, "23h old → fresh, no network call");
let eff = effectiveFromCache(cache, T0 + 23 * H, OPTS);
assert.equal(eff.plan, "pro");
assert.equal(eff.action, "use");
assert.equal(cacheMatchesKey(cache, KEY), true);
assert.equal(cacheMatchesKey(cache, "c".repeat(64)), false, "different key → re-verify");
// REVIEW P1-3 — the same 23h-old cache WITHOUT a signature is never fresh (it is re-checked at every launch).
assert.equal(cacheIsFresh(unsignedCache, T0 + 23 * H, OPTS), false, "unsigned → never fresh");
t();

// 3 — stale 25h (24–72h) → keep the cached plan but toast "Reconnect to verify license".
assert.equal(cacheIsFresh(cache, T0 + 25 * H, OPTS), false, "25h → not fresh (needs re-verify when online)");
eff = effectiveFromCache(cache, T0 + 25 * H, OPTS);
assert.equal(eff.plan, "pro", "stale keeps the paid tier");
assert.equal(eff.action, "toast");
assert.match(eff.message, /reconnect/i);
t();

// 4 — hard-stale 73h (>72h) → degrade to Personal, show the unverified banner.
eff = effectiveFromCache(cache, T0 + 73 * H, OPTS);
assert.equal(eff.plan, FREE_PLAN, "hard-stale degrades to Personal");
assert.equal(eff.action, "banner");
assert.match(eff.message, /unverified/i);
assert.ok((T0 + 73 * H) - Date.parse(cache.verified_at) > CACHE_HARD_MS, "past the 72h threshold");
t();

// 5 — no cache + no network → Personal (fail-closed). Also: a revoked verdict overrides freshness.
eff = effectiveFromCache(null, T0);
assert.equal(eff.plan, FREE_PLAN);
assert.equal(eff.action, "personal");
const revokedCache = buildCache(KEY, answer("pro", "revoked"), T0);
eff = effectiveFromCache(revokedCache, T0 + 1 * H, OPTS); // even 1h-fresh, revoked wins
assert.equal(eff.plan, FREE_PLAN, "revoked → Personal regardless of freshness");
assert.equal(eff.action, "banner");
assert.equal(cacheIsFresh(revokedCache, T0 + 1 * H, OPTS), false, "a revoked cache is never 'fresh' for skip-network");
t();

assert.equal(n, 5, "5 cache test groups");
console.log(`Desktop-license-cache test passed (${n} groups · fresh/stale/hard-stale tiers on a signed verdict · unsigned = 1h, never fresh · revoked override · key hashed not stored).`);
