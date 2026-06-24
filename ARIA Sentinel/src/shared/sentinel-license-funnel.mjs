// RUN 24 — pure auto-license-funnel logic shared by the Stripe webhook + the admin licenses API. No I/O
// (Stripe/Blobs/Resend live in the netlify handlers), so every decision here is unit-tested in the
// Sentinel suite. 🔒 R11 — free-text fields are path-scrubbed before they ever reach Blobs or an email;
// the license SECRET is never referenced here (only issuePlanKey, which takes it as an argument).
import crypto from "node:crypto";
import { issuePlanKey } from "./license-features.mjs";
import { normalizePlan, getTier, CLIENT_PLANS } from "./pricing-tiers.mjs";

export const DOWNLOADS_URL = "https://iisupp.net/downloads";
export const ADMIN_EMAIL = "ahmad.wasee@iisupp.net";

// Stripe lookup_key (or a price's metadata.sentinel_tier) → canonical plan. Covers the RUN 23e
// sentinel_* keys, the RUN 23f canonical tier IDs, and bare plan names — so the funnel works regardless
// of which tier-ID scheme is live in Stripe.
const LOOKUP_PLAN = {
  sentinel_personal_m: "personal", sentinel_personal_y: "personal", personal: "personal", personal_y: "personal",
  sentinel_pro_m: "pro", sentinel_pro_y: "pro", pro: "pro", pro_y: "pro",
  sentinel_business_y: "smb", small_business: "smb", small_business_y: "smb", smb: "smb",
  sentinel_midsize_y: "midsize", mid_size: "midsize", midsize: "midsize", midsize_y: "midsize",
  sentinel_enterprise_y: "enterprise", enterprise: "enterprise", enterprise_y: "enterprise"
};

/** Resolve a Stripe lookup_key / tier metadata to a canonical plan, or null when unknown (never guess). */
export function planFromLookupKey(lookupKey, tierMeta) {
  const k = String(lookupKey || "").trim().toLowerCase();
  if (LOOKUP_PLAN[k]) return LOOKUP_PLAN[k];
  if (tierMeta) {
    const p = normalizePlan(tierMeta);
    if (CLIENT_PLANS.includes(p)) return p;
  }
  return null;
}

// 🔒 R11 — strip anything that looks like a filesystem path from a free-text field (name/email) before
// it is persisted or emailed.
export function scrubField(value) {
  return String(value == null ? "" : value)
    .replace(/[A-Za-z]:\\[^\s"']*/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"']*/gi, "[path]")
    .replace(/\\\\[^\s"']+/g, "[path]")
    .trim();
}

/** Mint the key + build the Blobs record for a completed subscription. */
export function mintLicense({ email, name, plan, subscription_id, customer_id, secret, issued_at }) {
  const canonical = normalizePlan(plan);
  const key = issuePlanKey(canonical, secret);
  return {
    email: scrubField(email),
    name: scrubField(name) || "Customer",
    tier: canonical,
    key,
    subscription_id: String(subscription_id || ""),
    customer_id: String(customer_id || ""),
    issued_at: issued_at || "",
    status: "active"
  };
}

/** Idempotency: mint + email only when this subscription has no record yet. */
export function shouldMint(existingRecord) {
  return !existingRecord;
}

/** XXXX…XXXX masking for the admin notify (the raw key never appears in the admin email). */
export function maskKey(key) {
  const k = String(key || "");
  return k.length < 12 ? "…" : `${k.slice(0, 4)}…${k.slice(-4)}`;
}

const TIER_LABEL = (plan) => getTier(plan).label;

/** Customer welcome email — contains the key + the public /downloads link (no token). */
export function customerEmail(record) {
  const label = TIER_LABEL(record.tier);
  const subject = "Welcome to ARIA — your license is ready";
  const text = `Hi ${record.name},

You're in. Here's your license key for ARIA ${label}:

    ${record.key}

Two steps:
1. Download ARIA Sentinel from ${DOWNLOADS_URL}
2. Open it, paste the key when prompted

Your tier unlocks ARIA web today. ARIA Sentinel desktop ships on Windows within a month — we'll email when the .exe is live.

Questions: ${ADMIN_EMAIL} or (647) 581-3182.

— Ahmad, Integrated IT Support`;
  return { subject, text };
}

// ===== RUN 24 A3 — admin registry API helpers (pure; the netlify handler does the Blobs/Resend I/O) =====

function timingSafeEq(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

/** Bearer-token admin auth (constant-time). Every mutation + the list/get reads require this. */
export function isAdminAuthorized(authHeader, token) {
  if (!token) return false;
  const m = /^Bearer\s+(.+)$/i.exec(String(authHeader || ""));
  return Boolean(m) && timingSafeEq(m[1].trim(), token);
}

const byIssuedDesc = (a, b) => String(b.issued_at || "").localeCompare(String(a.issued_at || ""));

/** Filter the registry by an email/name substring (empty q → all), newest first. */
export function filterRecords(records, q) {
  const needle = String(q || "").trim().toLowerCase();
  const list = Array.isArray(records) ? records.slice() : [];
  const filtered = needle ? list.filter((r) => `${r.email || ""} ${r.name || ""}`.toLowerCase().includes(needle)) : list;
  return filtered.sort(byIssuedDesc);
}

/** Flip a record to revoked (immutable copy). */
export function revokeRecord(record, at) {
  return { ...record, status: "revoked", revoked_at: at || "" };
}

/**
 * Revocation lookup by key-hash (the runtime is-revoked check). `keyHashFn` hashes a record's key the
 * same way the client does (sha256). Returns { found, revoked } — never the key or any record field.
 */
export function findRevokedByKeyHash(records, hash, keyHashFn) {
  const h = String(hash || "").toLowerCase();
  const rec = (Array.isArray(records) ? records : []).find((r) => keyHashFn(r.key) === h);
  return { found: Boolean(rec), revoked: Boolean(rec && rec.status === "revoked") };
}

/** CSV export for the admin console (key column masked — the raw key never enters a spreadsheet). */
export function recordsToCsv(records) {
  const head = ["email", "name", "tier", "key", "subscription_id", "issued_at", "status"];
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const rows = (Array.isArray(records) ? records : []).map((r) =>
    [r.email, r.name, r.tier, maskKey(r.key), r.subscription_id, r.issued_at, r.status].map(esc).join(","));
  return [head.join(","), ...rows].join("\n");
}

// ===== RUN 24 A6 — server-side license resolve (sentinel-resolve.mjs) =====
// The desktop NEVER holds SENTINEL_LICENSE_SECRET; it POSTs the pasted key to sentinel-resolve, which
// resolves the plan + checks revocation server-side and returns ONLY {plan, status} (never the key, never
// the secret). These helpers are the pure decision core; the netlify handler does the Blobs/IP I/O.

// IP rate-limit: 10 attempts per IP per 5 minutes (enumeration brake — every POST counts).
export const RESOLVE_RL_WINDOW_MS = 5 * 60 * 1000;
export const RESOLVE_RL_MAX = 10;

/**
 * Pure fixed-window rate-limit bump. `record` = { count, window_start (ms) } | null (from Blobs).
 * Returns { record, limited }. A new window resets the count to 1 (never limited on the 1st hit);
 * within a window the (max+1)-th hit is limited. The handler persists `record` and 429s when `limited`.
 */
export function bumpRateLimit(record, nowMs, windowMs = RESOLVE_RL_WINDOW_MS, max = RESOLVE_RL_MAX) {
  const start = record && Number.isFinite(record.window_start) ? record.window_start : 0;
  if (!record || nowMs - start >= windowMs) {
    return { record: { count: 1, window_start: nowMs }, limited: false };
  }
  const count = (record.count || 0) + 1;
  return { record: { count, window_start: start }, limited: count > max };
}

/**
 * Pure resolve decision → { statusCode, body }. `plan` is resolvePlanFromKey(key, secret) (null = forged),
 * `revoked` is the Blobs key-hash lookup. The body NEVER contains the key or the secret:
 *   - malformed (not 64-hex) → 400 { status: "invalid", reason: "malformed" }
 *   - forged (plan === null)  → 401 { status: "invalid" }
 *   - authentic + revoked     → 200 { plan, status: "revoked" }
 *   - authentic + active      → 200 { plan, status: "active", verified_at }
 * Fail-closed: an unrecognized key is never granted a plan (resolvePlanFromKey is fail-closed upstream).
 */
export function resolveDecision({ key, plan, revoked, nowIso } = {}) {
  if (!/^[a-f0-9]{64}$/i.test(String(key || ""))) {
    return { statusCode: 400, body: { status: "invalid", reason: "malformed" } };
  }
  if (!plan) return { statusCode: 401, body: { status: "invalid" } };
  if (revoked) return { statusCode: 200, body: { plan, status: "revoked" } };
  return { statusCode: 200, body: { plan, status: "active", verified_at: nowIso || "" } };
}

/** Admin notify — masked key only; full record lives in the admin console Licenses tab. */
export function adminEmail(record) {
  const subject = `[SENTINEL] New customer: ${record.name} (${record.tier})`;
  const text = `Name: ${record.name}
Email: ${record.email}
Tier: ${record.tier}
Stripe customer: ${record.customer_id}
Stripe subscription: ${record.subscription_id}
Key issued: ${maskKey(record.key)}
Issued at: ${record.issued_at}

Full record in admin console → Licenses tab.`;
  return { subject, text };
}
