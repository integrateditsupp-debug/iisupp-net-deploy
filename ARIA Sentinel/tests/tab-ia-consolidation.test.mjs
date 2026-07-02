// RUN 23d — tab IA 17→9 consolidation lock. Verifies the merged tabs render every section, old anchor
// routes redirect correctly, every widget renderer/IPC surface is preserved, R11 holds across the merged
// surfaces, and the sidebar sub-anchor active-state + smooth-scroll wiring is in place. Pure container
// restructuring — NO widget was deleted and NO widget internals changed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// ── Test 1 — count-lock: RUN 23d 9 + RUN 33 ARIA + Walk-through (2026-07-02) = 11, in order (≤11 hard stop). ──
const navOrder = [...indexHtml.matchAll(/class="nav-item[^"]*"\s+data-tab="([^"]+)"/g)].map((m) => m[1]);
const CANONICAL = ["dashboard", "aria", "control-center", "recipes", "walkthrough", "compliance-privacy", "reports", "knowledge", "system", "servicenow", "settings"];
assert.deepEqual(navOrder, CANONICAL, "11 nav tabs in canonical order (9 + ARIA + Walk-through)");
assert.equal(new Set([...indexHtml.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1])).size, 11, "2026-07-02: 11 tabs (Walk-through added)");
ok("count-lock: 11 tabs in order (≤11 hard stop)");

// ── Test 2 — Dashboard renders all four merged sections (Overview · Performance · SLA · Activity) ──
const dashboard = indexHtml.slice(indexHtml.indexOf('id="dashboard"'), indexHtml.indexOf('id="control-center"'));
for (const id of ["heroStatus", "kpiTiles", "perfOperational", "perfAI", "perfUsage", "slaComposite", "slaUptime", "slaResponse", "slaResolution", "slaBreaches", "recentActivity", "trustStrip"]) {
  assert.match(dashboard, new RegExp(`id="${id}"`), `Dashboard hosts #${id}`);
}
for (const anchor of ["overview", "performance", "sla", "dashActivity"]) {
  assert.match(dashboard, new RegExp(`id="${anchor}"`), `Dashboard has ## anchor #${anchor}`);
}
ok("Dashboard renders Overview + Performance + SLA + Activity");

// ── Test 3 — Compliance & Privacy renders both merged sections ──
const compPriv = indexHtml.slice(indexHtml.indexOf('id="compliance-privacy"'), indexHtml.indexOf('id="reports"'));
for (const id of ["compAudit", "compPrivacy", "compTier0", "compR11", "compFrameworks", "outboundList", "captureRows", "logList", "deletePrefsList"]) {
  assert.match(compPriv, new RegExp(`id="${id}"`), `Compliance&Privacy hosts #${id}`);
}
assert.match(compPriv, /id="compliance"/, "## Compliance anchor present");
assert.match(compPriv, /id="privacy"/, "## Privacy anchor present");
ok("Compliance & Privacy renders both sections");

// ── Test 4 — System renders both merged sections (This Machine · Platform Support) ──
const system = indexHtml.slice(indexHtml.indexOf('id="system"'), indexHtml.indexOf('id="servicenow"'));
for (const id of ["systemContextApps", "systemContextSummary", "blueprintList", "blueprintView"]) {
  assert.match(system, new RegExp(`id="${id}"`), `System hosts #${id}`);
}
assert.match(system, /id="system-context"/, "## This Machine anchor present");
assert.match(system, /id="cross-platform"/, "## Platform Support anchor present");
ok("System renders This Machine + Platform Support");

// ── Test 5 — Settings renders all five merged sections (Mode · Hotkeys · Troubleshoot · Support · About) ──
const settings = indexHtml.slice(indexHtml.indexOf('id="settings"'));
for (const id of ["hotkeyStatus", "diagnosticRows", "restorePoints", "openAdminConsole2", "aboutVersion", "roiSummary", "autoUpdateToggle", "startupAuditLog"]) {
  assert.match(settings, new RegExp(`id="${id}"`), `Settings hosts #${id}`);
}
assert.match(settings, /class="mode-list"/, "Settings hosts the mode list");
assert.match(settings, /class="support-grid"/, "Settings hosts the support grid");
for (const anchor of ["mode", "hotkeys", "troubleshoot", "support", "about"]) {
  assert.match(settings, new RegExp(`id="${anchor}"`), `Settings has ## anchor #${anchor}`);
}
ok("Settings renders Mode + Hotkeys + Troubleshoot + Support + About");

// ── Test 6 — old anchor routes redirect to the correct parent + anchor ──
assert.match(renderer, /const TAB_REDIRECTS = \{/, "TAB_REDIRECTS map defined");
const EXPECT_REDIRECTS = {
  overview: "dashboard", performance: "dashboard", sla: "dashboard",
  compliance: "compliance-privacy", privacy: "compliance-privacy",
  "system-context": "system", "cross-platform": "system",
  mode: "settings", hotkeys: "settings", troubleshoot: "settings", support: "settings", about: "settings"
};
for (const [oldRoute, parent] of Object.entries(EXPECT_REDIRECTS)) {
  assert.match(renderer, new RegExp(`"?${oldRoute}"?:\\s*\\{\\s*tab:\\s*"${parent}",\\s*anchor:\\s*"${oldRoute}"`), `${oldRoute} → ${parent}#${oldRoute}`);
  // the anchor target actually exists in the markup.
  assert.match(indexHtml, new RegExp(`id="${oldRoute}"`), `anchor #${oldRoute} exists for redirect`);
}
ok("12 old anchor routes redirect to the right parent + anchor");

// ── Test 7 — every former widget renderer / surface is preserved (no widget deleted) ──
for (const id of [
  "recipeList", "tier0List", "knowledgeRows", "routingRows", "incidentList", "systemChecks",
  "perfAI", "slaBreaches", "compFrameworks", "reportsList", "outboundList", "hotkeyStatus"
]) {
  assert.match(indexHtml, new RegExp(`id="${id}"`), `widget #${id} preserved`);
}
// Renderer still defines every merged-tab loader.
for (const fn of ["loadDashboard", "loadPerformance", "loadSla", "loadCompliance", "loadReports", "loadSystemContext", "loadBlueprints", "loadIncidents", "renderTier0", "loadUpdatesPanel"]) {
  assert.match(renderer, new RegExp(`function ${fn}\\b|${fn}\\s*\\(`), `loader ${fn} preserved`);
}
ok("all widget renderers + merged-tab loaders preserved");

// ── Test 8 — merged parents fire EVERY former-tab loader (no orphaned widget on tab open) ──
const runLoaders = renderer.slice(renderer.indexOf("function runTabLoaders"), renderer.indexOf("function scrollToAnchor"));
assert.match(runLoaders, /dashboard"\)\s*\{\s*loadDashboard\(\);\s*loadPerformance\(\);\s*loadSla\(\);/, "Dashboard loads overview+perf+sla");
assert.match(runLoaders, /compliance-privacy"\)\s*loadCompliance\(\)/, "Compliance&Privacy loads compliance");
assert.match(runLoaders, /system"\)\s*\{\s*loadSystemContext\(\);\s*loadBlueprints\(\);/, "System loads context+blueprints");
assert.match(runLoaders, /settings"\)\s*loadUpdatesPanel\(\)/, "Settings loads updates/about panel");
ok("merged parents fan out to every former loader");

// ── Test 9 — sidebar sub-anchor lists exist for the 4 merged parents + active-state toggle wiring ──
for (const parent of ["dashboard", "compliance-privacy", "system", "settings"]) {
  assert.match(indexHtml, new RegExp(`class="nav-sub[^"]*"\\s+data-sub="${parent}"`), `sub-anchor list for ${parent}`);
}
assert.match(indexHtml, /class="nav-sub open" data-sub="dashboard"/, "Dashboard sub-list expanded by default");
assert.match(renderer, /qsa\("\.nav-sub"\)\.forEach\(\(sub\) => sub\.classList\.toggle\("open", sub\.dataset\.sub === target\)\)/, "only the active parent's sub-list is open");
assert.match(css, /\.nav-sub\.open \{ display: grid; \}/, "sub-list hidden unless .open");
ok("sidebar sub-anchors + active-state toggle wired");

// ── Test 10 — sub-anchor clicks smooth-scroll to the ## H2 section ──
assert.match(renderer, /qsa\("\.nav-sub a\[data-anchor\]"\)\.forEach/, "sub-anchor links wired");
assert.match(renderer, /function scrollToAnchor/, "scrollToAnchor helper present");
assert.match(renderer, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/, "smooth-scroll to anchor");
const anchorLinks = [...indexHtml.matchAll(/data-anchor="([^"]+)"/g)].map((m) => m[1]);
for (const a of anchorLinks) assert.match(indexHtml, new RegExp(`id="${a}"`), `sub-anchor link target #${a} exists`);
ok("sub-anchor clicks smooth-scroll to existing targets");

// ── Test 11 — 🔒 R11 holds across every merged surface (guard wired · enforcement widget present · no path) ──
assert.ok(fs.existsSync(path.join(root, "src", "shared", "path-guard.mjs")), "R11 path-guard present");
assert.match(read("src", "main", "system-context.mjs"), /path-guard\.mjs/, "R11 guard still wired into the System inventory path");
assert.match(compPriv, /id="compR11"/, "R11 enforcement widget lives in the Compliance & Privacy tab");
// Case-insensitive: the forbidden personal folder is never referenced in any rendered surface.
for (const surface of [indexHtml, renderer, css]) {
  assert.doesNotMatch(surface, /private pics and vids/i, "R11 forbidden path never appears in a rendered surface");
}
ok("R11 enforcement intact across merged surfaces");

// ── Test 12 — Dashboard is the default landing tab + init loads its merged sections ──
assert.match(indexHtml, /class="nav-item active"\s+data-tab="dashboard"/, "Dashboard is the active nav tab");
assert.match(indexHtml, /id="dashboard" class="tab-panel active"/, "Dashboard panel is active by default");
assert.match(renderer, /loadDashboard\(\);\s*\n\s*loadPerformance\(\);\s*\n\s*loadSla\(\);/, "init paints Dashboard's overview+perf+sla on launch");
ok("Dashboard is the default tab and paints its merged sections on launch");

assert.equal(tests, 12, "tab-ia-consolidation runs exactly 12 test cases");
console.log(`Tab-IA-consolidation test passed (${tests}/12 cases · 17→9 IA · redirects + sub-anchors + R11 intact).`);
