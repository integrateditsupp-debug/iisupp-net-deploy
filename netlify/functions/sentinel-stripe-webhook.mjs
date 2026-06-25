// RUN 24 A2 — ARIA Sentinel auto-license webhook. On a completed Sentinel subscription it mints an HMAC
// license key, persists it to the Netlify Blobs "sentinel-licenses" store (keyed by subscription_id,
// idempotent), and emails the key to the customer + a notify to admin. Thin handler: all decisions live
// in ../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs (unit-tested in the Sentinel suite).
//
// 🔒 Stop conditions enforced here:
//   - Forged/unsigned payloads are rejected (Stripe signature verified).
//   - SENTINEL_LICENSE_SECRET is never logged or returned.
//   - The key is emailed ONLY to the Stripe customer email; admin gets a MASKED key.
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import {
  planFromLookupKey, mintLicense, shouldMint, customerEmail, adminEmail, ADMIN_EMAIL
} from "../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs";

const FUNNEL_EVENTS = new Set(["checkout.session.completed", "customer.subscription.created"]);

export const handler = async (event) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const licenseSecret = process.env.SENTINEL_LICENSE_SECRET;
  if (!stripeKey || !webhookSecret || !licenseSecret) {
    return { statusCode: 500, body: "Webhook not configured" };
  }
  const stripe = new Stripe(stripeKey);

  // 1 — verify the Stripe signature; a forged/unsigned body is rejected before any work.
  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error("[sentinel-webhook] signature failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
  if (!FUNNEL_EVENTS.has(evt.type)) return ok({ ignored: evt.type });

  try {
    const facts = await extractFacts(stripe, evt);
    if (!facts) return ok({ skipped: "not-a-sentinel-plan" });
    const { email, name, plan, subscription_id, customer_id, issued_at } = facts;
    if (!plan || !subscription_id || !email) return ok({ skipped: "incomplete" });

    const store = getStore("sentinel-licenses");
    const existing = await store.get(subscription_id, { type: "json" }).catch(() => null);
    if (!shouldMint(existing)) return ok({ idempotent: true, subscription_id });

    const record = mintLicense({ email, name, plan, subscription_id, customer_id, secret: licenseSecret, issued_at });
    await store.setJSON(subscription_id, record);

    // Emails never fail the webhook (Stripe would retry the whole event otherwise).
    await sendEmail(record.email, customerEmail(record)).catch((e) => console.error("[sentinel-webhook] customer email:", e.message));
    await sendEmail(ADMIN_EMAIL, adminEmail(record)).catch((e) => console.error("[sentinel-webhook] admin email:", e.message));

    return ok({ minted: true, subscription_id, tier: record.tier });
  } catch (err) {
    console.error("[sentinel-webhook] error:", err.message);
    return { statusCode: 500, body: "Webhook processing error" };
  }
};

// Pull (email, name, plan, ids) from either event type. checkout.session carries metadata.tier + customer
// details directly; subscription.created resolves the plan from the price lookup_key + fetches the customer.
async function extractFacts(stripe, evt) {
  if (evt.type === "checkout.session.completed") {
    const s = evt.data.object;
    const tierKey = s.metadata && s.metadata.tier;
    const plan = planFromLookupKey(tierKey);
    if (!plan) return null;
    return {
      email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
      name: (s.customer_details && s.customer_details.name) || "",
      plan,
      subscription_id: s.subscription || s.id,
      customer_id: s.customer || "",
      issued_at: new Date((evt.created || 0) * 1000).toISOString()
    };
  }
  // customer.subscription.created
  const sub = evt.data.object;
  const item = sub.items && sub.items.data && sub.items.data[0];
  const lookupKey = item && item.price && (item.price.lookup_key || (item.price.metadata && item.price.metadata.sentinel_tier));
  const plan = planFromLookupKey(lookupKey, item && item.price && item.price.metadata && item.price.metadata.sentinel_tier);
  if (!plan) return null;
  let email = "", name = "";
  try {
    const cust = await stripe.customers.retrieve(sub.customer);
    if (cust && !cust.deleted) { email = cust.email || ""; name = cust.name || ""; }
  } catch { /* customer fetch best-effort */ }
  return { email, name, plan, subscription_id: sub.id, customer_id: sub.customer || "", issued_at: new Date((evt.created || 0) * 1000).toISOString() };
}

async function sendEmail(to, { subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from || !to) return;
  // RUN 34-3 — 8s timeout so a slow/unreachable Resend can't hang the webhook (email is best-effort; the
  // license is already minted + persisted, and Stripe must get a prompt 200 to avoid retrying the whole event).
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

function ok(body) {
  return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
