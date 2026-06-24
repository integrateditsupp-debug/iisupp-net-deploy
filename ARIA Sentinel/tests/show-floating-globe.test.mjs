// RUN 12 — "Show floating globe" toggle. Asserts the full chain + persistence + show/hide behaviour.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

// Toggle exists in the About panel.
const indexHtml = read("src", "renderer", "index.html");
assert.match(indexHtml, /id="showFloatingGlobe"/, "Show-floating-globe toggle exists in About");

// Renderer reads the persisted value and writes on change.
const rendererJs = read("src", "renderer", "renderer.js");
assert.match(rendererJs, /getSettings\(\)/, "renderer loads persisted settings");
assert.match(rendererJs, /setShowFloatingGlobe/, "renderer persists the toggle on change");

// Preload exposes both methods.
const preload = read("src", "main", "preload.cjs");
assert.match(preload, /getSettings:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(["']sentinel:get-settings["']\)/, "preload exposes getSettings");
assert.match(preload, /setShowFloatingGlobe:\s*\(on\)\s*=>\s*ipcRenderer\.invoke\(["']sentinel:set-show-floating-globe["']/, "preload exposes setShowFloatingGlobe");

// Main: store default true, IPC handlers, show/hide on change, and the ambient globe is gated.
const mainJs = read("src", "main", "main.mjs");
assert.match(mainJs, /showFloatingGlobe:\s*true/, "store defaults showFloatingGlobe to true");
assert.match(mainJs, /ipcMain\.handle\(["']sentinel:set-show-floating-globe["']/, "main handles set-show-floating-globe");
assert.match(mainJs, /ipcMain\.handle\(["']sentinel:get-settings["']/, "main handles get-settings");
assert.match(mainJs, /function setShowFloatingGlobe\(on\)\s*\{/, "main has setShowFloatingGlobe");
assert.match(mainJs, /store\.set\(["']showFloatingGlobe["']/, "persists the choice via electron-store");
assert.match(mainJs, /if \(on\) showOverlay\(\{ expanded: false \}\);\s*\n\s*else hideOverlay\(\);/, "shows/hides the overlay on toggle");
// The ambient globe is suppressed when hidden (a detection card still pops).
assert.match(mainJs, /store\.get\(["']showFloatingGlobe["']\)\s*===\s*false/, "ambient globe gated on the toggle");

console.log("Show-floating-globe test passed (toggle → preload → IPC → persist + show/hide; default on).");
