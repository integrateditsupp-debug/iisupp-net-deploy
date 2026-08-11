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

// RUN-AP / AP4 WIDENING (2026-08-05). This scanned ONLY `ARIA Sentinel/tests/`, while the registry
// also runs roughly twenty suites from the repository-root `tests/` directory — so a root-level suite
// could read the untracked records and never be seen by the check whose whole job is to see that.
// Exactly the AP4 class of bug: an invariant enforced up to a boundary and abandoned at it. Root
// suites are now scanned too, and are declared by their path as the registry names them.
const ROOT_TESTS = path.resolve(HERE, "../../tests");
const localSuites = readdirSync(HERE)
  .filter((f) => f.endsWith(".test.mjs") && f !== "record-dependency-declared.test.mjs")
  .map((f) => ({ name: f, abs: path.join(HERE, f) }));
const rootSuites = existsSync(ROOT_TESTS)
  ? readdirSync(ROOT_TESTS)
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => ({ name: `../../tests/${f}`, abs: path.join(ROOT_TESTS, f) }))
  : [];

// A suite "depends on the untracked root" if its own source references it. Read the text rather than
// executing anything: a dependency that only appears at runtime is exactly the kind this must catch.
const mentions = [...localSuites, ...rootSuites]
  .filter((s) => readFileSync(s.abs, "utf8").includes(ROOT_TOKEN))
  .map((s) => s.name)
  .sort();

// ── RUN-BA / BA0 — MENTIONING A PATH IS NOT READING IT.
//
// The textual scan above is deliberately conservative and stays that way: it is the reason no hidden
// dependency has ever slipped past. But it cannot distinguish a suite that OPENS the untracked root
// from one that carries the path as DATA — and RUN-BA needed the latter, a suite whose subject is a
// list of ten paths that must never be tracked. Naming them is the entire assertion.
//
// The wrong repairs, both rejected: declaring it (a manifest entry that claims a dependency which does
// not exist is the register becoming a rubber stamp — the very thing `NOTHING is declared that does
// not actually read` exists to prevent), or renaming the constants so the token disappears (making a
// check green by hiding from it, which is the failure class this whole series was built to refuse).
//
// So: a MENTIONS-ONLY exemption, in the manifest, with a written reason — and, unlike a plain
// allowlist, PROVEN rather than trusted. The exemption is only valid while the suite performs no
// filesystem or process call whose argument carries the token. That is mechanically checkable, it is
// checked below on every run, and the moment such a call appears the exemption stops applying and the
// suite must be declared like any other. Same shape as AW1's directory-scoped exemption: narrow,
// argued in writing, counted and reported every run.
// The first draft of this check listed the filesystem functions by name — readFileSync, existsSync,
// execFileSync and so on. It was written, then TESTED by planting a read, and the plant walked
// straight through it: `import { existsSync as _e }` and the call reads `_e(`, which is not on any
// list. A check that can be defeated by a rename is not a check, and this program has now caught the
// same family three times (AW's spelled-out `years` vs `21+ yrs`, AX's link checker normalising the
// thing it was checking, and this).
//
// So the rule inverts and stops trying to recognise anything: a line carrying the token is a READ
// unless it is inert — a bare string literal, an array element, a simple const assignment, a comment.
// Anything that CALLS something while holding the path counts, whatever the callee is named. That
// over-reports by design; over-reporting costs a manifest entry, under-reporting costs the invariant.
const INERT_LINE = /^\s*(?:(?:const|let|var)\s+[\w$]+\s*=\s*)?(?:["'`][^"'`]*["'`])\s*,?\s*;?\s*(?:\/\/.*)?$/;
const COMMENT_LINE = /^\s*(?:\/\/|\*|\/\*)/;
const mentionsOnly = manifest.mentionsOnly || {};

const readsRootFor = (abs) => readFileSync(abs, "utf8")
  .split("\n")
  .map((line, i) => ({ line, n: i + 1 }))
  .filter(({ line }) => line.includes(ROOT_TOKEN) && !COMMENT_LINE.test(line) && !INERT_LINE.test(line));

const observed = mentions.filter((name) => {
  if (!Object.prototype.hasOwnProperty.call(mentionsOnly, name)) return true;
  const s = [...localSuites, ...rootSuites].find((x) => x.name === name);
  // An exempt suite that has started actually reading the root is NOT exempt. Falls back to observed.
  return readsRootFor(s.abs).length > 0;
}).sort();

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
    assert.ok(existsSync(path.resolve(HERE, s)), `${s} is declared but does not exist - stale manifest entry`);
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

// ── RUN-BA / BA0 — the exemption is counted and re-proven on every run, never assumed.
test("every mentions-only exemption is real, argued, and still earns itself", () => {
  const names = Object.keys(mentionsOnly);
  for (const name of names) {
    const entry = mentionsOnly[name];
    const suite = [...localSuites, ...rootSuites].find((x) => x.name === name);

    assert.ok(suite, `${name} is exempted but does not exist — a stale exemption is a hole nobody is watching`);
    assert.ok(mentions.includes(name), `${name} is exempted but does not even mention the root — remove the entry`);
    assert.equal(typeof entry, "string", `${name} — an exemption without a written reason is a rubber stamp`);
    assert.ok(entry.trim().length >= 40, `${name} — the reason must be an argument, not a word`);
    assert.doesNotMatch(entry, /mentions? only\.?$/i, `${name} — a reason that restates the exemption explains nothing`);
    assert.ok(!declared.includes(name), `${name} is both exempted and declared — one of the two is false`);

    // The proof: no filesystem or process call in this suite carries the token. Reported BY LINE.
    const reads = readsRootFor(suite.abs);
    assert.deepEqual(
      reads.map((r) => `${name}:${r.n}`),
      [],
      `${name} claims to only NAME the untracked root, but these lines pass it to a filesystem or ` +
        `process call — the exemption no longer holds and the suite must be declared: ` +
        reads.map((r) => `${name}:${r.n} ${r.line.trim()}`).join(" | ")
    );
  }
  console.log(`# record-dependency: ${names.length} mentions-only exemption(s), each re-proven this run: ${names.join(", ") || "none"}`);
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
