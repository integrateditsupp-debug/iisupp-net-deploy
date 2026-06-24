// RUN 19 §8 — live-button audit. Every static button in the Settings shell must invoke a real handler:
// either bound by id in renderer.js, or delegated via a data-* hook (data-support / data-plan / data-
// recipe-run / data-rollback / data-rebind / data-comment). No button may be a dummy (alert-only,
// console.log-only, or unwired). The admin console must carry no alert() placeholders either.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const rendererJs = read("src", "renderer", "renderer.js");
const adminHtml = read("admin-console", "index.html");

// Buttons wired by an event-delegation loop in the renderer carry one of these data-* hooks.
const DELEGATED = /data-(support|plan|recipe-run|rollback|rebind|comment|tier|tab|mode)/;

// Enumerate every opening <button ...> tag in the static shell.
const tags = indexHtml.match(/<button\b[^>]*>/g) || [];
assert.ok(tags.length >= 20, `found ${tags.length} static buttons`);

const unwired = [];
for (const tag of tags) {
  if (DELEGATED.test(tag)) continue; // wired by an event-delegation loop
  const idm = tag.match(/id="([^"]+)"/);
  if (!idm) { unwired.push(tag.slice(0, 70)); continue; }
  const id = idm[1];
  // The id must be referenced by the renderer (bindClick("id") or #id or addEventListener target).
  if (!new RegExp(`["'#]${id}\\b`).test(rendererJs)) unwired.push(id);
}
assert.deepEqual(unwired, [], `every button is wired (offenders: ${unwired.join(", ")})`);

// The specific buttons the packet calls out must each resolve to a real handler.
const REQUIRED = [
  "startAria", "stopAria", "showGlobe", "pauseOneHour", "runSelfDiagnose", "runSelfRepair",
  "liveCapture", "exportEvidence", "exportAudit", "runDiagnostic", "testServiceNow",
  "saveNotify", "testNotify", "checkUpdates", "manageSubscription", "logoutBtn",
  "enterLicenseBtn", "installUpdateBtn", "resetDeletePrefs", "deleteConfirm", "deleteCancel"
];
for (const id of REQUIRED) {
  assert.match(indexHtml, new RegExp(`id="${id}"`), `${id} present in shell`);
  assert.ok(new RegExp(`["'#]${id}\\b`).test(rendererJs), `${id} wired in renderer`);
}

// No dummy handlers: the renderer must not ship alert() popups or console.log-only click handlers.
assert.doesNotMatch(rendererJs, /\balert\(/, "renderer uses toasts, not alert()");
assert.doesNotMatch(rendererJs, /=>\s*console\.log\(/, "no console.log-only handlers");
assert.doesNotMatch(rendererJs, /\/\/\s*(TODO|stub|placeholder)/i, "no TODO/stub/placeholder handlers in renderer");

// The admin console drill-in is a real handler now (no alert placeholder).
assert.doesNotMatch(adminHtml, /\balert\(/, "admin console has no alert() placeholders");

console.log(`Live-buttons test passed (${tags.length} buttons audited; all wired; no alert/console.log/stub dummies).`);
