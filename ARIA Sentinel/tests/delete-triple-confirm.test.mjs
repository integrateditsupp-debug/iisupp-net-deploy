// RUN 19 §4 — triple-confirm delete. 3-step gate by default; a per-ext opt-out drops to a SINGLE
// confirmation (never silent). Opt-outs persist to userData/delete-prefs.json.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extOf, normalizeExt, isOptedOut, requiredSteps, stepFor,
  addOptOut, resetOptOuts, normalizePrefs, emptyPrefs, TRIPLE_STEPS
} from "../src/shared/delete-confirm.mjs";

// extOf: lower-cased, dot-included; folders / dotfiles / trailing-dot → "".
assert.equal(extOf("C:/x/report.PDF"), ".pdf");
assert.equal(extOf("a\\b\\notes.TXT"), ".txt");
assert.equal(extOf("myfolder"), "");
assert.equal(extOf(".gitignore"), "");
assert.equal(extOf("archive.tar.gz"), ".gz");

// normalizeExt collapses "pdf", ".PDF", " .pdf " → ".pdf".
assert.equal(normalizeExt("pdf"), ".pdf");
assert.equal(normalizeExt(".PDF"), ".pdf");
assert.equal(normalizeExt(""), "");

// Default = 3 steps; opted-out ext = 1 step (single confirmation, not silent).
assert.equal(requiredSteps("report.pdf", emptyPrefs()), 3);
const prefs = addOptOut(emptyPrefs(), ".pdf");
assert.deepEqual(prefs.skipTripleFor, [".pdf"]);
assert.equal(isOptedOut(".pdf", prefs), true);
assert.equal(requiredSteps("report.pdf", prefs), 1, "opted-out ext → single confirmation");
assert.equal(requiredSteps("folder", prefs), 3, "no ext (folder/restore point) always triple-confirmed");

// addOptOut is immutable + deduped; reset empties.
const p2 = addOptOut(prefs, "PDF");
assert.deepEqual(p2.skipTripleFor, [".pdf"], "dedupes normalized");
assert.deepEqual(prefs.skipTripleFor, [".pdf"], "original not mutated");
assert.deepEqual(resetOptOuts(p2).skipTripleFor, []);

// stepFor: 3-step sequence labels + the single-step shape.
assert.equal(TRIPLE_STEPS.length, 3);
const s0 = stepFor("a.docx", emptyPrefs(), 0);
assert.equal(s0.total, 3); assert.equal(s0.confirm, "Delete"); assert.equal(s0.last, false);
const s2 = stepFor("a.docx", emptyPrefs(), 2);
assert.equal(s2.confirm, "Permanently delete"); assert.equal(s2.last, true);
assert.match(s2.body("a.docx"), /Last chance/i);
const single = stepFor("a.pdf", prefs, 0);
assert.equal(single.total, 1); assert.equal(single.last, true); assert.equal(single.confirm, "Delete");

// normalizePrefs coerces arbitrary disk JSON into a clean, deduped shape.
assert.deepEqual(normalizePrefs(null), { skipTripleFor: [] });
assert.deepEqual(normalizePrefs({ skipTripleFor: ["pdf", ".PDF", "", "docx"], junk: 1 }), { skipTripleFor: [".pdf", ".docx"] });

// Round-trip the persisted file shape.
// The scratch file lives in the OS temp dir, NEVER inside the tracked tree: a crash between the
// write and the cleanup used to leak `tests/del-prefs-<pid>.json` into git, and a suite that both
// writes and unlinks inside the repo is a data-loss path even when it is green.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-del-prefs-"));
const tmp = path.join(tmpDir, "delete-prefs.json");
assert.ok(!path.resolve(tmp).startsWith(path.resolve(import.meta.dirname)), "scratch file must not be written inside the tracked tests/ directory");
try {
  fs.writeFileSync(tmp, JSON.stringify(addOptOut(emptyPrefs(), ".log")));
  assert.deepEqual(normalizePrefs(JSON.parse(fs.readFileSync(tmp, "utf8"))), { skipTripleFor: [".log"] });
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// main.mjs wiring: prefs file in userData, IPC get/set/clear/reset, state carries deletePrefs.
const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
assert.match(main, /delete-prefs\.json/, "prefs persisted to delete-prefs.json");
assert.match(main, /app\.getPath\("userData"\)/, "stored under userData (not the registry)");
assert.match(main, /ipcMain\.handle\("sentinel:get-delete-prefs"/, "get IPC wired");
assert.match(main, /ipcMain\.handle\("sentinel:set-delete-pref"/, "set IPC wired");
assert.match(main, /ipcMain\.handle\("sentinel:reset-delete-prefs"/, "reset IPC wired");
assert.match(main, /deletePrefs:\s*readDeletePrefs\(\)/, "state carries deletePrefs");

// renderer wiring: triple-confirm flow gates the rollback, plus the Privacy-tab opt-out list + reset.
const rendererJs = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
assert.match(rendererJs, /function confirmDelete\(/, "renderer has the triple-confirm flow");
assert.match(rendererJs, /confirmDelete\(name,/, "restore-point rollback is gated by confirmDelete");
assert.match(rendererJs, /resetDeletePrefs/, "Reset-all wired");
const indexHtml = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
for (const id of ["deleteModal", "deleteOptOut", "deleteConfirm", "deleteCancel", "deletePrefsList", "resetDeletePrefs"]) {
  assert.match(indexHtml, new RegExp(`id="${id}"`), `delete UI element ${id} present`);
}

console.log("Delete-triple-confirm test passed (3-step default · per-ext opt-out → single confirm · persisted · wired).");
