import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
const rendererJs = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
const overlayHtml = fs.readFileSync(path.join(root, "src", "renderer", "overlay.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin-console", "index.html"), "utf8");

// RUN 23d — 9 consolidated desktop nav tabs (each is a data-tab nav button + a tab-panel section).
const settingsTabs = ["dashboard", "control-center", "recipes", "compliance-privacy", "reports", "knowledge", "system", "integrations", "settings"];
for (const tab of settingsTabs) {
  assert.match(indexHtml, new RegExp(`data-tab="${tab}"`), `settings nav includes ${tab}`);
  assert.match(indexHtml, new RegExp(`id="${tab}"`), `settings panel includes ${tab}`);
}

// RUN 22 — "reports" is a legitimate DESKTOP tab (quarterly customer reports); RUN 23d — "system" is now
// a desktop tab too (This Machine + Platform Support); 2026-07-02 — "integrations" is a desktop tab again
// (the restored Integrations tab). The rest stay admin-console-only.
for (const adminOnly of ["release", "endpoints", "policies", "stopcodes", "audit", "access"]) {
  assert.doesNotMatch(indexHtml, new RegExp(`data-tab="${adminOnly}"`), `${adminOnly} is not a desktop settings tab`);
}

for (const id of [
  "recipeList",
  "knowledgeRows",
  "outboundList",
  "logList",
  "routingRows",
  "systemChecks",
  "openAdminConsole"
]) {
  assert.match(indexHtml, new RegExp(`id="${id}"`), `settings shell includes ${id}`);
}

for (const api of ["selfDiagnose", "selfRepair", "showGlobe", "setPaused", "openAdminConsole", "reportError"]) {
  assert.match(rendererJs, new RegExp(`\\.${api}\\b|${api}:`), `renderer supports ${api}`);
}

for (const label of [
  "Sentinel Admin",
  "Release Gate Status",
  "Content-Blind Telemetry Proof",
  "Endpoint Health Summary",
  "Fleet Policy Controls",
  "Recent Audit Events",
  "Recipe Circuit Breaker",
  "Integrations",
  "Quick Actions"
]) {
  assert.match(adminHtml, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `admin console includes ${label}`);
}

assert.match(overlayHtml, /globe-button/, "overlay starts as a standalone globe button");
assert.match(overlayHtml, /overlayCard/, "overlay still has a hidden fix card for detections");

// BLOCK 3 — all 13 admin panels exist, are nav-targeted, and carry real content.
const adminViews = [
  "overview","release","endpoints","policies","recipes","kb-bundles",
  "stop-codes","audit-events","reports","integrations","settings","access","system","updates"
];
for (const v of adminViews) {
  assert.match(adminHtml, new RegExp(`data-view="${v}"`), `admin console panel ${v} exists`);
}

// RUN 12 — the Settings window opens big enough that the left rail never clips (Fix 1),
// and the floating-globe toggle lives in About (Fix 5).
const mainJsForShell = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
assert.match(mainJsForShell, /minWidth:\s*1024/, "settings window minWidth keeps the rail visible");
assert.match(mainJsForShell, /minHeight:\s*720/, "settings window minHeight set");
assert.match(indexHtml, /id="showFloatingGlobe"/, "About has the Show-floating-globe toggle");

console.log(`UI shell split test passed (${settingsTabs.length} settings tabs, separate admin console with ${adminViews.length} panels).`);
