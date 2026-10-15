// sentinel-resolve-pubkey — the ONE public key the desktop uses to verify a signed sentinel-resolve verdict, and
// the canonical payload both ends sign / verify. SENTINEL REVIEW FIXES 2026-10-14 (P1-3, server half).
//
// Why: the desktop cached `{ key_sha256, plan, status, verified_at }` in ~/.aria-sentinel/license-cache.json and
// trusted it for 24 hours with no proof it came from the server — a hand-written cache unlocked admin. Now
// sentinel-resolve signs the verdict with Ed25519 (private key: Netlify env SENTINEL_RESOLVE_SIGNING_KEY, never in
// the repo, never on a device) and the desktop verifies it with the public key below before trusting it.
//
// THE CONTRACT (netlify/functions/sentinel-resolve.mjs builds it with verdictPayload() from THIS module, so the
// two ends cannot drift):
//   verdict = { key_sha256, plan, status, seats, expires_at, verified_at, device }   ← keys in EXACTLY this order
//     key_sha256  sha256 hex of the key as the desktop sent it
//     plan        the plan the key grants NOW ("pro" for a live trial key, "free" after it)
//     status      "active" | "revoked" | "expired" | "past_due"
//     seats       number | null          expires_at  ISO | null (a trial key's end)
//     verified_at ISO (server clock)     device      the X-Sentinel-Device header value, or ""
//   payload = JSON.stringify(verdict)                                  (UTF-8)
//   sig     = base64url( Ed25519.sign(payload) )                       (crypto.sign(null, Buffer.from(payload), key))
// A response WITHOUT `sig` is an UNSIGNED verdict — the server says why in `signing`: "unconfigured" (no signing key
// set) or "withheld" (the revocation store could not be read) — and the desktop must treat it as short-lived. A
// verdict whose payload does not verify must be treated as no verdict at all. Any status other than "active" does
// not grant the plan ("expired" already carries plan "free"; "past_due" and "revoked" still name the paid plan).
//
// 🔒 Main-process / Node only: this module imports node:crypto, which the renderer's CSP blocks — the renderer must
// never import it (license-plan.mjs stays the crypto-free half). It holds only a PUBLIC key; nothing here can sign.
// The embedded key must match the private key in SENTINEL_RESOLVE_SIGNING_KEY (docs/SENTINEL-BACKEND-2026-10-14.md
// "Review fixes" has the generator one-liner); rotating one without the other makes every verdict fail to verify.
import crypto from "node:crypto";

/** Ed25519 public key, SPKI DER, base64. Pairs with Netlify env SENTINEL_RESOLVE_SIGNING_KEY (PKCS#8 DER, base64). */
export const SENTINEL_RESOLVE_PUBKEY_SPKI_B64 = "MCowBQYDK2VwAyEABJ3c5Hwd7rykf6NHfGnwJslUjQJNKEKQxuZq2jmcP7g=";

/** The verdict fields, in the exact order they are serialised for signing. Frozen contract. */
export const VERDICT_KEYS = Object.freeze(["key_sha256", "plan", "status", "seats", "expires_at", "verified_at", "device"]);

/**
 * The exact signed byte string for a verdict: JSON.stringify of the seven contract fields in contract order.
 * Fields are copied as-is (no defaults): a verdict missing a field serialises differently and will not verify.
 */
export function verdictPayload(verdict) {
  const v = verdict && typeof verdict === "object" ? verdict : {};
  const ordered = {};
  for (const k of VERDICT_KEYS) ordered[k] = v[k];
  return JSON.stringify(ordered);
}

const keyCache = new Map();
function publicKeyFrom(b64) {
  const k = String(b64 || "");
  if (keyCache.has(k)) return keyCache.get(k);
  let key = null;
  try {
    key = crypto.createPublicKey({ key: Buffer.from(k, "base64"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519") key = null;
  } catch { key = null; }
  keyCache.set(k, key);
  return key;
}

/** The embedded public key as a KeyObject (null if it does not parse as Ed25519 — then nothing verifies). */
export function resolvePublicKey(spkiB64 = SENTINEL_RESOLVE_PUBKEY_SPKI_B64) {
  return publicKeyFrom(spkiB64);
}

/**
 * verifyResolveSignature(verdict, sig[, spkiB64]) → boolean. Never throws.
 * true only when `sig` (base64url) is a valid Ed25519 signature, under the given SPKI public key (default: the
 * embedded production key), of verdictPayload(verdict). The third argument exists for tests with a throwaway pair.
 */
export function verifyResolveSignature(verdict, sig, spkiB64 = SENTINEL_RESOLVE_PUBKEY_SPKI_B64) {
  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict)) return false;
  // An Ed25519 signature is 64 bytes = exactly 86 base64url characters, unpadded (what the server emits).
  if (typeof sig !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(sig)) return false;
  const key = publicKeyFrom(spkiB64);
  if (!key) return false;
  try {
    return crypto.verify(null, Buffer.from(verdictPayload(verdict), "utf8"), key, Buffer.from(sig, "base64url"));
  } catch {
    return false;
  }
}
