// RUN 19 §1 — popup clamping. Every modal/popup card must stay inside the window viewport: clamped to
// calc(100vh - 80px) with vertical scroll, so nothing clips off the top/bottom in a small window.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const css = read("src", "renderer", "sentinel.css");
const indexHtml = read("src", "renderer", "index.html");

// The clamp rule groups every modal/popup card class and applies the viewport clamp + scroll together.
const clampBlock = css.match(/\.onboarding-card,\s*\.trial-end-card,\s*\.delete-modal-card,\s*\.cmdk-box,[\s\S]*?\{[\s\S]*?\}/);
assert.ok(clampBlock, "a grouped clamp rule covering the modal cards exists");
const block = clampBlock[0];
for (const sel of [".onboarding-card", ".trial-end-card", ".delete-modal-card", ".cmdk-box"]) {
  assert.ok(block.includes(sel), `clamp rule covers ${sel}`);
}
assert.match(block, /max-height:\s*calc\(100vh\s*-\s*80px\)/, "clamps height to calc(100vh - 80px)");
assert.match(block, /overflow-y:\s*auto/, "scrolls when content overflows");

// Every modal card class actually appears in the markup (so the clamp rule isn't dead).
for (const cls of ["onboarding-card", "trial-end-card", "delete-modal-card", "cmdk-box"]) {
  assert.match(indexHtml, new RegExp(`class="[^"]*${cls}`), `${cls} present in the shell`);
}

// Overlay modals keep padding so a clamped card never butts the screen edge.
assert.match(css, /\.onboarding\s*\{\s*padding:/, "modal overlay keeps edge padding");

console.log("Popup-clamp test passed (every modal clamps to calc(100vh - 80px) + scrolls; padding guards the edge).");
