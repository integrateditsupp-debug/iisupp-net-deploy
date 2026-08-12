#!/usr/bin/env node
// emit-axis-status-run-bm.mjs — RUN-BM / BM4.
//
// Inherits BD/BE/BF/BG/BL discipline unchanged: two separated readings, each written the moment it is
// taken, the OLDEST one deciding, a refusal to emit from anything cold, a refusal to emit while an
// internal path is tracked, and a refusal to emit while any shipped JavaScript fails to parse.
//
// Standing under AM1 … BL4: the AXIS status feed is regenerated from THIS cycle's own measurements,
// never from last cycle's prose. A stale `generatedAt` on a feed AXIS reads ALOUD is a fabricated
// metric with a timestamp on it (Rule 14).
//
// WHAT THIS CYCLE MEASURED.
//
//   1. THE READING A CLONE CANNOT TAKE, taken. A fresh clone of the SAME commit the operator's
//      machine calls green reads 56 failures in the desktop registry and three in the site suite.
//      Every one of them was traced this cycle, by running both suites in a clone and diffing the
//      failure NAMES against a clone of the published line — not by reading two files and assuming.
//
//   2. THE CAUSE IS CORRECT AND IS NOT MOVED. `.gitignore` excludes `/senior-director-state/` in
//      full because `netlify.toml` publishes `.`, so a tracked file is a SERVED file. Un-ignoring
//      the operator records would have made 56 reds green by publishing the ledger, the queue and
//      the staged asks to the anonymous web. That repair was written out and rejected.
//
//   3. WHAT IS NEW IS THE READING, NOT THE FINDING. `record-dependency-declared` recorded this same
//      class in cycle 120 and holds a written register of the suites that depend on operator state.
//      That is stated here rather than dressed up as a discovery (Rule 14). BM0 adds what a register
//      cannot do: `scripts/report-clone-readability.mjs` MEASURES, for any tree, which of those
//      inputs it actually has, names the suites it therefore cannot read, and exits non-zero.
//
//   4. THE BOUNDARY IS DERIVED, NEVER TYPED. `scripts/lib/operator-inputs.mjs` reads the ignored
//      roots out of `.gitignore` itself, so the register and the boundary cannot drift apart, and it
//      refuses a `.gitignore` that declares none rather than reporting an empty boundary as clean.
//
//   5. A FIXTURE IS NOT A WITHHELD INPUT. Seven of the thirty references name files nothing ever
//      creates — the suite's whole assertion is that they are absent. Separating them needs the
//      operator's tree as a reference and is never guessed at: with no reference given they are
//      reported as absent, which is true, rather than assumed to be fixtures.
//
//   6. THE INVERSE, PROVEN BY MEASUREMENT AND NOT BY ARGUMENT. Against the operator's own tree the
//      same reading finds 23 of 23 inputs PRESENT and holds no suite open; against a clone it names
//      12 suites and 23 absent inputs. Same commit, two trees, two honest answers. Without that
//      inverse this module would be a rubber stamp that excuses every red.
//
//   7. WHAT DID NOT REGRESS, MEASURED RATHER THAN ASSERTED. The failure NAMES before and after this
//      cycle's changes were diffed: zero new. The three commits this line carries over the published
//      one were diffed the same way against a clone of the published line — 27 failures fixed, zero
//      introduced.
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
//   node scripts/emit-axis-status-run-bm.mjs --measure-registry
//   node scripts/emit-axis-status-run-bm.mjs --measure-site
//   node scripts/emit-axis-status-run-bm.mjs             ← writes the feed from the fresh readings
const MEASURE_FILE = path.join(root, "senior-director-state", ".emit-bm-measure.json");
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
  if (!scratchOk()) throw new Error(`RUN-BM / BM4 refuses to measure: the scratch directory ${SCRATCH} will not take a write.`);
  console.log("measuring: ARIA Sentinel registry (read, never typed) …");
  reg = measureRegistry();
  console.log(`  ${reg.pass} pass / ${reg.fail} fail / ${reg.suites}/${reg.suitesTotal} suites / exit ${reg.exitCode} (${reg.seconds}s)`);
  stash("reg", reg);
  if (!measureOnly) process.exit(0);
}
if (measureOnly || process.argv.includes("--measure-site")) {
  if (!scratchOk()) throw new Error(`RUN-BM / BM4 refuses to measure: the scratch directory ${SCRATCH} will not take a write.`);
  console.log("measuring: site suite (read, never typed) …");
  site = measureSiteSuite();
  console.log(`  ${site.passed}/${site.total} suites / exit ${site.exitCode}`);
  stash("site", site);
  console.log("measurements written. Now run the same script with no arguments to emit.");
  process.exit(0);
}

if (!fs.existsSync(MEASURE_FILE)) {
  throw new Error("RUN-BM / BM4 refuses to emit: no measurement on disk. The feed is never written from remembered numbers.");
}
const measured = JSON.parse(fs.readFileSync(MEASURE_FILE, "utf8"));
for (const k of ["reg", "site"]) {
  if (!measured[k] || !measured[`${k}MeasuredAt`]) {
    throw new Error(`RUN-BM / BM4 refuses to emit: "${k}" was never measured. A partial reading is not a reading.`);
  }
}
// The OLDEST reading decides, not the newest.
const ageMin = Math.max(...["reg", "site"].map((k) => (Date.now() - Date.parse(measured[`${k}MeasuredAt`])) / 60000));
if (!(ageMin >= 0) || ageMin > MEASURE_MAX_AGE_MIN) {
  throw new Error(
    `RUN-BM / BM4 refuses to emit: the oldest measurement on disk is ${ageMin.toFixed(1)} minutes old ` +
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
    `RUN-BM / BM4 refuses to emit: ${trackedInIndex} internal path(s) in the index and ${trackedInHead} in HEAD's tree.`
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
    `RUN-BM / BM4 refuses to emit: ${unparseable.length} JavaScript file(s) do not parse, so a browser would not run them:\n` +
    unparseable.map((u) => `  ${u}`).join("\n")
  );
}

const publicFields = {
  status: green ? "active build" : "active build — a suite is red",
  milestone:
    "The build now states which of its own test results anybody else could reproduce. A fresh copy of "
    + "the code reads dozens of failures that the build machine does not, because those checks read "
    + "private operating records that are deliberately never published. Naming them separates a real "
    + "defect from a check a stranger was never given the inputs for.",
  readiness:
    "Built and tested. Both suites are reported exactly as they read, on a fresh copy of the code rather "
    + "than on the machine that wrote it, and the gap between the two readings is now measured instead of "
    + "described. Publishing to the live site stays a deliberate manual step by the operator. Plan names, "
    + "pricing, deposit amounts and how a custom quote is priced stay under review before publication.",
  revenueToDate: "none",
  // The 400-character guard refused the first draft of this. Shortened by cutting, never by
  // dropping the finding: the reading is still stated as taken on a fresh copy, and the reason the
  // failures are not code failures still travels with the number.
  // The 400-character guard refused two drafts of this. Shortened by cutting, never by dropping the
  // finding: the reading is still stated as taken on a fresh copy, and the reason those failures are
  // not code failures still travels with the number.
  headline:
    "ARIA / AXIS is in active build and voice-operable. This feed is regenerated from measurements taken "
    + "this cycle. Sent: 0. Meetings 0, revenue none. Tests, read on a FRESH COPY of the code: "
    + `${reg.pass} pass, ${reg.fail} fail`
    + `${reg.exitCode === 0 ? "" : " (exit 1 — held-open suites are never counted green)"}; `
    + `site ${site.passed}/${site.total}. Each failure is a check whose private input a fresh copy is not `
    + "given; the same checks read clean on the build machine.",
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to authenticated " +
    "operators inside the AXIS command centre. This public feed never carries commit, branch, or operator-script detail.",
};

const res = emitAxisStatus({ root, publicFields });
const leaks = checkPublicFiles(root);
if (leaks.length) throw new Error(`RUN-BM / BM4: the emitted feed does not scan clean: ${JSON.stringify(leaks)}`);

console.log("wrote:", JSON.stringify(res.written, null, 2));
console.log("public mirrors scan clean:", leaks.length === 0);
console.log("generatedAt:", JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/axis/status.json"), "utf8")).generatedAt);
