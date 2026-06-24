// RUN 13 §2 — every Control Center button is wired end-to-end (button → preload → main IPC).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const rendererJs = read("src", "renderer", "renderer.js");
const preload = read("src", "main", "preload.cjs");
const mainJs = read("src", "main", "main.mjs");

// Control Center tab contains the quick-control buttons.
assert.match(indexHtml, /id="control-center"\s+class="tab-panel/, "Control Center tab exists");
const controls = [
  { id: "showGlobe", preload: /showGlobe:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(["']sentinel:show-globe["']\)/, main: /sentinel:show-globe/ },
  { id: "pauseOneHour", preload: /setPaused:/, main: /sentinel:set-paused/ },
  // RUN 15 §6 — "Resume watching" was split into Start ARIA / Stop ARIA.
  { id: "startAria", preload: /startAria:/, main: /sentinel:start-aria/ },
  { id: "stopAria", preload: /stopAria:/, main: /sentinel:stop-aria/ },
  { id: "runSelfDiagnose", preload: /selfDiagnose:/, main: /sentinel:self-diagnose/ },
  { id: "runSelfRepair", preload: /selfRepair:/, main: /sentinel:self-repair/ },
  { id: "openAdminConsole", preload: /openAdminConsole:/, main: /sentinel:open-admin-console/ }
];
for (const c of controls) {
  assert.match(indexHtml, new RegExp(`id="${c.id}"`), `button ${c.id} present`);
  assert.match(rendererJs, new RegExp(c.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `renderer binds ${c.id}`);
  assert.match(preload, c.preload, `preload exposes the method for ${c.id}`);
  assert.match(mainJs, c.main, `main handles the IPC for ${c.id}`);
}
// The status table moved here too.
assert.match(indexHtml, /id="systemChecks"/, "status table in Control Center");

console.log(`Quick-controls test passed (${controls.length} buttons wired button→preload→main).`);
