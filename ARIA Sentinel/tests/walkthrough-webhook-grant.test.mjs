// SENTINEL TRIAL GATING 2026-07-02 — the Stripe webhook grants the Walk-Through entitlement ONLY from the
// Concierge "AI Setup Walk-Through" product (id/kind `ai-setup-walkthrough`). A normal Sentinel-tier order
// grants a plan (existing mintLicense) and NEVER sets walkthroughEntitled. Pure funnel logic — no Stripe/Blobs.
import assert from "node:assert/strict";
import {
  isConciergeWalkthroughOrder, mintWalkthroughEntitlement, walkthroughEffectivePlan,
  conciergeTrialEndsAt, mintLicense, planFromLookupKey,
  WALKTHROUGH_PRODUCT_ID, WALKTHROUGH_TRIAL_DAYS, WALKTHROUGH_TRIAL_PLAN
} from "../src/shared/sentinel-license-funnel.mjs";
import { resolvePlanFromKey } from "../src/shared/license-features.mjs";

const SECRET = "walkthrough-test-secret";
const DAY = 24 * 60 * 60 * 1000;
let n = 0; const t = () => { n++; };

// 1 — the Concierge product is detected by kind / product / lookup_key (case + underscore tolerant); a
// DIFFERENT product is NOT a Concierge order.
assert.equal(isConciergeWalkthroughOrder({ kind: "ai-setup-walkthrough" }), true, "kind matches");
assert.equal(isConciergeWalkthroughOrder({ product: "AI-Setup-Walkthrough" }), true, "product matches (case-insensitive)");
assert.equal(isConciergeWalkthroughOrder({ lookupKey: "ai_setup_walkthrough" }), true, "lookup_key matches (underscore-tolerant)");
assert.equal(isConciergeWalkthroughOrder({ kind: "sentinel_pro_m" }), false, "a Sentinel plan is NOT a Concierge order");
assert.equal(isConciergeWalkthroughOrder({ product: "growth-library-book" }), false, "an unrelated product is NOT a Concierge order");
assert.equal(isConciergeWalkthroughOrder({}), false, "empty metadata → not a Concierge order");
assert.equal(WALKTHROUGH_PRODUCT_ID, "ai-setup-walkthrough", "the product id is the ITEM 2 id");
t();

// 2 — a Concierge order mints an entitlement: walkthroughEntitled true + a real 30-day trialEndsAt + a Personal
// base key (never a permanent Pro unlock — the Pro window is enforced by trialEndsAt in sentinel-resolve).
const issued = "2026-07-02T00:00:00.000Z";
const rec = mintWalkthroughEntitlement({ email: "Buyer@Acme.com", name: "Buyer", order_id: "cs_test_1", customer_id: "cus_1", secret: SECRET, issued_at: issued });
assert.equal(rec.walkthroughEntitled, true, "Concierge order sets walkthroughEntitled");
assert.equal(rec.tier, "personal", "the base key/tier is Personal (not a forever-Pro key)");
assert.equal(resolvePlanFromKey(rec.key, SECRET), "personal", "the key resolves to Personal");
assert.equal(WALKTHROUGH_TRIAL_DAYS, 30, "the bundled trial is 30 days");
assert.equal(Date.parse(rec.trialEndsAt) - Date.parse(issued), WALKTHROUGH_TRIAL_DAYS * DAY, "trialEndsAt = issued + 30 days (real date)");
assert.equal(rec.email, "Buyer@Acme.com", "email preserved (scrubbed of any path)");
assert.equal(rec.status, "active");
t();

// 3 — the effective plan is time-boxed: FULL (Pro) inside the 30-day window, Personal after — but the
// Walk-Through entitlement is PERMANENT (always echoed).
const nowIn = Date.parse(issued) + 5 * DAY;   // day 5 → still in trial
const effIn = walkthroughEffectivePlan(rec, nowIn);
assert.equal(effIn.plan, WALKTHROUGH_TRIAL_PLAN, "inside the window → full paid experience (Pro)");
assert.equal(effIn.walkthroughEntitled, true, "entitlement echoed inside the window");
const nowAfter = Date.parse(issued) + 31 * DAY; // day 31 → expired
const effAfter = walkthroughEffectivePlan(rec, nowAfter);
assert.equal(effAfter.plan, "free", "after the window → falls back to the FREE FLOOR (Walk-Through only; must subscribe for the rest)");
assert.equal(effAfter.walkthroughEntitled, true, "entitlement is PERMANENT — still true after expiry");
assert.equal(effAfter.trialEndsAt, rec.trialEndsAt, "the real trial-end date is echoed for honest days-left");
t();

// 4 — 🔒 a NORMAL Sentinel-tier order NEVER sets the entitlement (the grant is Concierge-only).
const plan = planFromLookupKey("sentinel_pro_m");
assert.equal(plan, "pro");
const planRec = mintLicense({ email: "sub@acme.com", name: "Sub", plan, subscription_id: "sub_1", customer_id: "cus_2", secret: SECRET, issued_at: issued });
assert.equal(planRec.walkthroughEntitled, undefined, "a plain Sentinel order does NOT set walkthroughEntitled");
assert.equal(walkthroughEffectivePlan(planRec, nowIn).walkthroughEntitled, false, "no entitlement flag → not entitled");
// A non-Concierge product never even reaches the entitlement mint.
assert.equal(isConciergeWalkthroughOrder({ kind: "sentinel_pro_m", product: "sentinel", lookupKey: "sentinel_pro_m" }), false, "the plan order is never a Concierge order");
t();

// 5 — conciergeTrialEndsAt is real: default 30 days; a blank issued_at falls back to "now" (never a fake date).
const t0 = Date.now();
const endsFromNow = Date.parse(conciergeTrialEndsAt(""));
assert.ok(endsFromNow >= t0 + 30 * DAY - 2000 && endsFromNow <= t0 + 30 * DAY + 2000, "blank issued_at → now + 30 days");
assert.equal(Date.parse(conciergeTrialEndsAt(issued, 7)) - Date.parse(issued), 7 * DAY, "custom day count honored");
t();

assert.equal(n, 5, "5 webhook-grant groups");
console.log(`walkthrough-webhook-grant test passed (${n} groups · Concierge-only detection · 30-day trial + permanent entitlement · Pro window then Personal · normal order never entitled · real dates).`);
