// no-absolute-symlinks.test.mjs — no tracked symlink may point outside the repository
// (flywheel cycle 120, 2026-08-05).
//
// The real defect this suite exists to prevent recurring: two tracked symlinks reached the shared
// line pointing at `/sessions/<a-dead-sandbox>/mnt/iisupp-net-deploy/node_modules`. They were
// committed accidentally while an agent had symlinked dependency trees into a throwaway clone. The
// damage is threefold and none of it is theoretical:
//   1. They are broken on every machine on earth except one container that no longer exists, so a
//      fresh checkout gets two dangling entries where dependency trees are expected.
//   2. The publish directory is the repository root, so a tracked entry at the root SHIPS.
//   3. The target is an absolute build-sandbox path — the same leak class the status-feed emitter
//      already refuses to publish, arriving instead through git.
//
// The rule is deliberately narrow: a tracked symlink is fine if it resolves inside the repository.
// It is refused if it is absolute, or if it escapes the repository by traversal.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const git = (...args) =>
  execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// `git ls-files -s` prints: <mode> <sha> <stage>\t<path>. Mode 120000 is a symlink; its blob content
// IS the link target, so the check reads git's own record and never the working tree.
const trackedSymlinks = () =>
  git("ls-files", "-s")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [meta, file] = l.split("\t");
      const [mode, sha] = meta.split(/\s+/);
      return { mode, sha, file };
    })
    .filter((e) => e.mode === "120000");

test("no tracked symlink points outside the repository", () => {
  const offenders = [];
  for (const { sha, file } of trackedSymlinks()) {
    const target = git("cat-file", "-p", sha).trim();
    if (path.isAbsolute(target) || /^[A-Za-z]:[\\/]/.test(target)) {
      offenders.push(`${file} -> ${target} (absolute)`);
      continue;
    }
    const resolved = path.resolve(path.dirname(path.join(REPO, file)), target);
    if (!resolved.startsWith(REPO + path.sep)) offenders.push(`${file} -> ${target} (escapes the repository)`);
  }
  assert.deepEqual(
    offenders,
    [],
    "tracked symlinks that cannot resolve on another machine, and that ship because the publish " +
      "directory is the repository root:\n  " + offenders.join("\n  "),
  );
});

test("no tracked entry is named node_modules", () => {
  // Narrower and blunter than the check above, and worth keeping separate: a dependency tree must
  // never be tracked in any form — real directory, symlink, or gitlink. .gitignore already says so
  // four times; this makes the index agree with it.
  const named = git("ls-files")
    .split("\n")
    .filter((f) => f === "node_modules" || f.endsWith("/node_modules") || f.includes("node_modules/"));
  assert.deepEqual(named, [], "node_modules must never be tracked: " + named.join(", "));
});
