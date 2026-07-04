// RUN-C C1 - local funnel guard: customer-facing route files and conversion chain are present.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..", "..");
const mustExist = [
  "aria.html",
  "plans/index.html",
  "public/sentinel-binaries/README.md",
  "netlify/functions/sentinel-resolve.mjs",
  "netlify/functions/sentinel-stripe-webhook.mjs"
];
for (const rel of mustExist) assert.equal(existsSync(join(repo, rel)), true, `${rel} exists`);

const plans = readFileSync(join(repo, "plans", "index.html"), "utf8");
assert.match(plans, /sentinel|ARIA/i, "plans page references ARIA/Sentinel offer");
assert.doesNotMatch(plans, /href=["']#["']/i, "plans page has no bare # CTA");

const aria = readFileSync(join(repo, "aria.html"), "utf8");
assert.match(aria, /ARIA/i, "ARIA page loads");
assert.doesNotMatch(aria, /javascript:void\(0\)/i, "ARIA page has no javascript:void dead links");

console.log("Funnel-link-guard test passed (core routes exist + no obvious dead CTA placeholders).");
