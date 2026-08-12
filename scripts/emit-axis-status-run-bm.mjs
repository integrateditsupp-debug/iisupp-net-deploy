#!/usr/bin/env node
// emit-axis-status-run-bm.mjs — RUN-BM / BM4.
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
//   1. THE INTAKE NOBODY KEEPS — built. BL traced four facts a buyer is ASKED for by the quote
//      button's mailto (users/devices, locations, current stack, timeline) and reported all four
//      ASKED_NOT_CAPTURED: the tree asks the question and owns no shape for the answer, so the
//      second person to touch a deal starts from prose in a mail client. `quote-intake.mjs` is
//      that shape. It takes a reply as text and returns, per field, either the buyer's answer with
//      the line it came from or the fact that they gave none.
//
//   2. THE FIELDS ARE DISCOVERED, NOT TYPED, AND A SUITE PROVES IT BY READING THE SOURCE. The
//      schema comes through `readQuoteAsk()` — the reader `quote-inputs` already owns, never a
//      second copy of its regexes. A test asserts that not one of the four labels appears in
//      `quote-intake.mjs` at all, so a page that asks a fifth question produces a fifth field with
//      no edit, and a reply written before that question existed reports it ABSENT rather than
//      answered. Proven red-first against exactly that fixture.
//
//   3. AN ABSENT ANSWER STAYS ABSENT. No default, no zero, no "unknown" — a value the buyer did
//      not give would travel silently into a quote, which is the fabrication Rule 14 refuses. Two
//      kinds of absence are kept apart because they are different facts about a conversation: a
//      field the reply never mentions, and a field the buyer read and left blank. 11/11 green,
//      every class red-first, and a case proves the module sends nothing, holds no address and
//      opens no socket.
//
//   4. A ONE-CLICK SCRIPT WAS SITTING IN SERVED URL SPACE, AND THE GATE CAUGHT IT. `publish = "."`
//      makes the repository root the web root. Last cycle's own push script,
//      `AHMAD-PUSH-RUN126-RUN-BM.cmd`, had no force-404 rule — a real leak, found by running the
//      root-serving gate rather than by reading it. Regenerated: 143 file rules, and the diff is
//      that one stanza. This is the class RUN-BM0 was about, arriving from the opposite direction.
//
//   5. THE TWO REGISTRY REDS ARE OTHER SEATS' UNCOMMITTED WORK, AND ARE STATED RATHER THAN ROUNDED.
//      `classifier-accuracy` fails to LOAD on `default` = 85.5% < 86%, reading
//      `tests/aria-classifier-mirror.js` from the WORKING TREE where another writer's tuning is
//      uncommitted — BL's finding, re-measured here and not re-quoted from memory.
//      `record-dependency-declared` names `tests/axis-queue-steward.test.mjs`, which git does not
//      know at all: an untracked suite reading untracked operator records. Declaring an untracked
//      suite in the manifest would record a dependency no clone can have, so it is named instead.
//      Neither file was touched (Rule 15) and neither red is rounded to green (Rule 14).
//
//   6. THE SCRATCH GATE HAS ONE OFFENDER LEFT AND IT IS ALSO UNTRACKED.
//      `tests/axis-vault-brain.test.mjs` is not known to git and does not exist on main. The site
//      suite reads 104/105 in this working tree, the one red being that file — a suite another
//      seat is actively writing. Stated, not edited (R16).
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
  // The guard refused the first draft of this at 468 characters as a report rather than a headline,
  // and it was right. Shortened by cutting, never by dropping the finding.
  milestone:
    "The four facts a visitor is asked for when they request a custom quote now land in a defined "
    + "record instead of loose prose in an inbox, and the questions in that record are read from the "
    + "page itself so the two can never drift. An answer a visitor did not give is recorded as not "
    + "given — never filled in with a default.",
  readiness:
    "Built and tested. Both suites are reported as they read rather than rounded up: the checks held "
    + "open are work in progress on the build machine, not on the published line. Publishing to the "
    + "live site stays a deliberate manual step. Plan names, pricing, deposit amounts and how a custom "
    + "quote is priced stay under review before publication, not after.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build and is voice-operable: the spoken status answer reads this feed, and "
    + "this feed is regenerated from measurements taken this cycle. Sent: 0. Meetings 0, revenue none. "
    // The reds are carried in the headline rather than left to the status line, because a feed that
    // is read ALOUD is heard once. A listener who hears only "1073 pass" has been told a true number
    // and a false impression.
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
if (leaks.length) throw new Error(`RUN-BM / BM4: the emitted feed does not scan clean: ${JSON.stringify(leaks)}`);

console.log("wrote:", JSON.stringify(res.written, null, 2));
console.log("public mirrors scan clean:", leaks.length === 0);
console.log("generatedAt:", JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/axis/status.json"), "utf8")).generatedAt);
