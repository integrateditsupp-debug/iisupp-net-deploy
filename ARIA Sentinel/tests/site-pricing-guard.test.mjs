// R-ONE N1 - site-wide ARIA Sentinel pricing guard.
// Keeps the public/in-app tier prices aligned to src/shared/pricing-tiers.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CLIENT_PLANS, TIERS } from "../src/shared/pricing-tiers.mjs";

const sentinelRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(sentinelRoot, "..");
const read = (...p) => fs.readFileSync(path.join(repoRoot, ...p), "utf8");

const source = fs.readFileSync(path.join(sentinelRoot, "src", "shared", "pricing-tiers.mjs"), "utf8");
const ariaCore = read("assets", "aria-core.js");
const planPicker = fs.readFileSync(path.join(sentinelRoot, "src", "overlay", "plan-picker.mjs"), "utf8");
const renderer = fs.readFileSync(path.join(sentinelRoot, "src", "renderer", "index.html"), "utf8");

for (const plan of CLIENT_PLANS) {
  assert.ok(TIERS[plan].priceDisplay, `${plan} has a price display`);
  assert.match(source, new RegExp(TIERS[plan].stripeEnv || "STRIPE_"), `${plan} stripe env is sourced`);
}

for (const required of ["$599", "$1,500", "$156K"]) {
  assert.ok(ariaCore.includes(required) || renderer.includes(required) || planPicker.includes(required), `site/in-app surfaces include ${required}`);
}
for (const required of ["$312K", "$625K"]) {
  assert.ok(source.includes(required) || planPicker.includes(required), `matrix source includes ${required}`);
}

const staleMonthly = [
  /\$49\s*\/\s*(mo|month)/i,
  /\$99\s*\/\s*(mo|month)/i,
  /\$199\s*\/\s*(mo|month)/i,
  /\$499\s*\/\s*(mo|month)/i
];
for (const [name, text] of Object.entries({ "assets/aria-core.js": ariaCore, "renderer/index.html": renderer, "plan-picker.mjs": planPicker })) {
  for (const pat of staleMonthly) assert.doesNotMatch(text, pat, `${name} has no stale ARIA Sentinel monthly tier price`);
}

assert.doesNotMatch(source, /https?:\/\/buy\.stripe|checkout\.stripe/i, "tier source names env vars only, not checkout URLs");
assert.match(planPicker, /planComparisonTable/, "in-app matrix renders from pricing-tiers source");

console.log("Site-pricing-guard test passed (ARIA Sentinel prices match pricing-tiers source; no stale monthly tier prices).");
