// RUN 22 — adding the presentation layer didn't break RUN 17/18/19/20/21 features.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const main = read("src", "main", "main.mjs");
const indexHtml = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");

assert.match(indexHtml, /id="securityBanner"/, "RUN 17 banner intact");
assert.match(main, /function runPrivacyCapture/, "RUN 18 live capture intact");
assert.match(main, /ipcMain\.handle\("sentinel:export-evidence"/, "RUN 18 evidence pack intact");
assert.match(main, /function activateKillSwitch/, "RUN 19 kill-switch intact");
assert.match(renderer, /function confirmDelete/, "RUN 19 triple-confirm intact");
assert.ok(fs.existsSync(path.join(root, "aria-kb-pack", "diagnostics", "symptoms.md")), "RUN 20 KB intact");
assert.match(main, /function activateKillSwitch/, "kill-switch present");
assert.match(main, /function runUpdateCheck/, "RUN 21 update listener intact");
assert.match(main, /function registerStartup/, "RUN 21 startup registrar intact");
assert.ok(fs.existsSync(path.join(root, "src", "shared", "path-guard.mjs")), "R11 guard intact");
// axis stubs untouched.
assert.ok(fs.existsSync(path.join(root, "axis", "README.md")), "axis stubs untouched");
// RUN 23d — Performance is now a ## section inside the Dashboard tab (anchored by its old id), not a
// standalone tab-panel. Its widgets must still render.
assert.match(indexHtml, /id="performance"/, "Performance section anchor present");
assert.match(indexHtml, /id="perfOperational"/, "operational KPIs section present");
assert.match(indexHtml, /id="perfAI"/, "AI performance section present");
assert.match(indexHtml, /id="perfUsage"/, "usage patterns section present");

console.log("Performance-tab-no-regression test passed (RUN 17–21 intact · axis untouched · Performance tab added).");
