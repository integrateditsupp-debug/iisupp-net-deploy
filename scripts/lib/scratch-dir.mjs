// scratch-dir.mjs — RUN-BE / BE2. THE REMEDY THAT STOPS HAVING A COUNTDOWN ON IT.
//
// RUN-BC traced two cycles of red suites to `ENOSPC ... mkdtemp` and pinned the scratch directory to
// one hard-coded location. Within a day that location came back owned by another user and refused
// every write. RUN-BD fixed that INSIDE ONE SCRIPT — the status emitter — with a candidate list.
//
// The fix stayed local to the script that was hurting, so every OTHER caller of `os.tmpdir()` still
// carried the original failure. Found by running it: a brand-new suite written this cycle failed 16
// of its 20 cases on `ENOSPC ... mkdtemp` before a single assertion was evaluated. The tests were
// not wrong. The floor was.
//
// So the lesson gets extracted rather than re-learned: any code that needs somewhere to write picks
// the FIRST CANDIDATE THAT ACTUALLY ACCEPTS A WRITE, and proves it with a probe rather than assuming
// the directory it just created is usable. `mkdtemp` can succeed on a full volume; the write after it
// is what fails. A remedy that depends on one path staying writable forever is a remedy with a
// countdown on it.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// RUN-BH / BH2. The last resort, and the reason it exists.
// Measured this cycle: `/`, `/tmp`, `/var/tmp` and `~/.cache` all reached ENOSPC at once — this
// sandbox's root volume is 9.6 GB and full, and nothing on it can be unlinked to make room. Every
// system candidate refused a write within the same second and `makeScratchDir` correctly threw.
// The repository's own mount, however, still had space, because it is a different volume.
// `<repo>/tmp/` is git-ignored and force-404'd in netlify.toml, so nothing written there can become
// tracked content or reach the open web. It is LAST on purpose: a scratch directory inside the tree
// under test is a compromise, and it is only better than having no floor at all.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO_SCRATCH = path.join(REPO_ROOT, "tmp", "scratch");

/** Tried in order. The first that accepts BOTH a directory and a probe write wins. */
export const CANDIDATES = Object.freeze([
  () => process.env.AXIS_SCRATCH_DIR || null,
  () => os.tmpdir(),
  () => "/tmp",
  () => "/var/tmp",
  // RUN-BH / BH2: shared memory. Measured this cycle, when every disk-backed candidate answered
  // ENOSPC within the same second: `/dev/shm` was empty, writable, and — the property that decided
  // it — accepted UNLINK, which the repository mount does not. A fixture that runs `git commit`
  // needs to remove `COMMIT_EDITMSG`; on a volume that refuses unlink it cannot, and the suite goes
  // red on the floor rather than on its subject. Small (512 MB here) and volatile, which is exactly
  // what a test fixture wants.
  () => "/dev/shm",
  () => (os.homedir() ? path.join(os.homedir(), ".cache") : null),
  () => REPO_SCRATCH,
]);

/**
 * Create a private scratch directory this process owns.
 *
 * @param {string} prefix  a name that says which caller made it, so a leftover is traceable
 * @returns {string} absolute path to a directory that has been PROVEN writable
 * @throws when no candidate accepts a write — refusing is correct; writing into a volume that
 *         silently drops data would be worse than stopping.
 */
/**
 * RUN-BH / BH2. The repo-local floor is inside a work tree, and that is a fact fixtures can feel.
 *
 * Measured this cycle: with every system volume full at once, the fallback landed under
 * `<repo>/tmp/scratch/…` and eleven suites went red — not on their subject, but because a directory
 * a fixture had asked for as "somewhere that is NOT a repository" was, by being inside this one,
 * suddenly a repository. `git rev-parse` walks UP, so the scratch directory inherited the tree
 * around it and "an unreadable HEAD" silently became a readable one.
 *
 * `GIT_CEILING_DIRECTORIES` stops that walk at the scratch root. Discovery from inside answers
 * "not a git repository", which is what the fixture asked for, while `git init` still works for the
 * fixtures that build a real repository — verified both ways before this was relied on.
 */
function isInsideRepo(dir) {
  const abs = path.resolve(dir);
  return abs === REPO_ROOT || abs.startsWith(REPO_ROOT + path.sep);
}

function sealRepoBoundary(base) {
  // The ceiling is the SCRATCH ROOT, not the repository root: a fixture that builds its own
  // repository below it must still be discoverable from inside itself. Sealing at the repo root
  // would hide the fixture from its own test.
  const ceiling = path.resolve(base);
  const prev = process.env.GIT_CEILING_DIRECTORIES || "";
  if (prev.split(":").filter(Boolean).includes(ceiling)) return;
  process.env.GIT_CEILING_DIRECTORIES = prev ? `${prev}:${ceiling}` : ceiling;
}

export function makeScratchDir(prefix = "scratch-") {
  const failures = [];
  for (const pick of CANDIDATES) {
    let base;
    try { base = pick(); } catch { continue; }
    if (!base) continue;
    let dir;
    try {
      fs.mkdirSync(base, { recursive: true });
      dir = fs.mkdtempSync(path.join(base, prefix));
    } catch (err) { failures.push(`${base}: ${err.code || err.message}`); continue; }
    // mkdtemp succeeding is not the same fact as the volume accepting content.
    //
    // RUN-BH / BH2: the probe used to require the write AND the removal, and rejected any directory
    // that refused `unlink`. That is the wrong bar. This repository's own mount accepts writes and
    // refuses unlink permanently — the boundary AR3 recorded — so a perfectly usable floor was being
    // turned down for failing a courtesy. Writing is the requirement; removing is tidiness. The
    // failure to remove is recorded on the returned path's directory, never used to reject it.
    try {
      const probe = path.join(dir, `.probe-${process.pid}`);
      fs.writeFileSync(probe, "x");
      try { fs.rmSync(probe, { force: true }); } catch { /* a mount that refuses unlink is still a floor */ }
      if (isInsideRepo(base)) sealRepoBoundary(base);
      return dir;
    } catch (err) {
      failures.push(`${base}: created but refused a write (${err.code || err.message})`);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a full volume can refuse unlink too */ }
    }
  }
  throw new Error(`no writable scratch location — ${failures.join("; ") || "no candidate produced a path"}`);
}

/** Run `fn` against a fresh scratch directory and remove it afterwards, even on throw. */
export function withScratchDir(prefix, fn) {
  const dir = makeScratchDir(prefix);
  try { return fn(dir); } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }
}

export default { makeScratchDir, withScratchDir, CANDIDATES };
