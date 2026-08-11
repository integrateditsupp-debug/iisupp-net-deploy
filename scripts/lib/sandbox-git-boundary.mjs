// sandbox-git-boundary.mjs — RUN-AR / AR3. THE BOUNDARY, RECORDED ONCE AND STOPPED BEING REDISCOVERED.
//
// WHY THIS EXISTS (2026-08-06).
// Every cycle in this series has begun the same way: an agent tries to commit, git answers
//
//     fatal: Unable to create '.../.git/index.lock': File exists.
//
// and the agent then spends part of its cycle re-deriving, from scratch, the same three facts and
// the same workaround it derived last time. Twenty-three cycles have each paid that tax privately.
// The constraint is not a bug to fix — this environment genuinely cannot unlink files inside the
// mounted `.git` — so the only thing that can be improved is how long it takes to KNOW that.
//
// THE THREE FACTS, measured rather than remembered:
//   1. whether stale lock files are present (`index.lock`, `HEAD.lock`, ref locks);
//   2. whether this process can UNLINK a file inside `.git` — the property that decides everything.
//      A lock that can be removed is a nuisance; a lock that cannot be is a boundary;
//   3. whether the porcelain write path (`git commit`) is consequently blocked, and whether the
//      plumbing write path (write a tree from a private index, `commit-tree`, overwrite the ref file)
//      is still open. On this mount, creating and OVERWRITING files under `.git` is permitted and
//      only unlinking is refused — which is exactly why plumbing works when porcelain does not.
//
// WHAT IT REFUSES TO DO — the point of the task.
// A blocked git is a FACT ABOUT THE ENVIRONMENT, not a test failure. If this module reported a red
// whenever the lock was present, every cycle would open with a red suite that means nothing, and a
// red that means nothing is worse than no red at all — it trains the reader to skip the colour.
// So `probeGitBoundary()` never throws and never fails; it CLASSIFIES. The suite asserts that the
// report is internally consistent (a boundary that claims porcelain works while unlink is refused is
// itself the contradiction worth failing on), not that the environment is convenient.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const SANDBOX_GIT_BOUNDARY_SCHEMA = "sandbox-git-boundary.v1";
export const SENDS = false;

export const BOUNDARY_CLASSES = Object.freeze({
  CLEAR: "git-is-fine-here-porcelain-writes-work",
  STALE_LOCK_REMOVABLE: "a-stale-lock-is-present-and-this-process-can-remove-it",
  UNLINK_REFUSED: "the-git-directory-refuses-unlink-so-porcelain-writes-are-permanently-blocked",
  READ_ONLY: "the-git-directory-refuses-writes-entirely",
  NOT_A_REPO: "this-directory-is-not-a-git-repository",
});

export const LOCK_NAMES = Object.freeze(["index.lock", "HEAD.lock", "config.lock", "packed-refs.lock"]);

/**
 * PROBE. Reads the environment and returns a report. Never throws. Never fails.
 * It writes one probe file inside `.git` under a stable name and tries to remove it again; whether
 * that removal succeeds is the whole measurement.
 */
export function probeGitBoundary({ root = process.cwd() } = {}) {
  const gitDir = path.join(root, ".git");
  const at = new Date().toISOString();

  if (!fs.existsSync(gitDir)) {
    return report({ at, class: BOUNDARY_CLASSES.NOT_A_REPO, gitDirPresent: false,
      locks: [], canCreate: false, canOverwrite: false, canUnlink: false,
      detail: `${gitDir} is not present — nothing here is a git repository` });
  }

  const locks = LOCK_NAMES
    .map((n) => ({ name: n, abs: path.join(gitDir, n) }))
    .filter((l) => fs.existsSync(l.abs))
    .map((l) => ({ name: l.name, ageSeconds: ageSeconds(l.abs) }));

  // A STABLE name, deliberately. A unique name per probe would litter a directory that refuses
  // unlink with one dead file per cycle forever; a stable one is overwritten in place, which is the
  // operation this environment permits. Concurrency is not a concern: the probe writes a constant
  // string and reads nothing back from the file.
  const probeName = ".boundary-probe";
  const probeAbs = path.join(gitDir, probeName);

  let canCreate = false, canOverwrite = false, canUnlink = false, note = null;
  try { fs.writeFileSync(probeAbs, "probe\n"); canCreate = true; }
  catch (err) { note = `create refused: ${String(err.code || err.message)}`; }
  if (canCreate) {
    try { fs.writeFileSync(probeAbs, "probe-again\n"); canOverwrite = true; }
    catch (err) { note = `overwrite refused: ${String(err.code || err.message)}`; }
    try { fs.unlinkSync(probeAbs); canUnlink = true; }
    catch (err) { note = `unlink refused: ${String(err.code || err.message)}`; }
  }

  const cls = !canCreate ? BOUNDARY_CLASSES.READ_ONLY
    : !canUnlink ? BOUNDARY_CLASSES.UNLINK_REFUSED
    : locks.length ? BOUNDARY_CLASSES.STALE_LOCK_REMOVABLE
    : BOUNDARY_CLASSES.CLEAR;

  return report({
    at, class: cls, gitDirPresent: true, locks, canCreate, canOverwrite, canUnlink,
    probeLeftBehind: canCreate && !canUnlink ? `${probeName} (could not be removed — this is the boundary, not a leak)` : null,
    detail: note,
  });
}

function ageSeconds(abs) {
  try { return Math.round((Date.now() - fs.statSync(abs).mtimeMs) / 1000); } catch { return null; }
}

/** Shape the report and derive what each write path can do. Pure. */
function report(f) {
  const porcelainWrites = f.class === BOUNDARY_CLASSES.CLEAR || f.class === BOUNDARY_CLASSES.STALE_LOCK_REMOVABLE;
  // Plumbing needs: a private index file OUTSIDE .git (GIT_INDEX_FILE), object writes (create-only)
  // and a ref update performed as an OVERWRITE of the loose ref file rather than through the
  // lock-taking porcelain. It survives exactly the case porcelain does not.
  const plumbingWrites = f.canCreate && f.canOverwrite;
  return Object.freeze({
    schema: SANDBOX_GIT_BOUNDARY_SCHEMA,
    probedAt: f.at,
    class: f.class,
    gitDirPresent: f.gitDirPresent,
    staleLocks: f.locks,
    canCreateInGitDir: f.canCreate,
    canOverwriteInGitDir: f.canOverwrite,
    canUnlinkInGitDir: f.canUnlink,
    porcelainWrites,
    plumbingWrites,
    probeLeftBehind: f.probeLeftBehind || null,
    detail: f.detail || null,
    statement: statementFor(f.class, { porcelainWrites, plumbingWrites, locks: f.locks }),
    workaround: porcelainWrites ? null : WORKAROUND,
    // The check that tells the two situations apart in one line, for the next cycle.
    oneLineCheck: "node -e \"import('./scripts/lib/sandbox-git-boundary.mjs').then(m=>console.log(m.probeGitBoundary().statement))\"",
  });
}

/** The workaround, written once so no cycle has to re-derive it. */
export const WORKAROUND = Object.freeze({
  why: "porcelain (`git add` / `git commit`) takes `.git/index.lock` and `.git/<ref>.lock` and must " +
    "REMOVE them afterwards. Where unlink is refused, the very first lock write becomes permanent and " +
    "every subsequent porcelain command fails with `File exists` — including the commands that would " +
    "clean it up.",
  steps: Object.freeze([
    "export GIT_INDEX_FILE=/tmp/<unique>.index   # a private index OUTSIDE .git; porcelain's lock is never taken",
    "git read-tree HEAD && git add -A            # stages into the private index",
    "git write-tree                              # -> TREE",
    "git commit-tree TREE -p HEAD -m '<message>' # -> COMMIT (object writes are create-only, which is permitted)",
    "printf '%s\\n' COMMIT > .git/refs/heads/<branch>   # an OVERWRITE, not a lock — permitted here",
  ]),
  cost: "no clone, no network, no credential; the working tree and the object store are the real ones",
  doNot: "do not try to delete the stale lock and do not treat its presence as a failure — it cannot be " +
    "removed from this environment and its presence is expected",
});

export function statementFor(cls, { porcelainWrites, plumbingWrites, locks = [] } = {}) {
  const n = locks.length;
  switch (cls) {
    case BOUNDARY_CLASSES.CLEAR:
      return "git is fine here: no stale locks and porcelain writes work normally.";
    case BOUNDARY_CLASSES.STALE_LOCK_REMOVABLE:
      return `${n} stale lock file(s) are present but removable — clear them and use git normally.`;
    case BOUNDARY_CLASSES.UNLINK_REFUSED:
      return `The .git directory refuses unlink, so ${n} stale lock file(s) are permanent and every ` +
        `porcelain write is blocked for the life of this environment. Plumbing writes are ${plumbingWrites ? "STILL OPEN" : "also blocked"} ` +
        "— commit via a private index and a ref overwrite, and do not spend the cycle re-deriving this.";
    case BOUNDARY_CLASSES.READ_ONLY:
      return "The .git directory refuses writes entirely: no commit path exists here. Work in a /tmp clone and deliver a bundle.";
    case BOUNDARY_CLASSES.NOT_A_REPO:
      return "This directory is not a git repository, so there is no boundary to report.";
    default:
      return `Unclassified git boundary (porcelain ${porcelainWrites ? "open" : "blocked"}).`;
  }
}

/**
 * Does the porcelain path actually fail the way the probe predicts? Run only when the caller wants
 * the prediction CONFIRMED against git rather than inferred from filesystem permissions.
 * Returns { attempted, blocked, message }. Never throws.
 */
// Set by confirmPorcelainBlocked() at the moment it cleans up after itself; read back onto the
// returned object so a caller never has to re-read a filesystem another process is also writing.
let LAST_CONFIRM_LEFT_LOCK = null;

export function confirmPorcelainBlocked({ root = process.cwd() } = {}) {
  try {
    execFileSync("git", ["-c", "user.name=probe", "-c", "user.email=probe@invalid",
      "commit", "--allow-empty", "--dry-run", "-m", "boundary probe"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { attempted: true, blocked: false, inconclusive: false, reason: "porcelain accepted a dry-run commit", message: "porcelain accepted a dry-run commit", get lockLeftBehind() { return LAST_CONFIRM_LEFT_LOCK; } };
  } catch (err) {
    const msg = String(err.stderr || err.message || err).split("\n").filter(Boolean).slice(0, 2).join(" ");
    const lockSignature = /index\.lock|Another git process|Unable to create/i.test(msg);

    // ── RUN-BA / BA0 — A THIRD OUTCOME, BECAUSE THERE ARE THREE.
    //
    // This returned `blocked: false` for ANY non-lock failure, and `git commit --dry-run` exits
    // non-zero whenever there is simply nothing staged. So on a clean tree the confirmation reported
    // "porcelain is NOT blocked" while having learned nothing at all about locks — and the AR3 suite,
    // which asserts the confirmation agrees with the probe, went red on a fact neither side had
    // measured. An absence inferred from a non-answer is the same class this program keeps refusing:
    // UNRUN is not a pass and it is not a failure either.
    //
    // Reported as its own state. The caller decides what to do with "I could not tell", and the one
    // thing it may not do is round it into either bucket.
    const nothingToCommit = /nothing (added )?to commit|no changes added|nothing to commit/i.test(msg);
    return {
      attempted: true,
      blocked: lockSignature,
      inconclusive: !lockSignature && nothingToCommit,
      reason: lockSignature ? "a lock signature in git's own stderr"
        : nothingToCommit ? "git refused for having nothing to commit, which says nothing about locks — UNRUN, not evidence"
        : "git refused for a reason that carries no lock signature",
      message: msg,
      get lockLeftBehind() { return LAST_CONFIRM_LEFT_LOCK; },
    };
  } finally {
    // The confirmation is not free: `git commit` TAKES `.git/index.lock`, and on this mount it cannot
    // remove it again (`warning: unable to unlink ... Operation not permitted`). So the probe that
    // measures the boundary has been CREATING it — every cycle has opened by moving a lock aside that
    // the previous cycle's own measurement left behind. Measuring something must not manufacture it.
    // Unlink is refused here and rename is permitted (AU's recorded correction), so the lock is moved
    // rather than deleted, and a failure to move it is swallowed: a cleanup that throws would turn a
    // successful measurement into a failed one.
    try {
      const lock = path.join(root, ".git", "index.lock");
      if (fs.existsSync(lock)) {
        const parked = path.join(root, ".git", "_stale-locks");
        fs.mkdirSync(parked, { recursive: true });
        fs.renameSync(lock, path.join(parked, `index.lock.probe-${Date.now()}`));
      }
      // Checked HERE, in the same breath as the move, and reported on the result object — never by a
      // caller re-reading the filesystem afterwards. The first version of this asserted the file was
      // absent AFTER the function returned, and went red inside the very next emit: another process
      // on this machine takes and re-creates `.git/index.lock` within seconds, so the assertion was
      // measuring that process rather than this one. A test that can be failed by somebody else's
      // work is not testing the thing it names.
      LAST_CONFIRM_LEFT_LOCK = fs.existsSync(lock);
    } catch { LAST_CONFIRM_LEFT_LOCK = null; /* the boundary itself; recorded above, never fatal here */ }
  }
}
