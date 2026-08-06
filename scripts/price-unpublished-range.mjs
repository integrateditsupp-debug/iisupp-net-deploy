#!/usr/bin/env node
// price-unpublished-range.mjs — RUN-AR / AR1. Price the unpublished line instead of counting it.
//
// Run from the repo root:  node scripts/price-unpublished-range.mjs [ref]
//
// Writes `senior-director-state/unpublished-range.json` and prints the finding. A refusal to read
// the range is written to the artefact as a REFUSAL — never as an empty report, because an empty
// report reads as "nothing is unpublished", which is the opposite of what a refusal means.
import fs from "node:fs";
import path from "node:path";
import { readUnpublishedRange, CLASSES } from "./lib/unpublished-range.mjs";

const root = process.cwd();
const ref = process.argv[2] || "origin/main";
const OUT = "senior-director-state/unpublished-range.json";

const res = readUnpublishedRange({ root, ref });
const artefact = {
  schema: "unpublished-range.v1",
  generatedAt: new Date().toISOString(),
  ref,
  report: res.ok ? res.report : null,
  refusal: res.ok ? null : { class: res.class, detail: res.detail },
};
fs.mkdirSync(path.dirname(path.join(root, OUT)), { recursive: true });
fs.writeFileSync(path.join(root, OUT), `${JSON.stringify(artefact, null, 2)}\n`, "utf8");

if (!res.ok) {
  console.error(`RANGE NOT READ — ${res.class}`);
  console.error(`  ${res.detail}`);
  console.error(`  written to ${OUT} as a refusal, not as zero`);
  process.exit(1);
}

const r = res.report;
console.log(r.statement);
console.log("");
for (const b of r.byClass) {
  if (b.commits === 0 && b.files.length === 0) continue;
  console.log(`  ${b.class.padEnd(20)} ${String(b.commits).padStart(3)} commit(s)  ${String(b.exclusiveCommits).padStart(3)} exclusively  ${b.files.length} file(s)`);
}
if (r.publicFilesChanged.length) {
  console.log("\n  what a visitor would see change:");
  for (const f of r.publicFilesChanged) console.log(`    ${f}`);
} else {
  console.log(`\n  no file in class ${CLASSES.PUBLIC_PAGE} changed in this range.`);
}
console.log(`\n  written to ${OUT}`);
