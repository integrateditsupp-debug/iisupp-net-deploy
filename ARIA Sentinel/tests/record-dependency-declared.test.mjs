// record-dependency-declared.test.mjs - the shared line may depend on untracked operator records,
// but never SILENTLY (flywheel cycle 120, 2026-08-05).
//
// The finding this suite exists to keep visible: the full registry returns 504 pass / 0 fail on the
// operator's machine and 453 pass / 51 fail from a clean clone of the SAME commit. Every one of those
// 51 is ENOENT, never an assertion failure, because `.gitignore` excludes `/senior-director-state/`
// entirely and eight suites read real business records from inside it.
//
// That is a legitimate design choice - the records hold outbound and reply history and are deliberately
// untracked - but for several cycles "the shared line is green" was reported without saying that the
// green was not reproducible by anyone else. This suite makes the dependency declared:
//   1. every suite that reads the untracked root is named in record-dependencies.json,
//   2. nothing is named there that does not actually read it,
//   3. the manifest itself is tracked, so the cost is visible to any reader,
//   4. absence of the records is reported here as a plain fact, never as a pass or a failure.
// It asserts nothing about whether the records are present, so it is green on the operator's machine
// and green in a bare clone. What it cannot survive is a NEW hidden dependency.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(HERE, "record-dependencies.json");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const ROOT_TOKEN = manifest.untrackedRoot.replace(/\/$/, "");

const suiteFiles = readdirSync(HERE).filter((f) => f.endsWith(".test.mjs"));

// A suite "depends on the untracked root" if its own source references it. Read the text rather than
// executing anything: a dependency that only appears at runtime is exactly the kind this must catch.
const observed = suiteFiles
  .filter((f) => f !== "record-dependency-declared.test.mjs")
  .filter((f) => readFileSync(path.join(HERE, f), "utf8").includes(ROOT_TOKEN))
  .sort();

const declared = [...manifest.suites].sort();

test("the manifest is well formed and tracked", () => {
  assert.equal(manifest.schema, "record-dependencies/1");
  assert.ok(manifest.untrackedRoot.endsWith("/"), "untrackedRoot names a directory");
  assert.ok(Array.isArray(manifest.suites) && manifest.suites.length > 0);
  assert.ok(Array.isArray(manifest.why) && manifest.why.length > 0, "the manifest states WHY, not just what");
  for (const s of manifest.suites) assert.ok(s.endsWith(".test.mjs"), `${s} must name a suite file`);
  assert.equal(new Set(manifest.suites).size, manifest.suites.length, "no duplicate entries");
});

test("every declared suite exists on disk", () => {
  for (const s of declared) {
    assert.ok(existsSync(path.join(HERE, s)), `${s} is declared but does not exist - stale manifest entry`);
  }
});

test("NO suite reads the untracked record root without being declared", () => {
  const undeclared = observed.filter((s) => !declared.includes(s));
  assert.deepEqual(
    undeclared,
    [],
    "these suites read untracked operator records but are not declared in record-dependencies.json, so a " +
      "green registry on one machine would silently stop being reproducible on another: " + undeclared.join(", "),
  );
});

test("NOTHING is declared that does not actually read the untracked root", () => {
  const phantom = declared.filter((s) => !observed.includes(s));
  assert.deepEqual(
    phantom,
    [],
    "declared as record-dependent but reads nothing from the untracked root - remove it rather than " +
      "carrying a dependency that is not real: " + phantom.join(", "),
  );
});

test("record absence is REPORTED as a fact and never dressed up as a pass", () => {
  // This is the honesty half. The suite must behave identically whether or not the records are on disk,
  // and must be able to say which of the two it is looking at.
  const recordRoot = path.resolve(HERE, "../..", ROOT_TOKEN);
  const present = existsSync(recordRoot);
  const verdict = present
    ? "operator records PRESENT - the declared suites run against real records"
    : "operator records ABSENT - the declared suites cannot be verified here, and their result is not evidence";
  assert.equal(typeof verdict, "string");
  assert.ok(verdict.includes(present ? "PRESENT" : "ABSENT"));
  // Never assert on `present`: a bare clone is a legitimate environment, not a failure.
  console.log(`# record-dependency: ${verdict} (${declared.length} declared suites)`);
});
