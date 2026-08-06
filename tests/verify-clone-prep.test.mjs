// verify-clone-prep.test.mjs — 2026-08-04
//
// Locks the ONE thing this helper exists to protect: the line between an environmental red and a
// real red can never be blurred. A prepared tree's failures are always real; an unprepared tree's
// failures always certify nothing. If a future cycle is tempted to write "53 reds, all
// environmental" without preparing the tree first, these assertions stop it.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  OUTBOUND_REL,
  RUNTIME_DEPS,
  outboundRecordsPresent,
  runtimeDepsInstalled,
  copyOutboundRecords,
  classifyReds,
} from "../scripts/verify-clone-prep.mjs";

function tmpRoot() {
  return mkdtempSync(join(tmpdir(), "clone-prep-"));
}

test("an unprepared tree's reds certify NOTHING — they are never called real failures", () => {
  const r = classifyReds({ prepared: false, failures: 53 });
  assert.equal(r.verdict, "unprepared");
  assert.equal(r.certifiable, false);
  assert.match(r.note, /do not record this number as a pass rate/i);
});

test("a prepared tree's reds are REAL — they can never be excused as environmental", () => {
  const r = classifyReds({ prepared: true, failures: 1 });
  assert.equal(r.verdict, "red");
  assert.equal(r.certifiable, false);
  assert.match(r.note, /not environmental/i);
});

test("the size of the number never decides the verdict — only the state of the tree does", () => {
  // One red on a prepared tree is real; 51 reds on an unprepared tree still certify nothing.
  assert.equal(classifyReds({ prepared: true, failures: 51 }).verdict, "red");
  assert.equal(classifyReds({ prepared: false, failures: 1 }).verdict, "unprepared");
});

test("only zero failures is green — and green requires nothing else to be argued", () => {
  assert.equal(classifyReds({ prepared: true, failures: 0 }).certifiable, true);
  assert.equal(classifyReds({ prepared: false, failures: 0 }).certifiable, true);
});

test("an absent records directory is reported as absent, never as an empty-but-fine tree", () => {
  const root = tmpRoot();
  const res = outboundRecordsPresent(root);
  assert.equal(res.present, false);
  assert.equal(res.count, 0);
  assert.equal(res.reason, "directory absent");
});

test("a present-but-EMPTY records directory is still not prepared", () => {
  const root = tmpRoot();
  mkdirSync(join(root, OUTBOUND_REL), { recursive: true });
  const res = outboundRecordsPresent(root);
  assert.equal(res.present, false);
  assert.equal(res.reason, "directory present but empty");
});

test("copying never invents a record — an empty source copies nothing and says so", () => {
  const src = tmpRoot();
  const dest = tmpRoot();
  mkdirSync(join(src, OUTBOUND_REL), { recursive: true });
  const res = copyOutboundRecords(src, dest);
  assert.equal(res.ok, false);
  assert.equal(res.copied, 0);
  assert.match(res.reason, /empty/i);
});

test("copying real records makes the tree prepared, and every file arrives", () => {
  const src = tmpRoot();
  const dest = tmpRoot();
  mkdirSync(join(src, OUTBOUND_REL), { recursive: true });
  writeFileSync(join(src, OUTBOUND_REL, "outbound-record.json"), '{"sent":45}');
  writeFileSync(join(src, OUTBOUND_REL, "THE-HOUR.md"), "# hour");
  const res = copyOutboundRecords(src, dest);
  assert.equal(res.ok, true);
  assert.equal(res.copied, 2);
  assert.equal(readdirSync(join(dest, OUTBOUND_REL)).length, 2);
  assert.equal(outboundRecordsPresent(dest).present, true);
});

test("a missing declared dependency is named individually, not summarised away", () => {
  const root = tmpRoot();
  const res = runtimeDepsInstalled(root);
  assert.equal(res.installed, false);
  for (const d of RUNTIME_DEPS) assert.ok(res.missing.includes(d), `${d} must be named`);
});

test("the dependency list is the one the shipped functions actually import", () => {
  // If this list drifts from what netlify/functions import, the prep stops being sufficient and
  // the 'load failure' class quietly returns.
  assert.ok(RUNTIME_DEPS.includes("@netlify/blobs"));
});

console.log(
  "verify-clone-prep test passed (10 groups - unprepared reds certify nothing - prepared reds are real - " +
    "count never decides the verdict - absent vs empty distinguished - copying never invents a record)."
);
