#!/usr/bin/env node
// suite-census.mjs — RUN-BW. The I/O half: glob the disk, parse TESTS, load the ledger, decide.
//
// Pairs with `scripts/lib/suite-registry.mjs`, which holds the decision and touches nothing. This
// file is the only part that reads a filesystem, so the decision can be tested exhaustively without
// one, and so that importing the decider can never run a census (RUN-BV's lesson: importing the
// emit script to test a predicate RAN a cycle and emitted a feed).
//
// Usage:
//   node scripts/suite-census.mjs            # print the census, exit 1 if red
//   node scripts/suite-census.mjs --json     # machine-readable
//   node scripts/suite-census.mjs --write    # also write senior-director-state/suite-census.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { censusSuites, normaliseSpec, DEFAULT_MAX_PENDING_DAYS } from "./lib/suite-registry.mjs";

export const SENDS = false;

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");

export const RUNNER = "ARIA Sentinel/tests/run-all.mjs";
export const LEDGER = "tests/suite-census-ledger.json";
// Written only when asked for. Not under senior-director-state/: that prefix is denied by
// scripts/lib/deploy-denylist.mjs, so a file the gate must READ cannot live there — found by running
// the denylist against this cycle's own tree before delivering it.
export const CENSUS_OUT = "tests/suite-census.json";

/** Where suite files may live. Anything matching SUITE_FILE under these roots is in the universe. */
export const SEARCH_ROOTS = ["tests", "ARIA Sentinel/tests", "ARIA Sentinel/axis"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", "fixtures-out"]);
const SUITE_FILE = /\.test\.mjs$/;

/** Recursive listing, POSIX paths relative to the repo root. Never follows into SKIP_DIRS. */
export function listSuiteFiles(root = REPO_ROOT, searchRoots = SEARCH_ROOTS) {
  const found = [];
  const walk = (abs, rel) => {
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(abs, e.name), childRel);
      } else if (e.isFile() && SUITE_FILE.test(e.name)) {
        found.push(childRel);
      }
    }
  };
  for (const sr of searchRoots) {
    const abs = path.join(root, sr);
    if (fs.existsSync(abs)) walk(abs, sr);
  }
  return [...new Set(found)].sort();
}

/**
 * Read the `TESTS` array out of the runner as TEXT.
 *
 * Deliberately NOT by importing it: importing `run-all.mjs` RUNS every suite. The array is a flat
 * list of string literals between `const TESTS = [` and its closing `];`, so a text read is exact
 * and cheap. If the runner is ever restructured so this parse stops matching, that is a hard error
 * here rather than a silently smaller denominator — the exact failure this cycle exists to kill.
 */
export function parseRegisteredSpecs(runnerSource) {
  const m = runnerSource.match(/const TESTS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) {
    throw new Error("suite-census: could not find the TESTS array in the runner. Refusing to report a denominator it did not read.");
  }
  const body = m[1];
  // Strip comments first: a path mentioned in prose is not a registration.
  const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
  return [...code.matchAll(/["'`]([^"'`]+\.mjs)["'`]/g)].map((x) => x[1]);
}

/** Ledger of recorded verdicts. A missing ledger is an empty one — it never excuses anything. */
export function loadLedger(root = REPO_ROOT) {
  const p = path.join(root, LEDGER);
  if (!fs.existsSync(p)) return { entries: [], maxPendingDays: DEFAULT_MAX_PENDING_DAYS, present: false };
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const maxPendingDays = Number.isFinite(raw.maxPendingDays) ? raw.maxPendingDays : DEFAULT_MAX_PENDING_DAYS;
  return { entries, maxPendingDays, present: true, raw };
}

/** The whole census, from disk. Returns the decider's verdict plus where each reading came from. */
export function runCensus({ root = REPO_ROOT, now = new Date() } = {}) {
  const runnerPath = path.join(root, RUNNER);
  if (!fs.existsSync(runnerPath)) throw new Error(`suite-census: runner not found at ${RUNNER}`);
  const registered = parseRegisteredSpecs(fs.readFileSync(runnerPath, "utf8"));
  // The universe of suite files is: everything matching *.test.mjs, PLUS anything already
  // registered that exists on disk under another name. Two suites are registered as
  // `scenario-suite.mjs` and `privacy-audit.mjs` — real, present, and not matching the pattern.
  // Without this they read as "registered but missing", which is a true-shaped false finding: it
  // accuses the list of pointing at nothing when the file is right there.
  const globbed = listSuiteFiles(root);
  const registeredPresent = [...new Set(registered.map((s) => normaliseSpec(s)).filter(Boolean))]
    .filter((p) => fs.existsSync(path.join(root, p)));
  const onDisk = [...new Set([...globbed, ...registeredPresent])].sort();
  const ledger = loadLedger(root);
  const verdict = censusSuites({
    onDisk, registered, verdicts: ledger.entries, now, maxPendingDays: ledger.maxPendingDays,
  });
  return {
    ...verdict,
    generatedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    sources: {
      registered: { from: RUNNER, how: "text parse of the TESTS array; the runner is never imported" },
      onDisk: { from: SEARCH_ROOTS.join(", "), how: "recursive listing of *.test.mjs, node_modules excluded, plus any registered spec that exists under another name", globbed: globbed.length, registeredPresentNotGlobbed: registeredPresent.filter((p) => !globbed.includes(p)).length },
      verdicts: { from: LEDGER, present: ledger.present, count: ledger.entries.length },
    },
  };
}

function main(argv) {
  const json = argv.includes("--json");
  const write = argv.includes("--write");
  let result;
  try { result = runCensus(); } catch (err) {
    console.error(`SUITE CENSUS REFUSED: ${err.message}`);
    return 2;
  }
  if (write) {
    fs.writeFileSync(path.join(REPO_ROOT, CENSUS_OUT), JSON.stringify(result, null, 1) + "\n");
  }
  if (json) {
    console.log(JSON.stringify(result, null, 1));
  } else {
    console.log(`suite files on disk     ${result.suitesOnDisk}`);
    console.log(`registered in TESTS     ${result.suitesRegistered}`);
    console.log(`registered + on disk    ${result.registeredOnDisk}`);
    console.log(`registered, MISSING     ${result.registeredMissing.length}`);
    console.log(`on disk, UNREGISTERED   ${result.unregisteredCount}`);
    console.log(`  exempt (with reason)  ${result.accounted.exempt.length}`);
    console.log(`  deferred (on a clock) ${result.accounted.registerPending.length}`);
    console.log(`  dead (with reason)    ${result.accounted.dead.length}`);
    console.log(`  UNEXPLAINED           ${result.unexplained.length}`);
    console.log("");
    console.log(result.statement);
    for (const f of result.findings.slice(0, 40)) console.log(`  - ${f.kind}: ${f.file ?? f.spec ?? ""} ${f.why ?? ""}`.trimEnd());
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
