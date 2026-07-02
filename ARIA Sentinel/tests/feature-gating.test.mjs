// RUN 23e — the renderer gates every tier surface off the broadcast state.features object (single build),
// and main broadcasts features + adminConsole instead of the deleted adminBuild flag.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const renderer = read("src", "renderer", "renderer.js");
const main = read("src", "main", "main.mjs");
const css = read("src", "renderer", "sentinel.css");

// Main broadcasts the resolved feature object + admin flag (replacing adminBuild).
assert.match(main, /features: currentPlanFeatures\(\)/, "main broadcasts state.features");
assert.match(main, /adminConsole: currentIsAdmin\(\)/, "main broadcasts state.adminConsole");
assert.doesNotMatch(main, /adminBuild: /, "the old adminBuild state field is gone");
assert.match(main, /function currentPlanFeatures\(\)/, "currentPlanFeatures defined");
// RUN 24 A6 — the desktop no longer resolves the plan locally: the license SECRET left the client, and
// enterLicense verifies the key through the server-side sentinel-resolve endpoint instead.
// SENTINEL TRIAL GATING 2026-07-02 — resolveLicenseOnline now also carries the (optional) email so the server
// can resolve a per-customer Walk-Through entitlement; the key is still verified server-side (secret off-client).
assert.match(main, /resolveLicenseOnline\(key/, "enterLicense verifies the key via the server-side resolve endpoint");
assert.doesNotMatch(main, /process\.env\.SENTINEL_LICENSE_SECRET/, "the license secret is NEVER referenced on the desktop (server-side only)");

// Renderer runs the gate pass on every state render.
assert.match(renderer, /function applyFeatureGates\(state\)/, "applyFeatureGates defined");
assert.match(renderer, /applyFeatureGates\(state\);/, "applyFeatureGates called from renderState");

// Mode tiles lock when the plan doesn't include the mode; locked tiles open the upsell, never switch.
assert.match(renderer, /row\.classList\.toggle\("locked", !allowed\)/, "mode tiles lock by allowed modes");
assert.match(renderer, /if \(button\.classList\.contains\("locked"\)\)\s*\{\s*\n\s*showUpgradeUpsell/, "locked mode click → upsell (no setMode)");
assert.match(renderer, /const UPSELL = \{/, "upsell copy map present");

// Recipe library locks below the 77-recipe quota; Reports locks without quarterlyPdf.
assert.match(renderer, /Number\(features\.recipesCount \|\| 0\) < 77/, "recipe library gated by quota");
assert.match(renderer, /"quarterlyPdf", !features\.quarterlyPdf/, "reports PDF gated by quarterlyPdf");

// Admin buttons gate on the license tier (features.adminConsole), NOT the removed build flag.
assert.match(renderer, /state\.features && state\.features\.adminConsole/, "admin buttons gate on features.adminConsole");
assert.doesNotMatch(renderer, /state\.adminBuild/, "renderer no longer reads adminBuild");

// Upgrade buttons route through choosePlan (env-resolved Stripe), never a hardcoded URL.
assert.match(renderer, /sentinel\.choosePlan\?\.\(btn\.dataset\.upsellPlan\)/, "upsell buttons call choosePlan");
assert.doesNotMatch(renderer, /stripe\.com|buy\.stripe/i, "no hardcoded Stripe URL in renderer");

// Styling for locked tiles + upsell cards exists.
assert.match(css, /\.mode-row\.locked/, "locked mode tile style");
assert.match(css, /\.upsell-card/, "upsell card style");

console.log("Feature-gating test passed (features broadcast · mode/recipe/reports gates · admin via tier · choosePlan checkout · no hardcoded URL).");
