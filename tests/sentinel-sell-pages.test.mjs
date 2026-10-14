// sentinel-sell-pages.test.mjs — F4 2026-10-14 (audit B11 / R4 / R19 / sell pages).
//
// A stranger who pays for ARIA Sentinel lands on /downloads/?checkout=success&session_id=… (stripe-checkout.js sends
// Sentinel tiers there; the webhook emails the key). That page must tell them the three true things — the key is on its
// way, download + install (unsigned pilot build: SmartScreen warns), paste the key — and never say "coming soon" beside
// five SUBSCRIBE buttons. A cancelled checkout returns to /plans/?checkout=canceled and must read as neutral. Prices on
// both pages are the ones in ARIA Sentinel/src/shared/pricing-tiers.mjs. No page promises SMS, "auto-updates
// included", a download date, or 24/7 human support — the code and the contracts do not say so.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TIERS, CLIENT_PLANS } from "../ARIA Sentinel/src/shared/pricing-tiers.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const downloads = read("downloads/index.html");
const plans = read("plans/index.html");
const checkout = read("netlify/functions/stripe-checkout.js");

// The checkout function and the pages agree on where a Sentinel buyer lands.
assert.ok(checkout.includes("'/downloads/?checkout=success&session_id={CHECKOUT_SESSION_ID}'"), "Sentinel success → /downloads/?checkout=success&session_id=…");
assert.ok(checkout.includes("'/plans/?checkout=canceled'"), "Sentinel cancel → /plans/?checkout=canceled");

// /downloads success state: present, hidden by default, driven by the query string, three steps, session reference.
assert.ok(/\.checkout-state\{display:none/.test(downloads), "the state boxes are hidden until the query string says otherwise");
assert.ok(downloads.includes('id="checkout-success"'), "success box exists");
assert.ok(/q\.get\('checkout'\)/.test(downloads) && /state === 'success'/.test(downloads), "success state is read from ?checkout=success");
assert.ok(/q\.get\('session_id'\)/.test(downloads), "session_id is read");
assert.ok(/sid\.slice\(-8\)/.test(downloads), "only a short suffix of the session id is ever shown");
assert.ok(/license key is on its way/i.test(downloads), "step 0: the key is on its way");
assert.ok(/<li><b>Check your email<\/b>/.test(downloads), "step 1: check your email");
assert.ok(/<li><b>Download and run the installer<\/b>/.test(downloads) && /Run anyway/.test(downloads), "step 2: download + install, with the SmartScreen truth");
assert.ok(/<li><b>Open ARIA Sentinel and paste the key<\/b>/.test(downloads), "step 3: paste the key");
assert.ok(/No email after 15 minutes/.test(downloads), "a recovery path when the email does not arrive");
assert.ok(!/stripe-confirm/.test(downloads), "never calls stripe-confirm (it would mint an ARIA-web token, not a Sentinel key)");
// Cancel state: neutral on both pages, every spelling Stripe/users produce.
assert.ok(downloads.includes('id="checkout-cancel"') && /nothing was charged/i.test(downloads), "/downloads cancel state is neutral");
assert.ok(/state === 'cancel' \|\| state === 'canceled' \|\| state === 'cancelled'/.test(downloads), "/downloads accepts cancel|canceled|cancelled");
assert.ok(plans.includes('id="pf-checkout-cancel"') && /nothing was charged/.test(plans), "/plans cancel state is neutral");
assert.ok(/c==='cancel'\|\|c==='canceled'\|\|c==='cancelled'/.test(plans), "/plans accepts cancel|canceled|cancelled");

// Honest delivery copy: no 'coming soon', no dated promise, the unsigned truth, the emailed-installer truth.
for (const [name, html] of [["downloads", downloads], ["plans", plans]]) {
  assert.ok(!/coming soon/i.test(html.replace(/<!--[\s\S]*?-->/g, "").split('class="pf-roadmap"')[0]), `${name}: no 'coming soon' on the Sentinel sell surface (the labelled roadmap block aside)`);
  assert.ok(!/within a month/i.test(html), `${name}: no 'within a month'`);
  assert.ok(!/Auto-updates included/.test(html), `${name}: no 'auto-updates included'`);
  assert.ok(!/24\/7 (human )?support/i.test(html.replace(/No tier includes 24\/7 human support/g, "")), `${name}: no 24/7 support promise`);
}
assert.ok(/emailed after checkout/i.test(downloads), "downloads: key + installer emailed after checkout");
assert.ok(/not yet code-signed/.test(downloads) && /SmartScreen/.test(downloads), "downloads: unsigned pilot build, SmartScreen will warn");
assert.ok(/not yet code-signed/.test(plans) && /SmartScreen/.test(plans), "plans: the Sentinel section says the same");
assert.ok(/No tier includes 24\/7 human support or SMS alerts/.test(downloads), "downloads: no 24/7-human, no SMS");
assert.ok(/Pilot build now/.test(downloads) && /Roadmap &middot; not scheduled/.test(downloads), "platform roadmap is dated honestly (Windows now, others unscheduled)");

// Prices: every card on both pages equals pricing-tiers.mjs, and the five SUBSCRIBE buttons post the real tier keys.
for (const p of CLIENT_PLANS) {
  const t = TIERS[p];
  const monthly = t.priceMonthlyDisplay || t.priceDisplay;
  assert.ok(downloads.includes(`<div class="price">${monthly}<small>/mo</small></div>`), `downloads: ${t.label} ${monthly}/mo`);
  assert.ok(plans.includes(`<div class="pf-price">${monthly}<span class="pf-unit">/mo</span></div>`), `plans: ${t.label} ${monthly}/mo`);
}
for (const annual of ["$234,000", "$468,000", "$937,500"]) assert.ok(downloads.includes(`${annual}/yr billed annually`), `downloads states ${annual}/yr`);
const keys = [...downloads.matchAll(/data-tier="([^"]+)"/g)].map((m) => m[1]);
assert.deepEqual(keys, ["sentinel_personal_m", "sentinel_pro_m", "sentinel_business_y", "sentinel_midsize_y", "sentinel_enterprise_y"], "the five tier keys stripe-checkout accepts");
for (const stale of ["$599", "$1,500", "$156K", "$312K", "$625K"]) assert.ok(!downloads.includes(stale) && !plans.includes(stale), `no stale price ${stale}`);

// The HELD public download stays held: none of the parked markers is on either page.
for (const marker of ["dl-card", "AVAILABLE NOW", "aria-sentinel-windows.exe"]) {
  assert.ok(!downloads.includes(marker) && !plans.includes(marker), `held marker "${marker}" is not on a public page`);
}
// The page still carries the site disclaimer block and the notify form (nothing lost — Rule 15).
assert.ok(/iis-fineprint:start/.test(downloads) && /iis-fineprint:end/.test(downloads), "disclaimer block intact");
assert.ok(/name="sentinel-notify"/.test(downloads), "the notify form (signed-download waitlist) is intact");

console.log("sentinel-sell-pages passed (/downloads success + cancel states · stripe-checkout returns there · honest delivery copy · prices == pricing-tiers.mjs · 5 tier keys · held markers absent).");
