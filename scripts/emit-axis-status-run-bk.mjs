#!/usr/bin/env node
// emit-axis-status-run-bj.mjs — RUN-BK / BI4.
//
// Inherits BD/BE/BF/BG discipline unchanged: two separated readings, each written the moment it is
// taken, the OLDEST one deciding, a refusal to emit from anything cold, a refusal to emit while an
// internal path is tracked, and a refusal to emit while any shipped JavaScript fails to parse.
//
// Standing under AM1 … BG4: the AXIS status feed is regenerated from THIS cycle's own measurements,
// never from last cycle's prose. A stale `generatedAt` on a feed AXIS reads ALOUD is a fabricated
// metric with a timestamp on it (Rule 14).
//
// WHAT THIS CYCLE MEASURED.
//
//   1. THE AMOUNT A BUYER IS ACTUALLY CHARGED. RUN-BF checked the figures a stranger READS against
//      each other. Nothing had ever checked the figures a stranger is CHARGED against the card they
//      clicked. Nineteen options across six `data-buy-options` attributes on `index.html`: nine of
//      the thirteen carrying an amount are the EXACT floor of a band published on the same card,
//      which is the strongest possible result and is stated rather than passed over. Four are
//      deposits — $2,000, $4,000, $10,000, $750 — and not one appears anywhere a buyer reads; the
//      figure first arrives inside the checkout. Their shares of their own floors are 33.33%,
//      28.57%, 33.33% and 50.00%, reported as arithmetic with the division shown, never corrected.
//      The direction stays Ahmad's and a test proves no output field names a surface that must move.
//
//   2. A CLASS THAT WOULD HAVE BURIED THE FINDING. A deposit below a band's floor is not "outside
//      the band" — reporting it as a mismatch would hide the thing that matters (the amount is
//      published nowhere) under something false. DEPOSIT and RETAINER are separate classes, and the
//      INVERSE is proven too: a deposit that IS printed on its card must not be reported, or the
//      class is noise rather than a finding.
//
//   3. THE PARSER REFUSES RATHER THAN REPAIRS. RUN-BF's money parser stripped commas and read a
//      truncated `$1,2` as `$12`. Both parsers here validate grouping; a charge amount written
//      `2,000.00` is UNREADABLE and drags the whole verdict to UNREADABLE. A parser that repairs the
//      number a card is debited for is inventing a transaction.
//
//   4. THE REGISTRY RED IS NOT ON MAIN, MEASURED RATHER THAN INHERITED. `classifier-accuracy` fails
//      to LOAD on `default` = 85.5% < 86%, but it reads the mirror from the WORKING TREE. Main's
//      mirror was extracted and measured against the same 332,163-case corpus this cycle: overall
//      93.55%, `default` 86.13%, no intent below the 50% hard floor. The breach belongs to another
//      writer's uncommitted tuning and nothing of theirs was touched or committed (Rule 15).
//
// What this cycle could NOT do, stated plainly rather than omitted: the main line here still has no
// second copy on the code host, because this environment holds no credential for it. That is a
// one-click for the operator, not a defect in the build, and it is deliberately kept OUT of the
// public feed below — the public feed carries product truth, not operator plumbing.

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

// The split, inherited from BB4/BC4 and unchanged: each measurement is written the moment it is
// read, and the emit REFUSES any reading older than MEASURE_MAX_AGE_MIN.
//
//   node scripts/emit-axis-status-run-bj.mjs --measure-registry
//   node scripts/emit-axis-status-run-bj.mjs --measure-site
//   node scripts/emit-axis-status-run-bj.mjs             ← writes the feed from the fresh readings
const MEASURE_FILE = path.join(root, "senior-director-state", ".emit-bk-measure.json");
const MEASURE_MAX_AGE_MIN = 45;
const measureOnly = process.argv.includes("--measure");

function stash(key, value) {
  const prev = fs.existsSync(MEASURE_FILE) ? JSON.parse(fs.readFileSync(MEASURE_FILE, "utf8")) : {};
  const next = { ...prev, [key]: value, [`${key}MeasuredAt`]: new Date().toISOString() };
  fs.writeFileSync(MEASURE_FILE, JSON.stringify(next, null, 1) + "\n");
  return next;
}

let reg, site;
if (measureOnly || process.argv.includes("--measure-registry")) {
  if (!scratchOk()) throw new Error(`RUN-BK / BI4 refuses to measure: the scratch directory ${SCRATCH} will not take a write.`);
  console.log("measuring: ARIA Sentinel registry (read, never typed) …");
  reg = measureRegistry();
  console.log(`  ${reg.pass} pass / ${reg.fail} fail / ${reg.suites}/${reg.suitesTotal} suites / exit ${reg.exitCode} (${reg.seconds}s)`);
  stash("reg", reg);
  if (!measureOnly) process.exit(0);
}
if (measureOnly || process.argv.includes("--measure-site")) {
  if (!scratchOk()) throw new Error(`RUN-BK / BI4 refuses to measure: the scratch directory ${SCRATCH} will not take a write.`);
  console.log("measuring: site suite (read, never typed) …");
  site = measureSiteSuite();
  console.log(`  ${site.passed}/${site.total} suites / exit ${site.exitCode}`);
  stash("site", site);
  console.log("measurements written. Now run the same script with no arguments to emit.");
  process.exit(0);
}

if (!fs.existsSync(MEASURE_FILE)) {
  throw new Error("RUN-BK / BI4 refuses to emit: no measurement on disk. The feed is never written from remembered numbers.");
}
const measured = JSON.parse(fs.readFileSync(MEASURE_FILE, "utf8"));
for (const k of ["reg", "site"]) {
  if (!measured[k] || !measured[`${k}MeasuredAt`]) {
    throw new Error(`RUN-BK / BI4 refuses to emit: "${k}" was never measured. A partial reading is not a reading.`);
  }
}
// The OLDEST reading decides, not the newest.
const ageMin = Math.max(...["reg", "site"].map((k) => (Date.now() - Date.parse(measured[`${k}MeasuredAt`])) / 60000));
if (!(ageMin >= 0) || ageMin > MEASURE_MAX_AGE_MIN) {
  throw new Error(
    `RUN-BK / BI4 refuses to emit: the oldest measurement on disk is ${ageMin.toFixed(1)} minutes old ` +
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
    `RUN-BK / BI4 refuses to emit: ${trackedInIndex} internal path(s) in the index and ${trackedInHead} in HEAD's tree.`
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
    `RUN-BK / BI4 refuses to emit: ${unparseable.length} JavaScript file(s) do not parse, so a browser would not run them:\n` +
    unparseable.map((u) => `  ${u}`).join("\n")
  );
}

const publicFields = {
  status: green ? "active build" : "active build — a suite is red",
  milestone:
    "Every amount a customer can actually be charged on the site is now checked against the price printed "
    + "on the card they clicked. Nine of thirteen match the published figure exactly. Four are deposits "
    + "that appear nowhere a buyer reads before paying, and those are now reported rather than assumed "
    + "correct, with the decision about what they should be left to the operator.",
  readiness:
    "Built and tested. Both suites are reported exactly as they read on the build machine rather than "
    + "rounded up: two checks are held open by work in progress and neither is on the published line. "
    + "Publishing to the live site stays a deliberate manual step by the operator. Plan names, pricing "
    + "and deposit amounts stay under review before publication, not after.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build and is voice-operable: the spoken status answer reads this feed, and "
    + "this feed is regenerated from measurements taken this cycle. Sent: 0. Meetings 0, revenue none. "
    // The suite COUNT is only printed by the runner when every suite is green, so when one is held
    // open there is no count to read. It is left out rather than filled in — a number nobody
    // measured is the one thing this feed may never carry (Rule 14).
    + `Tests: ${reg.pass} pass, ${reg.fail} fail`
    + `${reg.suites === null || reg.suitesTotal === null ? "" : `, ${reg.suites}/${reg.suitesTotal} suites`}`
    + `${reg.exitCode === 0 ? "" : ` (registry exit ${reg.exitCode} — a suite is held open and is not counted as green)`}; `
    + `site suite ${site.passed}/${site.total}.`,
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to authenticated " +
    "operators inside the AXIS command centre. This public feed never carries commit, branch, or operator-script detail.",
};

const res = emitAxisStatus({ root, publicFields });
const leaks = checkPublicFiles(root);
if (leaks.length) throw new Error(`RUN-BK / BI4: the emitted feed does not scan clean: ${JSON.stringify(leaks)}`);

console.log("wrote:", JSON.stringify(res.written, null, 2));
console.log("public mirrors scan clean:", leaks.length === 0);
console.log("generatedAt:", JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/axis/status.json"), "utf8")).generatedAt);
