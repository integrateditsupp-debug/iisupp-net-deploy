// RUN 24 A2 — ARIA Sentinel auto-license webhook. On a completed Sentinel subscription it mints a license
// key, persists it to the Netlify Blobs "sentinel-licenses" store (keyed by subscription_id, idempotent),
// and emails the key to the customer + a notify to admin. Thin handler: all decisions live in
// ../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs (unit-tested in the Sentinel suite).
//
// 🔒 Stop conditions enforced here:
//   - Forged/unsigned payloads are rejected (Stripe signature verified).
//   - SENTINEL_LICENSE_SECRET is never logged or returned.
//   - The key is emailed ONLY to the Stripe customer email; admin gets a MASKED key.
//
// SENTINEL-BACKEND 2026-10-14:
//   - audit B7: this endpoint verifies with ITS OWN signing secret, STRIPE_SENTINEL_WEBHOOK_SECRET (falling back
//     to STRIPE_WEBHOOK_SECRET, which the ARIA-web stripe-webhook.js also reads — Stripe signs each endpoint
//     with a different whsec_, so one value cannot be right for both). Register
//     https://iisupp.net/.netlify/functions/sentinel-stripe-webhook in Stripe → Webhooks with the events
//     checkout.session.completed, customer.subscription.created, customer.subscription.deleted.
//   - audit B12: ONLY sentinel_* tiers mint (session metadata.tier / price lookup_key / price metadata
//     sentinel_tier). The ARIA-web tiers (personal, pro, small_business …) are skipped — a $70 web subscriber
//     no longer receives a Sentinel key.
//   - audit B3: the key is a per-customer v2 key (lib/sentinel-license-v2.cjs), the record carries seats +
//     key_version, and the O(1) key index ('sentinel-license-keys') is written alongside the record.
//   - audit B4: customer.subscription.deleted revokes — record status + the revocation entry sentinel-resolve
//     and device auth read.
//   - audit B1: Blobs through lib/sentinel-store.cjs (connectLambda first). A store that cannot be opened or
//     written is logged and answered 503 BEFORE any email, so Stripe retries later and no customer is told a
//     key exists that was never stored. Nothing is ever 500'd before it is logged.
import {
  planFromLookupKey, mintLicense, shouldMint, customerEmail, adminEmail, ADMIN_EMAIL,
  isConciergeWalkthroughOrder, mintWalkthroughEntitlement, WALKTHROUGH_TRIAL_DAYS, revokeRecord
} from "../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs";
import { keyHash } from "../../ARIA Sentinel/src/shared/license-features.mjs";
import { openStore, unavailable, putJson, getJson } from "./lib/sentinel-store.cjs";
import { issueCustomerKey } from "./lib/sentinel-license-v2.cjs";
import { STORES, writeKeyIndex, writeRevocation, REVOCATION_EFFECT } from "./lib/sentinel-license-records.cjs";

const FUNNEL_EVENTS = new Set(["checkout.session.completed", "customer.subscription.created"]);
const REVOKE_EVENTS = new Set(["customer.subscription.deleted"]);

// SENTINEL TRIAL GATING 2026-07-02 — entitlements are looked up server-side by (lowercased) email in
// sentinel-resolve, so a plain Personal-key holder never inherits another buyer's Walk-Through/trial.
const WALKTHROUGH_STORE = STORES.WALKTHROUGH;
const emailKey = (email) => String(email || "").trim().toLowerCase();

// ---------------------------------------------------------------- Stripe seam (tests inject a fake client)
let _stripeFactory = null;
/** Test seam: fn(secretKey) → { webhooks: { constructEvent }, customers: { retrieve } }. */
export function _setStripeFactory(fn) { _stripeFactory = typeof fn === "function" ? fn : null; }
async function loadStripe(secretKey) {
  if (_stripeFactory) return _stripeFactory(secretKey);
  const mod = await import("stripe");
  const Stripe = mod.default || mod;
  return new Stripe(secretKey);
}

/** The signing secrets to try, in order, each tagged with its env name (never logged beyond the name). */
export function webhookSecrets(env = process.env) {
  const out = [];
  for (const name of ["STRIPE_SENTINEL_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET"]) {
    const v = typeof env[name] === "string" ? env[name].trim() : "";
    if (v && !out.some((o) => o.value === v)) out.push({ name, value: v });
  }
  return out;
}

/** Only a Sentinel tier mints a Sentinel key (audit B12). → canonical plan or null. */
export function sentinelPlanFrom(lookupKey, tierMeta) {
  const k = String(lookupKey || "").trim().toLowerCase();
  if (k.startsWith("sentinel_")) return planFromLookupKey(k);
  if (tierMeta) return planFromLookupKey(null, tierMeta);
  return null;
}

/** Seats a plan carries when Stripe does not say (Personal is 1 user · 1 device; fleet tiers are unmetered). */
function defaultSeats(plan) {
  return plan === "personal" ? 1 : plan === "pro" ? 5 : null;
}

export const handler = async (event) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const secrets = webhookSecrets();
  const licenseSecret = process.env.SENTINEL_LICENSE_SECRET;
  if (!stripeKey || !secrets.length || !licenseSecret) {
    console.error("[sentinel-webhook] not configured:", JSON.stringify({ stripeKey: Boolean(stripeKey), webhookSecret: secrets.length > 0, licenseSecret: Boolean(licenseSecret) }));
    return { statusCode: 500, body: "Webhook not configured" };
  }
  let stripe;
  try { stripe = await loadStripe(stripeKey); } catch (err) {
    console.error("[sentinel-webhook] stripe client unavailable:", String((err && err.message) || err).slice(0, 160));
    return { statusCode: 500, body: "Webhook not configured" };
  }

  // 1 — verify the Stripe signature; a forged/unsigned body is rejected before any work.
  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  let evt = null;
  let lastErr = null;
  for (const s of secrets) {
    try { evt = stripe.webhooks.constructEvent(event.body, sig, s.value); break; } catch (err) { lastErr = err; }
  }
  if (!evt) {
    console.error("[sentinel-webhook] signature failed:", String((lastErr && lastErr.message) || lastErr).slice(0, 160));
    return { statusCode: 400, body: `Webhook Error: ${String((lastErr && lastErr.message) || "signature verification failed")}` };
  }
  if (!FUNNEL_EVENTS.has(evt.type) && !REVOKE_EVENTS.has(evt.type)) return ok({ ignored: evt.type });

  try {
    if (REVOKE_EVENTS.has(evt.type)) return await handleCancellation(evt, event);

    // SENTINEL TRIAL GATING 2026-07-02 — a completed Concierge "AI Setup Walk-Through" order grants a 30-day
    // Sentinel trial + a PERMANENT Walk-Through entitlement. Checked BEFORE the plan path (it is not a
    // Sentinel-tier subscription). Only this product sets the entitlement — a normal order falls through.
    if (evt.type === "checkout.session.completed") {
      const concierge = extractConciergeFacts(evt);
      if (concierge && concierge.email) {
        const store = await openStore(STORES.LICENSES, event);
        const wtStore = await openStore(WALKTHROUGH_STORE, event);
        if (!store || !wtStore) return storeDown("concierge", concierge.order_id);
        const existing = await getJson(store, concierge.order_id);
        if (!shouldMint(existing)) return ok({ idempotent: true, order_id: concierge.order_id });
        const base = mintWalkthroughEntitlement({ ...concierge, secret: licenseSecret });
        const record = { ...base, key: issueCustomerKey({ plan: "personal", seed: concierge.order_id, secret: licenseSecret }), key_version: 2, seats: 1 };
        if (!(await putJson(store, concierge.order_id, record))) return storeDown("concierge-write", concierge.order_id);
        // Per-customer entitlement lookup for sentinel-resolve (keyed by lowercased email, never the key).
        const wtWritten = await putJson(wtStore, emailKey(record.email), record);
        const indexed = await writeKeyIndex(record, event);
        const emailed = await sendBoth(record.email, walkthroughWelcomeEmail(record), adminEmail(record));
        return ok({ walkthroughEntitled: true, order_id: concierge.order_id, trialEndsAt: record.trialEndsAt, keyVersion: 2, entitlementStored: wtWritten, indexed, emailed });
      }
    }

    const facts = await extractFacts(stripe, evt);
    if (!facts) return ok({ skipped: "not-a-sentinel-plan" });
    const { email, name, plan, subscription_id, customer_id, issued_at, seats } = facts;
    if (!plan || !subscription_id || !email) return ok({ skipped: "incomplete" });

    const store = await openStore(STORES.LICENSES, event);
    if (!store) return storeDown("mint", subscription_id);
    const existing = await getJson(store, subscription_id);
    if (!shouldMint(existing)) return ok({ idempotent: true, subscription_id });

    const base = mintLicense({ email, name, plan, subscription_id, customer_id, secret: licenseSecret, issued_at });
    const record = {
      ...base,
      key: issueCustomerKey({ plan: base.tier, seed: subscription_id, secret: licenseSecret }),
      key_version: 2,
      seats: seats == null ? defaultSeats(base.tier) : seats,
      contacts: [],
      disabled: false
    };
    // The record is the source of truth: no email leaves until it is stored (Stripe retries a 503 later).
    if (!(await putJson(store, subscription_id, record))) return storeDown("mint-write", subscription_id);
    const indexed = await writeKeyIndex(record, event);

    // Emails never fail the webhook (Stripe would retry the whole event otherwise).
    const emailed = await sendBoth(record.email, customerEmail(record), adminEmail(record));
    return ok({ minted: true, subscription_id, tier: record.tier, keyVersion: 2, seats: record.seats, indexed, emailed });
  } catch (err) {
    console.error("[sentinel-webhook] error:", String((err && err.message) || err).slice(0, 200));
    return { statusCode: 500, body: "Webhook processing error" };
  }
};

/** customer.subscription.deleted → the record is revoked and the key is cut off everywhere (audit B4). */
async function handleCancellation(evt, event) {
  const sub = evt.data.object || {};
  const subscription_id = String(sub.id || "");
  if (!subscription_id) return ok({ ignored: "no-subscription-id" });
  const store = await openStore(STORES.LICENSES, event);
  if (!store) return storeDown("revoke", subscription_id);
  const rec = await getJson(store, subscription_id);
  if (!rec) return ok({ ignored: "no-record", subscription_id });
  if (rec.status === "revoked") return ok({ idempotent: true, revoked: true, subscription_id });
  const updated = { ...revokeRecord(rec, new Date().toISOString()), revoked_reason: `stripe:${evt.type}` };
  if (!(await putJson(store, subscription_id, updated))) return storeDown("revoke-write", subscription_id);
  const indexed = await writeKeyIndex(updated, event);
  const enforced = rec.key ? await writeRevocation(keyHash(rec.key), { reason: `stripe:${evt.type}`, subscription_id }, event) : false;
  if (!enforced) console.error("[sentinel-webhook] revocation entry NOT written for", subscription_id);
  return ok({ revoked: true, subscription_id, enforced, indexed, effect: enforced ? REVOCATION_EFFECT : "revocation-store-unavailable" });
}

function storeDown(stage, id) {
  console.error(`[sentinel-webhook] store unavailable at ${stage} (${String(id || "").slice(-10)}) — answering 503 so Stripe retries`);
  return unavailable({ stage });
}

// Pull (email, name, plan, ids) from either event type. checkout.session carries metadata.tier + customer
// details directly; subscription.created resolves the plan from the price lookup_key + fetches the customer.
// Only sentinel_* tiers resolve (audit B12).
async function extractFacts(stripe, evt) {
  if (evt.type === "checkout.session.completed") {
    const s = evt.data.object;
    const meta = s.metadata || {};
    const plan = sentinelPlanFrom(meta.tier, meta.sentinel_tier);
    if (!plan) return null;
    const seats = Number(meta.seats) > 0 ? Math.floor(Number(meta.seats)) : null;
    return {
      email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
      name: (s.customer_details && s.customer_details.name) || "",
      plan,
      subscription_id: s.subscription || s.id,
      customer_id: s.customer || "",
      issued_at: new Date((evt.created || 0) * 1000).toISOString(),
      seats
    };
  }
  // customer.subscription.created
  const sub = evt.data.object;
  const item = sub.items && sub.items.data && sub.items.data[0];
  const price = item && item.price;
  const lookupKey = price && price.lookup_key;
  const subMeta = sub.metadata || {};
  const plan = sentinelPlanFrom(lookupKey, price && price.metadata && price.metadata.sentinel_tier) || sentinelPlanFrom(subMeta.tier, subMeta.sentinel_tier);
  if (!plan) return null;
  let email = "", name = "";
  try {
    const cust = await stripe.customers.retrieve(sub.customer);
    if (cust && !cust.deleted) { email = cust.email || ""; name = cust.name || ""; }
  } catch { /* customer fetch best-effort */ }
  const seats = Number(subMeta.seats) > 0 ? Math.floor(Number(subMeta.seats)) : (item && Number(item.quantity) > 1 ? Math.floor(Number(item.quantity)) : null);
  return { email, name, plan, subscription_id: sub.id, customer_id: sub.customer || "", issued_at: new Date((evt.created || 0) * 1000).toISOString(), seats };
}

// SENTINEL TRIAL GATING 2026-07-02 — pull Concierge facts from a checkout.session. The Concierge sale marks
// the session with metadata.kind / metadata.product / a line-item price lookup_key === "ai-setup-walkthrough".
// Returns null when the session is NOT the Concierge product (so the normal plan path handles it).
function extractConciergeFacts(evt) {
  const s = evt.data.object;
  const meta = s.metadata || {};
  if (!isConciergeWalkthroughOrder({ kind: meta.kind, product: meta.product, lookupKey: meta.lookup_key })) return null;
  return {
    email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
    name: (s.customer_details && s.customer_details.name) || "",
    order_id: s.id,
    customer_id: s.customer || "",
    issued_at: new Date((evt.created || 0) * 1000).toISOString()
  };
}

// Concierge welcome — honest: the guided setup is permanent; Sentinel beyond the 30-day trial is a separate plan.
function walkthroughWelcomeEmail(record) {
  const subject = "Your AI Setup Walk-Through + 30-day ARIA Sentinel trial";
  const text = `Hi ${record.name},

Thanks for your AI Setup Walk-Through. Here's your ARIA Sentinel key:

    ${record.key}

Your package includes:
1. The guided AI Setup Walk-Through — yours to keep, always.
2. A ${WALKTHROUGH_TRIAL_DAYS}-day trial of the full ARIA Sentinel (monitoring + auto-fix).

Open ARIA Sentinel, paste the key, and use the Walk-Through tab any time. After the ${WALKTHROUGH_TRIAL_DAYS}-day
trial, the Walk-Through stays; continuing with Sentinel's monitoring & auto-fix is a separate plan you can
start from Settings.

Questions: ${ADMIN_EMAIL}.

— Ahmad, Integrated IT Support`;
  return { subject, text };
}

/** Customer + admin mail, each best-effort; reports honestly which one Resend accepted. */
async function sendBoth(customerTo, customerMail, adminMail) {
  const emailed = { customer: false, admin: false };
  emailed.customer = Boolean(await sendEmail(customerTo, customerMail).catch((e) => { console.error("[sentinel-webhook] customer email:", e.message); return false; }));
  emailed.admin = Boolean(await sendEmail(ADMIN_EMAIL, adminMail).catch((e) => { console.error("[sentinel-webhook] admin email:", e.message); return false; }));
  return emailed;
}

/** true when Resend accepted the message; false when email is not configured; throws on a provider error. */
async function sendEmail(to, { subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from || !to) return false;
  // RUN 34-3 — 8s timeout so a slow/unreachable Resend can't hang the webhook (email is best-effort; the
  // license is already minted + persisted, and Stripe must get a prompt 200 to avoid retrying the whole event).
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
  return true;
}

function ok(body) {
  return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
