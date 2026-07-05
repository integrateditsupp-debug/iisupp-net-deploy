// 2026-07-04 - Control Center demo lab wiring for Ahmad's live recording pass.
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
assert.match(index, /id="liveCaptureTimeline"/, "live capture timeline host");
assert.match(index, /id="liveCaptureReport"/, "live capture report host");
assert.match(index, /id="commonCallDemoList"/, "demo list host");
assert.match(index, /simulation only/i, "UI clearly labels simulation");
assert.match(index, /without changing Windows, locking accounts, bypassing policy, or granting hidden access/i, "UI states safety boundary");

assert.match(renderer, /COMMON_CALL_DEMO_SCENARIOS/, "renderer imports scenario library");
assert.match(renderer, /buildLiveCaptureDemo/, "renderer imports live capture model");
assert.match(renderer, /function runLiveCaptureDemo\(\)/, "renderer has live capture runner");
assert.match(renderer, /function proofReportFor\(demo, stepIndex\)/, "renderer writes proof report");
assert.match(renderer, /runLiveCaptureDemo\(\)/, "live capture button is wired");
assert.match(renderer, /function runCommonCallDemo\(mode\)/, "renderer has demo runner");
assert.match(renderer, /runCommonCallDemo\("manual"\)/, "manual button is wired");
assert.match(renderer, /runCommonCallDemo\("confirmed"\)/, "confirmed button is wired");
assert.match(renderer, /runCommonCallDemo\("autonomous"\)/, "autonomous button is wired");
assert.match(renderer, /demo\.completedText/, "live capture report prints proof-chain completion copy");

assert.match(css, /\.common-call-demo-panel/, "demo panel styled");
assert.match(css, /\.common-call-row\.live/, "live progress styling");
assert.match(css, /\.ccr-risk\.high, \.ccr-risk\.critical/, "high-risk visual stop styling");
assert.match(css, /\.live-capture-card/, "live capture card styled");
assert.match(css, /\.live-capture-step\.running/, "running capture step styled");
assert.match(css, /\.live-capture-step\.done/, "completed capture step styled");
assert.match(css, /\.live-capture-report/, "proof report styled");

console.log("common-call-demo-ui passed.");
