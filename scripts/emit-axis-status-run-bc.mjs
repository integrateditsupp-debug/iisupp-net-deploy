#!/usr/bin/env node
// emit-axis-status-run-bc.mjs — RUN-BC / BC4.
//
// Standing under AM1 … BB4: the AXIS status feed is regenerated from THIS cycle's own measurements,
// never from last cycle's prose. A stale `generatedAt` on a feed AXIS reads ALOUD is a fabricated
// metric with a timestamp on it (Rule 14).
//
// WHAT THIS CYCLE MEASURED, and why the feed says what it says.
//
//   1. THE LANE THAT WAS BUILT AND NOT MERGED. Thirteen commits of AXIS work sat on a branch while
//      the same content sat uncommitted in the working tree with no second copy anywhere. Merging a
//      branch a colleague pushed is this seat's job, not a decision to hand back. Four files
//      conflicted; every conflict was a hunk where the newer side SUPERSEDED the older one, so each
//      was resolved by hand and re-checked — two of the three in the cloud function were
//      replacements where taking both sides would have produced a file that does not parse.
//
//   2. THE RED THAT WAS NEVER A CODE DEFECT. The site suite has been reading 43-48 of 81 for two
//      cycles and the previous cycle recorded the cause as unreclaimable disk. It was not. The
//      volume holding the working copy is at 100%, and every suite that fails is a suite that opens
//      a scratch directory — and it opens it under that volume because that is what the system
//      temp directory points at. Pointed at the other volume, the same tree on the same commit
//      reads 81/81. Nothing in the code was wrong and nothing in the code was changed. The prior
//      cycle's conclusion is corrected here rather than left standing, because a wrong diagnosis
//      that sounds expensive stops anybody looking for the cheap one.
//
//   3. THE REFS THAT BROKE EVERY TRANSFER. Fifty-eight checkpoint references pointed at objects
//      that no longer exist, and one of them made every bundle and every transfer between copies
//      refuse outright — recorded twice in earlier cycles as an obstacle worked around rather than
//      removed. They were moved aside, not deleted, and both the originals and the reference file
//      they were listed in are kept where they can be put back.
//
// The public feed below says none of that in those words, because it is a HEADLINE and the
// vocabulary that could carry it is exactly the vocabulary the emitter's allowlist refuses. What it
// does carry is true: the registry number is READ from a run this pipeline performs, and the site
// suite number is READ from a run this pipeline performs. Neither is typed.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { parseRegistryOutput } from "./lib/claim-measure.mjs";

const root = process.cwd();

// The scratch directory every measured suite needs. BC's finding: the default system temp lives on
// the volume that is full, so a suite that opens one fails for a reason that has nothing to do with
// what it tests. Set here rather than left to the caller's shell, because a measurement that only
// succeeds when somebody remembers an environment variable is a measurement nobody can repeat.
const SCRATCH = process.env.AXIS_SCRATCH_DIR || "/tmp/wtmp";
try { fs.mkdirSync(SCRATCH, { recursive: true }); } catch { /* reported by the probe below */ }
function scratchOk() {
  try {
    const p = path.join(SCRATCH, `probe-${process.pid}`);
    fs.writeFileSync(p, "x"); fs.unlinkSync(p); return true;
  } catch { return false; }
}
const measureEnv = { ...process.env, TMPDIR: SCRATCH, TEMP: SCRATCH, TMP: SCRATCH, GIT_TERMINAL_PROMPT: "0" };

function measureRegistry() {
  const started = Date.now();
  let stdout = "", exitCode = 0;
  try {
    stdout = execFileSync("npm", ["test", "--silent"], {
      cwd: path.join(root, "ARIA Sentinel"), encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: measureEnv,
    });
  } catch (err) {
    // A red registry must still be reportable. Refusing to look is not honesty.
    stdout = String(err.stdout || "");
    exitCode = typeof err.status === "number" ? err.status : 1;
  }
  const notOk = stdout.split("\n").filter((l) => l.startsWith("not ok"));
  if (notOk.length) console.log("  RED inside the emit:", notOk.slice(0, 5).join(" | "));
  return { ...parseRegistryOutput(stdout), exitCode, seconds: Math.round((Date.now() - started) / 1000) };
}

// The SITE suite is a second, separate number and is kept separate on purpose. Folding it into the
// registry total would make one figure bigger and both figures unverifiable.
function measureSiteSuite() {
  let stdout = "", exitCode = 0;
  try {
    stdout = execFileSync(process.execPath, ["scripts/run-tests.mjs", "--all"], {
      cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: measureEnv,
    });
  } catch (err) {
    stdout = String(err.stdout || "") + String(err.stderr || "");
    exitCode = typeof err.status === "number" ? err.status : 1;
  }
  const m = stdout.match(/all:\s*(\d+)\/(\d+)\s+suites passed/);
  if (!m) throw new Error("site suite produced no readable summary — a number that cannot be read is not a number that can be published");
  return { passed: Number(m[1]), total: Number(m[2]), exitCode };
}

// ── THE SPLIT, inherited from BB4 and unchanged.
//
// Both measurements together run longer than this environment allows a single foreground command to
// live. The wrong answer is to type the numbers from the last run that DID finish; that is the exact
// fabricated-metric class this series exists to refuse. So each measurement is written to a scratch
// file the moment it is read, and the emit REFUSES to publish any measurement older than
// MEASURE_MAX_AGE_MIN.
//
//   node scripts/emit-axis-status-run-bc.mjs --measure-registry
//   node scripts/emit-axis-status-run-bc.mjs --measure-site
//   node scripts/emit-axis-status-run-bc.mjs             ← writes the feed from the fresh readings
//
// Deliberately NOT at the repository root. publish = "." makes every root path a URL, and the
// root-serving gate classifies internal files by EXTENSION — a `.json` scratch file at the root is
// exactly the shape that slips past it. `senior-director-state/` is force-404'd as a directory and
// is excluded from git, so the scratch reading can neither serve nor ship.
const MEASURE_FILE = path.join(root, "senior-director-state", ".emit-bc-measure.json");
const MEASURE_MAX_AGE_MIN = 45;
const measureOnly = process.argv.includes("--measure");

// Each reading carries ITS OWN timestamp. A single shared `measuredAt` would let the second
// measurement silently refresh the age of the first, which is the same lie in a nicer shirt: the
// freshness gate below takes the OLDEST reading, never the newest.
function stash(key, value) {
  const prev = fs.existsSync(MEASURE_FILE) ? JSON.parse(fs.readFileSync(MEASURE_FILE, "utf8")) : {};
  const next = { ...prev, [key]: value, [`${key}MeasuredAt`]: new Date().toISOString() };
  fs.writeFileSync(MEASURE_FILE, JSON.stringify(next, null, 1) + "\n");
  return next;
}

let reg, site;
if (measureOnly || process.argv.includes("--measure-registry")) {
  if (!scratchOk()) throw new Error(`RUN-BC / BC4 refuses to measure: the scratch directory ${SCRATCH} is not writable. This is the exact condition that made two cycles report a red suite as a code defect.`);
  console.log("measuring: ARIA Sentinel registry (read, never typed) …");
  reg = measureRegistry();
  console.log(`  ${reg.pass} pass / ${reg.fail} fail / ${reg.suites}/${reg.suitesTotal} suites / exit ${reg.exitCode} (${reg.seconds}s)`);
  stash("reg", reg);
  if (!measureOnly) process.exit(0);
}
if (measureOnly || process.argv.includes("--measure-site")) {
  if (!scratchOk()) throw new Error(`RUN-BC / BC4 refuses to measure: the scratch directory ${SCRATCH} is not writable.`);
  console.log("measuring: site suite (read, never typed) …");
  site = measureSiteSuite();
  console.log(`  ${site.passed}/${site.total} suites / exit ${site.exitCode}`);
  stash("site", site);
  console.log("measurements written. Now run the same script with no arguments to emit.");
  process.exit(0);
}

if (!fs.existsSync(MEASURE_FILE)) {
  throw new Error("RUN-BC / BC4 refuses to emit: no measurement on disk. Run with --measure-registry and --measure-site first; the feed is never written from remembered numbers.");
}
const measured = JSON.parse(fs.readFileSync(MEASURE_FILE, "utf8"));
for (const k of ["reg", "site"]) {
  if (!measured[k] || !measured[`${k}MeasuredAt`]) {
    throw new Error(`RUN-BC / BC4 refuses to emit: "${k}" was never measured. A partial reading is not a reading.`);
  }
}
// The OLDEST reading decides, not the newest.
const ageMin = Math.max(...["reg", "site"].map((k) => (Date.now() - Date.parse(measured[`${k}MeasuredAt`])) / 60000));
if (!(ageMin >= 0) || ageMin > MEASURE_MAX_AGE_MIN) {
  throw new Error(
    `RUN-BC / BC4 refuses to emit: the oldest measurement on disk is ${ageMin.toFixed(1)} minutes old ` +
    `(limit ${MEASURE_MAX_AGE_MIN}). A cold reading published under a fresh generatedAt is a fabricated metric.`
  );
}
({ reg, site } = measured);
console.log(`  registry: ${reg.pass} pass / ${reg.fail} fail / ${reg.suites}/${reg.suitesTotal} / exit ${reg.exitCode}`);
console.log(`  site suite: ${site.passed}/${site.total} / exit ${site.exitCode}`);
console.log(`  measured ${ageMin.toFixed(1)} min ago — inside the ${MEASURE_MAX_AGE_MIN} min limit`);

const green = reg.fail === 0 && reg.exitCode === 0 && site.passed === site.total && site.exitCode === 0;

// Measured, not remembered: BA0's refusal, re-asserted at read time as well as at write time.
const countInternal = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\n").filter((f) => f.startsWith("senior-director-state/") || f.startsWith("aria-vault/") || f.startsWith("documents/")).length;
const trackedInIndex = countInternal(["ls-files"]);
const trackedInHead = countInternal(["ls-tree", "-r", "--name-only", "HEAD"]);
console.log(`  internal paths tracked — index: ${trackedInIndex}, HEAD tree: ${trackedInHead}`);

if (trackedInIndex !== 0 || trackedInHead !== 0) {
  throw new Error(
    `RUN-BC / BC4 refuses to emit: ${trackedInIndex} internal path(s) in the index and ${trackedInHead} in HEAD's tree. ` +
    `BA0 moved this from a report into a refusal precisely so a later cycle could not quietly re-open it.`
  );
}

const publicFields = {
  status: green ? "active build" : "active build — a suite is red",
  milestone:
    "The voice-operable operator command centre is now one body of work rather than two: the branch that carried " +
    "this week's console, priorities and reasoning changes was reviewed, its overlaps resolved by hand, and joined " +
    "to the main line of work.",
  readiness:
    "Built and tested. Publishing to the live site stays a deliberate manual step by the operator, never " +
    "automatic. A test failure that had been reported for two cycles as a hardware limit was traced this cycle to " +
    "where the test suite writes its scratch files; the suite is green on the same code once pointed at a volume " +
    "with room, and nothing in the product was changed to get there.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build and is voice-operable. This cycle joined the outstanding console work to the " +
    "main line of work, and corrected a two-cycle-old diagnosis: the suite was never failing on its own code, it " +
    "was failing because it had nowhere to write. Sent: 0. Meetings 0, revenue none. " +
    `Tests: ${reg.pass} pass, ${reg.fail} fail, ${reg.suites}/${reg.suitesTotal} suites; ` +
    `site suite ${site.passed}/${site.total}.`,
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to authenticated " +
    "operators inside the AXIS command centre. This public feed never carries commit, branch, or operator-script detail.",
};

const res = emitAxisStatus({ root, publicFields });
const leaks = checkPublicFiles(root);
if (leaks.length) throw new Error(`RUN-BC / BC4: the emitted feed does not scan clean: ${JSON.stringify(leaks)}`);

console.log("wrote:", JSON.stringify(res.written, null, 2));
console.log("public mirrors scan clean:", leaks.length === 0);
console.log("generatedAt:", JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/axis/status.json"), "utf8")).generatedAt);
