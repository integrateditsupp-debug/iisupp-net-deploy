// Q-WEBTIER — contract test for the $70/mo "ARIA Web + AI Edge" website subscription.
// Verifies: env-aware config (configured only when the Stripe price is set, no price-id leak), the card
// view-model (Subscribe when configured, trial/contact fallback otherwise — never a broken checkout), the
// checkout PRICE_MAP wiring, and that this web product is kept SEPARATE from the desktop license matrix.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..", "..");

// 1 — Config endpoint is env-aware and never leaks the raw Stripe price id.
const { buildConfig, TIER } = require(path.join(root, "netlify/functions/aria-web-tier.js"));
assert.equal(buildConfig({}).configured, false, "unset env → not configured");
assert.equal(buildConfig({ STRIPE_PRICE_ARIA_WEB_M: "price_live_xyz" }).configured, true, "set env → configured");
assert.ok(!JSON.stringify(buildConfig({ STRIPE_PRICE_ARIA_WEB_M: "price_SECRET" })).includes("price_SECRET"),
  "config response must NOT leak the raw Stripe price id");
assert.equal(TIER.tier, "aria_web_m");
assert.equal(TIER.amount, 70);
assert.match(TIER.price, /\$70/);

// 2 — Card view-model: configured → real checkout; not configured → trial/contact fallback (never broken).
const { tierCardModel } = require(path.join(root, "assets/aria-web-tier.js"));
const on = tierCardModel({ configured: true, name: TIER.name, price: TIER.price, features: TIER.features });
assert.equal(on.primary.action, "checkout", "configured → Subscribe/checkout");
assert.equal(on.primary.tier, "aria_web_m");
const off = tierCardModel({ configured: false });
assert.equal(off.primary.action, "trial", "unconfigured → free trial, not a broken checkout");
assert.ok(off.secondary && off.secondary.href, "unconfigured → a secondary path (contact) is offered");

// 3 — Checkout wiring: aria_web_m reads STRIPE_PRICE_ARIA_WEB_M (env-only, no baked default) and runs as a subscription.
const checkoutSrc = fs.readFileSync(path.join(root, "netlify/functions/stripe-checkout.js"), "utf8");
assert.match(checkoutSrc, /aria_web_m:\s*process\.env\.STRIPE_PRICE_ARIA_WEB_M/, "aria_web_m wired to env in PRICE_MAP");
assert.ok(!/aria_web_m:\s*process\.env\.STRIPE_PRICE_ARIA_WEB_M\s*\|\|/.test(checkoutSrc), "aria_web_m must have NO baked default price");
assert.match(checkoutSrc, /'aria_web_m'\s*\/\/ Q-WEBTIER/, "aria_web_m is in the SUBSCRIPTION_TIERS set");

// 4 — Separation: the web tier must NOT pollute the desktop Sentinel license matrix.
const tiersSrc = fs.readFileSync(path.join(root, "ARIA Sentinel/src/shared/pricing-tiers.mjs"), "utf8");
assert.ok(!/aria_web_m/.test(tiersSrc), "aria_web_m must NOT appear in the desktop pricing-tiers.mjs matrix");

console.log("web-tier-contract test passed (env-aware config no-leak · card subscribe/trial fallback · checkout env-only wiring · separate from desktop matrix).");
