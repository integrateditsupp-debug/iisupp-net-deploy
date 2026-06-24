// RUN 23e — plan-picker overlay surface: data-driven from pricing-tiers, env-resolved Stripe (no
// hardcoded URLs), monthly/yearly toggle, current-plan highlight, wired into main + preload.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const html = read("src", "overlay", "plan-picker.html");
const mjs = read("src", "overlay", "plan-picker.mjs");
const css = read("src", "overlay", "plan-picker.css");
const main = read("src", "main", "main.mjs");
const preload = read("src", "main", "preload.cjs");

// Surface exists + links its module/styles.
assert.match(html, /plan-picker\.mjs/, "loads its module");
assert.match(html, /plan-picker\.css/, "loads its styles");
assert.match(html, /data-billing="monthly"/, "monthly billing toggle");
assert.match(html, /data-billing="yearly"/, "yearly billing toggle");
assert.match(html, /id="cards"/, "plan card host");
assert.match(html, /id="matrix"/, "comparison matrix host");

// Data-driven from the single source of truth — never hardcodes prices or plans.
assert.match(mjs, /from "\.\.\/shared\/pricing-tiers\.mjs"/, "imports the pricing-tiers source of truth");
assert.match(mjs, /planComparisonTable\(\)/, "renders the shared comparison matrix");
assert.match(mjs, /CLIENT_PLANS/, "iterates the canonical client plans");

// 🚫 Stop condition — NO hardcoded Stripe URL anywhere in the picker; checkout goes through choosePlan.
for (const [name, src] of [["html", html], ["mjs", mjs], ["css", css]]) {
  assert.doesNotMatch(src, /stripe\.com|buy\.stripe|checkout\.stripe/i, `no hardcoded Stripe URL in ${name}`);
  assert.doesNotMatch(src, /STRIPE_[A-Z_]+_URL\s*=/, `no inline Stripe env assignment in ${name}`);
}
assert.match(mjs, /choosePlan\?\.\(/, "Subscribe routes through choosePlan (env-resolved URL in main)");
assert.match(mjs, /currentPlan/, "highlights the current plan");

// Wired into the app: main opens the surface, preload bridges it.
assert.match(main, /function openPlanPicker\(\)/, "main defines openPlanPicker");
assert.match(main, /ipcMain\.handle\("sentinel:open-plan-picker"/, "open-plan-picker IPC handled");
assert.match(main, /plan-picker\.html/, "main loads the plan-picker surface");
assert.match(preload, /openPlanPicker:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:open-plan-picker"\)/, "preload bridges openPlanPicker");

console.log("Plan-picker test passed (data-driven · no hardcoded Stripe URL · monthly/yearly toggle · current-plan highlight · wired into main+preload).");
