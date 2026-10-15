// RUN 24 — pure auto-license-funnel logic shared by the Stripe webhook + the admin licenses API. No I/O
// (Stripe/Blobs/Resend live in the netlify handlers), so every decision here is unit-tested in the
// Sentinel suite. 🔒 R11 — free-text fields are path-scrubbed before they ever reach Blobs or an email;
// the license SECRET is never referenced here (only issuePlanKey, which takes it as an argument).
import crypto from "node:crypto";
import { issuePlanKey, FREE_PLAN } from "./license-features.mjs";
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

// ===== SENTINEL TRIAL GATING 2026-07-02 — the AI Setup Walk-Through (Concierge) entitlement =====
// The Concierge "AI Setup Walk-Through" package (ITEM 2 product id/kind `ai-setup-walkthrough`) bundles a
// 30-day ARIA Sentinel trial + a PERMANENT Walk-Through entitlement. This is separate from a Sentinel plan
// subscription: it grants the Walk-Through tab forever and full Sentinel for 30 days, then the rest gates.
export const WALKTHROUGH_PRODUCT_ID = "ai-setup-walkthrough";
export const WALKTHROUGH_TRIAL_DAYS = 30;
// During the 30-day window the buyer gets the full paid experience (Pro-equivalent); after it, they keep
// only the Walk-Through (walkthroughEntitled) and the rest falls to the free Personal tier.
export const WALKTHROUGH_TRIAL_PLAN = "pro";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is this order the Concierge AI Setup Walk-Through (vs a normal Sentinel-tier subscription)? Matches on the
 * product id / kind / lookup_key used by the Concierge sale. Never guesses — an unrelated product is false,
 * so the entitlement is granted ONLY from the Concierge product.
 */
export function isConciergeWalkthroughOrder({ kind, product, lookupKey } = {}) {
  const norm = (v) => String(v || "").trim().toLowerCase().replace(/_/g, "-");
  return [kind, product, lookupKey].some((v) => norm(v) === WALKTHROUGH_PRODUCT_ID);
}

/** ISO trial-end = issued_at (or now) + 30 days. Real server-issued date — the desktop shows real days-left. */
export function conciergeTrialEndsAt(issuedAtIso, days = WALKTHROUGH_TRIAL_DAYS) {
  const base = Date.parse(issuedAtIso || "") || Date.now();
  return new Date(base + days * DAY_MS).toISOString();
}

/**
 * Mint the Walk-Through entitlement record for a completed Concierge order. The key is a Personal base key
 * (never a permanent Pro unlock — the 30-day Pro window is enforced server-side by trialEndsAt in
 * sentinel-resolve). The record carries walkthroughEntitled + trialEndsAt so the desktop caches + gates on
 * real dates. 🔒 free-text fields are path-scrubbed (R11); the secret is only passed to issuePlanKey.
 */
export function mintWalkthroughEntitlement({ email, name, order_id, customer_id, secret, issued_at }) {
  const key = issuePlanKey("personal", secret);
  return {
    email: scrubField(email),
    name: scrubField(name) || "Customer",
    tier: "personal",
    key,
    subscription_id: String(order_id || ""),
    customer_id: String(customer_id || ""),
    issued_at: issued_at || "",
    status: "active",
    walkthroughEntitled: true,
    trialEndsAt: conciergeTrialEndsAt(issued_at)
  };
}

/**
 * The runtime plan/entitlement a Concierge buyer sees, given their stored entitlement record + `now`. Inside
 * the 30-day window they get the full paid experience (Pro); after it, only the Walk-Through survives — the rest
 * falls to the FREE FLOOR (2026-07-02: was "personal", which wrongly handed a Concierge buyer permanent paid
 * Personal Sentinel access; now they must subscribe to unlock the rest). walkthroughEntitled + trialEndsAt are
 * always echoed (the tab is permanent).
 */
export function walkthroughEffectivePlan(record, nowMs = Date.now()) {
  const ends = record && record.trialEndsAt ? Date.parse(record.trialEndsAt) : 0;
  const trialActive = Boolean(ends) && nowMs < ends;
  return {
    plan: trialActive ? WALKTHROUGH_TRIAL_PLAN : FREE_PLAN,
    walkthroughEntitled: Boolean(record && record.walkthroughEntitled),
    trialEndsAt: (record && record.trialEndsAt) || null
  };
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

// SENTINEL REVIEW FIXES 2026-10-14 (P2-1) — the AI Setup Walk-Through purchase now really mints a key: a
// time-boxed TRIAL key (plan code 07 in netlify/functions/lib/sentinel-license-v2.cjs) whose end date is inside
// the key itself. Its record carries tier "trial", walkthroughEntitled:true and expires_at (= purchase + 30 days).
export const TRIAL_TIER = "trial";
export const PLANS_URL = "https://iisupp.net/plans/";
const dateOnly = (iso) => { const t = Date.parse(iso || ""); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "the end of your trial"; };

/**
 * The Walk-Through trial welcome — honest about exactly what the key does and when it stops: Pro features until
 * expires_at, then the Walk-Through stays and the rest falls to the free tier (nothing renews, nothing is charged),
 * mirroring the homepage line "Includes a 30-day ARIA Sentinel trial — keep the Walk-Through forever; continue
 * Sentinel's monitoring & auto-fix on a separate plan."
 */
export function trialCustomerEmail(record) {
  const ends = dateOnly(record.expires_at || record.trialEndsAt);
  const subject = `Your AI Setup Walk-Through + ${WALKTHROUGH_TRIAL_DAYS}-day ARIA Sentinel trial key`;
  const text = `Hi ${record.name},

Thank you for booking the AI Setup Walk-Through. Your package includes a ${WALKTHROUGH_TRIAL_DAYS}-day ARIA Sentinel trial. Here is your trial key:

    ${record.key}

What this key does:
- Until ${ends} (UTC) — ${WALKTHROUGH_TRIAL_DAYS} days from your purchase — ARIA Sentinel runs with the Pro features (monitoring + auto-fix).
- After ${ends} the key keeps your Walk-Through; Sentinel's monitoring and auto-fix drop to the free tier. Continuing them is a separate plan you can start at ${PLANS_URL} — nothing renews and nothing is charged automatically.

Getting started:
1. Install ARIA Sentinel for Windows — we email the Windows pilot installer to this address within one business day (there is nothing to download from ${DOWNLOADS_URL} yet; that page explains the pilot). It is a per-user install, no admin rights needed. The pilot build is unsigned, so Windows SmartScreen will warn — "More info → Run anyway".
2. Open it, choose "Start with safe defaults", and paste the key when prompted.
3. We reply within one business day to confirm your Walk-Through scope and schedule (final scope + price are confirmed before work begins).

Installer not here after one business day? Reply to this email and it is sent by hand.

Questions: ${ADMIN_EMAIL} or (647) 581-3182.

— Ahmad, Integrated IT Support`;
  return { subject, text };
}

/**
 * Plan-change mail (P2-5): the plan is part of the key, so a Stripe plan change mints a NEW key and the old one is
 * revoked. Honest about what the customer must do and when the old key stops.
 */
export function planChangeEmail(record, { fromTier } = {}) {
  const to = TIER_LABEL(record.tier);
  const from = fromTier ? TIER_LABEL(fromTier) : "your previous plan";
  const subject = `Your ARIA Sentinel plan changed to ${to} — here is your new key`;
  const text = `Hi ${record.name},

Your ARIA Sentinel subscription changed from ${from} to ${to}. Your plan is part of your license key, so here is your new key:

    ${record.key}

In ARIA Sentinel, open the License panel, paste the new key and press Activate. Your previous key has been retired: the desktop drops it at its next license check (within 24 hours), so paste the new key before then to keep your ${to} features without a gap.

Questions: ${ADMIN_EMAIL} or (647) 581-3182.

— Ahmad, Integrated IT Support`;
  return { subject, text };
}

/** Admin notice for a plan change — masked keys only, no installer action (the customer already has the app). */
export function adminPlanChangeEmail(record, { fromTier } = {}) {
  const subject = `[SENTINEL] Plan change: ${record.name} (${fromTier || "?"} → ${record.tier})`;
  const text = `Name: ${record.name}
Email: ${record.email}
Stripe customer: ${record.customer_id}
Stripe subscription: ${record.subscription_id}
Plan: ${fromTier || "?"} → ${record.tier}
New key issued: ${maskKey(record.key)} (the previous key was revoked; the customer was emailed the new one)

No action needed unless the customer replies. Full record in admin console → Licenses tab.`;
  return { subject, text };
}

/** Customer welcome email — contains the key + the public /downloads link (no token). */
export function customerEmail(record) {
  if (record && record.tier === TRIAL_TIER) return trialCustomerEmail(record);
  const label = TIER_LABEL(record.tier);
  const subject = "Welcome to ARIA — your license is ready";
  const text = `Hi ${record.name},

You're in. Here's your license key for ARIA ${label}:

    ${record.key}

Three steps:
1. Install ARIA Sentinel for Windows — we email the Windows pilot installer to this address within one business day (there is nothing to download from ${DOWNLOADS_URL} yet; that page explains the pilot). It is a per-user install, no admin rights needed. The pilot build is unsigned, so Windows SmartScreen will warn — "More info → Run anyway".
2. Open it, choose "Start with safe defaults", and paste the key when prompted.
3. Turn on "Live fixes" in Settings → Autonomy when you want ARIA to apply fixes (Windows may ask for admin permission).

Installer not here after one business day? Reply to this email and it is sent by hand.

Your tier also unlocks ARIA web today.

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
  if (record && record.tier === TRIAL_TIER) {
    const subject = `[SENTINEL] Walk-Through purchase: ${record.name} (${WALKTHROUGH_TRIAL_DAYS}-day trial key)`;
    const text = `Name: ${record.name}
Email: ${record.email}
Product: AI Setup Walk-Through (Stripe checkout ${record.subscription_id})
Stripe customer: ${record.customer_id || "(guest checkout)"}
Trial key issued: ${maskKey(record.key)} — Pro features until ${dateOnly(record.expires_at || record.trialEndsAt)} (UTC), then the Walk-Through only
Issued at: ${record.issued_at}

ACTIONS (yours, within one business day — the welcome email promised both):
1. Email the Windows pilot installer (dist\\ARIA-Sentinel-<version>-unsigned.exe + its SHA-256 from dist\\RELEASE-<version>.json) to ${record.email}.
2. Reply to ${record.email} to confirm the Walk-Through scope and schedule.

Full record in admin console → Licenses tab.`;
    return { subject, text };
  }
  const subject = `[SENTINEL] New customer: ${record.name} (${record.tier})`;
  const text = `Name: ${record.name}
Email: ${record.email}
Tier: ${record.tier}
Stripe customer: ${record.customer_id}
Stripe subscription: ${record.subscription_id}
Key issued: ${maskKey(record.key)}
Issued at: ${record.issued_at}

ACTION (yours, within one business day): email the Windows pilot installer (dist\\ARIA-Sentinel-<version>-unsigned.exe + its SHA-256 from dist\\RELEASE-<version>.json) to ${record.email}. The welcome email promised it; nothing on the website serves it yet.

Full record in admin console → Licenses tab.`;
  return { subject, text };
}
