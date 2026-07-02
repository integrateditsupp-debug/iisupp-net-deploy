// The companion shell: clicking the floating globe opens the interactive assistant ("What would you like to
// do?"), the menu renders the four paths, and the proactive card only ever shows a REAL detected issue (never a
// fabricated one). Fix routes to the guided/gated surface — NEVER Control Center. Structural + data proof.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { COMPANION_MENU } from "../src/shared/walkthrough-steps.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const overlay = rd("src", "renderer", "overlay.js");
const overlayHtml = rd("src", "renderer", "overlay.html");
const main = rd("src", "main", "main.mjs");
const preload = rd("src", "main", "preload.cjs");
let n = 0; const t = () => { n++; };

// 1 — clicking the globe (no active detection) opens the companion assistant (not just re-shows the globe).
assert.match(overlay, /getElementById\("overlayGlobe"\)\.addEventListener\("click"[\s\S]*?if \(currentDetection\)[\s\S]*?sentinel\.openCompanion\(\)/, "globe click → openCompanion when no detection");
assert.match(main, /ipcMain\.handle\("sentinel:open-companion"/, "main exposes open-companion");
assert.match(preload, /openCompanion:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:open-companion"\)/, "preload bridges openCompanion");
t();

// 2 — the menu is exactly the four paths Ahmad specified, and the shell renders "What would you like to do?".
assert.deepEqual(COMPANION_MENU.map((m) => m.id), ["fix", "setup", "learn", "ask"], "four menu paths in order");
assert.match(overlay, /What would you like to do\?/, "greeting prompt rendered");
assert.match(overlay, /function renderMenu\(\)/, "menu renderer exists");
assert.match(overlay, /item\.action === "ask"[\s\S]*?openMainTab\("aria"\)/, "Ask ARIA opens the KB chat tab");
t();

// 3 — the companion has its own overlay window mode + bounds (a panel anchored to the globe, not a takeover).
assert.match(main, /overlayCompanion/, "main tracks companion overlay mode");
assert.match(main, /function overlayBounds[\s\S]*?if \(overlayCompanion\)/, "companion has its own (bigger) bounds");
assert.match(main, /overlay-mode", overlayCompanion \? "companion"/, "main sends the companion overlay-mode");
assert.match(overlayHtml, /id="companionPanel"/, "companion panel exists in the overlay");
assert.match(overlay, /mode === "companion"/, "overlay handles companion mode");
t();

// 4 — PROACTIVE card is REAL-ONLY: it renders the detection main hands it; the companion fabricates no issue.
assert.match(overlay, /sentinel\.onDetection\(\(detection\) => \{[\s\S]*?render\(detection\)/, "proactive card renders the real detection from main");
assert.ok(!/currentDetection = \{[\s\S]*?title:/.test(overlay), "overlay never synthesizes a fake detection object");
t();

// 5 — Fix path routes to guided (Walk-through) or the gated apply — NEVER Control Center, never a dead click.
assert.match(overlay, /function renderFixResult/, "fix result view exists");
assert.match(overlay, /sentinel\.openWalkthrough\(\{ recipeId: view\.recipeId, intent: view\.intent \}\)/, "fix → guided Walk-through");
assert.match(overlay, /sentinel\.supervisedFix\(\{ recipeId: view\.recipeId, mode: "confirmed" \}\)/, "fix → gated apply (confirmed)");
assert.match(overlay, /isVettedRecipe/, "resolve offered only for a vetted recipe");
assert.doesNotMatch(overlay, /control-center/i, "companion NEVER routes to Control Center");
assert.match(main, /ipcMain\.handle\("sentinel:open-walkthrough"/, "main bridges the guided Walk-through open");
t();

// 6 — `open` steps launch the USER's browser to an OFFICIAL site via the host-anchored allowlist (not an app
// fetch, not an account/payment action). The allowlist is host-anchored to the vendor domains only.
assert.match(main, /OPEN_EXTERNAL_ALLOW = \/\^https/, "host-anchored open-external allowlist");
const allowLine = main.match(/OPEN_EXTERNAL_ALLOW = [^\n]+/)[0];
for (const host of ["anthropic", "claude", "openai", "chatgpt", "gemini"]) assert.ok(allowLine.includes(host), `official domain allowlisted: ${host}`);
assert.match(overlay, /sentinel\.openExternal\(step\.url\)/, "open step launches the user's browser");
t();

assert.equal(n, 6, "6 companion-shell groups");
console.log(`companion-shell test passed (${n} groups · globe → assistant menu · four paths · companion window mode · proactive real-only · Fix → guided/gated never Control Center · official-source open).`);
