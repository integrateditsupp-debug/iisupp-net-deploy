// RUN 23e — idempotent Stripe setup for the ARIA Sentinel tiers. Creates (or reuses, by lookup_key) the
// recurring prices for all five client tiers straight from pricing-tiers.mjs, then prints the Netlify
// env-var assignments. Re-running is safe: an existing price with the same lookup_key is reused, never
// duplicated. No charges are created — these are catalog products/prices only.
//
//   Usage (you are logged into Stripe; this needs the SECRET key, NOT the browser session):
//     STRIPE_SECRET_KEY=sk_live_xxx node scripts/setup-stripe-sentinel.mjs
//   Add --set-netlify to also push the price IDs to the linked Netlify site automatically:
//     STRIPE_SECRET_KEY=sk_live_xxx node scripts/setup-stripe-sentinel.mjs --set-netlify
//
// 🔒 R11 — touches Stripe catalog + env names only; never a filesystem path. Stripe URLs are never
// hardcoded anywhere — the app/site resolve checkout from these env-stored price IDs.
import { TIERS, CLIENT_PLANS } from "../src/shared/pricing-tiers.mjs";
import { CHECKOUT_TIER, SENTINEL_PRICE_ENV } from "./build-plans-matrix.mjs";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("✗ STRIPE_SECRET_KEY is not set. Run:\n  STRIPE_SECRET_KEY=sk_live_xxx node scripts/setup-stripe-sentinel.mjs");
  process.exit(1);
}
const live = KEY.startsWith("sk_live");
console.log(`Stripe mode: ${live ? "LIVE" : "test"}`);

const Stripe = (await import("stripe")).default;
const stripe = Stripe(KEY);

const PLANS = CLIENT_PLANS.map((p) => ({
  plan: p,
  label: TIERS[p].label,
  lookupKey: CHECKOUT_TIER[p],
  envName: SENTINEL_PRICE_ENV[p],
  amountCents: Math.round(TIERS[p].price * 100),
  interval: TIERS[p].billing === "year" ? "year" : "month"
}));

const results = [];
for (const t of PLANS) {
  // Idempotency: reuse a live price already tagged with this lookup_key.
  const existing = (await stripe.prices.list({ lookup_keys: [t.lookupKey], active: true, limit: 1 })).data[0];
  if (existing) {
    console.log(`= exists  ${t.lookupKey.padEnd(22)} → ${existing.id}`);
    results.push({ env: t.envName, id: existing.id });
    continue;
  }
  // Find-or-create the product, then create the recurring price + claim the lookup_key.
  const productName = `ARIA Sentinel ${t.label}`;
  let product = null;
  try {
    product = (await stripe.products.search({ query: `metadata['sentinel_tier']:'${t.plan}'`, limit: 1 })).data[0] || null;
  } catch { /* search may be disabled on some accounts — fall back to list */ }
  if (!product) {
    product = (await stripe.products.list({ limit: 100 })).data.find((pr) => pr.name === productName) || null;
  }
  if (!product) {
    product = await stripe.products.create({ name: productName, metadata: { sentinel_tier: t.plan } });
  }
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: t.amountCents,
    currency: "usd",
    recurring: { interval: t.interval },
    lookup_key: t.lookupKey,
    transfer_lookup_key: true,
    metadata: { sentinel_tier: t.plan }
  });
  console.log(`+ created ${t.lookupKey.padEnd(22)} → ${price.id}  ($${(t.amountCents / 100).toLocaleString()}/${t.interval})`);
  results.push({ env: t.envName, id: price.id });
}

console.log("\n--- Netlify env vars (price IDs) ---");
for (const r of results) console.log(`netlify env:set ${r.env} ${r.id}`);

if (process.argv.includes("--set-netlify")) {
  const { execSync } = await import("node:child_process");
  console.log("\nPushing to the linked Netlify site…");
  for (const r of results) {
    try { execSync(`netlify env:set ${r.env} ${r.id}`, { stdio: "inherit" }); }
    catch (e) { console.error(`  ✗ failed to set ${r.env}: ${e.message}`); }
  }
  console.log("Done. Redeploy (or next build) picks up the new prices; the /plans buttons go live automatically.");
} else {
  console.log("\n(Run again with --set-netlify to push these to Netlify automatically.)");
}
