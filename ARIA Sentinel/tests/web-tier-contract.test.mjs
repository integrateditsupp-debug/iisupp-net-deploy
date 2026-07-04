// Q-WEBTIER - ARIA Web + AI Edge tier contract.
// Verifies current plan cards use env-backed checkout wiring and shared pricing data.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CLIENT_PLANS, TIERS } from "../src/shared/pricing-tiers.mjs";

const sentinelRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(sentinelRoot, "..");
const ariaCore = fs.readFileSync(path.join(repoRoot, "assets", "aria-core.js"), "utf8");
const checkout = fs.readFileSync(path.join(repoRoot, "netlify", "functions", "stripe-checkout.js"), "utf8");
const planPicker = fs.readFileSync(path.join(sentinelRoot, "src", "overlay", "plan-picker.mjs"), "utf8");
const renderer = fs.readFileSync(path.join(sentinelRoot, "src", "renderer", "index.html"), "utf8");

assert.match(ariaCore, /STRIPE_CHECKOUT_ENDPOINT\s*=\s*"\/\.netlify\/functions\/stripe-checkout"/, "web checkout endpoint is server-side");
for (const tier of ["personal", "pro", "small_business"]) {
  assert.match(ariaCore, new RegExp(`data-tier="${tier}"`), `web lock overlay has ${tier} card`);
}

assert.match(checkout, /process\.env\.STRIPE_PRICE_PERSONAL/, "personal checkout uses env price id");
assert.match(checkout, /process\.env\.STRIPE_PRICE_PRO/, "pro checkout uses env price id");
assert.match(checkout, /process\.env\.STRIPE_PRICE_SMALL_BUSINESS/, "small business checkout uses env price id");
assert.match(checkout, /STRIPE_SECRET_KEY/, "checkout remains server-side Stripe secret gated");

assert.match(planPicker, /from "\.\.\/shared\/pricing-tiers\.mjs"/, "plan picker imports shared pricing source");
assert.match(planPicker, /planComparisonTable\(\)/, "matrix renders from shared comparison table");
assert.doesNotMatch(planPicker, /checkout\.stripe\.com|buy\.stripe/i, "plan picker has no hardcoded Stripe checkout URL");

for (const plan of CLIENT_PLANS) {
  assert.ok(TIERS[plan].stripeEnv || plan === "admin", `${plan} carries env checkout metadata`);
  assert.match(renderer, new RegExp(`data-tier="${plan}"|data-plan="${plan}"|${TIERS[plan].label}`), `${plan} is represented in app pricing surfaces`);
}

console.log("Web-tier-contract test passed (env-aware checkout, shared card model, matrix from pricing source, no hardcoded Stripe URL).");
