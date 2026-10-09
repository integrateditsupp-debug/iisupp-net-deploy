// host-reading.mjs — RUN-BS. The second half of the third state.
//
// RUN-BR gave the runner a word for a reading it cannot take: an assertion that reads a REAL
// operator record under `senior-director-state/`, untracked by design, is reported NOT TAKEN rather
// than counted as a failure. That fixed 53 assertions. It did not fix the other shape of the same
// problem, and this cycle five suites died of it on a clean copy of the shared line:
//
//   axis-worker-offline    reads scripts/run-axis-brain-worker.ps1  — `.gitignore:80  *.ps1`
//   axis-windows-traps     globs scripts/**/*.ps1                   — same line, so it finds none
//   axis-assistant-behaviors reads ~/Documents/AXIS-Brain/…         — the operator's vault, not the repo
//   axis-app-detect §8     counts ≥20 probe log lines               — only 20 probes exist on win32
//   axis-job-watchdog      imports scripts/lib/job-registry.mjs     — a REAL defect; that file was
//                                                                     never banked, and is, this cycle.
//
// Four of those five are the same honest fact wearing four costumes: the artefact is a Windows
// launcher or an operator-machine file that is deliberately absent from every checkout. A raw
// ENOENT reported those as CODE FAILURES. They are not. They are readings this host cannot take.
//
// The rule this module exists to keep (Rule 14): a reading that was not taken is never reported as a
// pass, never reported as a failure, and NEVER substituted with a fixture. A stand-in reading is
// worse than no reading, because it manufactures the feeling of coverage — the same bug
// job-registry.mjs was written to prevent ("a log nobody reads is worse than no log").
//
// On the operator machine every one of these assertions runs for real and a genuine bug still fails
// it. That is the whole point: this module changes what an ABSENT artefact means, never what a
// PRESENT one proves.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const READS_IDENTITY = false;
export const WRITES = false;

const toPath = (p) => (typeof p === "string" ? p : fileURLToPath(p));

/** Reasons an artefact is legitimately absent here. Each is a fact about the checkout, not a bug. */
export const REASONS = {
  gitignored: "the artefact is git-ignored by design and exists only on the operator machine",
  operatorVault: "the artefact lives in the operator's Obsidian vault, outside this repository",
  platform: "the reading requires a Windows host and this is not one",
  operatorRecord: "the artefact is an operator-internal record under senior-director-state/, untracked by design",
};

/** Present on disk? Directories count. */
export function artefactPresent(p) {
  try { fs.statSync(toPath(p)); return true; } catch { return false; }
}

/** True when this host is Windows. */
export const onWindows = () => process.platform === "win32";

/**
 * Report a reading that could not be taken here, by name, and say why.
 * Prints one line the runner and a human read the same way, and returns false so a caller can
 * write `if (!notTaken(...)) { …assert… }` and keep the assertions exactly as they were.
 */
export function notTaken(what, reason, detail = "") {
  const why = REASONS[reason] || reason;
  console.log(`  NOT TAKEN — ${what}: ${why}${detail ? ` (${detail})` : ""}`);
  return true;
}

/**
 * The guard the four suites use. Returns true when the reading CAN be taken (artefact present, or
 * platform matches) and false — having printed the NOT TAKEN line — when it cannot.
 *
 *   if (canRead(ps1, 'the launcher hardening checks', 'gitignored')) { …assertions… }
 */
export function canRead(artefact, what, reason) {
  if (artefactPresent(artefact)) return true;
  notTaken(what, reason, path.basename(toPath(artefact)));
  return false;
}

/** Same contract, for a reading gated on the host OS rather than on a file. */
export function canReadOnWindows(what) {
  if (onWindows()) return true;
  notTaken(what, "platform", `platform=${process.platform}`);
  return false;
}

/**
 * A summary line every patched suite ends on, so "green" and "green with readings skipped" can
 * never be mistaken for each other in the runner's output.
 */
export function readingSummary(name, taken, skipped) {
  return skipped
    ? `${name}: ${taken} reading(s) taken, ${skipped} NOT TAKEN on this host — green on what could be read`
    : `${name}: ${taken} reading(s) taken, all green`;
}

export default canRead;
