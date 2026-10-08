// operator-record.mjs — the honest third state for a reading that CANNOT be taken in this checkout.
//
// RUN-BR. Fifty-one assertions across five suites read a REAL operator record under
// `senior-director-state/`. That directory is deliberately untracked (.gitignore, "Operator-internal
// — never ship"): `publish="."` means a tracked copy would be served to the anonymous web, and the
// records carry the outbound history this company runs on. So the files exist on the operator's
// machine and cannot exist in a clean clone — and every one of those assertions died there with a
// raw ENOENT, counted as a FAILURE.
//
// A failure means the code is wrong. An absent operator record means the reading was not taken.
// Reporting the second as the first is the same dishonesty this harness already refuses elsewhere:
// `staged-action-guard.mjs` calls it UNVERIFIABLE — "neither claimed green nor failed". This module
// gives the test runner the same vocabulary, so a clean clone reports NOT TAKEN, by name, and the
// operator machine still runs every one of those assertions for real.
//
// It never invents a fixture to stand in for a real record. A substitute reading would be worse than
// no reading (Rule 14).
//
// RUN-CU 2026-10-08 — THE DIRECTORY NAME IS NOT THE RECORD.
// The first version asked `statSync(root).isDirectory()`, which reads "is there a folder with that
// name" and was taken to mean "the operator's records are here". Those are different questions, and
// the gap opened the moment a shared file had to live at that path: `AGENT-BOOTSTRAP.md` and
// `FLEET-REFRESH-*.md` are fleet-wide notes, not operator records, and a clone carrying only those
// suddenly claimed it could take readings it has no records for. Two suites that correctly reported
// NOT TAKEN went red — not because anything broke, but because the predicate answered the wrong
// question. So presence now requires an actual WITNESS record. A reading taken against an absent
// record is still NOT TAKEN; the operator machine, which holds every witness, runs every assertion
// exactly as before.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const OPERATOR_RECORD_ROOT = "senior-director-state";
export const READS_IDENTITY = false;
export const WRITES = false;

/**
 * Files that exist on any machine actually running the operator's record keeping, and on no other.
 * Both are append-only ledgers the fleet writes every day, so neither can be present by accident
 * and neither is something a shared bootstrap note would bring with it.
 */
export const OPERATOR_RECORD_WITNESSES = Object.freeze([
  "PROGRESS-LEDGER.md",
  "codex-claude-queue.md",
  "Live-Operations-Log.md",
]);

export const NOT_TAKEN =
  "reading NOT TAKEN — this assertion reads an operator-internal record under senior-director-state/, " +
  "untracked by design (deploy-safety denylist). Present on the operator machine, absent in a clean " +
  "clone. Not a pass and not a failure.";

const toPath = (p) => (typeof p === "string" ? p : fileURLToPath(p));

/**
 * True when this checkout actually holds the operator's records — the root directory exists AND at
 * least one witness ledger is in it. A directory that holds only shared fleet notes is not a record
 * store, and saying otherwise is how an absent reading gets reported as a failure.
 */
export function operatorRecordsPresent(root) {
  let dir;
  try {
    dir = toPath(root);
    if (!fs.statSync(dir).isDirectory()) return false;
  } catch {
    return false;
  }
  return OPERATOR_RECORD_WITNESSES.some((witness) => {
    try {
      return fs.statSync(path.join(dir, witness)).isFile();
    } catch {
      return false;
    }
  });
}

/**
 * Node test-runner options for an assertion that reads a real operator record.
 * Present  -> {} (the assertion runs for real, and a genuine bug still fails it).
 * Absent   -> { skip: NOT_TAKEN } (reported as not taken, never as green, never as red).
 */
export function whenOperatorRecords(root) {
  return operatorRecordsPresent(root) ? {} : { skip: NOT_TAKEN };
}

export default whenOperatorRecords;
