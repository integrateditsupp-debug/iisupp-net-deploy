// branch-reference-consumers.test.mjs — RUN-BL / BL2. THE GUARD THAT IS NOW ACTUALLY CALLED.
//
// BH1 built `branch-reference.mjs` because BG found a lane recorded as merged that was not, and the
// cause was the REFERENCE: on this machine `origin/main` is a cached remote pointer no credential
// can refresh, so a branch already contained in the local line and a branch genuinely ahead of it
// return the same answer. The module was written, tested, and then nothing imported it. Three
// cycles running the ledger's branch reading was taken BY HAND, and the two modules that actually
// measure the distance — `unpublished-range.mjs` and `range-bundle.mjs` — carried
//
//     ref = "origin/main"
//
// as a DEFAULT PARAMETER. A guard against a stale pointer sat beside two modules whose default was
// that exact pointer. A guard nothing calls is a comment.
//
// What this suite holds, and why each is worth a case:
//
//   1. The default is resolved HERE, not typed. A caller that passes nothing gets the reference this
//      checkout can actually trust.
//   2. Every reading NAMES what it was measured from. A distance travelling without its reference is
//      the exact shape of the bug BG found, and it is now unreportable rather than merely discouraged.
//   3. An explicit ref is HONOURED, never swapped. A fixture that names a ref means it; silently
//      substituting would make fixtures untestable and would be its own kind of dishonesty.
//   4. When an explicit ref lags the local line, the reading says SO. Honoured, and flagged.
//   5. There is ONE implementation. A second copy of "which ref do we trust" is how the first one
//      drifts, so the consumers are checked for re-implementation by reading their source.
//
// Reads only. No network, no fetch, no credential — resolveBranchReference is documented as never
// reaching the network and a case here proves the consumers inherit that.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  resolveReadingRef, assertNamesReference, resolveBranchReference,
  REFERENCE_CLASSES, RESOLVE_HERE,
} from "../scripts/lib/branch-reference.mjs";
import { readUnpublishedRange } from "../scripts/lib/unpublished-range.mjs";
import { createRangeBundle } from "../scripts/lib/range-bundle.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

const git = (args, cwd) => execFileSync("git", args, {
  cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
});

/**
 * A repository whose remote pointer is deliberately BEHIND its local line — the state this machine
 * is permanently in, built small enough to reason about.
 * @returns {{dir:string, base:string, tip:string}}
 */
function staleRemoteRepo() {
  const dir = makeScratchDir("bl2-stale-");
  git(["init", "-q", "-b", "main", "."], dir);
  fs.writeFileSync(path.join(dir, "a.txt"), "one\n");
  git(["add", "-A"], dir); git(["commit", "-qm", "one"], dir);
  const base = git(["rev-parse", "HEAD"], dir).trim();
  // The remote pointer is pinned to the FIRST commit and then never moved again — exactly what an
  // unrefreshable cached ref looks like from inside.
  git(["update-ref", "refs/remotes/origin/main", base], dir);
  fs.writeFileSync(path.join(dir, "b.txt"), "two\n");
  git(["add", "-A"], dir); git(["commit", "-qm", "two"], dir);
  fs.writeFileSync(path.join(dir, "index.html"), "<html>public</html>\n");
  git(["add", "-A"], dir); git(["commit", "-qm", "three"], dir);
  return { dir, base, tip: git(["rev-parse", "HEAD"], dir).trim() };
}
const withRepo = (fn) => {
  const repo = staleRemoteRepo();
  try { return fn(repo); } finally { try { fs.rmSync(repo.dir, { recursive: true, force: true }); } catch { /* mount refuses unlink */ } }
};

// ── 1 · the default resolves here ────────────────────────────────────────────

test("BL2 — the default is the reference this checkout resolves to, not a typed ref", () => {
  withRepo(({ dir }) => {
    const picked = resolveReadingRef({ root: dir, ref: RESOLVE_HERE });
    assert.equal(picked.resolvedHere, true);
    assert.equal(picked.ref, "main", "with the remote pointer behind, the local line IS the reference");
    assert.equal(picked.class, REFERENCE_CLASSES.LOCAL_AHEAD);
    assert.equal(picked.staleBy, 2, "the remote pointer is two commits behind and the number is carried, not hidden");
  });
});

test("BL2 — RED: the reading a caller would have got from the old default is a DIFFERENT number", () => {
  // This is the whole bug, made arithmetic. Against the stale pointer the range is 2 commits;
  // against the line this checkout is on it is 0. Both are computable; only one is the answer to
  // "what is unpublished from here", and the old default returned the other one.
  withRepo(({ dir }) => {
    const stale = readUnpublishedRange({ root: dir, ref: "refs/remotes/origin/main" });
    const here = readUnpublishedRange({ root: dir });
    assert.equal(stale.ok, true);
    assert.equal(here.ok, true);
    assert.equal(stale.report.summary.commits, 2);
    assert.equal(here.report.summary.commits, 0, "measured from the reference this checkout resolves to, nothing is ahead");
    assert.notEqual(stale.report.summary.commits, here.report.summary.commits,
      "if these were equal the fixture would not reproduce the bug and the case would prove nothing");
  });
});

// ── 2 · every reading names its reference ────────────────────────────────────

test("BL2 — a range reading carries the reference it was measured from", () => {
  withRepo(({ dir }) => {
    const read = readUnpublishedRange({ root: dir });
    assert.equal(assertNamesReference(read).ok, true, assertNamesReference(read).reason);
    assert.equal(read.reference.ref, "main");
    assert.ok(read.reference.sha, "a named reference without a sha is half a citation");
    assert.match(read.detail, /main/);
  });
});

test("BL2 — RED: a reading that names no reference is refused, and says why", () => {
  const verdicts = [
    assertNamesReference(null),
    assertNamesReference({ report: { total: 51 } }),
    assertNamesReference({ reference: { ref: "main" } }), // named, but no statement of why
  ];
  for (const v of verdicts) assert.equal(v.ok, false, `should have been refused: ${v.reason}`);
  assert.match(verdicts[1].reason, /does not name the reference/);
  assert.match(verdicts[2].reason, /why that ref/);
});

test("BL2 — an unreadable range is still a reading that names its reference", () => {
  // A refusal is where a wrong number is most tempting. Even the failure path carries the citation.
  withRepo(({ dir }) => {
    const read = readUnpublishedRange({ root: dir, ref: "refs/heads/no-such-lane-bl2" });
    assert.equal(read.ok, false);
    assert.equal(assertNamesReference(read).ok, true, "a refusal without a reference is indistinguishable from a clean zero");
    assert.match(read.detail, /unknown, not zero/);
  });
});

// ── 3 and 4 · explicit refs are honoured, and flagged when they lag ───────────

test("BL2 — an explicitly named ref is honoured exactly, never swapped underneath the caller", () => {
  withRepo(({ dir }) => {
    const picked = resolveReadingRef({ root: dir, ref: "refs/remotes/origin/main" });
    assert.equal(picked.ref, "refs/remotes/origin/main", "a fixture that names a ref means it");
    assert.equal(picked.resolvedHere, false);
    assert.equal(picked.requested, "refs/remotes/origin/main");
  });
});

test("BL2 — but a lagging explicit ref is FLAGGED, so the number cannot be printed as if it were current", () => {
  withRepo(({ dir }) => {
    const picked = resolveReadingRef({ root: dir, ref: "refs/remotes/origin/main" });
    assert.equal(picked.stale, true);
    assert.match(picked.statement, /AS ASKED/);
    assert.match(picked.statement, /NOT the distance/);
    const read = readUnpublishedRange({ root: dir, ref: "refs/remotes/origin/main" });
    assert.equal(read.reference.stale, true, "the flag must survive into the reading, or it protects nothing");
  });
});

// ── the bundle: the base a receiver must already hold ─────────────────────────

test("BL2 — a range bundle records the reference it is thin against, resolved not assumed", () => {
  withRepo(({ dir }) => {
    const made = createRangeBundle({ root: dir, ref: "refs/remotes/origin/main", head: "HEAD", branch: "main" });
    assert.equal(made.ok, true, made.detail);
    assert.equal(made.manifest.basedOn.ref, "refs/remotes/origin/main");
    assert.equal(made.manifest.basedOn.resolvedHere, false);
    assert.equal(made.manifest.basedOn.stale, true,
      "a receiver reading `commits: 2` is owed the fact that the base lags the line it was cut from");
    assert.ok(made.manifest.basedOn.statement.length > 40);
  });
});

// ── 5 · one implementation ───────────────────────────────────────────────────

test("BL2 — neither consumer keeps its own idea of which ref to trust", () => {
  for (const rel of ["scripts/lib/unpublished-range.mjs", "scripts/lib/range-bundle.mjs"]) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.match(src, /from "\.\/branch-reference\.mjs"/, `${rel} must import the reference module rather than decide for itself`);
    const defaulted = src.match(/ref\s*=\s*["'][^"']+["']/g) || [];
    assert.deepEqual(defaulted, [],
      `${rel} still defaults \`ref\` to a hard-coded string (${defaulted.join(", ")}) — that literal is the bug`);
  }
});

test("BL2 — the reference is resolved without reaching the network", () => {
  // No credential exists here. A reading that quietly required one would be wrong the first time it
  // mattered, and the failure would look like a git problem rather than a design one.
  withRepo(({ dir }) => {
    const before = resolveBranchReference({ root: dir });
    const read = readUnpublishedRange({ root: dir });
    assert.equal(read.ok, true);
    assert.equal(before.sha, read.reference.sha, "the reading must not have moved the reference by fetching");
    const packed = fs.existsSync(path.join(dir, ".git", "FETCH_HEAD"));
    assert.equal(packed, false, "a FETCH_HEAD appearing means something reached for the network");
  });
});
