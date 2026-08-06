// sandbox-git-boundary.test.mjs — RUN-AR / AR3.
//
// The claim under test: the environment's git constraint is now a RECORDED FACT with a one-line
// check, so no future cycle re-derives it — and, crucially, its presence is never a red.
//
// The hardest assertion in this file is the one about colour: a suite that goes red because the
// environment is inconvenient trains its reader to ignore red. So the tests below prove the report
// is INTERNALLY CONSISTENT and that the workaround it names is complete, and deliberately assert
// nothing about which class this particular machine happens to be in.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  probeGitBoundary, confirmPorcelainBlocked, statementFor, WORKAROUND,
  BOUNDARY_CLASSES, LOCK_NAMES, SANDBOX_GIT_BOUNDARY_SCHEMA, SENDS,
} from "../scripts/lib/sandbox-git-boundary.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("AR3 — the module sends nothing and declares its schema", () => {
  assert.equal(SENDS, false);
  assert.equal(SANDBOX_GIT_BOUNDARY_SCHEMA, "sandbox-git-boundary.v1");
});

test("AR3 — the probe never throws, whatever it is pointed at", () => {
  assert.doesNotThrow(() => probeGitBoundary({ root: REPO }));
  assert.doesNotThrow(() => probeGitBoundary({ root: os.tmpdir() }));
  assert.doesNotThrow(() => probeGitBoundary({ root: "/definitely/not/here/ar3" }));
});

test("AR3 — a directory that is not a repository is classified, not failed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ar3-norepo-"));
  const r = probeGitBoundary({ root: dir });
  assert.equal(r.class, BOUNDARY_CLASSES.NOT_A_REPO);
  assert.equal(r.gitDirPresent, false);
  assert.match(r.statement, /not a git repository/);
});

test("AR3 — a healthy repository reports CLEAR and porcelain open", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ar3-clean-"));
  git(["init", "-q", "-b", "main"], dir);
  const r = probeGitBoundary({ root: dir });
  assert.equal(r.class, BOUNDARY_CLASSES.CLEAR);
  assert.equal(r.canUnlinkInGitDir, true);
  assert.equal(r.porcelainWrites, true);
  assert.equal(r.workaround, null, "a healthy repo must not be handed a workaround it does not need");
  assert.equal(r.probeLeftBehind, null, "a removable probe file must be removed");
});

test("AR3 — a REMOVABLE stale lock is a nuisance, and is classified as one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ar3-lock-"));
  git(["init", "-q", "-b", "main"], dir);
  fs.writeFileSync(path.join(dir, ".git/index.lock"), "");
  const r = probeGitBoundary({ root: dir });
  assert.equal(r.class, BOUNDARY_CLASSES.STALE_LOCK_REMOVABLE);
  assert.equal(r.staleLocks.length, 1);
  assert.equal(r.staleLocks[0].name, "index.lock");
  assert.ok(Number.isInteger(r.staleLocks[0].ageSeconds));
  assert.match(r.statement, /removable/);
  assert.equal(r.porcelainWrites, true, "a lock you can delete does not block you");
});

test("AR3 — the report is internally consistent: unlink refused implies porcelain blocked", () => {
  // Proven over every class rather than over whatever this machine happens to be.
  for (const cls of Object.values(BOUNDARY_CLASSES)) {
    const s = statementFor(cls, { porcelainWrites: false, plumbingWrites: true, locks: [] });
    assert.ok(typeof s === "string" && s.length > 20, `class ${cls} must carry a statement`);
  }
  const r = probeGitBoundary({ root: REPO });
  if (r.canCreateInGitDir && !r.canUnlinkInGitDir) {
    assert.equal(r.class, BOUNDARY_CLASSES.UNLINK_REFUSED);
    assert.equal(r.porcelainWrites, false, "if the lock cannot be removed, porcelain cannot work — the report must not claim it can");
    assert.ok(r.workaround, "a blocked environment must be handed the workaround, not just the diagnosis");
  }
  if (r.porcelainWrites) {
    assert.ok(r.canUnlinkInGitDir || r.class === BOUNDARY_CLASSES.NOT_A_REPO,
      "porcelain cannot be reported open where locks are permanent");
  }
});

test("AR3 — the recorded workaround is complete enough to follow without rediscovery", () => {
  assert.ok(WORKAROUND.why.length > 80, "the reason must be written out, not implied");
  const joined = WORKAROUND.steps.join("\n");
  for (const needed of ["GIT_INDEX_FILE", "write-tree", "commit-tree", "refs/heads/"]) {
    assert.ok(joined.includes(needed), `the workaround must name ${needed} — a half-recorded workaround is re-derived`);
  }
  assert.match(WORKAROUND.doNot, /do not treat its presence as a failure/);
  assert.ok(LOCK_NAMES.includes("index.lock") && LOCK_NAMES.includes("HEAD.lock"));
});

test("AR3 — the workaround actually produces a commit where porcelain is blocked", () => {
  // The claim is tested for real: a repository whose index.lock exists, committed via plumbing.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ar3-plumb-"));
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "t@example.invalid"], dir);
  git(["config", "user.name", "T"], dir);
  fs.writeFileSync(path.join(dir, "a.txt"), "one\n");
  git(["add", "."], dir); git(["commit", "-qm", "base"], dir);
  const before = git(["rev-parse", "HEAD"], dir).trim();

  // Block porcelain the way this environment is blocked.
  fs.writeFileSync(path.join(dir, ".git/index.lock"), "");
  let porcelainFailed = false;
  try { git(["add", "."], dir); } catch { porcelainFailed = true; }
  assert.equal(porcelainFailed, true, "the premise: with index.lock present, porcelain refuses");

  // Now the recorded steps, executed literally.
  const idx = path.join(os.tmpdir(), `ar3-${process.pid}.index`);
  const env = { ...process.env, GIT_INDEX_FILE: idx };
  const g = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
  fs.writeFileSync(path.join(dir, "b.txt"), "two\n");
  g(["read-tree", "HEAD"]);
  g(["add", "-A"]);
  const tree = g(["write-tree"]).trim();
  const commit = g(["commit-tree", tree, "-p", before, "-m", "via plumbing"]).trim();
  fs.writeFileSync(path.join(dir, ".git/refs/heads/main"), `${commit}\n`);

  assert.equal(git(["rev-parse", "HEAD"], dir).trim(), commit, "the branch must actually move");
  assert.notEqual(commit, before);
  assert.equal(git(["cat-file", "-t", commit], dir).trim(), "commit");
  assert.match(git(["show", "--stat", "--oneline", commit], dir), /b\.txt/,
    "the new file must really be in the committed tree — a commit that contains nothing is not a workaround");
  fs.rmSync(idx, { force: true });
});

test("AR3 — the porcelain confirmation agrees with the probe on THIS repository", () => {
  const r = probeGitBoundary({ root: REPO });
  const c = confirmPorcelainBlocked({ root: REPO });
  assert.equal(c.attempted, true);
  if (!r.porcelainWrites) {
    assert.equal(c.blocked, true,
      `the probe predicted porcelain blocked; git said: ${c.message}`);
  }
});

test("AR3 — the boundary artefact on disk, when present, matches the schema", () => {
  const abs = path.join(REPO, "senior-director-state/sandbox-git-boundary.json");
  if (!fs.existsSync(abs)) return;
  const saved = JSON.parse(fs.readFileSync(abs, "utf8"));
  assert.equal(saved.schema, SANDBOX_GIT_BOUNDARY_SCHEMA);
  assert.ok(Object.values(BOUNDARY_CLASSES).includes(saved.class));
  assert.ok(typeof saved.statement === "string" && saved.statement.length > 20);
  assert.ok(!Number.isNaN(Date.parse(saved.probedAt)));
  if (!saved.porcelainWrites) assert.ok(saved.workaround, "a recorded blocked state must carry the workaround with it");
});
