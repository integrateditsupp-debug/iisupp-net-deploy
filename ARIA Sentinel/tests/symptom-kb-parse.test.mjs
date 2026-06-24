// RUN 20 §2 — all 17 symptom files parse to well-formed structured causes, and the master index lists them.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadSymptomKb, isWellFormed, CAUSE_FIELDS } from "../src/shared/symptom-kb.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "aria-kb-pack", "diagnostics");

const EXPECTED = [
  "slow-performance", "app-crashes", "system-crashes", "no-internet", "audio-issues", "display-issues",
  "printer-issues", "update-stuck", "license-activation", "boot-issues", "battery-power", "file-explorer",
  "email-issues", "bluetooth-wifi", "usb-peripheral", "antivirus-conflict", "credential-issues"
];

const kb = loadSymptomKb(dir);
assert.equal(kb.length, 17, "17 symptom files");
const ids = kb.map((r) => r.id).sort();
assert.deepEqual(ids, [...EXPECTED].sort(), "all expected symptom categories present");

let totalCauses = 0;
for (const rec of kb) {
  assert.ok(isWellFormed(rec), `${rec.id} is well-formed`);
  assert.ok(rec.phrasings.length >= 3, `${rec.id} has user phrasings`);
  assert.ok(rec.causes.length >= 5, `${rec.id} has >=5 ranked causes (has ${rec.causes.length})`);
  for (const c of rec.causes) {
    for (const f of CAUSE_FIELDS) assert.ok(String(c[f] ?? "").length > 0, `${rec.id} cause "${c.name}" has ${f}`);
    assert.ok(c.probability > 0 && c.probability <= 100, `${rec.id} cause probability in range`);
  }
  totalCauses += rec.causes.length;
}
assert.ok(totalCauses >= 90, `~100 diagnostic entries (got ${totalCauses})`);

// Master index lists every category.
const index = fs.readFileSync(path.join(dir, "symptoms.md"), "utf8");
for (const id of EXPECTED) assert.match(index, new RegExp(id), `index references ${id}`);

console.log(`Symptom-KB-parse test passed (17 files, ${totalCauses} causes, all well-formed, index complete).`);
