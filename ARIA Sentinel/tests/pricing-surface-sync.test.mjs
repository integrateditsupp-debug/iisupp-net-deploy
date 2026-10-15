// PROD 2026-10-14 (audit R4 / R5) — ONE price source, ONE buy path. Every in-app surface (renderer, trial-end
// modal, plan-picker overlay, upsell copy) prints prices from pricing-tiers.mjs and opens the live plans page;
// no dollar literal may disagree with the tier table, no buy control may point at a page that 404s, and the
// desktop never reads a Stripe env var on the customer's machine.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TIERS, CLIENT_PLANS, PLANS_URL, plansUrl, priceLine, yearlyDisplay, monthlyDisplay, SEPARATE_HUMAN_SUPPORT_NOTE } from "../src/shared/pricing-tiers.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0; const t = () => { n++; };

// 1 — plansUrl: the one buy URL, with tier + billing, never a 404 path, never an env var.
assert.equal(PLANS_URL, "https://iisupp.net/plans/");
assert.equal(plansUrl(), "https://iisupp.net/plans/?from=app");
assert.equal(plansUrl("pro"), "https://iisupp.net/plans/?from=app&tier=pro");
assert.equal(plansUrl("Small Business", { billing: "yearly" }), "https://iisupp.net/plans/?from=app&tier=smb&billing=yearly");
assert.equal(plansUrl("admin"), "https://iisupp.net/plans/?from=app", "internal tiers never appear in a buy URL");
assert.equal(plansUrl("free"), "https://iisupp.net/plans/?from=app");
assert.doesNotMatch(plansUrl("pro"), /aria-sentinel|sentinel-status|\/contact/, "never the dead pages the audit found");
t();

// 2 — priceLine / yearlyDisplay: monthly tiers "/mo"; annual tiers "/mo · billed annually ($X/yr)"; yearly = 12× or the stated annual.
assert.deepEqual(priceLine("personal"), { amount: "$899", unit: "/mo", note: "", label: "$899/mo" });
assert.deepEqual(priceLine("pro", "monthly"), { amount: "$2,250", unit: "/mo", note: "", label: "$2,250/mo" });
assert.equal(priceLine("smb").unit, "/mo"); assert.match(priceLine("smb").note, /^billed annually \(\$234K\/yr\)$/);
assert.equal(yearlyDisplay("personal"), "$10,788"); assert.equal(yearlyDisplay("pro"), "$27,000"); assert.equal(yearlyDisplay("smb"), "$234,000");
assert.deepEqual(priceLine("pro", "yearly"), { amount: "$27,000", unit: "/yr", note: "billed annually", label: "$27,000/yr · billed annually" });
assert.equal(priceLine("enterprise", "yearly").amount, "$937,500");
assert.equal(priceLine("free").amount, "Free"); assert.equal(priceLine("admin").unit, "");
assert.equal(monthlyDisplay("pro"), "$2,250/mo");
t();

// 3 — the trial-end modal's STATIC prices equal the tier table (the renderer re-renders them at runtime from the same table).
const html = rd("src", "renderer", "index.html");
const modal = html.match(/<div id="planModal"[\s\S]*?<!--/)[0];
for (const plan of CLIENT_PLANS) {
  const card = modal.match(new RegExp(`<div class="plan-card" data-tier="${plan}">[\\s\\S]*?<\\/div>`))[0];
  const shown = (card.match(/\$[\d,.]+K?/) || [])[0];
  assert.equal(shown, TIERS[plan].priceMonthlyDisplay, `${plan}: static modal price equals pricing-tiers`);
}
assert.match(modal, /id="planModalUpdates"/, "the updates badge is dynamic (manual / OTA from state)");
assert.doesNotMatch(modal, /Auto-updates included/, "no static 'Auto-updates included' promise");
assert.match(modal, /data-plan-billing="yearly"/, "the modal has a Yearly tab");
t();

// 4 — no dollar literal in the renderer / overlay JS that disagrees with the table; UPSELL prices come from monthlyDisplay().
const renderer = rd("src", "renderer", "renderer.js");
const picker = rd("src", "overlay", "plan-picker.mjs");
for (const [name, src] of [["renderer.js", renderer], ["plan-picker.mjs", picker], ["overlay.js", rd("src", "renderer", "overlay.js")]]) {
  const literals = (src.match(/\$[1-9][\d,]*(?:\.\d+)?K?(?:\/mo|\/yr)?/g) || []); // "$0" (a KB answer costs nothing) is a cost badge, not a price
  assert.deepEqual(literals, [], `${name}: no dollar literals (found ${literals.join(", ")})`);
}
assert.doesNotMatch(renderer, /1,500/, "the stale $1,500 Pro price is gone");
assert.match(renderer, /const PRO_PRICE = monthlyDisplay\("pro"\)/, "upsell copy derives the Pro price from pricing-tiers");
assert.match(renderer, /priceLine\(plan, planModalBilling\)/, "the modal re-renders prices from priceLine()");
assert.match(renderer, /setText\("planSupportNote", SEPARATE_HUMAN_SUPPORT_NOTE\)/, "the human-support note appears on the pricing surface");
assert.match(picker, /priceLine\(p, billing\)/, "the plan picker renders priceLine() (yearly tab = real yearly totals)");
assert.match(picker, /billing: billing === "yearly" \? "yearly" : "monthly"/, "choosePlan carries the billing period");
assert.ok(SEPARATE_HUMAN_SUPPORT_NOTE.length > 20);
t();

// 5 — every buy / support link in the markup is a live page; no Stripe env on the desktop renderer.
const supports = [...html.matchAll(/data-support="([^"]+)"/g)].map((m) => m[1]);
for (const u of supports) assert.doesNotMatch(u, /aria-sentinel\/|sentinel-status|\/contact$/, `dead page in data-support: ${u}`);
assert.ok(supports.includes("https://iisupp.net/plans/?from=app"), "the plan-details link opens the live plans page");
assert.ok(supports.includes("https://iisupp.net/account"), "the account page is linked");
assert.doesNotMatch(renderer + picker, /process\.env/, "the renderer never reads env vars");
assert.doesNotMatch(renderer + picker + html, /stripe\.com|buy\.stripe|STRIPE_/i, "no Stripe URL or env name in customer-facing renderer surfaces");
t();

assert.equal(n, 5, "5 pricing-surface-sync groups");
console.log(`pricing-surface-sync test passed (${n} groups · plansUrl tier+billing never 404 · priceLine/yearlyDisplay · static modal prices = TIERS · no dollar literals in renderer/overlay · live support links, no env/Stripe on the desktop).`);
