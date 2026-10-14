// sentinel-resolve — the server-side license resolve the desktop calls (RUN 24 A6 contract).
//   POST { key, email? } → 200 { plan, status:"active"|"revoked", verified_at, walkthroughEntitled, trialEndsAt }
//                          400 bad-key-format · 401 invalid · 429 rate-limited · 500 server-misconfigured
// 🔒 R11 — never logs the raw key (only masked first4…last4) or the secret. SENTINEL_LICENSE_SECRET stays server-side.
//
// SENTINEL-BACKEND 2026-10-14:
//   - audit B9: the key scheme is the SHARED one. v1 plan keys resolve through
//     ARIA Sentinel/src/shared/license-features.mjs resolvePlanFromKey (the module every test exercises and
//     sentinel-licenses mints with), so an admin key minted there ("sentinel-license:v1:admin") activates; the
//     "admin-lifetime" message this emergency file used to sign is still accepted as an alias of admin.
//   - audit B3: per-customer v2 keys (lib/sentinel-license-v2.cjs — plan + customer + HMAC inside 64 hex)
//     resolve first; the per-customer record (key index) supplies seats / status.
//   - audit B4: revocation is read from the ONE store admin revoke and the Stripe cancellation path write
//     ('sentinel-licenses-revocations', keyed by sha256(key)) — before today nothing wrote it.
//   - audit B1: Blobs is reached through lib/sentinel-store.cjs (connectLambda before getStore).
// The response SHAPE is unchanged (plan/status/verified_at/walkthroughEntitled/trialEndsAt); `keyVersion`,
// `seats` and `revocationChecked` are additive. The desktop reads only the original fields (main.mjs
// resolveLicenseOnline) — no desktop change is needed.
import { resolvePlanFromKey, keyHash as sharedKeyHash } from "../../ARIA Sentinel/src/shared/license-features.mjs";
import { walkthroughEffectivePlan } from "../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs";
import { resolveAnyKey, maskKey } from "./lib/sentinel-license-v2.cjs";
import { openStore } from "./lib/sentinel-store.cjs";
import { STORES, loadKeyRecord, revocationFor } from "./lib/sentinel-license-records.cjs";

const WALKTHROUGH_STORE = STORES.WALKTHROUGH;
const emailKey = (email) => String(email || "").trim().toLowerCase();

function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { status: "method-not-allowed" });

  const secret = process.env.SENTINEL_LICENSE_SECRET;
  if (!secret) {
    console.error("[sentinel-resolve] SENTINEL_LICENSE_SECRET not set on Netlify env");
    return json(500, { status: "server-misconfigured" });
  }

  const ok = await rateLimitOk(event);
  if (!ok) return json(429, { status: "rate-limited" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { status: "bad-json" }); }
  // The key is used exactly as pasted (trimmed, not re-cased): the desktop's x-sentinel-key credential is
  // sha256 of the same string, so the revocation / key-index lookups must hash the identical bytes.
  const key = String((body && body.key) || "").trim();
  const email = String((body && body.email) || "").trim();

  if (!/^[a-f0-9]{64}$/i.test(key)) return json(400, { status: "bad-key-format" });

  // v2 (per-customer) first, then the shared v1 scheme, then the legacy admin alias. All constant-time; fail-closed.
  const resolved = resolveAnyKey(key, secret, { resolveV1: resolvePlanFromKey });
  if (!resolved) {
    console.log(`[sentinel-resolve] invalid key ${maskKey(key)}`);
    return json(401, { status: "invalid" });
  }
  const plan = resolved.plan;
  // Records are keyed by sha256 of the minted (lowercase) key; the device credential is sha256 of the key as
  // pasted. Keys are issued lowercase, but an upper-cased paste must not slip past revocation — check both.
  const hashes = [...new Set([sharedKeyHash(key), sharedKeyHash(key.toLowerCase())])];

  // Per-customer record (key index) — seats / status for v2 keys and admin-minted records. Fail-open on a blip.
  let keyRecord = null;
  try { for (const h of hashes) { keyRecord = await loadKeyRecord(h, event); if (keyRecord) break; } } catch { keyRecord = null; }

  // SENTINEL TRIAL GATING 2026-07-02 — per-customer Walk-Through entitlement, looked up by lowercased email
  // (never the shared plan key). Grants a PERMANENT Walk-Through + a 30-day Pro trial window; after the
  // window the entitlement stays but the plan falls back. Best-effort + fail-open — a Blobs blip never blocks
  // a normal license resolve. Only a real Concierge buyer (an entitlement record exists) gets it.
  let walkthroughEntitled = false;
  let trialEndsAt = null;
  let effectivePlan = plan;
  if (email) {
    try {
      const wt = await openStore(WALKTHROUGH_STORE, event);
      const rec = wt ? await wt.get(emailKey(email), { type: "json" }) : null;
      if (rec && rec.walkthroughEntitled) {
        const eff = walkthroughEffectivePlan(rec, Date.now());
        walkthroughEntitled = true;
        trialEndsAt = eff.trialEndsAt;
        // During the trial window the buyer gets the full paid experience; never DOWNGRADE a genuinely
        // higher paid plan the key already resolves to.
        if (eff.plan === "pro" && plan === "personal") effectivePlan = "pro";
      }
    } catch { /* Blobs down → fail-open: resolve the plan from the key alone, no entitlement this round. */ }
  }
  if (keyRecord && keyRecord.walkthroughEntitled && !walkthroughEntitled) {
    walkthroughEntitled = true;
    trialEndsAt = keyRecord.trialEndsAt || trialEndsAt;
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
  } catch { /* if Blobs down, fall through with status active */ }
  if (keyRecord && keyRecord.status === "revoked") revoked = true;

  const extra = { keyVersion: resolved.version, seats: keyRecord && keyRecord.seats != null ? keyRecord.seats : null, revocationChecked };
  if (revoked) {
    console.log(`[sentinel-resolve] revoked key ${maskKey(key)} (plan=${plan})`);
    // A permanent Walk-Through entitlement survives plan revocation (the buyer paid for it); echo it through.
    return json(200, { plan, status: "revoked", walkthroughEntitled, trialEndsAt, verified_at: new Date().toISOString(), ...extra });
  }

  console.log(`[sentinel-resolve] active key ${maskKey(key)} (plan=${effectivePlan}, v${resolved.version}${walkthroughEntitled ? ", walkthrough" : ""})`);
  return json(200, { plan: effectivePlan, status: "active", walkthroughEntitled, trialEndsAt, verified_at: new Date().toISOString(), ...extra });
}

export const config = { path: "/.netlify/functions/sentinel-resolve" };
