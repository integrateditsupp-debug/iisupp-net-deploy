#!/usr/bin/env node
// emit-axis-status-run-bb.mjs — RUN-BB / BB4.
//
// Standing under AM1 … BA4: the AXIS status feed is regenerated from THIS cycle's own measurements,
// never from last cycle's prose. A stale `generatedAt` on a feed AXIS reads ALOUD is a fabricated
// metric with a timestamp on it (Rule 14) — and this is the cycle that made AXIS speak, so the
// feed is now something a person HEARS rather than something a person could choose not to open.
//
// WHAT THIS CYCLE MEASURED, and why the feed says what it says.
//
// Three defects, every one of them found by Ahmad USING the product rather than by anybody reading
// it, which is the only reason they were findable at all:
//
//   1. AXIS could not hear him. Browser speech-to-text does not return the literal string "axis" —
//      Chrome and Edge transcribe the wake word as "access", "axes", "acts", "exes". The matcher
//      was /axis/. Every sentence spoken at it was heard and silently discarded, which from the
//      outside is indistinguishable from a broken microphone.
//   2. AXIS said "Brain busy. Try again in a sec." for a day. The real condition was HTTP 400,
//      credit balance too low — permanent, and retrying can never fix it. One generic message for
//      every failure mode hid it completely.
//   3. The priorities panel had no dates. The failure mode a priorities screen INVITES is
//      fabrication: approvals and inbox messages have no deadline field, and a plausible-looking
//      date is worse than a blank one.
//
// The public feed below says none of that in those words, because it is a HEADLINE and the
// vocabulary that could carry it is exactly the vocabulary the emitter's allowlist refuses. What it
// does carry is true: the registry number is READ from a run this script performs, and the site
// suite number is READ from a run this script performs. Neither is typed.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { parseRegistryOutput } from "./lib/claim-measure.mjs";

const root = process.cwd();

function measureRegistry() {
  const started = Date.now();
  let stdout = "", exitCode = 0;
  try {
    stdout = execFileSync("npm", ["test", "--silent"], {
      cwd: path.join(root, "ARIA Sentinel"), encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
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
      cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (err) {
    stdout = String(err.stdout || "") + String(err.stderr || "");
    exitCode = typeof err.status === "number" ? err.status : 1;
  }
  const m = stdout.match(/all:\s*(\d+)\/(\d+)\s+suites passed/);
  if (!m) throw new Error("site suite produced no readable summary — a number that cannot be read is not a number that can be published");
  return { passed: Number(m[1]), total: Number(m[2]), exitCode };
}

// ── THE SPLIT, and why it is not a shortcut.
//
// Both measurements together run longer than this environment allows a single foreground command to
// live, and a background process here does not survive the call that started it. The wrong answer is
// to type the numbers from the last run that DID finish; that is the exact fabricated-metric class
// this whole series exists to refuse.
//
// So the measurements are written to a scratch file the moment they are read, and the emit REFUSES
// to publish any measurement older than MEASURE_MAX_AGE_MIN. The numbers still come only from a run
// this pipeline performed — they are just allowed to have been performed a few minutes ago, and the
// feed cannot be written at all from a measurement that has gone cold.
//
//   node scripts/emit-axis-status-run-bb.mjs --measure   ← run first; reads both suites
//   node scripts/emit-axis-status-run-bb.mjs             ← writes the feed from the fresh reading
// Deliberately NOT at the repository root. publish = "." makes every root path a URL, and the
// root-serving gate classifies internal files by EXTENSION — a `.json` scratch file at the root is
// exactly the shape that slips past it. `senior-director-state/` is force-404'd as a directory and
// is excluded from git, so the scratch reading can neither serve nor ship.
const MEASURE_FILE = path.join(root, "senior-director-state", ".emit-bb-measure.json");
const MEASURE_MAX_AGE_MIN = 30;
const measureOnly = process.argv.includes("--measure");

// Each measurement lands the moment it is read, so a call that dies mid-way loses only its own
// reading and never leaves a half-written record that looks whole.
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
  console.log("measuring: ARIA Sentinel registry (read, never typed) …");
  reg = measureRegistry();
  console.log(`  ${reg.pass} pass / ${reg.fail} fail / ${reg.suites}/${reg.suitesTotal} suites / exit ${reg.exitCode} (${reg.seconds}s)`);
  stash("reg", reg);
  if (!measureOnly) process.exit(0);
}
if (measureOnly || process.argv.includes("--measure-site")) {
  console.log("measuring: site suite (read, never typed) …");
  site = measureSiteSuite();
  console.log(`  ${site.passed}/${site.total} suites / exit ${site.exitCode}`);
  stash("site", site);
  console.log("measurements written. Now run the same script with no arguments to emit.");
  process.exit(0);
}

if (!fs.existsSync(MEASURE_FILE)) {
  throw new Error("RUN-BB / BB4 refuses to emit: no measurement on disk. Run with --measure first; the feed is never written from remembered numbers.");
}
const measured = JSON.parse(fs.readFileSync(MEASURE_FILE, "utf8"));
for (const k of ["reg", "site"]) {
  if (!measured[k] || !measured[`${k}MeasuredAt`]) {
    throw new Error(`RUN-BB / BB4 refuses to emit: "${k}" was never measured. A partial reading is not a reading.`);
  }
}
// The OLDEST reading decides, not the newest.
const ageMin = Math.max(...["reg", "site"].map((k) => (Date.now() - Date.parse(measured[`${k}MeasuredAt`])) / 60000));
if (!(ageMin >= 0) || ageMin > MEASURE_MAX_AGE_MIN) {
  throw new Error(
    `RUN-BB / BB4 refuses to emit: the oldest measurement on disk is ${ageMin.toFixed(1)} minutes old ` +
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
    `RUN-BB / BB4 refuses to emit: ${trackedInIndex} internal path(s) in the index and ${trackedInHead} in HEAD's tree. ` +
    `BA0 moved this from a report into a refusal precisely so a later cycle could not quietly re-open it.`
  );
}

const publicFields = {
  status: green ? "active build" : "active build — a suite is red",
  milestone:
    "The operator command centre can now be spoken to and answers out loud. This cycle fixed three faults found " +
    "by using it rather than by reading it: it did not recognise the spoken name, it gave one vague message for " +
    "every kind of failure, and its priorities view had no dates on it.",
  readiness:
    "Built and tested. Publishing to the live site stays a deliberate manual step by the operator, never " +
    "automatic. Where the assistant cannot reach its reasoning service it now says which condition it hit and " +
    "keeps answering from the last saved snapshot instead of going silent.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build and is now voice-operable. Three faults fixed this cycle: the spoken name was " +
    "not recognised by real browsers, every failure reported the same vague message, and the priorities view " +
    "carried no dates — dates are shown only where a real one exists, never invented. Sent: 0. Meetings 0, " +
    `revenue none. Tests: ${reg.pass} pass, ${reg.fail} fail, ${reg.suites}/${reg.suitesTotal} suites; ` +
    `site suite ${site.passed}/${site.total}.`,
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to authenticated " +
    "operators inside the AXIS command centre. This public feed never carries commit, branch, or operator-script detail.",
};

const res = emitAxisStatus({ root, publicFields });
const leaks = checkPublicFiles(root);
if (leaks.length) throw new Error(`RUN-BB / BB4: the emitted feed does not scan clean: ${JSON.stringify(leaks)}`);

console.log("wrote:", JSON.stringify(res.written, null, 2));
console.log("public mirrors scan clean:", leaks.length === 0);
console.log("generatedAt:", JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/axis/status.json"), "utf8")).generatedAt);
