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
//     with a different whsec_, so one value cannot be right for both).
//   - audit B12: ONLY sentinel_* plans mint; the ARIA-web tiers (personal, pro, small_business …) are skipped.
//   - audit B3: the key is a per-customer v2 key (lib/sentinel-license-v2.cjs), the record carries seats +
//     key_version, and the O(1) key index ('sentinel-license-keys') is written alongside the record.
//   - audit B1: Blobs through lib/sentinel-store.cjs (connectLambda first). A store that cannot be opened or
//     written is logged and answered 503 BEFORE any email, so Stripe retries later and no customer is told a
//     key exists that was never stored. Nothing is ever 500'd before it is logged.
//
// SENTINEL REVIEW FIXES 2026-10-14:
//   - P0-1: a key is minted ONLY for a checkout.session with mode "subscription" and payment_status paid /
//     no_payment_required, and the PLAN comes from the subscription's PRICE (lookup_key → price
//     metadata.sentinel_tier → stripe-checkout's own PRICE_MAP → the server-set subscription metadata) — never
//     from the session's metadata.tier, which a one-time checkout used to echo from the client (a $1 session
//     carrying tier "sentinel_enterprise_y" minted an Enterprise key). No more `subscription_id = session.id`
//     fallback: a session without a subscription mints nothing.
//   - P2-1: the AI Setup Walk-Through (one-time, $7,000 catalogue price, server-set metadata.product
//     "ai-setup-walkthrough") now grants what the homepage promises: a permanent Walk-Through entitlement + a
//     30-day Pro trial, as a per-customer TRIAL key (plan code 07, expiry inside the key) stored with
//     walkthroughEntitled:true + expires_at, the entitlement keyed by buyer email, and the key emailed.
//   - P2-5: the subscription lifecycle is handled — customer.subscription.updated (past_due / unpaid / canceled /
//     incomplete_expired → revoke with the reason; back to active after past_due/unpaid → restored; a plan
//     change → the old key is revoked and a new key for the new price is minted and emailed), invoice.payment_failed
//     (payment_failed_at is recorded; sentinel-resolve reports status "past_due" 7 days later) and invoice.paid
//     (clears it). Concurrent duplicate events (checkout.session.completed + customer.subscription.created arrive
//     together) are serialised by a one-writer claim (lib/sentinel-store.cjs claimOnce) so the key is emailed once;
//     a duplicate that loses the claim answers 409 and Stripe's retry finds the record (idempotent 200).
//   Register these events on the endpoint: checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed, invoice.paid.
import { createRequire } from "node:module";
import {
  planFromLookupKey, mintLicense, shouldMint, customerEmail, adminEmail, planChangeEmail, adminPlanChangeEmail, ADMIN_EMAIL,
  isConciergeWalkthroughOrder, mintWalkthroughEntitlement, conciergeTrialEndsAt, WALKTHROUGH_TRIAL_PLAN, revokeRecord, TRIAL_TIER
} from "../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs";
import { keyHash } from "../../ARIA Sentinel/src/shared/license-features.mjs";
import { openStore, unavailable, putJson, readJson, claimOnce, finishClaim } from "./lib/sentinel-store.cjs";
import { issueCustomerKey, issueTrialKey } from "./lib/sentinel-license-v2.cjs";
import { STORES, writeKeyIndex, writeKeyIndexAt, writeRevocation, clearRevocation, REVOCATION_EFFECT } from "./lib/sentinel-license-records.cjs";

const require = createRequire(import.meta.url);
// The server's own price table + the Walk-Through catalogue price (one source of truth with checkout).
const checkout = require("./stripe-checkout.js");
const WALKTHROUGH_PRODUCT_ID = checkout._plans.WALKTHROUGH_PRODUCT_ID;
const WALKTHROUGH_MIN_CENTS = checkout._pricing.ONE_TIME_CATALOGUE[WALKTHROUGH_PRODUCT_ID];

const MINT_EVENTS = new Set(["checkout.session.completed", "customer.subscription.created"]);
const LIFECYCLE_EVENTS = new Set(["customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed", "invoice.paid", "invoice.payment_succeeded"]);
const PAID = new Set(["paid", "no_payment_required"]);
const MINTABLE_SUB_STATUSES = new Set(["active", "trialing"]);
const REVOKE_SUB_STATUSES = new Set(["past_due", "unpaid", "canceled", "incomplete_expired"]);
// A revocation for these reasons is undone when Stripe reports the subscription active again (the card was fixed).
const RECOVERABLE_REASONS = new Set(["stripe:subscription.past_due", "stripe:subscription.unpaid"]);

// SENTINEL TRIAL GATING 2026-07-02 — the Walk-Through entitlement is stored per (lowercased) buyer email.
const emailKey = (email) => String(email || "").trim().toLowerCase();
const nowIso = () => new Date().toISOString();
const isoFromEvent = (evt) => new Date((Number(evt && evt.created) || Math.floor(Date.now() / 1000)) * 1000).toISOString();

// ---------------------------------------------------------------- Stripe seam (tests inject a fake client)
let _stripeFactory = null;
/** Test seam: fn(secretKey) → { webhooks: { constructEvent }, customers: { retrieve }, subscriptions: { retrieve } }. */
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

/**
 * REVIEW FIX P0-1 — the Sentinel plan a subscription is PAYING for, from its price (never client metadata):
 * price lookup_key (sentinel_*) → price metadata.sentinel_tier → stripe-checkout's PRICE_MAP (price id → tier)
 * → the subscription's metadata.tier, which stripe-checkout writes server-side (subscription_data) from the tier
 * it validated against PRICE_MAP. null → not a Sentinel plan.
 */
export function planFromSubscription(sub) {
  const items = sub && sub.items && Array.isArray(sub.items.data) ? sub.items.data : [];
  for (const item of items) {
    const price = item && item.price;
    if (!price) continue;
    const plan = sentinelPlanFrom(price.lookup_key, price.metadata && price.metadata.sentinel_tier)
      || sentinelPlanFrom(checkout._plans.subscriptionTierForPriceId(price.id));
    if (plan) return plan;
  }
  const meta = (sub && sub.metadata) || {};
  return sentinelPlanFrom(meta.tier);
}

/** Seats a plan carries when Stripe does not say (Personal is 1 user · 1 device; fleet tiers are unmetered). */
function defaultSeats(plan) {
  return plan === "personal" ? 1 : plan === "pro" ? 5 : null;
}
function seatsFrom(sub, plan) {
  const meta = (sub && sub.metadata) || {};
  const item = sub && sub.items && Array.isArray(sub.items.data) ? sub.items.data[0] : null;
  if (Number(meta.seats) > 0) return Math.floor(Number(meta.seats));
  if (item && Number(item.quantity) > 1) return Math.floor(Number(item.quantity));
  return defaultSeats(plan);
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
  if (!MINT_EVENTS.has(evt.type) && !LIFECYCLE_EVENTS.has(evt.type)) return ok({ ignored: evt.type });

  const ctx = { stripe, event, secret: licenseSecret };
  try {
    switch (evt.type) {
      case "checkout.session.completed": return await onCheckoutCompleted(evt, ctx);
      case "customer.subscription.created": return await onSubscriptionCreated(evt, ctx);
      case "customer.subscription.updated": return await onSubscriptionUpdated(evt, ctx);
      case "customer.subscription.deleted": return await onSubscriptionDeleted(evt, ctx);
      case "invoice.payment_failed": return await onPaymentFailed(evt, ctx);
      default: return await onPaymentSucceeded(evt, ctx); // invoice.paid / invoice.payment_succeeded
    }
  } catch (err) {
    console.error("[sentinel-webhook] error:", String((err && err.message) || err).slice(0, 200));
    return { statusCode: 500, body: "Webhook processing error" };
  }
};

// ================================================================ minting

/** checkout.session.completed — a paid SUBSCRIPTION session mints; a paid Walk-Through session grants the trial. */
async function onCheckoutCompleted(evt, ctx) {
  const s = evt.data.object || {};
  const mode = String(s.mode || "");
  if (mode === "payment") {
    const wt = walkthroughFacts(evt);
    if (wt && wt.skip) return skipped(wt.skip, { order_id: String(s.id || "") });
    if (wt) return grantWalkthrough(wt, ctx);
  }
  // P0-1: only a subscription purchase is a plan purchase — whatever the session metadata says.
  if (mode !== "subscription") return skipped("not-a-subscription", { mode: mode || null });
  if (!PAID.has(String(s.payment_status || ""))) return skipped("payment-not-complete", { payment_status: s.payment_status || null });
  const subscription_id = typeof s.subscription === "string" ? s.subscription : (s.subscription && s.subscription.id) || "";
  if (!subscription_id) return skipped("incomplete");
  let sub = s.subscription && typeof s.subscription === "object" && s.subscription.items ? s.subscription : null;
  if (!sub) {
    try { sub = await ctx.stripe.subscriptions.retrieve(subscription_id); } catch (err) { return stripeDown("subscription-retrieve", subscription_id, err); }
  }
  const plan = planFromSubscription(sub);
  if (!plan) return skipped("not-a-sentinel-plan");
  if (!MINTABLE_SUB_STATUSES.has(String((sub && sub.status) || ""))) return skipped("subscription-not-active", { status: (sub && sub.status) || null });
  const metaTier = s.metadata && s.metadata.tier;
  if (metaTier && sentinelPlanFrom(metaTier) && sentinelPlanFrom(metaTier) !== plan) {
    console.warn(`[sentinel-webhook] session metadata.tier (${String(metaTier).slice(0, 40)}) ignored — the subscription's price says ${plan}`);
  }
  return mintForSubscription({
    email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
    name: (s.customer_details && s.customer_details.name) || "",
    plan,
    subscription_id,
    customer_id: typeof s.customer === "string" ? s.customer : (s.customer && s.customer.id) || "",
    issued_at: isoFromEvent(evt),
    seats: seatsFrom(sub, plan)
  }, ctx);
}

/** customer.subscription.created — mints for a live Sentinel subscription (idempotent with the checkout event). */
async function onSubscriptionCreated(evt, ctx) {
  const sub = evt.data.object || {};
  const plan = planFromSubscription(sub);
  if (!plan) return skipped("not-a-sentinel-plan");
  if (!MINTABLE_SUB_STATUSES.has(String(sub.status || ""))) return skipped("subscription-not-active", { status: sub.status || null });
  const cust = await customerOf(ctx.stripe, sub.customer);
  return mintForSubscription({ email: cust.email, name: cust.name, plan, subscription_id: String(sub.id || ""), customer_id: idOf(sub.customer), issued_at: isoFromEvent(evt), seats: seatsFrom(sub, plan) }, ctx);
}

/** Store → index → email, once per subscription, behind the one-writer claim. */
async function mintForSubscription(f, ctx) {
  const { email, name, plan, subscription_id, customer_id, issued_at, seats } = f;
  if (!plan || !subscription_id || !email) return skipped("incomplete");
  const store = await openStore(STORES.LICENSES, ctx.event);
  if (!store) return storeDown("mint", subscription_id);
  const first = await readJson(store, subscription_id);
  if (!first.ok) return storeDown("mint", subscription_id);
  if (!shouldMint(first.value)) return ok({ idempotent: true, subscription_id });

  const claims = await openStore(STORES.MINT_CLAIMS, ctx.event);
  const claimKey = `mint/${subscription_id}`;
  const claim = await claimOnce(claims, claimKey, { info: { kind: "mint" } });
  if (claim.unavailable) return storeDown("mint-claim", subscription_id);
  if (!claim.claimed) return (await alreadyDone(store, subscription_id, claim)) || inFlight(subscription_id, claim);
  const again = await readJson(store, subscription_id);
  if (!again.ok) { await finishClaim(claims, claimKey, "released"); return storeDown("mint", subscription_id); }
  if (!shouldMint(again.value)) { await finishClaim(claims, claimKey, "done", { kind: "mint" }); return ok({ idempotent: true, subscription_id }); }

  const base = mintLicense({ email, name, plan, subscription_id, customer_id, secret: ctx.secret, issued_at });
  const record = {
    ...base,
    key: issueCustomerKey({ plan: base.tier, seed: subscription_id, secret: ctx.secret }),
    key_version: 2,
    key_generation: 1,
    seats: seats == null ? defaultSeats(base.tier) : seats,
    contacts: [],
    disabled: false
  };
  // The record is the source of truth: no email leaves until it is stored (Stripe retries a 503 later).
  if (!(await putJson(store, subscription_id, record))) { await finishClaim(claims, claimKey, "released"); return storeDown("mint-write", subscription_id); }
  const indexed = await writeKeyIndex(record, ctx.event);

  // Emails never fail the webhook (Stripe would retry the whole event otherwise).
  const emailed = await sendBoth(record.email, customerEmail(record), adminEmail(record));
  if (emailed.customer) await putJson(store, subscription_id, { ...record, emailed_customer_at: nowIso() });
  await finishClaim(claims, claimKey, "done", { kind: "mint" });
  return ok({ minted: true, subscription_id, tier: record.tier, keyVersion: 2, seats: record.seats, indexed, emailed });
}

// ================================================================ the Walk-Through (P2-1)

/**
 * The Walk-Through facts from a checkout.session, or null when it is not the Walk-Through. Recognised ONLY by the
 * SERVER-set markers (metadata.product / metadata.kind — a client can set neither through stripe-checkout), never
 * by metadata.tier (which echoes the client's item id). Defence in depth: the pre-discount subtotal must be at
 * least the catalogue price (a promotion code lowers amount_total, not amount_subtotal).
 */
function walkthroughFacts(evt) {
  const s = evt.data.object || {};
  const meta = s.metadata || {};
  if (!isConciergeWalkthroughOrder({ kind: meta.kind, product: meta.product })) return null;
  if (!PAID.has(String(s.payment_status || ""))) return { skip: "payment-not-complete" };
  const subtotal = s.amount_subtotal == null ? NaN : Number(s.amount_subtotal);
  if (Number.isFinite(subtotal) && subtotal < WALKTHROUGH_MIN_CENTS) {
    console.error(`[sentinel-webhook] Walk-Through session ${String(s.id || "").slice(-10)} subtotal ${subtotal} < catalogue ${WALKTHROUGH_MIN_CENTS} — not granted`);
    return { skip: "amount-below-catalogue" };
  }
  return {
    email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
    name: (s.customer_details && s.customer_details.name) || "",
    order_id: String(s.id || ""),
    customer_id: typeof s.customer === "string" ? s.customer : (s.customer && s.customer.id) || "",
    issued_at: isoFromEvent(evt),
    amount_subtotal: Number.isFinite(subtotal) ? subtotal : null,
    currency: s.currency ? String(s.currency) : null
  };
}

async function grantWalkthrough(f, ctx) {
  if (!f.email || !f.order_id) return skipped("incomplete");
  const store = await openStore(STORES.LICENSES, ctx.event);
  const wtStore = await openStore(STORES.WALKTHROUGH, ctx.event);
  if (!store || !wtStore) return storeDown("walkthrough", f.order_id);
  const first = await readJson(store, f.order_id);
  if (!first.ok) return storeDown("walkthrough", f.order_id);
  if (!shouldMint(first.value)) return ok({ idempotent: true, order_id: f.order_id });

  const claims = await openStore(STORES.MINT_CLAIMS, ctx.event);
  const claimKey = `walkthrough/${f.order_id}`;
  const claim = await claimOnce(claims, claimKey, { info: { kind: "walkthrough" } });
  if (claim.unavailable) return storeDown("walkthrough-claim", f.order_id);
  if (!claim.claimed) return (await alreadyDone(store, f.order_id, claim, "order_id")) || inFlight(f.order_id, claim);
  const again = await readJson(store, f.order_id);
  if (!again.ok) { await finishClaim(claims, claimKey, "released"); return storeDown("walkthrough", f.order_id); }
  if (!shouldMint(again.value)) { await finishClaim(claims, claimKey, "done", { kind: "walkthrough" }); return ok({ idempotent: true, order_id: f.order_id }); }

  // 30 days from the purchase (the event time), carried INSIDE the key (plan code 07) and on the record.
  const trialEndsAt = conciergeTrialEndsAt(f.issued_at);
  const base = mintWalkthroughEntitlement({ ...f, secret: ctx.secret }); // the shared fields; its Personal key is discarded
  const record = {
    ...base,
    tier: TRIAL_TIER,
    key: issueTrialKey({ seed: f.order_id, expiresAt: trialEndsAt, secret: ctx.secret }),
    key_version: 2,
    seats: 1,
    walkthroughEntitled: true,
    trialEndsAt,
    expires_at: trialEndsAt,
    trial_plan: WALKTHROUGH_TRIAL_PLAN,
    product: WALKTHROUGH_PRODUCT_ID,
    amount_subtotal: f.amount_subtotal,
    currency: f.currency,
    contacts: [],
    disabled: false
  };
  if (!(await putJson(store, f.order_id, record))) { await finishClaim(claims, claimKey, "released"); return storeDown("walkthrough-write", f.order_id); }
  // The per-buyer entitlement (lowercased email) — the facts, a key HASH, never the key itself.
  const entitlementStored = await putJson(wtStore, emailKey(record.email), {
    walkthroughEntitled: true, trialEndsAt, trial_plan: WALKTHROUGH_TRIAL_PLAN, email: record.email,
    order_id: f.order_id, key_hash: keyHash(record.key), issued_at: record.issued_at
  });
  const indexed = await writeKeyIndex(record, ctx.event);
  const emailed = await sendBoth(record.email, customerEmail(record), adminEmail(record));
  if (emailed.customer) await putJson(store, f.order_id, { ...record, emailed_customer_at: nowIso() });
  await finishClaim(claims, claimKey, "done", { kind: "walkthrough" });
  return ok({ walkthroughEntitled: true, order_id: f.order_id, tier: TRIAL_TIER, trialEndsAt, expires_at: trialEndsAt, keyVersion: 2, entitlementStored, indexed, emailed });
}

// ================================================================ lifecycle (P2-5)

/** customer.subscription.deleted → the record is revoked and the key is cut off everywhere (audit B4). */
async function onSubscriptionDeleted(evt, ctx) {
  const sub = evt.data.object || {};
  const subscription_id = String(sub.id || "");
  if (!subscription_id) return ok({ ignored: "no-subscription-id" });
  const store = await openStore(STORES.LICENSES, ctx.event);
  if (!store) return storeDown("revoke", subscription_id);
  const cur = await readJson(store, subscription_id);
  if (!cur.ok) return storeDown("revoke", subscription_id);
  if (!cur.value) return ok({ ignored: "no-record", subscription_id });
  return revokeSubscription(store, cur.value, `stripe:${evt.type}`, ctx);
}

/**
 * customer.subscription.updated:
 *   past_due / unpaid / canceled / incomplete_expired → revoke with the reason;
 *   active / trialing → restore a past_due/unpaid revocation, finish an interrupted plan change, apply a NEW plan
 *   (revoke the old key, mint + email a key for the new price), or clear payment_failed_at;
 *   no record yet + active → mint (a subscription that was `incomplete` when it was created).
 */
async function onSubscriptionUpdated(evt, ctx) {
  const sub = evt.data.object || {};
  const subscription_id = String(sub.id || "");
  if (!subscription_id) return ok({ ignored: "no-subscription-id" });
  const status = String(sub.status || "");
  const store = await openStore(STORES.LICENSES, ctx.event);
  if (!store) return storeDown("update", subscription_id);
  const cur = await readJson(store, subscription_id);
  if (!cur.ok) return storeDown("update", subscription_id);
  const rec = cur.value;
  if (!rec) {
    if (!MINTABLE_SUB_STATUSES.has(status)) return ok({ ignored: "no-record", subscription_id, status: status || null });
    const plan = planFromSubscription(sub);
    if (!plan) return skipped("not-a-sentinel-plan");
    const cust = await customerOf(ctx.stripe, sub.customer);
    return mintForSubscription({ email: cust.email, name: cust.name, plan, subscription_id, customer_id: idOf(sub.customer), issued_at: isoFromEvent(evt), seats: seatsFrom(sub, plan) }, ctx);
  }
  if (REVOKE_SUB_STATUSES.has(status)) return revokeSubscription(store, rec, `stripe:subscription.${status}`, ctx);
  if (!MINTABLE_SUB_STATUSES.has(status)) return ok({ ignored: `status:${status || "unknown"}`, subscription_id });

  let current = rec;
  let restored = false;
  if (rec.status === "revoked") {
    if (!RECOVERABLE_REASONS.has(String(rec.revoked_reason || ""))) return ok({ ignored: "revoked", subscription_id, reason: rec.revoked_reason || null });
    const r = await restoreSubscription(store, rec, status, ctx);
    if (!r.ok) return r.response;
    current = r.record;
    restored = true;
  }
  if (current.plan_change_pending) return completePlanChange(store, current, ctx);
  const plan = planFromSubscription(sub);
  // A price change in the same update as a recovery is applied too (it would otherwise wait for another event).
  if (plan && plan !== current.tier) return changePlan(store, current, plan, sub, ctx);
  if (restored) return ok({ restored: true, subscription_id, tier: current.tier });
  if (current.payment_failed_at) return clearPaymentFailed(store, current, ctx, `stripe:subscription.${status}`);
  return ok({ unchanged: true, subscription_id, tier: current.tier });
}

/** Revoke (idempotent): record → index → revocation entry. A failed entry write is a 503 so Stripe's retry finishes it. */
async function revokeSubscription(store, rec, reason, ctx) {
  const id = String(rec.subscription_id || "");
  const already = rec.status === "revoked";
  let updated = rec;
  if (!already) {
    updated = { ...revokeRecord(rec, nowIso()), revoked_reason: reason };
    if (!(await putJson(store, id, updated))) return storeDown("revoke-write", id);
  }
  const indexed = await writeKeyIndex(updated, ctx.event);
  if (!updated.key) return ok({ revoked: true, subscription_id: id, reason: updated.revoked_reason || reason, enforced: false, indexed, enforcement: "record-has-no-key", ...(already ? { idempotent: true } : {}) });
  // A v1 key is SHARED by every customer on its plan: never cut it off from a lifecycle event (Rule 14 — say so).
  if (Number(updated.key_version) !== 2) {
    console.error(`[sentinel-webhook] ${id}: record holds a shared v1 plan key — revocation entry NOT written (would cut off every customer on the plan)`);
    return ok({ revoked: true, subscription_id: id, reason: updated.revoked_reason || reason, enforced: false, indexed, enforcement: "shared-plan-key: use sentinel-licenses action=revokeKeyHash to cut the key off for everyone", ...(already ? { idempotent: true } : {}) });
  }
  const enforced = await writeRevocation(keyHash(updated.key), { reason: updated.revoked_reason || reason, subscription_id: id }, ctx.event);
  if (!enforced) return storeDown("revoke-entry", id);
  return ok({ revoked: true, subscription_id: id, reason: updated.revoked_reason || reason, enforced, indexed, effect: REVOCATION_EFFECT, ...(already ? { idempotent: true } : {}) });
}

/**
 * Back to active after past_due / unpaid → the key works again (the revocation entry is cleared).
 * → { ok:true, record } or { ok:false, response } (a 503 so Stripe's retry finishes it).
 */
async function restoreSubscription(store, rec, status, ctx) {
  const id = String(rec.subscription_id || "");
  const updated = { ...rec, status: "active", revoked_at: null, revoked_reason: null, restored_at: nowIso(), restored_reason: `stripe:subscription.${status}`, payment_failed_at: null };
  const cleared = updated.key ? await clearRevocation(keyHash(updated.key), ctx.event) : true;
  if (!cleared) return { ok: false, response: storeDown("restore-entry", id) };
  if (!(await putJson(store, id, updated))) return { ok: false, response: storeDown("restore-write", id) };
  const indexed = await writeKeyIndex(updated, ctx.event);
  if (!indexed) return { ok: false, response: storeDown("restore-index", id) };
  return { ok: true, record: updated };
}

/** A Stripe plan change: the plan is inside the key, so the old key is retired and a new one minted + emailed. */
async function changePlan(store, rec, newPlan, sub, ctx) {
  const id = String(rec.subscription_id || "");
  const generation = (Number(rec.key_generation) || 1) + 1;
  const claims = await openStore(STORES.MINT_CLAIMS, ctx.event);
  const claimKey = `plan/${id}/${generation}`;
  const claim = await claimOnce(claims, claimKey, { info: { kind: "plan-change", to: newPlan } });
  if (claim.unavailable) return storeDown("plan-change-claim", id);
  if (!claim.claimed) return inFlight(id, claim);
  const fresh = await readJson(store, id);
  if (!fresh.ok || !fresh.value) { await finishClaim(claims, claimKey, "released"); return storeDown("plan-change", id); }
  if (fresh.value.tier === newPlan || fresh.value.plan_change_pending) {
    await finishClaim(claims, claimKey, "done", { kind: "plan-change" });
    return fresh.value.plan_change_pending ? completePlanChange(store, fresh.value, ctx) : ok({ idempotent: true, subscription_id: id, tier: newPlan });
  }
  const now = nowIso();
  const oldKey = String(fresh.value.key || "");
  const updated = {
    ...fresh.value,
    tier: newPlan,
    key: issueCustomerKey({ plan: newPlan, seed: `${id}#g${generation}`, secret: ctx.secret }),
    key_version: 2,
    key_generation: generation,
    seats: seatsFrom(sub, newPlan),
    plan_changed_at: now,
    previous_keys: [...(Array.isArray(fresh.value.previous_keys) ? fresh.value.previous_keys : []), { key_hash: oldKey ? keyHash(oldKey) : null, tier: fresh.value.tier, retired_at: now, reason: "stripe:plan-change" }].slice(-10),
    plan_change_pending: { from: fresh.value.tier, old_key_hash: oldKey ? keyHash(oldKey) : null, old_key_version: Number(fresh.value.key_version) || 1, at: now },
    plan_change_emailed_at: null
  };
  // 1 — the record (source of truth) first; everything after it is resumable from plan_change_pending.
  if (!(await putJson(store, id, updated))) { await finishClaim(claims, claimKey, "released"); return storeDown("plan-change-write", id); }
  const res = await completePlanChange(store, updated, ctx);
  await finishClaim(claims, claimKey, "done", { kind: "plan-change" });
  return res;
}

/** Steps 2–5 of a plan change (also the resume path after a 503): new index, retire the old key, email, clear. */
async function completePlanChange(store, rec, ctx) {
  const id = String(rec.subscription_id || "");
  const pending = rec.plan_change_pending || {};
  const indexed = await writeKeyIndex(rec, ctx.event);
  if (!indexed) return storeDown("plan-change-index", id);
  let oldRevoked = false;
  if (pending.old_key_hash && Number(pending.old_key_version) === 2) {
    const oldIndexed = await writeKeyIndexAt(pending.old_key_hash, { ...rec, tier: pending.from, status: "revoked", revoked_at: pending.at || nowIso() }, ctx.event, { replaced_by_generation: rec.key_generation || null });
    oldRevoked = await writeRevocation(pending.old_key_hash, { reason: "stripe:plan-change", subscription_id: id, replaced_by_tier: rec.tier }, ctx.event);
    if (!oldIndexed || !oldRevoked) return storeDown("plan-change-retire", id);
  } else if (pending.old_key_hash) {
    console.error(`[sentinel-webhook] ${id}: the replaced key was a shared v1 plan key — not revoked (would cut off every customer on the plan)`);
  }
  let emailed = { customer: false, admin: false, previously: Boolean(rec.plan_change_emailed_at) };
  let current = rec;
  if (!rec.plan_change_emailed_at) {
    emailed = await sendBoth(rec.email, planChangeEmail(rec, { fromTier: pending.from }), adminPlanChangeEmail(rec, { fromTier: pending.from }));
    if (emailed.customer) current = { ...rec, plan_change_emailed_at: nowIso() };
  }
  const { plan_change_pending, ...done } = current; // eslint-disable-line no-unused-vars
  if (!(await putJson(store, id, done))) return storeDown("plan-change-finish", id);
  return ok({ planChanged: true, subscription_id: id, from: pending.from || null, tier: rec.tier, keyVersion: 2, keyGeneration: rec.key_generation || null, oldKeyRevoked: oldRevoked, indexed, emailed });
}

/** invoice.payment_failed → payment_failed_at (first failure kept); sentinel-resolve says past_due 7 days later. */
async function onPaymentFailed(evt, ctx) {
  const inv = evt.data.object || {};
  const subscription_id = invoiceSubscriptionId(inv);
  if (!subscription_id) return ok({ ignored: "no-subscription" });
  const store = await openStore(STORES.LICENSES, ctx.event);
  if (!store) return storeDown("payment-failed", subscription_id);
  const cur = await readJson(store, subscription_id);
  if (!cur.ok) return storeDown("payment-failed", subscription_id);
  const rec = cur.value;
  if (!rec) return ok({ ignored: "no-record", subscription_id });
  if (rec.payment_failed_at) return ok({ idempotent: true, subscription_id, payment_failed_at: rec.payment_failed_at });
  const at = isoFromEvent(evt);
  const updated = { ...rec, payment_failed_at: at, payment_failed_invoice: String(inv.id || "").slice(0, 80) || null };
  if (!(await putJson(store, subscription_id, updated))) return storeDown("payment-failed-write", subscription_id);
  const indexed = await writeKeyIndex(updated, ctx.event);
  if (!indexed) return storeDown("payment-failed-index", subscription_id);
  return ok({ marked: "payment-failed", subscription_id, payment_failed_at: at, past_due_from: new Date(Date.parse(at) + 7 * 86400000).toISOString(), indexed });
}

/** invoice.paid / invoice.payment_succeeded → a recorded payment failure is cleared. */
async function onPaymentSucceeded(evt, ctx) {
  const subscription_id = invoiceSubscriptionId(evt.data.object || {});
  if (!subscription_id) return ok({ ignored: "no-subscription" });
  const store = await openStore(STORES.LICENSES, ctx.event);
  if (!store) return storeDown("payment-ok", subscription_id);
  const cur = await readJson(store, subscription_id);
  if (!cur.ok) return storeDown("payment-ok", subscription_id);
  if (!cur.value) return ok({ ignored: "no-record", subscription_id });
  if (!cur.value.payment_failed_at) return ok({ ignored: "no-payment-failure", subscription_id });
  return clearPaymentFailed(store, cur.value, ctx, `stripe:${evt.type}`);
}

async function clearPaymentFailed(store, rec, ctx, via) {
  const id = String(rec.subscription_id || "");
  const updated = { ...rec, payment_failed_at: null, payment_recovered_at: nowIso(), payment_recovered_via: via };
  if (!(await putJson(store, id, updated))) return storeDown("payment-ok-write", id);
  const indexed = await writeKeyIndex(updated, ctx.event);
  if (!indexed) return storeDown("payment-ok-index", id);
  return ok({ cleared: "payment-failed", subscription_id: id, indexed });
}

/** The subscription id on an invoice — pre-2025 API (`invoice.subscription`) and the newer `parent` shape. */
function invoiceSubscriptionId(inv) {
  const direct = inv.subscription;
  if (typeof direct === "string" && direct) return direct;
  if (direct && typeof direct === "object" && direct.id) return String(direct.id);
  const viaParent = inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription;
  return typeof viaParent === "string" ? viaParent : (viaParent && viaParent.id) || "";
}

// ================================================================ helpers

/** A Stripe reference that may be an id string or an expanded object → the id string ("" when absent). */
function idOf(ref) {
  return typeof ref === "string" ? ref : (ref && typeof ref === "object" && ref.id ? String(ref.id) : "");
}

async function customerOf(stripe, customerId) {
  if (!customerId) return { email: "", name: "" };
  try {
    const cust = await stripe.customers.retrieve(typeof customerId === "string" ? customerId : customerId.id);
    if (cust && !cust.deleted) return { email: cust.email || "", name: cust.name || "" };
  } catch { /* customer fetch best-effort */ }
  return { email: "", name: "" };
}

function storeDown(stage, id) {
  console.error(`[sentinel-webhook] store unavailable at ${stage} (${String(id || "").slice(-10)}) — answering 503 so Stripe retries`);
  return unavailable({ stage });
}

function stripeDown(stage, id, err) {
  console.error(`[sentinel-webhook] Stripe API failed at ${stage} (${String(id || "").slice(-10)}): ${String((err && err.message) || err).slice(0, 160)} — answering 503 so Stripe retries`);
  return { statusCode: 503, headers: { "content-type": "application/json", "retry-after": "30" }, body: JSON.stringify({ ok: false, reason: "stripe-unavailable", stage }) };
}

/** The claim holder already FINISHED and its record is visible → the idempotent 200 (no needless Stripe retry). */
async function alreadyDone(store, id, claim, idField = "subscription_id") {
  if (!claim || !claim.holder || claim.holder.state !== "done") return null;
  const rec = await readJson(store, id);
  return rec.ok && rec.value ? ok({ idempotent: true, [idField]: id }) : null;
}

/** Another invocation holds the mint claim for this id: 409 (logged) so Stripe retries and finds the record. */
function inFlight(id, claim) {
  console.warn(`[sentinel-webhook] ${String(id || "").slice(-10)}: another delivery is minting (claim ${claim && claim.mode}) — 409, Stripe will retry and find the record`);
  return { statusCode: 409, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false, inFlight: true, id: String(id || "") }) };
}

function skipped(reason, extra) {
  return ok({ skipped: reason, ...(extra || {}) });
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
