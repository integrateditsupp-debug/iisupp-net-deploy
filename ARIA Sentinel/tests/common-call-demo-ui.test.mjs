// JULY PORT 2026-10-14 (from cd518cea · 9f2b9bd7 · 69058206) — Control Center demo-lab wiring for a live recording
// pass. ADAPTED to the production line: the panel must label itself a SCRIPTED demonstration (Rule 14), and the
// demo runners must never reach the device — no window.sentinel call, no supervisedFix, no runRecipe, no executor
// inside the demo block. The golden "ARIA using computer" frame is a visual label only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const index = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

assert.match(index, /id="runCommonCallManual"/, "manual demo button");
assert.match(index, /id="runCommonCallConfirmed"/, "confirmed demo button");
assert.match(index, /id="runCommonCallAutonomous"/, "autonomous safe-demo button");
assert.match(index, /id="runLiveCaptureDemo"/, "live capture demo button");
assert.match(index, /id="runAutonomousTakeoverDemo"/, "autonomous takeover prompt button");
assert.match(index, /id="ariaUsingComputerFrame"/, "golden ARIA using computer frame");
assert.match(index, /id="runAutonomyFrontend"/, "front-end visible-control choice");
assert.match(index, /id="runAutonomyBackend"/, "back-end remediation choice");
assert.match(index, /id="autonomyRebootPlan"/, "reboot reminder plan host");
assert.match(index, /id="liveCaptureTimeline"/, "live capture timeline host");
assert.match(index, /id="liveCaptureReport"/, "live capture report host");
assert.match(index, /id="commonCallDemoList"/, "demo list host");
assert.match(index, /simulation only/i, "UI clearly labels simulation");
assert.match(index, /scripted demonstration/i, "Rule 14: the panel labels itself a scripted demonstration");
assert.match(index, /nothing is measured on this device, and nothing runs/i, "Rule 14: the panel says nothing is measured or run");
assert.match(index, /without changing Windows, locking accounts, bypassing policy, or granting hidden access/i, "UI states safety boundary");
// The panel lives INSIDE the existing Control Center tab (Rule 15: additive, no new nav entry).
const controlCenter = index.slice(index.indexOf('id="control-center"'), index.indexOf('id="recipes"'));
assert.match(controlCenter, /id="commonCallDemoPanel"/, "the demo lab is a panel of the Control Center tab");

assert.match(renderer, /COMMON_CALL_DEMO_SCENARIOS/, "renderer imports scenario library");
assert.match(renderer, /buildAutonomousTakeoverDemo/, "renderer imports autonomous takeover model");
assert.match(renderer, /buildLiveCaptureDemo/, "renderer imports live capture model");
assert.match(renderer, /function runLiveCaptureDemo\(\)/, "renderer has live capture runner");
assert.match(renderer, /function setAriaUsingComputerFrame\(active, mode = "frontend"\)/, "renderer toggles the golden visible-control frame");
assert.match(renderer, /function renderAutonomyChoice\(mode = null, stepIndex = -1\)/, "renderer renders the front/back prompt");
assert.match(renderer, /function runAutonomousTakeoverDemo\(mode = "frontend"\)/, "renderer runs autonomous takeover demo");
assert.match(renderer, /runAutonomousTakeoverDemo\("frontend"\)/, "front-end choice is wired");
assert.match(renderer, /runAutonomousTakeoverDemo\("backend"\)/, "back-end choice is wired");
assert.match(renderer, /forceEnabled \? "enabled by admin policy" : "disabled in this production-safe demo build"/, "forced reboot remains visibly policy-gated");
assert.match(renderer, /function proofReportFor\(demo, stepIndex\)/, "renderer writes proof report");
assert.match(renderer, /runLiveCaptureDemo\(\)/, "live capture button is wired");
assert.match(renderer, /function runCommonCallDemo\(mode\)/, "renderer has demo runner");
assert.match(renderer, /runCommonCallDemo\("manual"\)/, "manual button is wired");
assert.match(renderer, /runCommonCallDemo\("confirmed"\)/, "confirmed button is wired");
assert.match(renderer, /runCommonCallDemo\("autonomous"\)/, "autonomous button is wired");
assert.match(renderer, /demo\.completedText/, "live capture report prints proof-chain completion copy");
assert.match(renderer, /wireCommonCallDemo\(\);/, "the demo lab is wired from wireActions");

// ── The gate proof: the whole demo block reaches NOTHING on the device. ──
const demoStart = renderer.indexOf("let commonCallDemoTimer = null;");
const demoEnd = renderer.indexOf("function bindClick(id, handler)");
assert.ok(demoStart > 0 && demoEnd > demoStart, "the demo block is a contiguous section before bindClick");
const demoBlock = renderer.slice(demoStart, demoEnd);
assert.doesNotMatch(demoBlock, /sentinel\.|window\.sentinel|supervisedFix|runRecipe|previewTier0|executeTier0|selfRepair|setMode\(/, "the demo runners never call the bridge, the supervisor, a recipe or the executor");
assert.match(demoBlock, /scripted demonstration — not measured on this device/, "the proof reports say they are scripted, not measured");
assert.match(index, /ARIA using computer · scripted demo/, "the golden frame itself says it is a scripted demo");

assert.match(css, /\.common-call-demo-panel/, "demo panel styled");
assert.match(css, /\.aria-using-computer-frame/, "golden visible-control frame styled");
assert.match(css, /pointer-events:none/, "the frame never intercepts a click (visual label only)");
assert.match(css, /\.autonomy-choice-card/, "autonomous choice card styled");
assert.match(css, /\.autonomy-reboot-plan/, "reboot reminder plan styled");
assert.match(css, /\.common-call-row\.live/, "live progress styling");
assert.match(css, /\.ccr-risk\.high, \.ccr-risk\.critical/, "high-risk visual stop styling");
assert.match(css, /\.live-capture-card/, "live capture card styled");
assert.match(css, /\.live-capture-step\.running/, "running capture step styled");
assert.match(css, /\.live-capture-step\.done/, "completed capture step styled");
assert.match(css, /\.live-capture-report/, "proof report styled");

for (const [name, text] of [["index", index], ["renderer", renderer], ["css", css]]) {
  assert.doesNotMatch(text, /shutdown\.exe|Restart-Computer|Stop-Computer|forced reboot now|silently grants/i, `${name} has no unsafe autonomous operation`);
}

console.log("common-call-demo-ui passed (Control Center panel · scripted-demo labels · runners reach nothing on the device · golden frame is a label).");
