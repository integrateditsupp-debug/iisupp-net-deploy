// range-bundle.test.mjs — RUN-AR / AR2.
//
// The claim under test: the unpublished line now has a delivery path that needs no credential this
// environment lacks, and the artefact is proven to reproduce the exact tree the tests were green
// against — not "a recent commit", the SHA and the tree.
//
// RED-FIRST, proven against real corruption rather than mocks:
//   · a truncated bundle reported as verified
//   · a bundle whose tip is a DIFFERENT commit than the one recorded
//   · a manifest whose tree hash was hand-edited to a tree the tip does not describe
//   · a bundle with no manifest treated as self-proving
//   · a missing bundle treated as anything other than missing
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  createRangeBundle, verifyRangeBundle, BUNDLE_CLASSES,
  BUNDLE_FILE, MANIFEST_FILE, RANGE_BUNDLE_SCHEMA, SENDS, digestFile,
} from "../scripts/lib/range-bundle.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** A tiny real repository, so every assertion below is against git and not against a fake. */
function scratchRepo() {
  const dir = makeScratchDir("ar2-bundle-");
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "t@example.invalid"], dir);
  git(["config", "user.name", "T"], dir);
  fs.writeFileSync(path.join(dir, "a.txt"), "one\n");
  git(["add", "."], dir); git(["commit", "-qm", "base"], dir);
  const base = git(["rev-parse", "HEAD"], dir).trim();
  git(["update-ref", "refs/remotes/origin/main", base], dir);
  fs.writeFileSync(path.join(dir, "b.txt"), "two\n");
  git(["add", "."], dir); git(["commit", "-qm", "ahead one"], dir);
  fs.writeFileSync(path.join(dir, "c.txt"), "three\n");
  git(["add", "."], dir); git(["commit", "-qm", "ahead two"], dir);
  return { dir, base };
}

test("AR2 — the module sends nothing and declares its schema", () => {
  assert.equal(SENDS, false);
  assert.equal(RANGE_BUNDLE_SCHEMA, "range-bundle.v1");
});

test("AR2 — a bundle is created, verifies, and carries the tested tip and tree", () => {
  const { dir } = scratchRepo();
  const made = createRangeBundle({ root: dir, ref: "refs/remotes/origin/main", head: "HEAD", branch: "main" });
  assert.equal(made.ok, true, made.detail);
  assert.equal(made.class, BUNDLE_CLASSES.OK);
  assert.equal(made.manifest.commits, 2, "the range is two commits, read from git not typed");
  assert.equal(made.manifest.tip, git(["rev-parse", "HEAD"], dir).trim());
  assert.equal(made.manifest.tree, git(["rev-parse", "HEAD^{tree}"], dir).trim());
  assert.ok(made.manifest.bytes > 0);
  assert.ok(fs.existsSync(path.join(dir, BUNDLE_FILE)));
  assert.ok(fs.existsSync(path.join(dir, MANIFEST_FILE)));
  assert.match(made.manifest.fetchCommand, /^git fetch /, "the receiver's one command is recorded with the artefact");

  const ok = verifyRangeBundle({ root: dir });
  assert.equal(ok.ok, true, ok.detail);
});

test("AR2 — the bundle actually reproduces the tree, fetched by a receiver that has only the base", () => {
  const { dir, base } = scratchRepo();
  const made = createRangeBundle({ root: dir, ref: "refs/remotes/origin/main", head: "HEAD", branch: "main" });
  assert.equal(made.ok, true, made.detail);

  // A separate repository holding ONLY the base commit — the receiver's situation exactly.
  const rx = makeScratchDir("ar2-rx-");
  git(["init", "-q", "-b", "main"], rx);
  git(["config", "user.email", "t@example.invalid"], rx);
  git(["config", "user.name", "T"], rx);
  git(["fetch", "-q", dir, `${base}:refs/heads/base`], rx);

  git(["fetch", "-q", path.join(dir, BUNDLE_FILE), "main:refs/heads/delivered"], rx);
  const deliveredTree = git(["rev-parse", "refs/heads/delivered^{tree}"], rx).trim();
  assert.equal(deliveredTree, made.manifest.tree,
    "the tree a receiver checks out must be byte-identical to the tree the tests ran against");
  assert.equal(git(["rev-parse", "refs/heads/delivered"], rx).trim(), made.manifest.tip);
});

test("AR2 — RED: a truncated bundle must not verify (git's own verify passes it — the digest does not)", () => {
  const { dir } = scratchRepo();
  assert.equal(createRangeBundle({ root: dir, ref: "refs/remotes/origin/main" }).ok, true);
  const abs = path.join(dir, BUNDLE_FILE);
  const buf = fs.readFileSync(abs);
  fs.writeFileSync(abs, buf.subarray(0, Math.floor(buf.length * 0.6)));
  const res = verifyRangeBundle({ root: dir });
  assert.equal(res.ok, false);
  assert.equal(res.class, BUNDLE_CLASSES.DIGEST_MISMATCH,
    "git bundle verify reads the header only and PASSES a truncated file; the byte digest is the check that catches it");
  assert.match(res.detail, /not the file that was created/);

  // And the finding that produced this class, asserted so it cannot be forgotten: git alone is not
  // enough. If a future git starts rejecting truncation this assertion tells us the guard is now
  // redundant rather than letting us assume it always was.
  let gitAcceptedIt = true;
  try { execFileSync("git", ["bundle", "verify", path.join(dir, BUNDLE_FILE)], { cwd: dir, stdio: "ignore" }); }
  catch { gitAcceptedIt = false; }
  assert.equal(gitAcceptedIt, true,
    "recorded 2026-08-06: `git bundle verify` accepts a 60%-truncated bundle — this is why the digest exists");
});

test("AR2 — RED: a bundle whose tip is not the recorded commit is a TIP_MISMATCH", () => {
  const { dir } = scratchRepo();
  assert.equal(createRangeBundle({ root: dir, ref: "refs/remotes/origin/main" }).ok, true);
  const manifestAbs = path.join(dir, MANIFEST_FILE);
  const m = JSON.parse(fs.readFileSync(manifestAbs, "utf8"));
  m.tip = git(["rev-parse", "HEAD~1"], dir).trim(); // a real commit — just not the tested one
  fs.writeFileSync(manifestAbs, JSON.stringify(m, null, 2));
  const res = verifyRangeBundle({ root: dir });
  assert.equal(res.ok, false);
  assert.equal(res.class, BUNDLE_CLASSES.TIP_MISMATCH);
  assert.match(res.detail, /none of them is the recorded tip/);
});

test("AR2 — RED: a hand-edited tree hash is caught even when the commit SHA is right", () => {
  const { dir } = scratchRepo();
  assert.equal(createRangeBundle({ root: dir, ref: "refs/remotes/origin/main" }).ok, true);
  const manifestAbs = path.join(dir, MANIFEST_FILE);
  const m = JSON.parse(fs.readFileSync(manifestAbs, "utf8"));
  m.tree = git(["rev-parse", "HEAD~1^{tree}"], dir).trim(); // the SHA stays correct; the tree does not
  fs.writeFileSync(manifestAbs, JSON.stringify(m, null, 2));
  const res = verifyRangeBundle({ root: dir });
  assert.equal(res.ok, false);
  assert.equal(res.class, BUNDLE_CLASSES.TREE_MISMATCH);
  assert.match(res.detail, /describes tree/);
});

test("AR2 — RED: corruption in the middle of the pack is caught by the digest", () => {
  const { dir } = scratchRepo();
  assert.equal(createRangeBundle({ root: dir, ref: "refs/remotes/origin/main" }).ok, true);
  const abs = path.join(dir, BUNDLE_FILE);
  const buf = fs.readFileSync(abs);
  buf[Math.floor(buf.length * 0.7)] ^= 0xff; // one flipped byte, length unchanged
  fs.writeFileSync(abs, buf);
  const res = verifyRangeBundle({ root: dir });
  assert.equal(res.ok, false);
  assert.equal(res.class, BUNDLE_CLASSES.DIGEST_MISMATCH,
    "a single flipped byte must be caught — the file size is identical, so only the digest can see it");
});

test("AR2 — the manifest records the digest of the bytes it describes", () => {
  const { dir } = scratchRepo();
  const made = createRangeBundle({ root: dir, ref: "refs/remotes/origin/main" });
  assert.match(String(made.manifest.sha256), /^[0-9a-f]{64}$/);
  assert.equal(made.manifest.sha256, digestFile(path.join(dir, BUNDLE_FILE)));
  assert.equal(made.manifest.bytes, fs.statSync(path.join(dir, BUNDLE_FILE)).size);
});

test("AR2 — RED: a bundle with no manifest proves nothing and must say so", () => {
  const { dir } = scratchRepo();
  assert.equal(createRangeBundle({ root: dir, ref: "refs/remotes/origin/main" }).ok, true);
  fs.rmSync(path.join(dir, MANIFEST_FILE));
  const res = verifyRangeBundle({ root: dir });
  assert.equal(res.ok, false);
  assert.equal(res.class, BUNDLE_CLASSES.NO_MANIFEST);
});

test("AR2 — RED: a missing bundle is missing, not 'fine'", () => {
  const dir = makeScratchDir("ar2-empty-");
  const res = verifyRangeBundle({ root: dir });
  assert.equal(res.ok, false);
  assert.equal(res.class, BUNDLE_CLASSES.NOT_ON_DISK);
});

test("AR2 — RED: creation against a ref that does not exist fails with a reason, never silently", () => {
  const { dir } = scratchRepo();
  const res = createRangeBundle({ root: dir, ref: "refs/remotes/origin/nope" });
  assert.equal(res.ok, false);
  assert.equal(res.class, BUNDLE_CLASSES.CREATE_FAILED);
  assert.match(res.detail, /could not resolve the range/);
});

test("AR2 — the delivered bundle in THIS repository, when present, verifies against its manifest", () => {
  if (!fs.existsSync(path.join(REPO, BUNDLE_FILE))) return; // the emitter writes it; absence is not this red
  const res = verifyRangeBundle({ root: REPO });
  assert.equal(res.ok, true, `the shipped bundle must verify: ${res.class} — ${res.detail}`);
  assert.equal(res.manifest.schema, RANGE_BUNDLE_SCHEMA);
  assert.ok(Number.isInteger(res.manifest.commits) && res.manifest.commits >= 0);
  // The tip it carries must be a commit this repository actually has — a bundle of somewhere else
  // is worse than no bundle.
  assert.equal(git(["cat-file", "-t", res.manifest.tip], REPO).trim(), "commit");
});

// ── AU4 (2026-08-11). The isolated re-verify, and the reason it is not a weakening. ─────────────
test("AU4 — when a dangling foreign ref forces the isolated re-verify, it is RECORDED, never silent", () => {
  const res = verifyRangeBundle({ root: REPO });
  if (!res.ok) return; // a bundle that is genuinely bad is another test's subject, not this one
  assert.ok(typeof res.verifiedIn === "string" && res.verifiedIn.length > 0,
    "every verification says where it ran, so a fallback can never pass as the ordinary path");
  if (res.verifiedIn !== "this repository") {
    assert.match(res.verifiedIn, /dangling ref/,
      "the fallback must state the reason it was needed, in the result an operator reads");
    assert.match(res.detail, /verified in /,
      "and it must appear in the human-readable detail too, not only in a field nobody prints");
  }
});
