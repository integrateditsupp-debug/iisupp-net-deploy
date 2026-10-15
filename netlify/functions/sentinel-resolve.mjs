// sentinel-resolve — the server-side license resolve the desktop calls (RUN 24 A6 contract).
//   POST { key }   headers: X-Sentinel-Device: <device hash> (optional)
//   → 200 { plan, status, verified_at, walkthroughEntitled, trialEndsAt, keyVersion, seats, revocationChecked,
//           expires_at, trialStartedAt, verdict, sig | signing:"unconfigured" }
//     400 bad-key-format · 401 invalid · 429 rate-limited · 500 server-misconfigured
// 🔒 R11 — never logs the raw key (only masked first4…last4) or a secret. SENTINEL_LICENSE_SECRET and
//    SENTINEL_RESOLVE_SIGNING_KEY stay server-side and are never echoed.
//
// SENTINEL-BACKEND 2026-10-14 (audit B9 / B3 / B4 / B1): v1 plan keys resolve through the shared
// license-features.resolvePlanFromKey; per-customer v2 keys resolve first; revocation is read from the one
// store admin revoke / the Stripe paths write; Blobs via lib/sentinel-store.cjs.
//
// SENTINEL REVIEW FIXES 2026-10-14:
//   - P2-2: the request body's `email` is IGNORED. It used to unlock a Walk-Through entitlement looked up by that
//     email — any key holder who typed a Concierge buyer's address got Pro + a permanent Walk-Through, and the
//     response shape told them whether the address was a buyer. Entitlement now comes only from the KEY: its own
//     key-index record (walkthroughEntitled / trialEndsAt) or a trial key's plan code. Known and unknown emails get
//     byte-identical answers (they are not read).
//   - P2-1 / P2-5: a trial key (plan code 07) is "pro"/"active" until the expiry inside the key, then
//     "free"/"expired"; a subscription with an unpaid invoice older than 7 days reports status "past_due".
//   - P1-3: every 200 carries `verdict` = { key_sha256, plan, status, seats, expires_at, verified_at, device } and,
//     when SENTINEL_RESOLVE_SIGNING_KEY is set, `sig` = base64url(Ed25519(JSON.stringify(verdict))) — the payload
//     is built by ARIA Sentinel/src/shared/sentinel-resolve-pubkey.mjs verdictPayload(), the same function the
//     desktop verifies with, so the two cannot drift. Without the env var the answer is unsigned and says
//     `signing:"unconfigured"`; a set-but-unparseable key is a 500 (fail closed, logged without the key); when the
//     revocation store could not be read the verdict is left unsigned (`signing:"withheld"`) — never a 24-hour
//     signed "active" for a key whose revocation was not checked.
//   - P1-3: `trialStartedAt` — the first time this server saw the X-Sentinel-Device hash (Blobs
//     sentinel-trial-anchors `trial-anchor/<device>`, written once, never overwritten, nothing else stored).
// The original fields keep their names and meaning for the shipped desktop (main.mjs resolveLicenseOnline).
import crypto from "node:crypto";
import { resolvePlanFromKey, keyHash as sharedKeyHash } from "../../ARIA Sentinel/src/shared/license-features.mjs";
import { walkthroughEffectivePlan } from "../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs";
import { verdictPayload } from "../../ARIA Sentinel/src/shared/sentinel-resolve-pubkey.mjs";
import { resolveAnyKey, effectivePlan, maskKey } from "./lib/sentinel-license-v2.cjs";
import { openStore } from "./lib/sentinel-store.cjs";
import { STORES, loadKeyRecord, revocationFor } from "./lib/sentinel-license-records.cjs";
import { readTrialAnchor } from "./lib/sentinel-trial-anchor.cjs";

const PAST_DUE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-sentinel-device",
      "cache-control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function headerOf(event, name) {
  const h = (event && event.headers) || {};
  const want = String(name).toLowerCase();
  for (const k of Object.keys(h)) if (k.toLowerCase() === want) return h[k] == null ? "" : String(h[k]);
  return "";
}

// Rate-limit per IP — bound on Netlify edge ip header, not spoofable x-forwarded-for.
async function rateLimitOk(event) {
  try {
    const ip = event.headers?.["x-nf-client-connection-ip"] ||
               event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
               "unknown";
    const store = await openStore("sentinel-resolve-rl", event);
    if (!store) return true; // Blobs unavailable → fail OPEN for the desktop install path (launch-critical).
    const slot = `${ip}/${Math.floor(Date.now() / (5 * 60 * 1000))}`;
    const current = Number((await store.get(slot)) || 0);
    if (current >= 10) return false;
    await store.set(slot, String(current + 1), { metadata: { ip, expires: new Date(Date.now() + 10 * 60 * 1000).toISOString() } });
    return true;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------- verdict signing (P1-3)
let cachedSigner = { env: null, key: null };
/**
 * The Ed25519 signing key from SENTINEL_RESOLVE_SIGNING_KEY (PKCS#8 DER, base64).
 *   → { state:'unconfigured' } | { state:'ok', key } | { state:'misconfigured' }   — never throws, never logs the key.
 */
function signingKey(env = process.env) {
  const raw = typeof env.SENTINEL_RESOLVE_SIGNING_KEY === "string" ? env.SENTINEL_RESOLVE_SIGNING_KEY.trim() : "";
  if (!raw) return { state: "unconfigured" };
  if (cachedSigner.env === raw && cachedSigner.key) return { state: "ok", key: cachedSigner.key };
  try {
    const key = crypto.createPrivateKey({ key: Buffer.from(raw, "base64"), format: "der", type: "pkcs8" });
    if (key.asymmetricKeyType !== "ed25519") return { state: "misconfigured" };
    cachedSigner = { env: raw, key };
    return { state: "ok", key };
  } catch {
    return { state: "misconfigured" };
  }
}

/** base64url Ed25519 signature over verdictPayload(verdict). */
export function signVerdict(verdict, key) {
  return crypto.sign(null, Buffer.from(verdictPayload(verdict), "utf8"), key).toString("base64url");
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { status: "method-not-allowed" });

  const secret = process.env.SENTINEL_LICENSE_SECRET;
  if (!secret) {
    console.error("[sentinel-resolve] SENTINEL_LICENSE_SECRET not set on Netlify env");
    return json(500, { status: "server-misconfigured" });
  }
  const signer = signingKey();
  if (signer.state === "misconfigured") {
    console.error("[sentinel-resolve] SENTINEL_RESOLVE_SIGNING_KEY is set but is not a PKCS#8 DER (base64) Ed25519 private key — refusing to answer unsigned or mis-signed");
    return json(500, { status: "server-misconfigured", signing: "misconfigured" });
  }

  const ok = await rateLimitOk(event);
  if (!ok) return json(429, { status: "rate-limited" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { status: "bad-json" }); }
  // The key is used exactly as pasted (trimmed, not re-cased): the desktop's x-sentinel-key credential is
  // sha256 of the same string, so the revocation / key-index lookups must hash the identical bytes.
  // P2-2: body.email is deliberately never read.
  const key = String((body && body.key) || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(key)) return json(400, { status: "bad-key-format" });

  // v2 (per-customer, incl. trial) first, then the shared v1 scheme, then the legacy admin alias. Constant-time; fail-closed.
  const resolved = resolveAnyKey(key, secret, { resolveV1: resolvePlanFromKey });
  if (!resolved) {
    console.log(`[sentinel-resolve] invalid key ${maskKey(key)}`);
    return json(401, { status: "invalid" });
  }
  const now = Date.now();
  // Records are keyed by sha256 of the minted (lowercase) key; the device credential is sha256 of the key as
  // pasted. Keys are issued lowercase, but an upper-cased paste must not slip past revocation — check both.
  const hashes = [...new Set([sharedKeyHash(key), sharedKeyHash(key.toLowerCase())])];

  // The key's OWN record (key index) — seats, a Walk-Through entitlement, an unpaid-invoice flag. Fail-open on a blip.
  let keyRecord = null;
  try { for (const h of hashes) { keyRecord = await loadKeyRecord(h, event); if (keyRecord) break; } } catch { keyRecord = null; }

  // The plan the KEY grants now (a trial key carries its own expiry).
  const eff = effectivePlan(resolved, now);
  let plan = eff.plan;
  let status = eff.status;
  const expires_at = eff.expires_at || null;
  let walkthroughEntitled = resolved.plan === "trial" || Boolean(keyRecord && keyRecord.walkthroughEntitled === true);
  let trialEndsAt = resolved.plan === "trial" ? expires_at : null;
  if (keyRecord && keyRecord.walkthroughEntitled === true && resolved.plan !== "trial") {
    // A Walk-Through record on a non-trial key (legacy Concierge record): its own window, never an email lookup.
    const wt = walkthroughEffectivePlan(keyRecord, now);
    trialEndsAt = wt.trialEndsAt;
    if (wt.plan === "pro" && (plan === "personal" || plan === "free")) plan = "pro";
  }

  // Revocation — the ONE store (sentinel-licenses-revocations, keyed by sha256(key)) plus the record's own status.
  let revoked = false;
  let revocationChecked = false;
  try {
    for (const h of hashes) {
      const r = await revocationFor(h, event);
      revocationChecked = revocationChecked || !r.unknown;
      if (r.revoked) { revoked = true; break; }
    }
  } catch { /* if Blobs down, fall through with the key's own verdict */ }
  if (keyRecord && keyRecord.status === "revoked") revoked = true;
  if (revoked) {
    status = "revoked";
    plan = resolved.plan === "trial" ? eff.plan : resolved.plan; // a revoked key still names its plan (contract)
  } else if (status === "active" && keyRecord && keyRecord.payment_failed_at) {
    const failedAt = Date.parse(keyRecord.payment_failed_at);
    if (Number.isFinite(failedAt) && now - failedAt >= PAST_DUE_AFTER_MS) status = "past_due";
  }

  // P1-3 — the server-anchored trial start for this device (first sight, never overwritten).
  const deviceHeader = headerOf(event, "x-sentinel-device").trim();
  const anchor = await readTrialAnchor(event, deviceHeader, { now });
  const device = anchor.device || "";

  const verified_at = new Date(now).toISOString();
  const seats = keyRecord && keyRecord.seats != null ? Number(keyRecord.seats) || null : null;
  const verdict = { key_sha256: sharedKeyHash(key), plan, status, seats, expires_at, verified_at, device };
  // Fail closed: a SIGNED verdict is trusted by the desktop for up to 24 h, so it is only issued when the revocation
  // store actually answered. During a Blobs blip the answer stays available but unsigned (short-lived on the desktop).
  const signing = signer.state !== "ok" ? { signing: "unconfigured" }
    : !revocationChecked ? { signing: "withheld" }
    : { sig: signVerdict(verdict, signer.key) };
  if (signing.signing === "withheld") console.error(`[sentinel-resolve] revocation store unreadable — verdict for ${maskKey(key)} left UNSIGNED`);

  const out = {
    plan, status, walkthroughEntitled, trialEndsAt, verified_at,
    keyVersion: resolved.version, seats, revocationChecked, expires_at,
    trialStartedAt: anchor.trialStartedAt,
    verdict, ...signing
  };
  console.log(`[sentinel-resolve] ${status} key ${maskKey(key)} (plan=${plan}, v${resolved.version}${walkthroughEntitled ? ", walkthrough" : ""}${signing.sig ? ", signed" : `, unsigned:${signing.signing}`})`);
  return json(200, out);
}

export const config = { path: "/.netlify/functions/sentinel-resolve" };
