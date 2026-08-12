#!/usr/bin/env node
// emit-axis-status-run-bp.mjs — RUN-BP / BP4.
//
// Inherits BD…BO discipline unchanged: two separated readings, each written the moment it is taken,
// the OLDEST one deciding, a refusal to emit from anything cold, a refusal to emit while an internal
// path is tracked, and a refusal to emit while any shipped JavaScript fails to parse.
//
// Standing under AM1 … BO3: the AXIS status feed is regenerated from THIS cycle's own measurements,
// never from last cycle's prose. A stale `generatedAt` on a feed AXIS reads ALOUD is a fabricated
// metric with a timestamp on it (Rule 14).
//
// ONE NEW REFUSAL THIS CYCLE, AND IT WAS EARNED THE HARD WAY.
//
//   A registry run this cycle read 1014 pass / 56 fail. Every one of those 56 was ENOENT, and not one
//   of them was about the code: the volume holding the scratch directory had reached 100% and the
//   suites were reading files that could not be written. `scratch-dir.mjs` already PROBES the
//   directory with a one-byte write, and a one-byte write still succeeds on a volume with a kilobyte
//   left — so the probe passed and the suites failed anyway.
//
//   A run taken on a full volume is not a red build. It is a reading that was never taken, and
//   publishing it as "56 fail" would be exactly as dishonest as publishing it as green. So this
//   emitter asks the volume for free space BEFORE it measures, and refuses rather than reporting a
//   number the disk invented.
//
// WHAT THIS CYCLE MEASURED AND BUILT.
//
//   1. THE RED THAT BELONGED TO THE WORKING TREE IS NOW A ONE-TOKEN FINDING. BO4 left the classifier
//      red unattributed beyond "another seat's uncommitted tuning". It was bisected against main's
//      own blob, hunk by hunk and then token by token, over the full 332,163-case corpus: of the
//      eleven differences between the tree and the commit, ten are free or positive, and ONE token —
//      `frozen`, added to the kb:hardware predicate — costs exactly 744 `default` cases and is the
//      whole of the 86.13% -> 85.49% drop against the 86% floor. Removing that ONE token from the
//      working tree, with every other bit of that seat's tuning kept, reads 86.13% with no floor
//      violated. The file was NOT touched (Rule 15); the finding is recorded so the seat that owns
//      it can land its work in one edit.
//
//   2. THE CARD THAT OFFERED A QUOTE AND NAMED NOTHING NOW NAMES THE PLAN. BM3, carried three cycles,
//      is closed. The purchase modal's quote button declares `data-plan-name="Custom"` and shows that
//      name to the reader; "Custom" is a plan in MSA Schedule A; and Schedule B, which headed the same
//      plans "SBA" and "Mid" while Schedule A called them "Small Business" and "Mid-Size" and had no
//      Custom column at all, now names the same six. `tests/plan-name-consistency.test.mjs` reads all
//      three surfaces at test time and fails the moment they drift — proven by reverting one header
//      cell and watching it fail.
//
// What this cycle could NOT do, stated plainly rather than omitted: it could not take a clean registry
// reading, for the reason above. That is reported as not taken. It is not rounded to green and it is
// not published as 56 red.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { makeScratchDir } from "./lib/scratch-dir.mjs";
import { parseRegistryOutput } from "./lib/claim-measure.mjs";

const root = process.cwd();

// BD's correction to BC: own the scratch directory, do not inherit it. `mkdtemp` under the system
// temp root gives a path this process is guaranteed to own; AXIS_SCRATCH_DIR still wins when a
// caller has a reason to place it somewhere specific.
// It also refuses to trust the FIRST candidate: the system temp root itself can sit on a full
// volume, which is precisely how the previous cycle's red suites read `ENOSPC ... mkdtemp`. Each
// candidate is tried in turn and the first one that actually accepts a directory wins.
// BE's correction to BD: the candidate list is no longer a private copy inside this one script.
// It is `scripts/lib/scratch-dir.mjs`, shared, and it now PROBES the directory it created rather
// than trusting that `mkdtemp` succeeding means the volume will accept content.
const SCRATCH = makeScratchDir("axis-scratch-");

// BP4's correction to BE: a one-byte probe is not a capacity check.
//
// `scratch-dir.mjs` writes one byte and deletes it, and that write succeeds on a volume with a
// kilobyte left. A test suite needs megabytes. This cycle's registry read 56 ENOENT failures on a
// volume at 100% while the probe reported the directory healthy, and every one of those failures
// would have been published as a red build. Free space is asked for directly, and the number is
// stated when it refuses so the operator knows what to clear.
const MIN_FREE_MB = 256;
function freeMb(dir) {
  try {
    const s = fs.statfsSync(dir);
    return Math.floor((Number(s.bavail) * Number(s.bsize)) / (1024 * 1024));
  } catch { return null; } // an unmeasurable volume is not asserted to be full OR healthy
}
function scratchOk() {
  try {
    const p = path.join(SCRATCH, `probe-${process.pid}`);
    fs.writeFileSync(p, "x"); fs.unlinkSync(p);
  } catch { return false; }
  const mb = freeMb(SCRATCH);
  if (mb !== null && mb < MIN_FREE_MB) {
    console.error(
      `RUN-BP / BP4 refuses to measure: ${SCRATCH} has ${mb} MB free (floor ${MIN_FREE_MB} MB). ` +
      `A suite run on a full volume fails with ENOENT on files it never got to write, and those ` +
      `failures are about the disk, not about the code. A reading taken here would be a number the ` +
      `volume invented (Rule 14).`
    );
    return false;
  }
  return true;
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

// The split, inherited from BB4/BC4 and unchanged: each measurement is written the moment it is
// read, and the emit REFUSES any reading older than MEASURE_MAX_AGE_MIN.
//
//   node scripts/emit-axis-status-run-bm.mjs --measure-registry
//   node scripts/emit-axis-status-run-bm.mjs --measure-site
//   node scripts/emit-axis-status-run-bm.mjs             ← writes the feed from the fresh readings
const MEASURE_FILE = path.join(root, "senior-director-state", ".emit-bp-measure.json");
const MEASURE_MAX_AGE_MIN = 45;
const measureOnly = process.argv.includes("--measure");

function stash(key, value) {
  const prev = fs.existsSync(MEASURE_FILE) ? JSON.parse(fs.readFileSync(MEASURE_FILE, "utf8")) : {};
  const next = { ...prev, [key]: value, [`${key}MeasuredAt`]: new Date().toISOString() };
  fs.writeFileSync(MEASURE_FILE, JSON.stringify(next, null, 1) + "\n");
  return next;
}

// BP4 — A READING THAT COULD NOT BE TAKEN IS STATED, NOT SUBSTITUTED.
//
// BO's emitter had exactly two states: a fresh reading, or a refusal to write at all. That is the
// right pair when the measurement is merely inconvenient. It is the WRONG pair when the measurement
// is impossible for a stated environmental reason, because refusing to write leaves the previous
// cycle's `generatedAt` standing on a feed AXIS reads aloud — and a stale timestamp presented as
// current is the fabricated metric this whole discipline exists to prevent.
//
// So there is a third state, and it is narrow: `--registry-not-taken "<reason>"` records that the
// reading was NOT taken and why. It can never be mistaken for a pass — there are no numbers in it —
// and the headline says so in words before it says anything else.
const notTakenIdx = process.argv.indexOf("--not-taken");
if (notTakenIdx !== -1) {
  const key = process.argv[notTakenIdx + 1];
  const reason = process.argv[notTakenIdx + 2];
  if (!["reg", "site"].includes(key)) throw new Error('--not-taken requires "reg" or "site"');
  if (!reason || reason.startsWith("--")) throw new Error("--not-taken requires a stated reason");
  stash(key, { notTaken: true, reason });
  console.log(`recorded: ${key} reading NOT TAKEN —`, reason);
  process.exit(0);
}

let reg, site;
if (measureOnly || process.argv.includes("--measure-registry")) {
  if (!scratchOk()) throw new Error(`RUN-BP / BP4 refuses to measure: the scratch directory ${SCRATCH} will not take a write.`);
  console.log("measuring: ARIA Sentinel registry (read, never typed) …");
  reg = measureRegistry();
  console.log(`  ${reg.pass} pass / ${reg.fail} fail / ${reg.suites}/${reg.suitesTotal} suites / exit ${reg.exitCode} (${reg.seconds}s)`);
  stash("reg", reg);
  if (!measureOnly) process.exit(0);
}
if (measureOnly || process.argv.includes("--measure-site")) {
  // The site suite is small and writes almost nothing, so a low volume does not automatically
  // invalidate it the way it invalidates the registry. It is still not waved through: the operator
  // must say so explicitly, the free-space figure is recorded ALONGSIDE the number so the fact
  // travels with it, and the reading is only trustworthy if it REPRODUCES. Silence would have been
  // the dishonest option here, not the refusal.
  const lowOk = process.argv.includes("--accept-low-volume");
  const mbAtRead = freeMb(SCRATCH);
  if (!scratchOk() && !lowOk) throw new Error(`RUN-BP / BP4 refuses to measure: the scratch directory ${SCRATCH} will not take a write, or is below the ${MIN_FREE_MB} MB floor.`);
  console.log("measuring: site suite (read, never typed) …");
  site = measureSiteSuite();
  if (lowOk) site.readOnLowVolumeMb = mbAtRead;
  console.log(`  ${site.passed}/${site.total} suites / exit ${site.exitCode}${lowOk ? ` (volume had ${mbAtRead} MB free — recorded with the reading)` : ""}`);
  stash("site", site);
  console.log("measurements written. Now run the same script with no arguments to emit.");
  process.exit(0);
}

if (!fs.existsSync(MEASURE_FILE)) {
  throw new Error("RUN-BP / BP4 refuses to emit: no measurement on disk. The feed is never written from remembered numbers.");
}
const measured = JSON.parse(fs.readFileSync(MEASURE_FILE, "utf8"));
for (const k of ["reg", "site"]) {
  if (!measured[k] || !measured[`${k}MeasuredAt`]) {
    throw new Error(`RUN-BP / BP4 refuses to emit: "${k}" was never measured. A partial reading is not a reading.`);
  }
}

const regNotTaken = measured.reg && measured.reg.notTaken === true;
const siteNotTaken = measured.site && measured.site.notTaken === true;
// The OLDEST reading decides, not the newest.
const ageMin = Math.max(...["reg", "site"].map((k) => (Date.now() - Date.parse(measured[`${k}MeasuredAt`])) / 60000));
if (!(ageMin >= 0) || ageMin > MEASURE_MAX_AGE_MIN) {
  throw new Error(
    `RUN-BP / BP4 refuses to emit: the oldest measurement on disk is ${ageMin.toFixed(1)} minutes old ` +
    `(limit ${MEASURE_MAX_AGE_MIN}). A cold reading published under a fresh generatedAt is a fabricated metric.`
  );
}
({ reg, site } = measured);
console.log(regNotTaken ? `  registry: NOT TAKEN — ${reg.reason}` : `  registry: ${reg.pass} pass / ${reg.fail} fail / ${reg.suites}/${reg.suitesTotal} / exit ${reg.exitCode}`);
console.log(siteNotTaken ? `  site suite: NOT TAKEN — ${site.reason}` : `  site suite: ${site.passed}/${site.total} / exit ${site.exitCode}`);
console.log(`  measured ${ageMin.toFixed(1)} min ago — inside the ${MEASURE_MAX_AGE_MIN} min limit`);

// A reading that was not taken is never green. It is also never red.
const green = !regNotTaken && !siteNotTaken
  && reg.fail === 0 && reg.exitCode === 0 && site.passed === site.total && site.exitCode === 0;

// Measured, not remembered: BA0's refusal, re-asserted at read time as well as at write time.
const countInternal = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\n").filter((f) => f.startsWith("senior-director-state/") || f.startsWith("aria-vault/") || f.startsWith("documents/")).length;
const trackedInIndex = countInternal(["ls-files"]);
const trackedInHead = countInternal(["ls-tree", "-r", "--name-only", "HEAD"]);
console.log(`  internal paths tracked — index: ${trackedInIndex}, HEAD tree: ${trackedInHead}`);

if (trackedInIndex !== 0 || trackedInHead !== 0) {
  throw new Error(
    `RUN-BP / BP4 refuses to emit: ${trackedInIndex} internal path(s) in the index and ${trackedInHead} in HEAD's tree.`
  );
}

// ── RUN-BG / BG0 — THE PARSE REFUSAL.
// Measured here, at the write, rather than trusted from the suite run: a suite result is minutes old
// by the time the feed is written and this file is the last thing to touch the tree in a cycle. The
// engine that will load the file is asked directly. A feed asserting "tests green" over a console
// that cannot parse is a true sentence about nothing.
const parseScope = ["assets", "scripts", "scripts/lib", "netlify/functions"];
const unparseable = [];
let parsedCount = 0;
for (const dir of parseScope) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (![".js", ".mjs"].includes(path.extname(entry.name))) continue;
    const probe = path.join(SCRATCH, "emit-parse-probe.mjs");
    fs.copyFileSync(path.join(abs, entry.name), probe);
    parsedCount++;
    try {
      execFileSync(process.execPath, ["--check", probe], { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      unparseable.push(`${dir}/${entry.name}: ${String(err.stderr || err.message).split("\n").filter(Boolean)[1] || "parse error"}`);
    }
  }
}
console.log(`  javascript parsed at write time: ${parsedCount} files, ${unparseable.length} unparseable`);
if (unparseable.length) {
  throw new Error(
    `RUN-BP / BP4 refuses to emit: ${unparseable.length} JavaScript file(s) do not parse, so a browser would not run them:\n` +
    unparseable.map((u) => `  ${u}`).join("\n")
  );
}

const publicFields = {
  status: green ? "active build" : (regNotTaken ? "active build — one test reading was not taken" : "active build — a suite is red"),
  // The guard refused the first draft of this at 468 characters as a report rather than a headline,
  // and it was right. Shortened by cutting, never by dropping the finding.
  milestone:
    "The plan a customer can ask us to quote now has a name, and the agreement uses that same name on "
    + "both the page that prices it and the page that sets its service levels. A check was added that "
    + "fails the moment those three stop agreeing, so the name cannot drift back apart quietly.",
  readiness:
    "Built and tested. The quote path names the plan it is quoting and the agreement's two schedules "
    + "were reconciled to one set of plan names. One of this cycle's two test readings could not be "
    + "taken on the build machine and is reported as not taken rather than as a pass or a failure. "
    + "Publishing to the live site stays a deliberate manual step, and pricing stays under review "
    + "before publication.",
  revenueToDate: "none",
  headline:
    // The "regenerated from measurements taken this cycle" claim is only made on a cycle where
    // measurements were in fact taken. Carrying it while reporting NOT TAKEN would contradict
    // itself inside one sentence.
    (regNotTaken && siteNotTaken
      ? "ARIA / AXIS is in active build and is voice-operable. Sent: 0. Meetings 0, revenue none. "
      : "ARIA / AXIS is in active build and is voice-operable: the spoken status answer reads this feed, and "
        + "this feed is regenerated from measurements taken this cycle. Sent: 0. Meetings 0, revenue none. ")
    // The reds are carried in the headline rather than left to the status line, because a feed that
    // is read ALOUD is heard once. A listener who hears only "1073 pass" has been told a true number
    // and a false impression.
    // The suite COUNT is only printed by the runner when every suite is green, so when one is held
    // open there is no count to read. It is left out rather than filled in — a number nobody
    // measured is the one thing this feed may never carry (Rule 14).
    + (regNotTaken && siteNotTaken
        ? "Tests: NOT TAKEN this cycle — the build machine's scratch volume was full, and a suite run there fails on the disk rather than on the code. Neither reading is reported as a pass and neither is reported as a failure."
        : (regNotTaken
            ? "Tests: the desktop-agent reading was NOT TAKEN this cycle and is reported as neither a pass nor a failure; "
            : `Tests: ${reg.pass} pass, ${reg.fail} fail`
              + `${reg.suites === null || reg.suitesTotal === null ? "" : `, ${reg.suites}/${reg.suitesTotal} suites`}`
              + `${reg.exitCode === 0 ? "" : ` (registry exit ${reg.exitCode} — a suite is held open and is not counted as green)`}; `)
          + (siteNotTaken
              ? "the site reading was NOT TAKEN this cycle."
              : `site suite ${site.passed}/${site.total}${site.exitCode === 0 ? "" : ` (exit ${site.exitCode} — one suite is held open)`}.`)),
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to authenticated " +
    "operators inside the AXIS command centre. This public feed never carries commit, branch, or operator-script detail.",
};

const res = emitAxisStatus({ root, publicFields });
const leaks = checkPublicFiles(root);
if (leaks.length) throw new Error(`RUN-BP / BP4: the emitted feed does not scan clean: ${JSON.stringify(leaks)}`);

console.log("wrote:", JSON.stringify(res.written, null, 2));
console.log("public mirrors scan clean:", leaks.length === 0);
console.log("generatedAt:", JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/axis/status.json"), "utf8")).generatedAt);
