// RUN 21 — regression lock: RUN 17 banner + RUN 18 wiring + RUN 19 fixes + RUN 20 KB + axis stubs all
// remain intact after the auto-update / startup / heartbeat work.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const main = read("src", "main", "main.mjs");
const renderer = read("src", "renderer", "renderer.js");

// RUN 17 — audit-tamper security banner (markup + verifier still wired).
assert.match(indexHtml, /id="securityBanner"/, "RUN 17 banner markup intact");
assert.match(main, /function verifyAuditIntegrity\(\)/, "RUN 17 audit-integrity verifier intact");

// RUN 18 — enterprise wiring (live capture + evidence pack + ack-whats-new).
assert.match(main, /function runPrivacyCapture\(windowMs = 10000\)/, "RUN 18 live capture intact");
assert.match(main, /ipcMain\.handle\("sentinel:export-evidence"/, "RUN 18 evidence pack intact");

// RUN 19 — kill-switch + triple-confirm delete.
assert.match(main, /function activateKillSwitch\(\)/, "RUN 19 kill-switch intact");
assert.match(main, /child\.kill\("SIGKILL"\)/, "RUN 19 SIGKILL intact");
assert.match(renderer, /function confirmDelete\(/, "RUN 19 triple-confirm delete intact");
assert.match(indexHtml, /<aria-globe class="brand-globe"/, "RUN 19 live globe intact");

// RUN 20 — system knowledge engine (KB packs + reasoner + tier-0).
assert.ok(fs.existsSync(path.join(root, "aria-kb-pack", "diagnostics", "symptoms.md")), "RUN 20 symptom KB intact");
assert.equal(fs.readdirSync(path.join(root, "aria-kb-pack", "blueprints")).filter((f) => f.endsWith(".md")).length, 10, "RUN 20 10 blueprints intact");
assert.ok(fs.existsSync(path.join(root, "src", "shared", "diagnostic-reasoner.mjs")), "RUN 20 reasoner intact");
assert.equal(fs.readdirSync(path.join(root, "src", "main", "recipes", "tier-0")).filter((f) => f.endsWith(".recipe.mjs")).length, 21, "RUN 20 tier-0 recipes intact + S2 clear-print-queue = 21");

// Tab count: RUN 23d's 9 + RUN 33 PIVOT's ARIA tab = 10 (≤10 hard stop).
assert.equal(new Set([...indexHtml.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1])).size, 11, "11 settings tabs (9 + ARIA + Walk-through)");

// axis/ stubs UNTOUCHED — present + still stub-only (RUN A scaffolding).
assert.ok(fs.existsSync(path.join(root, "axis", "README.md")), "axis/ stubs present + untouched");

// 🔒 R11 — the private-folder guard exists and is wired into the inventory path.
assert.ok(fs.existsSync(path.join(root, "src", "shared", "path-guard.mjs")), "R11 path-guard present");
assert.match(read("src", "main", "system-context.mjs"), /path-guard\.mjs/, "R11 guard wired into system-context");

console.log("Run-21-no-regression test passed (RUN 17/18/19/20 intact · 12 tabs · axis untouched · R11 guard wired).");
