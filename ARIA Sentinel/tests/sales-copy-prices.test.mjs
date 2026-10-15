// F4 2026-10-14 (audit R5 / R19 / sell pages) — SALES COPY QUOTES THE PRICE THE CODE SELLS, AND CLAIMS ONLY WHAT 0.2.1 DOES.
//
// The one-pager quoted Personal $599 / Pro $1,500 / SMB $156K while pricing-tiers.mjs (the module the app, the plan
// picker and the website build read) says $899 / $2,250 / $234K; it promised a 12-hour trial next to a 30-day one, and
// pointed at a 404. This suite reads every sales surface and the two website pages and holds them to the one table.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TIERS, CLIENT_PLANS, SEPARATE_HUMAN_SUPPORT_NOTE } from "../src/shared/pricing-tiers.mjs";
import { TRIAL_DAYS } from "../src/shared/license.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const pkg = JSON.parse(read("package.json"));

const onePager = read("sales/ARIA-Sentinel-Sales-One-Pager.md");
const roi = read("sales/ARIA-Sentinel-Integrated-Pricing-ROI.md");
const downloads = read("../downloads/index.html");
const plans = read("../plans/index.html");
const notes = read(`docs/RELEASE_NOTES_${pkg.version}.md`);

// Stale figures from the previous price list must appear NOWHERE a buyer reads.
const STALE = ["$599", "$1,500", "$156K", "$312K", "$625K", "$156,000", "$312,000", "$625,000", "12-hour", "12 hour"];
for (const [name, text] of [["one-pager", onePager], ["ROI doc", roi], ["downloads page", downloads], ["plans page", plans]]) {
  for (const s of STALE) assert.ok(!text.includes(s), `${name} still carries the stale figure "${s}"`);
}

// 1 — the one-pager's tier table equals pricing-tiers.mjs: label + monthly price per client plan, annual for business tiers.
const money = (n) => "$" + Number(n).toLocaleString("en-US");
for (const p of CLIENT_PLANS) {
  const t = TIERS[p];
  const row = onePager.split("\n").find((l) => l.startsWith(`| **${t.label}**`));
  assert.ok(row, `one-pager has a row for ${t.label}`);
  const monthly = t.priceMonthly || t.price;
  assert.ok(row.includes(`${money(monthly)} / mo`), `${t.label} row quotes ${money(monthly)} / mo (got: ${row})`);
  if (t.billedAnnually) {
    assert.ok(row.includes(`${money(t.price)} / yr`), `${t.label} row quotes the annual price ${money(t.price)} / yr`);
    assert.ok(/billed annually/.test(row), `${t.label} row says billed annually`);
    assert.ok(row.includes(`${t.bundledVisits.onsitePerYear} on-site visit`), `${t.label} row states the bundled visits`);
  }
  assert.ok(row.includes(`${t.features.recipesCount}-recipe`) || row.includes(`${t.features.recipesCount} fix recipes`) || row.includes("Everything in Pro") || row.includes("Same,"), `${t.label} row's recipe claim matches the tier (${t.features.recipesCount})`);
}
assert.ok(onePager.includes(`${TRIAL_DAYS}-day free trial`), `the trial length is the code's (${TRIAL_DAYS} days)`);
assert.ok(onePager.includes("iisupp.net/plans"), "the buy link is the live plans page, not /aria-sentinel");
assert.ok(!onePager.includes("iisupp.net/aria-sentinel"), "no link to the 404 page");
assert.ok(onePager.includes("separate, quote-based contract"), "the separate-human-support note (N5) is on the pricing surface");
assert.ok(/No tier includes 24\/7 human support/.test(onePager), "no 24/7 human promise");
assert.ok(/unsigned/i.test(onePager), "the one-pager states the signing status");
assert.ok(/No SMS/i.test(onePager), "no SMS promise");
assert.ok(/UAC/.test(onePager), "admin fixes are described as UAC-gated, not unattended");
assert.ok(!/24\/7\./.test(onePager.split("## How it works")[0].replace(/No tier includes 24\/7 human support/, "")), "the headline does not sell 24/7");
const kb = JSON.parse(read("aria-kb-pack/kb-fulltext.json"));
assert.ok(onePager.includes(`${Math.floor(kb.count / 10) * 10}-article knowledge base`), `the KB size claim matches the bundled pack (${kb.count} articles)`);

// 2 — the ROI doc: same prices, writes honestly scoped, bands labelled as bands.
for (const p of CLIENT_PLANS) {
  const t = TIERS[p];
  const monthly = t.priceMonthly || t.price;
  assert.ok(roi.includes(`${t.label} **${money(monthly)}/mo**`), `ROI doc quotes ${t.label} ${money(monthly)}/mo`);
}
assert.ok(roi.includes("$234K / $468K / $937.5K per year"), "ROI doc quotes the annual prices in the registered form (docs/QUOTED-FIGURES.md)");
assert.ok(/read-only.*ship/i.test(roi), "ROI doc says directory READS ship today");
assert.ok(/write actions[^.]*(per engagement|implementation)/i.test(roi), "ROI doc scopes directory WRITES to the engagement, not the shipped product");
assert.ok(roi.includes("not a price a buyer can click"), "the implementation band is labelled a band that ends in a quote");
assert.ok(roi.includes("ARIA Web ($70/mo)"), "the web tier price stays consistent with the site");
assert.ok(/not shipped software/i.test(roi), "Integrated is not sold as shipped software");

// 3 — the website: /downloads cards and /plans cards quote the table; delivery copy is honest.
for (const p of CLIENT_PLANS) {
  const t = TIERS[p];
  const monthlyDisplay = t.priceMonthlyDisplay || t.priceDisplay;
  assert.ok(downloads.includes(`<div class="price">${monthlyDisplay}<small>/mo</small></div>`), `downloads card quotes ${t.label} ${monthlyDisplay}/mo`);
  assert.ok(plans.includes(`<div class="pf-price">${monthlyDisplay}<span class="pf-unit">/mo</span></div>`), `plans card quotes ${t.label} ${monthlyDisplay}/mo`);
}
for (const annual of ["$234,000", "$468,000", "$937,500"]) {
  assert.ok(downloads.includes(`${annual}/yr billed annually`), `downloads states the annual price ${annual}`);
  assert.ok(plans.includes(`${annual}/yr`), `plans states the annual price ${annual}`);
}
assert.ok(plans.includes(SEPARATE_HUMAN_SUPPORT_NOTE.split(" — ")[0].replace("OR", "OR")), "plans carries the N5 human-support note");
assert.ok(!/coming soon/i.test(downloads), "downloads no longer says 'coming soon' — it says how delivery works");
assert.ok(!/within a month/i.test(downloads) && !/within a month/i.test(plans), "no 'within a month' promise anywhere");
assert.ok(/emailed after (checkout|purchase)/i.test(downloads), "downloads says the installer + key are emailed after checkout");
assert.ok(/not yet code-signed|unsigned/i.test(downloads) && /SmartScreen/.test(downloads), "downloads states the unsigned/SmartScreen truth");
assert.ok(/No tier includes 24\/7 human support/.test(downloads), "downloads makes no 24/7 human promise");
assert.ok(!/Auto-updates included/.test(downloads) && !/Auto-updates included/.test(plans), "no 'auto-updates included' badge on the sell pages");
assert.ok(!/SMS/.test(plans.split("<!-- COMING SOON")[0]) || /no SMS|SMS alerts in this version/i.test(plans), "plans does not sell SMS as shipped");
assert.ok(/not yet code-signed/.test(plans), "plans Sentinel section states the pilot build is unsigned");

// 4 — post-checkout states on the pages stripe-checkout returns to.
assert.ok(downloads.includes('id="checkout-success"'), "downloads has the success state");
assert.ok(/Check your email/.test(downloads) && /Download and run the installer/.test(downloads) && /paste the key/.test(downloads), "the three post-purchase steps");
assert.ok(/session_id/.test(downloads), "the success state reads session_id");
assert.ok(downloads.includes('id="checkout-cancel"') && /'cancel' \|\| state === 'canceled'/.test(downloads), "downloads handles ?checkout=cancel|canceled neutrally");
assert.ok(plans.includes('id="pf-checkout-cancel"') && /nothing was charged/.test(plans), "plans handles the cancelled checkout neutrally");
assert.ok(!/stripe-confirm/.test(downloads), "the success page never calls stripe-confirm (it would mint an ARIA-web token)");
const checkout = read("../netlify/functions/stripe-checkout.js");
assert.ok(checkout.includes("'/downloads/?checkout=success&session_id={CHECKOUT_SESSION_ID}'"), "stripe-checkout returns Sentinel tiers to the downloads success state");
assert.ok(checkout.includes("'/plans/?checkout=canceled'"), "…and sends a cancelled Sentinel checkout to plans");

// 5 — the release notes agree with the sell pages on what is NOT included.
for (const must of [/SMS/, /unsigned/i, /macOS/, /Unattended administrator fixes/]) assert.match(notes, must, `release notes mention ${must}`);

console.log(`sales-copy-prices test passed (one-pager + ROI + /downloads + /plans == pricing-tiers.mjs for ${CLIENT_PLANS.length} tiers · ${TRIAL_DAYS}-day trial · no stale $599/$1,500/$156K/12-hour · no 24/7-human/SMS/auto-update promises · checkout success + cancel states wired).`);
