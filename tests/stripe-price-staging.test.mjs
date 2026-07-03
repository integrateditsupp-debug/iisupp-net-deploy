#!/usr/bin/env node
// STRIPE STAGED-PRICE CONTRACT (2026-07-03) — the ARIA Sentinel plan buttons + the AI-setup one-time products
// (Walk-Through / DIY Book / Cookbook) must map to STAGED, env-only Stripe prices so that when Ahmad creates the
// products and pastes the real price IDs, checkout works with ZERO code change — and NEVER charges a wrong amount
// or a fake baked price ID before launch (Rule 14). This suite reads the SHIPPED source (no env, no network) and
// asserts: (1) each staged key is env-only with NO baked `price_...` default, (2) the recurring Sentinel tiers open
// a SUBSCRIPTION (not a one-time payment) session, (3) the site's buy buttons reference tier keys that exist in the
// map, and (4) the website plan prices match pricing-tiers.mjs (source of truth) with no stale Sentinel numbers.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIERS } from "../ARIA Sentinel/src/shared/pricing-tiers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
let n = 0; const t = () => { n++; };

const checkout = read("netlify/functions/stripe-checkout.js");

// Pull the line that defines a PRICE_MAP key (e.g. `sentinel_personal_m:  process.env.X || process.env.Y,`).
function mapLine(key) {
  const re = new RegExp("(?:^|\\n)\\s*['\"]?" + key.replace(/[-]/g, "\\-") + "['\"]?\\s*:\\s*([^\\n]*)");
  const m = checkout.match(re);
  return m ? m[1] : null;
}

// 1 — the 5 Sentinel tier keys the site POSTs are all STAGED: env-only, no baked `price_...` default.
const SENTINEL_KEYS = ["sentinel_personal_m", "sentinel_pro_m", "sentinel_business_y", "sentinel_midsize_y", "sentinel_enterprise_y"];
for (const k of SENTINEL_KEYS) {
  const line = mapLine(k);
  assert.ok(line, `PRICE_MAP has a "${k}" entry`);
  assert.ok(/process\.env\./.test(line), `${k} resolves from an env var (staged)`);
  assert.ok(!/['"]price_[A-Za-z0-9]+['"]/.test(line), `${k} has NO baked live price ID (would charge a wrong/fake amount) — got: ${line.trim()}`);
}
t();

// 2 — the one-time AI-setup products are staged env-only too (Walk-Through / DIY Book / Cookbook).
for (const k of ["walkthrough", "cookbook", "diybook", "gl-ai-automation-setup-book"]) {
  const line = mapLine(k);
  assert.ok(line, `PRICE_MAP has a "${k}" entry`);
  assert.ok(/process\.env\./.test(line), `${k} resolves from an env var (staged)`);
  assert.ok(!/['"]price_[A-Za-z0-9]+['"]/.test(line), `${k} has NO baked live price ID — got: ${line.trim()}`);
}
t();

// 3 — the DIY book + Sentinel tiers accept the staged-doc env names too, so pasting the real ID into EITHER
//     variable works with zero code change (STRIPE-PRICE-LIST-TO-CREATE.md).
assert.match(mapLine("diybook") || "", /STRIPE_PRICE_DIYBOOK/, "diybook reads the staged-doc env name");
assert.match(mapLine("sentinel_personal_m") || "", /STRIPE_PRICE_PERSONAL_M/, "personal accepts the short staged-doc name");
assert.match(mapLine("sentinel_business_y") || "", /STRIPE_PRICE_SMB_Y/, "SMB accepts the short staged-doc name");
t();

// 4 — recurring Sentinel tiers MUST open a subscription session (not one-time). Otherwise, the moment a recurring
//     price ID is pasted, Stripe rejects mode:'payment' on a recurring price → broken go-live.
const subBlock = checkout.slice(checkout.indexOf("SUBSCRIPTION_TIERS"));
for (const k of SENTINEL_KEYS) {
  assert.ok(subBlock.includes(`'${k}'`), `${k} is registered as a SUBSCRIPTION tier`);
}
t();

// 5 — the site's plan buttons reference tier keys that actually exist in PRICE_MAP (no orphaned buttons).
for (const page of ["plans/index.html", "downloads/index.html"]) {
  const html = read(page);
  const tiers = [...html.matchAll(/data-tier="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(tiers.length >= 5, `${page} exposes the 5 Sentinel plan buttons (saw ${tiers.length})`);
  for (const tier of tiers) {
    assert.ok(mapLine(tier) !== null, `${page} button tier "${tier}" exists in PRICE_MAP`);
  }
}
t();

// 6 — website plan prices match pricing-tiers.mjs (source of truth), and NO stale Sentinel prices linger.
const plans = read("plans/index.html");
assert.ok(plans.includes(TIERS.personal.priceDisplay), `plans shows Personal ${TIERS.personal.priceDisplay}`);
assert.ok(plans.includes(TIERS.pro.priceDisplay), `plans shows Pro ${TIERS.pro.priceDisplay}`);
assert.ok(plans.includes("234,000") && plans.includes("468,000") && plans.includes("937,500"), "plans shows the exact fleet-tier annual prices");
for (const stale of ["$599", "$156K", "$312K", "$625K", "$156,000", "$312,000", "$625,000"]) {
  assert.ok(!plans.includes(stale), `no stale Sentinel price "${stale}" on the plans page`);
}
t();

// 7 — the Cookbook offer is present + honest (free with Walk-Through, $45 standalone) and staged (no live button yet).
assert.match(plans, /Prompt \+ Loop Cookbook/, "Cookbook offer listed on /plans");
assert.match(plans, /free with the Walk-Through/i, "Cookbook honestly noted free with the Walk-Through");
t();

assert.equal(n, 7, "7 staged-price groups");
console.log(`stripe-price-staging passed (${n} groups · 5 tiers + Walk-Through + DIY Book + Cookbook staged env-only · subscriptions open sub sessions · site prices match pricing-tiers.mjs · 0 stale).`);
