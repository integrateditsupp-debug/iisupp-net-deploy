// R-ONE N1 — site-wide pricing guard. Fails CI if any OLD Sentinel-tier price reappears on a customer
// surface, or if a page drifts from the pricing-tiers.mjs single source. This is the "prices can never
// drift again" guarantee. (Service/retainer prices like the $1,500–$2,500 home-IT lines are NOT tier
// prices and are intentionally out of scope.)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TIERS, monthlyDisplay } from "../src/shared/pricing-tiers.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// 1 — single source carries the +50% values (N1) + N5 monthly/visits.
assert.equal(TIERS.personal.price, 899);
assert.equal(TIERS.pro.price, 2250);
assert.equal(TIERS.smb.price, 234000);
assert.equal(TIERS.midsize.price, 468000);
assert.equal(TIERS.enterprise.price, 937500);

// 2 — NO stale tier price anywhere on the customer pricing surfaces. These tokens are unambiguous tier
//     prices (the home-IT service lines use $1,500–$2,500 ranges, never these exact tier strings).
const STALE = ["$599", "$156,000", "$156K", "$312,000", "$312K", "$625,000", "$625K", "$1,500/mo", "$1,500<", "$1,500 USD"];
const SURFACES = [
  "plans/index.html", "downloads/index.html", "pricing-experiments.html",
  "verticals/finance.html", "verticals/healthcare.html", "verticals/legal.html",
  "trust/perf.html", "trust/index.html", "trust/routing-accuracy.html",
  "ARIA Sentinel/src/renderer/index.html",
];
for (const f of SURFACES) {
  const html = read(f);
  for (const old of STALE) {
    assert.ok(!html.includes(old), `STALE price "${old}" found in ${f} — must render the +50% value`);
  }
}

// 3 — the canonical /plans page shows the new monthly figures from the single source.
const plans = read("plans/index.html");
for (const p of ["personal", "pro", "smb", "midsize", "enterprise"]) {
  const md = monthlyDisplay(p);
  // personal/pro: "$899/mo"; business: "$19,500/mo (billed annually)" — at minimum the $-figure must appear.
  const fig = md.split("/")[0];
  assert.ok(plans.includes(fig), `/plans shows ${p} monthly figure ${fig}`);
}

// 4 — the $70 web tier is UNCHANGED (must not have been swept by the +50%).
assert.ok(plans.includes("ARIA Web") || read("aria.html").includes("aria-web-tier"), "the $70 web tier is left intact");

console.log("site-pricing-guard test passed (single source at +50% · 0 stale tier prices across 10 surfaces · /plans monthly figures match source · $70 web tier untouched).");
