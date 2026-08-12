// scratch-substitution.test.mjs — RUN-BL / BL3. THE FIX A WRITER READS INSTEAD OF A VERDICT.
//
// BK's cycle watched BH2's gate catch a suite three minutes after another seat wrote it. The gate
// was right. What it said was, in full, "use makeScratchDir from scripts/lib/scratch-dir.mjs" — a
// module name and nothing else. A writer meeting that has to open a stranger's file, work out the
// call shape, and guess which of their lines was the offending one. They pay that tax every time,
// and the gate has taught them nothing they can act on in place.
//
// So the gate now prints the offending line, its number, and the line that replaces it. Which means
// the replacement text is now something this repository ASSERTS, and an assertion has to be proven:
// a guard that prints a fix which does not compile has replaced one detour with a worse one. Every
// case below is red-first — the substitution is checked by PARSING it, not by reading it.
//
// It writes nothing, edits nothing, and reaches no network. Explicitly: it never rewrites the file
// it flags. A file another seat is actively writing is the wrong thing to reach into (R16).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  scratchSubstitutions, substitutionReport, makeScratchDir,
  RAW_SCRATCH_PATTERNS, IMPORT_LINE, SUBSTITUTION_HINT,
} from "../scripts/lib/scratch-dir.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Does this line actually parse as JavaScript? The whole point of printing a fix. */
function parses(line) {
  const dir = makeScratchDir("bl3-parse-");
  const file = path.join(dir, "probe.mjs");
  // The substitution is checked in the shape it is offered in: a line inside a function body, with
  // the import above it, exactly as a writer would paste it.
  fs.writeFileSync(file, `${IMPORT_LINE.replace("../scripts/", `${ROOT}/scripts/`)}\nimport fs from "node:fs";\nimport os from "node:os";\nimport path from "node:path";\nfunction f() {\n  ${line}\n}\nexport default f;\n`);
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, reason: "parses" };
  } catch (err) {
    return { ok: false, reason: String(err.stderr || err.message).split("\n").slice(0, 3).join(" ") };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a mount that refuses unlink is still a floor */ }
  }
}

// ── the shapes this repository has actually met ──────────────────────────────
// Not invented shapes. Each of these was found in a real suite in this tree, and the third one was
// found by widening the gate during BL3 itself.
const REAL_SHAPES = [
  {
    why: "the shape BK's concurrent writer used, with the `fs.` prefix that broke the first draft",
    line: "const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axis-vault-test-'));",
    expect: "const tmp = makeScratchDir('axis-vault-test-');",
  },
  {
    why: "the same call unprefixed",
    line: "const dir = mkdtempSync(path.join(os.tmpdir(), \"charge-\"));",
    expect: "const dir = makeScratchDir(\"charge-\");",
  },
  {
    why: "a FILE path built under tmpdir by hand — the join must survive, only the volume changes",
    line: "const idx = path.join(os.tmpdir(), `ar3-${process.pid}.index`);",
    expect: "const idx = path.join(makeScratchDir(\"scratch-\"), `ar3-${process.pid}.index`);",
  },
];

test("BL3 — every printed substitution is the exact replacement, character for character", () => {
  for (const shape of REAL_SHAPES) {
    const [found] = scratchSubstitutions(shape.line);
    assert.ok(found, `no substitution offered for a shape this repository actually contains: ${shape.why}`);
    assert.equal(found.replacement, shape.expect, shape.why);
  }
});

test("BL3 — RED: a substitution that would not run is a worse detour than no substitution", () => {
  // The first draft of this printed `const tmp = fs.makeScratchDir(...)`, because the replacement
  // dropped the `mkdtempSync` and kept the object it hung off. It parses — and it throws at runtime,
  // which is the failure mode a writer would have blamed on the module. Proven by parsing, and the
  // known-bad text is asserted bad so the regression cannot come back unnoticed.
  assert.equal(parses("const tmp = fs.makeScratchDir('x-');").ok, true, "the bad draft PARSED — which is exactly why parsing alone is not the whole assertion");
  for (const shape of REAL_SHAPES) {
    const [found] = scratchSubstitutions(shape.line);
    assert.equal(/\b(?:fs|os)\.makeScratchDir\b/.test(found.replacement), false,
      "a substitution that hangs makeScratchDir off the module the old call came from does not exist at runtime");
    const p = parses(found.replacement);
    assert.equal(p.ok, true, `the printed fix must parse: ${found.replacement} — ${p.reason}`);
  }
});

test("BL3 — the report names the file, the line number, the fix and the import", () => {
  const src = ["// a suite", "const d = fs.mkdtempSync(path.join(os.tmpdir(), 'p-'));"].join("\n");
  const findings = scratchSubstitutions(src);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2, "the line number is what turns a verdict into an edit");
  const report = substitutionReport("tests/example.test.mjs", findings);
  assert.match(report, /tests\/example\.test\.mjs:2/);
  assert.match(report, /found:/);
  assert.match(report, /replace:/);
  assert.match(report, /import:\s+import \{ makeScratchDir \}/);
});

test("BL3 — RED: a clean source produces no report at all, so the gate cannot cry wolf", () => {
  const clean = [
    'import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";',
    'const dir = makeScratchDir("fine-");',
    "// mentions os.tmpdir() only in prose",
  ].join("\n");
  assert.deepEqual(scratchSubstitutions(clean), []);
  assert.equal(substitutionReport("tests/clean.test.mjs", []), "");
});

test("BL3 — a bare os.tmpdir() is NOT flagged: the gate must stay precise to stay obeyed", () => {
  // Suites that deliberately exercise a hostile TMPDIR pass `os.tmpdir()` on purpose. Flagging them
  // would make the gate noise, and a noisy gate gets suppressed rather than obeyed.
  assert.deepEqual(scratchSubstitutions("assert.doesNotThrow(() => probeGitBoundary({ root: os.tmpdir() }));"), []);
  assert.deepEqual(scratchSubstitutions("const env = { ...process.env, TMPDIR: os.tmpdir() };"), []);
});

test("BL3 — one finding per line, chosen by the first pattern that matches", () => {
  const line = "const d = fs.mkdtempSync(path.join(os.tmpdir(), 'p-'));";
  const found = scratchSubstitutions(line);
  assert.equal(found.length, 1, "two overlapping patterns must not produce two contradictory fixes for one line");
  assert.equal(found[0].pattern, "mkdtemp-path-join-tmpdir");
});

test("BL3 — the exhaustion message tells a writer what to set, not just that it failed", () => {
  // `makeScratchDir` throwing is CORRECT when nothing accepts a write (BE). What was missing is the
  // next action. AXIS_SCRATCH_DIR is first in the candidate list, so naming it is a real remedy.
  assert.match(SUBSTITUTION_HINT, /AXIS_SCRATCH_DIR/);
  assert.match(SUBSTITUTION_HINT, /run-tests\.mjs/);
  assert.match(SUBSTITUTION_HINT, /makeScratchDir/);
});

test("BL3 — every declared pattern carries a why, and none is a bare regex nobody can explain", () => {
  assert.ok(RAW_SCRATCH_PATTERNS.length >= 3);
  for (const p of RAW_SCRATCH_PATTERNS) {
    assert.ok(p.id && p.re instanceof RegExp && typeof p.replace === "function");
    assert.ok(String(p.why).length > 20, `${p.id} has no stated reason, and a rule without a reason gets deleted by the next reader`);
  }
});

test("BL3 — a string literal and a comment are not a call, or this very suite would be an offender", () => {
  // Found by running it: the gate flagged THIS file, because a suite that proves the substitutions
  // necessarily holds every offending shape as fixture data. A guard that cannot tell code from the
  // text describing code gets suppressed within a week, so the distinction is a tested property.
  const asData = 'const cases = ["const d = fs.mkdtempSync(path.join(os.tmpdir(), \'p-\'));"];';
  const asComment = "// was: const d = fs.mkdtempSync(path.join(os.tmpdir(), 'p-'));";
  const trailing = "const d = makeScratchDir('p-'); // replaces fs.mkdtempSync(path.join(os.tmpdir(), 'p-'))";
  assert.deepEqual(scratchSubstitutions(asData), [], "a shape quoted as data is not a call");
  assert.deepEqual(scratchSubstitutions(asComment), [], "a shape described in a comment is not a call");
  assert.deepEqual(scratchSubstitutions(trailing), [], "a trailing comment does not make a fixed line an offender again");
  // and the inverse, or the filter would simply switch the gate off
  assert.equal(scratchSubstitutions("const d = fs.mkdtempSync(path.join(os.tmpdir(), 'p-'));").length, 1);
});

test("BL3 — the substitution is offered, never applied: no file on disk is touched", () => {
  const dir = makeScratchDir("bl3-untouched-");
  const f = path.join(dir, "victim.test.mjs");
  const body = "const d = fs.mkdtempSync(path.join(os.tmpdir(), 'p-'));\n";
  fs.writeFileSync(f, body);
  const before = fs.readFileSync(f, "utf8");
  substitutionReport(f, scratchSubstitutions(fs.readFileSync(f, "utf8")));
  assert.equal(fs.readFileSync(f, "utf8"), before,
    "a gate that rewrites a file another seat is writing is a worse failure than the one it prevents");
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* mount refuses unlink */ }
});
