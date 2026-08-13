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
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const OPERATOR_RECORD_ROOT = "senior-director-state";
export const READS_IDENTITY = false;
export const WRITES = false;

export const NOT_TAKEN =
  "reading NOT TAKEN — this assertion reads an operator-internal record under senior-director-state/, " +
  "untracked by design (deploy-safety denylist). Present on the operator machine, absent in a clean " +
  "clone. Not a pass and not a failure.";

const toPath = (p) => (typeof p === "string" ? p : fileURLToPath(p));

/** True when the untracked operator record root is present in this checkout. */
export function operatorRecordsPresent(root) {
  try {
    return fs.statSync(toPath(root)).isDirectory();
  } catch {
    return false;
  }
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
