// RUN 22 §1 — the 4 Overview quick-action buttons each wire to a real handler (no dummies).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");

const actions = [
  { id: "dashDiagnose", api: null },                      // opens chat in diagnostic mode
  { id: "dashHealthCheck", api: "selfHeal" },
  { id: "dashCheckUpdates", api: "checkUpdateChannel" },
  { id: "dashExportEvidence", api: "exportEvidence" }
];
for (const a of actions) {
  assert.match(indexHtml, new RegExp(`id="${a.id}"`), `button ${a.id} present`);
  assert.match(renderer, new RegExp(`bindClick\\("${a.id}"`), `renderer wires ${a.id}`);
  if (a.api) assert.match(renderer, new RegExp(`sentinel\\.${a.api}`), `${a.id} calls a real API (${a.api})`);
}
// RUN 34-2 — dashDiagnose now opens the ARIA tab chat (the Settings dock was removed).
assert.match(renderer, /bindClick\("dashDiagnose"[\s\S]*?activateTab\("aria"\)/, "Diagnose opens the ARIA tab chat");
// Preload exposes the APIs these buttons call.
assert.match(preload, /checkUpdateChannel:/);
assert.match(preload, /exportEvidence:/);
// No alert-only handlers in the renderer (RUN 19 rule still holds).
assert.doesNotMatch(renderer, /\balert\(/, "no alert() dummies");

console.log("Dashboard-quick-actions test passed (4 quick actions wired to real handlers).");
