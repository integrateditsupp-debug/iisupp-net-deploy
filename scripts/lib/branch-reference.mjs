// branch-reference.mjs — RUN-BH / BH1. THE REFERENCE EVERY BRANCH READING IS TAKEN AGAINST.
//
// WHY THIS EXISTS (2026-08-11).
// BG found a lane recorded as merged that was not. The cause was not the recording: BF measured
// branch distance against `origin/main`, and in this environment `origin/main` is a CACHED remote
// pointer that cannot be refreshed — `git ls-remote` here answers
//
//     fatal: could not read Username for 'https://github.com'
//
// so it only moves when somebody with a credential fetches. When it lags the local `main`, the
// question "is this branch already contained?" is asked against a tip that does not include the
// commits that would contain it, and a genuinely-ahead branch and an already-merged one return the
// SAME ANSWER. A reading taken against the wrong reference is not a smaller truth; it is a wrong one.
//
// WHAT THIS REFUSES TO DO.
//   · It does not silently substitute one ref for another. It NAMES the reference it used, in its
//     own output, so a report carrying a distance also carries what the distance was measured from.
//   · It does not treat "the remote pointer is stale" as an error. It is the normal state of this
//     machine. It is reported as a fact with a number attached (`staleBy`), never as a failure.
//   · It does not fetch, and it does not reach the network. There is no credential here and a
//     reading that quietly requires one is a reading that will be wrong the first time it is needed.
import { execFileSync } from "node:child_process";

export const BRANCH_REFERENCE_SCHEMA = "branch-reference.v1";
export const SENDS = false;

export const REFERENCE_CLASSES = Object.freeze({
  LOCAL_AHEAD: "the-remote-pointer-is-behind-the-local-line-so-the-local-line-is-the-reference",
  IN_STEP: "the-remote-pointer-and-the-local-line-name-the-same-commit",
  REMOTE_AHEAD: "the-remote-pointer-is-ahead-of-the-local-line",
  NO_LOCAL: "the-local-line-does-not-resolve-in-this-checkout",
  NO_REMOTE: "there-is-no-remote-pointer-here-so-the-local-line-is-the-only-reference",
});

export const DEFAULT_LOCAL = "main";
export const DEFAULT_REMOTE = "origin/main";

const runGit = (args, root) => execFileSync("git", args, {
  cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
}).trim();

function resolve(ref, root) {
  try { return runGit(["rev-parse", "--verify", `${ref}^{commit}`], root); } catch { return null; }
}

function countBetween(from, to, root) {
  try { return Number(runGit(["rev-list", "--count", `${from}..${to}`], root)); } catch { return null; }
}

/**
 * Which reference should a "is this merged / how far ahead" reading be taken against, here, now.
 * Never throws. Always names what it chose and why.
 *
 * @returns {{ok:boolean, class:string, reference:string, sha:string|null, staleBy:number|null,
 *            local:{ref:string,sha:string|null}, remote:{ref:string,sha:string|null}, statement:string}}
 */
export function resolveBranchReference({ root = process.cwd(), local = DEFAULT_LOCAL, remote = DEFAULT_REMOTE } = {}) {
  const localSha = resolve(local, root);
  const remoteSha = resolve(remote, root);

  const base = {
    schema: BRANCH_REFERENCE_SCHEMA,
    local: { ref: local, sha: localSha },
    remote: { ref: remote, sha: remoteSha },
  };

  if (!localSha && !remoteSha) {
    return { ...base, ok: false, class: REFERENCE_CLASSES.NO_LOCAL, reference: null, sha: null, staleBy: null,
      statement: `neither ${local} nor ${remote} resolves here — no branch distance can be measured, and an unmeasurable distance is not zero` };
  }
  if (!localSha) {
    return { ...base, ok: true, class: REFERENCE_CLASSES.NO_LOCAL, reference: remote, sha: remoteSha, staleBy: null,
      statement: `${local} does not resolve here, so readings are taken against ${remote} (${remoteSha.slice(0, 12)}) and say so` };
  }
  if (!remoteSha) {
    return { ...base, ok: true, class: REFERENCE_CLASSES.NO_REMOTE, reference: local, sha: localSha, staleBy: null,
      statement: `there is no ${remote} here, so ${local} (${localSha.slice(0, 12)}) is the only reference and is named as such` };
  }
  if (localSha === remoteSha) {
    return { ...base, ok: true, class: REFERENCE_CLASSES.IN_STEP, reference: remote, sha: remoteSha, staleBy: 0,
      statement: `${remote} and ${local} name the same commit (${localSha.slice(0, 12)}) — either is the reference and the choice is recorded anyway` };
  }

  const remoteBehind = countBetween(remote, local, root);   // commits on local that remote lacks
  const remoteAhead = countBetween(local, remote, root);    // commits on remote that local lacks

  if (remoteBehind > 0) {
    return { ...base, ok: true, class: REFERENCE_CLASSES.LOCAL_AHEAD, reference: local, sha: localSha, staleBy: remoteBehind,
      statement: `${remote} is ${remoteBehind} commit(s) behind ${local} and cannot be refreshed without a credential this ` +
        `environment does not hold, so every branch reading is taken against ${local} (${localSha.slice(0, 12)}) — ` +
        `measuring against ${remote} would report an already-merged branch and a genuinely-ahead branch identically` };
  }
  return { ...base, ok: true, class: REFERENCE_CLASSES.REMOTE_AHEAD, reference: remote, sha: remoteSha, staleBy: 0,
    statement: `${remote} is ${remoteAhead} commit(s) ahead of ${local}; readings are taken against ${remote} (${remoteSha.slice(0, 12)})` };
}

/**
 * How far a branch stands from the reference, with the reference NAMED in the result.
 * @returns {{ok:boolean, branch:string, reference:string|null, referenceSha:string|null,
 *            ahead:number|null, behind:number|null, merged:boolean|null, staleReference:boolean,
 *            statement:string}}
 */
export function branchDistance(branch, { root = process.cwd(), local = DEFAULT_LOCAL, remote = DEFAULT_REMOTE } = {}) {
  const pick = resolveBranchReference({ root, local, remote });
  const branchSha = resolve(branch, root);

  if (!branchSha) {
    return { ok: false, branch, reference: pick.reference, referenceSha: pick.sha, ahead: null, behind: null,
      merged: null, staleReference: (pick.staleBy || 0) > 0, referenceClass: pick.class,
      statement: `${branch} does not resolve in this checkout — its distance is unknown, which is not the same fact as zero` };
  }
  if (!pick.reference) {
    return { ok: false, branch, reference: null, referenceSha: null, ahead: null, behind: null,
      merged: null, staleReference: false, referenceClass: pick.class,
      statement: `no reference resolves here, so ${branch} cannot be placed` };
  }

  const ahead = countBetween(pick.reference, branch, root);
  const behind = countBetween(branch, pick.reference, root);
  const merged = Number.isInteger(ahead) ? ahead === 0 : null;

  return {
    ok: true, branch, reference: pick.reference, referenceSha: pick.sha, ahead, behind, merged,
    staleReference: (pick.staleBy || 0) > 0, referenceClass: pick.class,
    statement: merged
      ? `${branch} is contained in ${pick.reference} (${String(pick.sha).slice(0, 12)}) — 0 ahead, ${behind} behind`
      : `${branch} is ${ahead} commit(s) ahead of ${pick.reference} (${String(pick.sha).slice(0, 12)}) and ${behind} behind`,
  };
}

/**
 * RED-maker. A reading is INVALID when it was taken against a ref that is behind the local line.
 * Returns { valid, reason } — a caller that ignores this is choosing to publish a wrong number.
 */
export function validateReading(reading, { root = process.cwd(), local = DEFAULT_LOCAL, remote = DEFAULT_REMOTE } = {}) {
  const usedRef = reading && (reading.reference || reading.ref);
  if (!usedRef) return { valid: false, reason: "the reading does not name the reference it was taken against" };
  const pick = resolveBranchReference({ root, local, remote });
  if (!pick.reference) return { valid: false, reason: pick.statement };
  if (usedRef !== pick.reference && (pick.staleBy || 0) > 0) {
    return { valid: false, reason: `taken against ${usedRef}, which is ${pick.staleBy} commit(s) behind ${pick.reference}` };
  }
  return { valid: true, reason: `taken against ${usedRef}, the reference this checkout resolves to` };
}

export default { resolveBranchReference, branchDistance, validateReading, REFERENCE_CLASSES, BRANCH_REFERENCE_SCHEMA };
