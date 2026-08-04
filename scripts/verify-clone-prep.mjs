// verify-clone-prep.mjs — make the merged-tree verification REPRODUCIBLE.
//
// WHY THIS EXISTS (2026-08-04, flywheel cycle 114)
// Every cycle that verified a branch in a fresh /tmp clone saw the same 53 reds, and every cycle
// re-derived the same explanation from scratch:
//
//   * 51 assertion failures across the U/V/W/X/Y suites — those suites read the REAL outbound
//     records under `senior-director-state/outbound/`, which are deliberately untracked operator
//     data and therefore absent from any clone. A suite that reads real records SHOULD fail loudly
//     when they are missing; that behaviour is correct and is not being changed here.
//   * 2 suites failing to LOAD — `Cannot find package '@netlify/blobs'`. The dependency IS
//     correctly declared in package.json; a fresh clone simply has no node_modules. Not a defect.
//
// Neither is a defect and both are fully clearable — with the prep below the registry runs
// 504/504. Re-deriving that every cycle is waste, and worse, it leaves a 53-red number sitting in
// the record where a reader cannot tell environment from truth. This script performs the two prep
// steps and REPORTS what it did, so a clone can be certified honestly in one command.
//
// It never fabricates a green. If the operator records are not reachable it says so and exits
// non-zero, rather than letting a verification run proceed against a tree it cannot certify.
//
// Run:  node scripts/verify-clone-prep.mjs --source /path/to/operator/checkout
//       node scripts/verify-clone-prep.mjs            (auto-detects an operator checkout)

import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const OUTBOUND_REL = "senior-director-state/outbound";
export const RUNTIME_DEPS = ["@netlify/blobs"];

/** Records that must be present for the U/V/W/X/Y suites to assert against reality. */
export function outboundRecordsPresent(root) {
  const dir = join(root, OUTBOUND_REL);
  if (!existsSync(dir)) return { present: false, count: 0, reason: "directory absent" };
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") || f.endsWith(".md"));
  if (files.length === 0) return { present: false, count: 0, reason: "directory present but empty" };
  return { present: true, count: files.length, reason: null };
}

/** Are the declared runtime deps actually installed in this tree? */
export function runtimeDepsInstalled(root) {
  const missing = RUNTIME_DEPS.filter((d) => !existsSync(join(root, "node_modules", ...d.split("/"))));
  return { installed: missing.length === 0, missing };
}

/**
 * Copy the real operator records into a clone. Never invents a record and never writes an empty
 * placeholder: if the source has nothing, the destination gains nothing and the caller is told.
 */
export function copyOutboundRecords(sourceRoot, destRoot) {
  const src = join(sourceRoot, OUTBOUND_REL);
  if (!existsSync(src)) return { copied: 0, ok: false, reason: `source has no ${OUTBOUND_REL}` };
  const files = readdirSync(src).filter((f) => statSync(join(src, f)).isFile());
  if (files.length === 0) return { copied: 0, ok: false, reason: "source records directory is empty" };
  const dest = join(destRoot, OUTBOUND_REL);
  mkdirSync(dest, { recursive: true });
  for (const f of files) copyFileSync(join(src, f), join(dest, f));
  return { copied: files.length, ok: true, reason: null };
}

/**
 * Classify a raw failure count against the state of the tree. The whole point: an unprepared
 * tree's reds are NEVER reported as product failures, and a prepared tree's reds are NEVER
 * excused as environmental. The distinction is made by the state of the tree, not by the size of
 * the number and not by who is reading it.
 */
export function classifyReds({ prepared, failures }) {
  if (failures === 0) return { verdict: "green", certifiable: true, note: null };
  if (prepared) {
    return {
      verdict: "red",
      certifiable: false,
      note:
        "The tree was prepared (real operator records present, declared deps installed). These " +
        "failures are REAL and must be fixed before merge. They are not environmental.",
    };
  }
  return {
    verdict: "unprepared",
    certifiable: false,
    note:
      "The tree was NOT prepared, so this count mixes environment with truth and certifies nothing " +
      "either way. Run the prep and re-run before drawing any conclusion — in particular, do not " +
      "record this number as a pass rate.",
  };
}

function autoDetectSource(here) {
  const candidates = [process.env.IIS_OPERATOR_CHECKOUT, resolve(here, "..")].filter(Boolean);
  for (const c of candidates) {
    if (c !== here && outboundRecordsPresent(c).present) return c;
  }
  return null;
}

function main() {
  const here = process.cwd();
  const flagIdx = process.argv.indexOf("--source");
  const source = flagIdx > -1 ? process.argv[flagIdx + 1] : autoDetectSource(here);

  const lines = [];
  let ok = true;

  const before = outboundRecordsPresent(here);
  if (before.present) {
    lines.push(`records: already present (${before.count} files) — nothing copied`);
  } else if (!source) {
    lines.push(
      "records: ABSENT (" + before.reason + ") and no operator checkout found. " +
        "Pass --source <path> or set IIS_OPERATOR_CHECKOUT. Without the real records the " +
        "U/V/W/X/Y suites will fail correctly and this tree cannot be certified."
    );
    ok = false;
  } else {
    const res = copyOutboundRecords(source, here);
    if (res.ok) lines.push(`records: copied ${res.copied} real operator records from ${source}`);
    else {
      lines.push(`records: could not copy — ${res.reason}`);
      ok = false;
    }
  }

  const deps = runtimeDepsInstalled(here);
  if (deps.installed) lines.push(`deps: ${RUNTIME_DEPS.join(", ")} installed`);
  else {
    lines.push(
      `deps: MISSING ${deps.missing.join(", ")} — declared in package.json but not installed here. ` +
        `Run: npm install --no-save ${deps.missing.join(" ")}`
    );
    ok = false;
  }

  console.log(lines.map((l) => "  " + l).join("\n"));
  console.log(
    ok
      ? "\nverify-clone-prep: READY — a red from here is a real red."
      : "\nverify-clone-prep: NOT READY — do not record a pass rate from this tree."
  );
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
