// RUN 20 §2 — every symptom file parses to well-formed structured causes, and the master index lists them.
//
// A2 (2026-08-05): this test used to assert `kb.length === 17` against a closed list. That is the assertion
// that FROZE the knowledge base: any genuinely new diagnostic article made it red, so the only ways to stay
// green were to never add one, or to pad a real article with a fabricated cause to clear an arbitrary count.
// Both are worse than the bug. It is now open-world and STRICTER: the 17 canonical categories must all still
// be present and each must still carry >=5 ranked causes, AND every symptom doc in the pack -- including any
// added later -- must be well-formed, carry >=3 user phrasings and >=3 fully-populated ranked causes, and be
// listed in the master index. Nothing is exempt by virtue of being new.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadSymptomKb, isWellFormed, CAUSE_FIELDS, parseSymptomFile, isSymptomDoc } from "../src/shared/symptom-kb.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "aria-kb-pack", "diagnostics");

const EXPECTED = [
  "slow-performance", "app-crashes", "system-crashes", "no-internet", "audio-issues", "display-issues",
  "printer-issues", "update-stuck", "license-activation", "boot-issues", "battery-power", "file-explorer",
  "email-issues", "bluetooth-wifi", "usb-peripheral", "antivirus-conflict", "credential-issues"
];

const kb = loadSymptomKb(dir);
const ids = kb.map((r) => r.id);

// 1 — the 17 canonical categories are all still present. Open-world: extra symptom docs are allowed,
//     MISSING ones are not. A regression that drops a category is still caught.
for (const id of EXPECTED) assert.ok(ids.includes(id), `canonical symptom category "${id}" is present`);

// 2 — a how-to is NOT a symptom doc. `intent: setup` articles are real KB content the matcher routes to,
//     but they have no ranked causes, so they must not be loaded as symptom records.
const withHowTos = loadSymptomKb(dir, { includeNonSymptom: true });
const howTos = withHowTos.filter((r) => !isSymptomDoc(r));
assert.ok(withHowTos.length >= kb.length, "including how-tos never drops symptom docs");
assert.equal(kb.length, withHowTos.length - howTos.length, "symptom set is exactly the non-setup docs");
for (const r of howTos) assert.ok(!ids.includes(r.id), `how-to "${r.id}" is not loaded as a symptom doc`);

// 3 — frontmatter defaults: a doc with no frontmatter (the original 17) is break-fix/generic.
const bare = parseSymptomFile("# T\n## Symptom: s\n> User phrasings: \"a\"\n", "bare");
assert.equal(bare.intent, "break-fix", "no frontmatter => break-fix");
assert.equal(bare.vertical, "generic", "no frontmatter => generic vertical");
assert.ok(isSymptomDoc(bare), "a doc with no frontmatter is a symptom doc");
assert.ok(!isSymptomDoc({ intent: "setup" }), "a setup doc is not a symptom doc");

// 4 — every symptom doc, canonical or added later, clears the structural bar. The canonical 17 keep the
//     >=5-cause floor they were authored to; nothing new is allowed in below >=3 fully-populated causes.
let totalCauses = 0;
for (const rec of kb) {
  const canonical = EXPECTED.includes(rec.id);
  const floor = canonical ? 5 : 3;
  assert.ok(isWellFormed(rec), `${rec.id} is well-formed`);
  assert.ok(rec.symptoms.length >= 1, `${rec.id} states at least one symptom`);
  assert.ok(rec.phrasings.length >= 3, `${rec.id} has >=3 user phrasings (has ${rec.phrasings.length})`);
  assert.ok(rec.causes.length >= floor,
    `${rec.id} has >=${floor} ranked causes (has ${rec.causes.length}${canonical ? ", canonical" : ""})`);
  for (const c of rec.causes) {
    for (const f of CAUSE_FIELDS) assert.ok(String(c[f] ?? "").length > 0, `${rec.id} cause "${c.name}" has ${f}`);
    assert.ok(c.probability > 0 && c.probability <= 100, `${rec.id} cause probability in range`);
  }
  totalCauses += rec.causes.length;
}
assert.ok(totalCauses >= 90, `~100 diagnostic entries (got ${totalCauses})`);

// 5 — the master index lists EVERY doc in the pack, canonical or not, symptom or how-to. A new article
//     that nobody can find from the index is a new article that does not exist.
const index = fs.readFileSync(path.join(dir, "symptoms.md"), "utf8");
for (const rec of withHowTos) assert.match(index, new RegExp(rec.id), `index references ${rec.id}`);

console.log(`Symptom-KB-parse test passed (${kb.length} symptom files incl. all 17 canonical, ${howTos.length} how-to article(s) correctly excluded, ${totalCauses} causes, all well-formed, index complete).`);
