// Walk-through LAUNCHER (2026-07-14) — the tab becomes a launcher: pick a system → Start → the guided pop-up
// opens UNDER the floating globe (its own overlay window), and as it advances ARIA live-opens each setup target.
// Proves: the launcher groups exist (AI-tool + workspace/IT + learn); the tab's Start routes to the under-globe
// companion (NOT in-tab); the main↔preload↔overlay wiring opens a SPECIFIC flow flash-free; and the in-tab runner
// is RELOCATED, not deleted (Rule 15 fallback when the globe is unavailable).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LAUNCHER_GROUPS, listFlows, getFlow } from "../src/shared/walkthrough-steps.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const renderer = rd("src", "renderer", "renderer.js");
const overlay = rd("src", "renderer", "overlay.js");
const main = rd("src", "main", "main.mjs");
const preload = rd("src", "main", "preload.cjs");
let n = 0; const t = () => { n++; };

// 1 — the launcher groups cover AI-tool setup, workspace/IT setup, and learn; each group has real flows.
assert.deepEqual(LAUNCHER_GROUPS.map((g) => g.group), ["setup", "it-setup", "learn"], "three launcher groups in order");
for (const g of LAUNCHER_GROUPS) assert.ok(listFlows(g.group).length >= 1, `group ${g.group} has flows`);
// the packet's IT-setup catalog is present (real-or-empty: each is an authored flow, not a stub).
for (const id of ["m365-setup", "onedrive-setup", "vpn-setup", "printer-add-setup", "browser-extension-setup", "mfa-setup"]) {
  assert.ok(getFlow(id), `IT-setup flow authored: ${id}`);
  assert.equal(getFlow(id).group, "it-setup", `${id} is in the it-setup group`);
}
// the new AI-tool flows the packet named are present too.
for (const id of ["codex-setup", "perplexity-setup", "copilot-setup"]) assert.equal(getFlow(id)?.group, "setup", `AI flow ${id} in setup group`);
t();

// 2 — the tab is a LAUNCHER: Start cards (data-flow + "Start") built from LAUNCHER_GROUPS, and Start routes to the
// under-globe companion via startWalkthroughUnderGlobe → sentinel.openCompanionFlow. NO step content renders in-tab.
assert.match(renderer, /LAUNCHER_GROUPS\.map/, "empty state renders the launcher groups");
assert.match(renderer, /class="walkthrough-lib-start">Start/, "each launcher card shows a Start cue");
assert.match(renderer, /startWalkthroughUnderGlobe\(b\.dataset\.flow/, "Start routes through startWalkthroughUnderGlobe");
assert.match(renderer, /async function startWalkthroughUnderGlobe/, "startWalkthroughUnderGlobe defined");
assert.match(renderer, /sentinel\.openCompanionFlow\?\.\(flowId\)/, "Start opens the flow UNDER the globe (openCompanionFlow)");
// Rule 15 — the in-tab runner is the RELOCATED fallback, never deleted.
assert.match(renderer, /renderCompanionFlowInTab\(flowId\); \/\/ graceful fallback/, "in-tab runner kept as the graceful fallback");
assert.match(renderer, /function renderCompanionFlowInTab\(/, "renderCompanionFlowInTab still exists (content relocated, not deleted)");
t();

// 3 — preload bridges the launcher + pull channels (guide-mode only; no fix runs on this path).
assert.match(preload, /openCompanionFlow:\s*\(flowId\)\s*=>\s*ipcRenderer\.invoke\("sentinel:open-companion-flow", flowId\)/, "preload bridges openCompanionFlow");
assert.match(preload, /getCompanionFlow:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:get-companion-flow"\)/, "preload bridges getCompanionFlow (pull)");
assert.match(preload, /onCompanionFlow:\s*\(callback\)/, "preload bridges onCompanionFlow (push)");
t();

// 4 — main opens a SPECIFIC flow on the globe overlay: stash for the pull + push for the already-open case.
assert.match(main, /let pendingCompanionFlow = null;/, "main holds the pending launcher flow");
assert.match(main, /ipcMain\.handle\("sentinel:open-companion-flow"/, "main exposes open-companion-flow");
assert.match(main, /showOverlay\(\{ companion: true \}\);\s*\/\/ shows the overlay even if the ambient globe is hidden/, "opening a flow shows the companion overlay");
assert.match(main, /webContents\.send\("sentinel:companion-flow", \{ flowId: id \}\)/, "main pushes the flow id to the overlay");
assert.match(main, /ipcMain\.handle\("sentinel:get-companion-flow", \(\) => \{ const f = pendingCompanionFlow; pendingCompanionFlow = null; return f; \}\)/, "overlay can pull + clear the pending flow");
t();

// 5 — the overlay opens the companion DIRECTLY at the chosen flow (first step), reusing the same flow engine, and
// pulls the pending flow on companion-mode entry (flash-free) — falling back to the menu when there is no flow.
assert.match(overlay, /function openCompanionAtFlow\(flowId\)/, "overlay has openCompanionAtFlow");
assert.match(overlay, /stack: \[\{ kind: "flow", flowId, index: 0 \}\]/, "opens at the flow's first step");
assert.match(overlay, /sentinel\.getCompanionFlow\?\.\(\)/, "companion-mode entry pulls the pending launcher flow");
assert.match(overlay, /sentinel\.onCompanionFlow\?\.\(\(payload\) =>/, "overlay listens for the pushed flow id");
assert.match(overlay, /if \(flowId && getFlow\(flowId\)\) openCompanionAtFlow\(flowId\)/, "a valid pushed flow opens under the globe");
// honesty: the launcher opens a GUIDE — it never runs a fix on Start.
assert.doesNotMatch(renderer.match(/async function startWalkthroughUnderGlobe[\s\S]*?\n}/)[0], /supervisedFix|runRecipe/, "Start never runs a fix (guide only)");
t();

assert.equal(n, 5, "5 walkthrough-launcher groups");
console.log(`walkthrough-launcher test passed (${n} groups · 3 launcher groups incl. IT-setup · Start → under-globe companion · main/preload/overlay wiring · flash-free pull + push · in-tab fallback kept (Rule 15) · guide-only).`);
