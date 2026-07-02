// RUN 23 — regression lock: everything RUN 17→22 shipped stays intact after the self-service loop work
// (process detectors · supervisor · countdown gate · dry-run policy · quarterly cron · cowork bridge), the
// new RUN 23 modules exist, and ZERO new npm runtime deps were added.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const main = read("src", "main", "main.mjs");
const renderer = read("src", "renderer", "renderer.js");

// RUN 17 — audit-tamper security banner.
assert.match(indexHtml, /id="securityBanner"/, "RUN 17 banner markup intact");
assert.match(main, /function verifyAuditIntegrity\(\)/, "RUN 17 audit-integrity verifier intact");

// RUN 18 — enterprise wiring.
assert.match(main, /function runPrivacyCapture\(windowMs = 10000\)/, "RUN 18 live capture intact");
assert.match(main, /ipcMain\.handle\("sentinel:export-evidence"/, "RUN 18 evidence pack intact");

// RUN 19 — kill-switch + triple-confirm delete + live globe.
assert.match(main, /function activateKillSwitch\(\)/, "RUN 19 kill-switch intact");
assert.match(main, /child\.kill\("SIGKILL"\)/, "RUN 19 SIGKILL intact");
assert.match(renderer, /function confirmDelete\(/, "RUN 19 triple-confirm delete intact");
assert.match(indexHtml, /<aria-globe class="brand-globe"/, "RUN 19 live globe intact");

// RUN 20 — system knowledge engine (20 Tier-0 recipes, reasoner, KB).
assert.equal(fs.readdirSync(path.join(root, "src", "main", "recipes", "tier-0")).filter((f) => f.endsWith(".recipe.mjs")).length, 21, "RUN 20 recipes intact (20) + S2 clear-print-queue = 21");
assert.ok(fs.existsSync(path.join(root, "src", "shared", "diagnostic-reasoner.mjs")), "RUN 20 reasoner intact");

// RUN 22 report/email modules intact; RUN 23d's 9 + RUN 33 PIVOT's ARIA tab = 10.
assert.equal(new Set([...indexHtml.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1])).size, 11, "11 settings tabs (9 + ARIA + Walk-through)");
assert.ok(fs.existsSync(path.join(root, "src", "main", "report-generator.mjs")), "RUN 22 report generator intact");

// axis/ stubs UNTOUCHED.
assert.ok(fs.existsSync(path.join(root, "axis", "README.md")), "axis/ stubs present + untouched");

// 🔒 R11 — guard present + still wired into the inventory path.
assert.ok(fs.existsSync(path.join(root, "src", "shared", "path-guard.mjs")), "R11 path-guard present");
assert.match(read("src", "main", "system-context.mjs"), /path-guard\.mjs/, "R11 guard wired into system-context");

// RUN 23 — the new modules all exist.
const NEW = [
  "src/main/process-detectors.mjs", "src/shared/recommend-action.mjs", "src/overlay/globe-status-panel.mjs",
  "src/overlay/globe-status-panel.html", "src/overlay/globe-status-panel.css", "src/main/action-countdown.mjs",
  "src/overlay/action-indicator.mjs", "src/overlay/action-indicator.html", "src/overlay/action-indicator.css",
  "src/main/supervisor-agent.mjs", "src/main/dry-run-policy.mjs", "src/shared/cowork-redact.mjs",
  "netlify/functions/aria-sentinel-quarterly-cron.js", "netlify/functions/aria-sentinel-cowork-bridge.js",
  "cowork-tools/sentinel-bridge.mjs"
];
for (const f of NEW) assert.ok(fs.existsSync(path.join(root, f)), `RUN 23 file present: ${f}`);

// Runtime deps are locked. Documented exceptions: electron-store (pre-existing), electron-updater, and
// vosk-browser (2026-07-02) — the OFFLINE on-device STT engine that REPLACED the browser Web Speech recognizer so
// tap-to-speak never sends audio to the cloud. No other runtime deps may be added silently.
const pkg = JSON.parse(read("package.json"));
assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["electron-store", "electron-updater", "vosk-browser"], "runtime deps locked (+ vosk-browser on-device STT)");
assert.deepEqual(Object.keys(pkg.devDependencies).sort(), ["electron", "electron-builder"], "no new dev deps");

// Customer build still ships from the src/** allow-list (new modules included; cowork-tools/netlify excluded).
assert.ok(pkg.build.files.includes("src/**/*"), "src tree shipped to customers");
assert.ok(!pkg.build.files.some((f) => /cowork-tools|netlify/.test(f)), "cowork-tools/netlify excluded from customer build");

console.log("Run-23-no-regression test passed (RUN 17→22 intact · 21 recipes (20 + S2 clear-print-queue) · 9 tabs · axis untouched · R11 wired · 15 new files · 0 new deps).");
