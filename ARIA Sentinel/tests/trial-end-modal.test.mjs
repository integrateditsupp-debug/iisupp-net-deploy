// RUN 19 §5 — luxury trial-end modal. 5 pricing tiers, each "Subscribe" opens the tier's Stripe
// Checkout URL from env. A <30%-remaining trial shows a non-blocking upgrade toast.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const css = read("src", "renderer", "sentinel.css");
const rendererJs = read("src", "renderer", "renderer.js");
const main = read("src", "main", "main.mjs");

// The modal exists, is the full-screen luxe variant, with a Cinzel header.
const modal = indexHtml.match(/<div id="planModal"[\s\S]*?<!--/);
assert.ok(modal, "trial-end modal block found");
const m = modal[0];
assert.match(m, /class="onboarding trial-end"/, "full-screen luxe modal");
assert.match(m, /class="trial-end-card"/, "luxe card");
assert.match(m, /Your ARIA trial has ended/, "header copy");
assert.match(m, /Choose your tier/, "subtitle copy");

// Exactly 5 pricing cards, each with the right tier + price + a Subscribe CTA carrying data-plan.
const tiers = [
  { tier: "personal", price: "$899", plan: "personal" },
  { tier: "pro", price: "$2,250", plan: "pro" },
  { tier: "smb", price: "$19,500", plan: "smb" },
  { tier: "midsize", price: "$39,000", plan: "midsize" },
  { tier: "enterprise", price: "$78,125", plan: "enterprise" }
];
const cards = m.match(/<div class="plan-card"[\s\S]*?<\/div>/g) || [];
assert.equal(cards.length, 5, "exactly 5 pricing cards");
const subs = m.match(/data-plan="[a-z]+"/g) || [];
assert.equal(subs.length, 5, "5 Subscribe CTAs");
for (const t of tiers) {
  assert.match(m, new RegExp(`data-tier="${t.tier}"`), `card for ${t.tier}`);
  assert.ok(m.includes(t.price), `price ${t.price} shown`);
  assert.match(m, new RegExp(`class="primary plan-subscribe" data-plan="${t.plan}"`), `Subscribe CTA for ${t.plan}`);
}

// "Enter license" (renamed) appears in the modal — never "Enter license key".
assert.match(m, /Enter license</, "Enter license link/button present");
assert.doesNotMatch(indexHtml, /Enter license key/, "old 'Enter license key' copy gone");

// Renderer wires each Subscribe → choosePlan(tier), and the <30% trial nudge toast.
assert.match(rendererJs, /\.plan-subscribe[\s\S]*?choosePlan\?\.\(/, "Subscribe → choosePlan");
assert.match(rendererJs, /0\.30/, "trial nudge fires under 30% remaining");
assert.match(rendererJs, /showToast\(/, "non-blocking toast helper used");

// main maps all 5 tiers to the canonical Stripe env URLs.
for (const env of [
  "STRIPE_PERSONAL_MONTHLY_URL", "STRIPE_PRO_MONTHLY_URL",
  "STRIPE_SMALL_BUSINESS_YEARLY_URL", "STRIPE_MIDSIZE_YEARLY_URL", "STRIPE_ENTERPRISE_YEARLY_URL"
]) {
  assert.match(main, new RegExp(env), `${env} mapped`);
}
assert.match(main, /function openPlanCheckout\(tier\)/, "checkout opener exists");

// CSS: shimmer on hover + gold glow on focus.
assert.match(css, /\.trial-end-card \.plan-card:hover/, "card shimmer/lift on hover");
assert.match(css, /\.trial-end-card \.plan-card:focus-within/, "gold border-glow on focus");

console.log("Trial-end-modal test passed (5 tiers · Subscribe→Stripe env · luxe shimmer/glow · <30% nudge).");
