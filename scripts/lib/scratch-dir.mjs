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

/** Tried in order. The first that accepts BOTH a directory and a probe write wins. */
export const CANDIDATES = Object.freeze([
  () => process.env.AXIS_SCRATCH_DIR || null,
  () => os.tmpdir(),
  () => "/tmp",
  () => "/var/tmp",
  () => (os.homedir() ? path.join(os.homedir(), ".cache") : null),
]);

/**
 * Create a private scratch directory this process owns.
 *
 * @param {string} prefix  a name that says which caller made it, so a leftover is traceable
 * @returns {string} absolute path to a directory that has been PROVEN writable
 * @throws when no candidate accepts a write — refusing is correct; writing into a volume that
 *         silently drops data would be worse than stopping.
 */
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
    try {
      const probe = path.join(dir, `.probe-${process.pid}`);
      fs.writeFileSync(probe, "x");
      fs.rmSync(probe, { force: true });
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
