// ledger-head-on-disk.test.mjs — RUN-AP / AP4. THE INVARIANT THAT STOPPED AT THE FILESYSTEM BOUNDARY.
//
// WHAT WENT WRONG, IN ONE PARAGRAPH. `ledger-head.mjs` promises "ONE TRUTH, THREE SURFACES … a
// drift is a TEST FAILURE", and `o3-ledger-head.test.mjs` proves exactly that — for three
// computations held in memory off one truth object, which cannot drift because they are one object.
// The block a human opens in `senior-director-state/PROGRESS-LEDGER.md` was never read by any test.
// On 2026-08-05 it said RUN-Z 0/3, 321/323, 41 unpublished while the served feed said RUN-AO 3/3,
// 646/646 · 340/340, 48 unpublished, and the suite was green through all of it.
//
// The proof this suite is required to show, and shows below with both halves:
//   RED   — the exact stale block quoted above, compared against a live truth, reported as DRIFT;
//           a truth artefact that disagrees with the served feed, so a stale truth cannot quietly
//           agree with a stale head; and a missing truth artefact, which reports stale rather than
//           inventing a head.
//   GREEN — the real `PROGRESS-LEDGER.md` on disk, matching the head generated from the real truth
//           artefact this cycle emitted, with the history below `LEDGER-HEAD:END` byte-identical.
//
// Rule 15: the record below the marker is never rewritten, and that is asserted here rather than
// promised in a comment.
//
// Run: node tests/ledger-head-on-disk.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const M = await import(new URL("../scripts/lib/ledger-head-fs.mjs", import.meta.url).href);
const {
  checkLedgerHeadOnDisk, regenerateLedgerHeadOnDisk, truthAgreesWithFeed, readProgramTruth,
  splitHeadRegion, loadLedgerHeadModule, CLASSES, LEDGER_FILE, TRUTH_FILE, SENDS,
} = M;

const { buildLedgerHead, BEGIN_MARKER, END_MARKER } = await loadLedgerHeadModule();

// The truth as it actually stood on the morning AP4 was written — used to generate the head the
// stale block is compared against.
const LIVE_TRUTH_RAW = {
  program: { series: "flywheel", sequence: "RUN-AP — the six screens that say nothing", tasksMerged: 3, tasksTotal: 4 },
  tests: { green: 646, total: 646, effectiveGreen: 340, effectiveTotal: 340 },
  unpushed: { commits: 48 },
  revenue: { receivedCad: 0, asksSent: 0, asksStaged: 4, candidates: 0, conversationsHeld: 0, hoursSpent: 0 },
};

// The block that was actually on disk, verbatim in its load-bearing figures.
const STALE_BLOCK = [
  BEGIN_MARKER,
  "",
  "## Where this stands, in 11 lines",
  "",
  "- **Sequence:** RUN-Z — the second hour — 0/3 tasks merged",
  "- **Published line:** The published line is a last-known local reference, not a live read.",
  "- **Verified but unpublished:** 41 verified commit(s) are built and tested but not published.",
  "- **Tests:** Suite 321/323 green.",
  "",
  END_MARKER,
].join("\n");

const HISTORY = [
  "",
  "",
  "## The record below is never rewritten",
  "",
  "| 1 | 2026-06-28 | RUN-A | first entry |",
  "| 2 | 2026-06-29 | RUN-B | second entry |",
  "",
].join("\n");

function tmpRepo({ block = STALE_BLOCK, truth = null, feed = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ap4-"));
  fs.mkdirSync(path.join(dir, "senior-director-state"), { recursive: true });
  fs.mkdirSync(path.join(dir, "netlify/functions"), { recursive: true });
  fs.writeFileSync(path.join(dir, LEDGER_FILE), block + HISTORY);
  if (truth) fs.writeFileSync(path.join(dir, TRUTH_FILE), JSON.stringify(truth, null, 2));
  if (feed) fs.writeFileSync(path.join(dir, "netlify/functions/_axis-status-full.json"), JSON.stringify(feed, null, 2));
  return dir;
}

// ── inert ─────────────────────────────────────────────────────────────────────────────────────
test("AP4 — the checker sends nothing and never writes unless asked", () => {
  assert.equal(SENDS, false);
  const src = fs.readFileSync(path.join(ROOT, "scripts/lib/ledger-head-fs.mjs"), "utf8");
  assert.ok(!/fetch\(|child_process|execSync/.test(src), "AP4 must not spawn or reach the network");
  assert.equal((src.match(/writeFileSync/g) || []).length, 1,
    "exactly one write path, and it is behind an explicit write:true");
});

// ── RED #1: the exact stale block ─────────────────────────────────────────────────────────────
test("AP4 RED — the stale block that was on disk is reported as DRIFT", async () => {
  const truth = buildLedgerHead(LIVE_TRUTH_RAW).truth;
  const dir = tmpRepo({ block: STALE_BLOCK, truth });
  const r = await checkLedgerHeadOnDisk({ root: dir });

  assert.equal(r.ok, false,
    "the block on disk said RUN-Z 0/3, 321/323, 41 unpublished while the truth said otherwise — " +
    "an invariant proven only in memory is not an invariant");
  assert.equal(r.class, CLASSES.DRIFT);
  assert.match(r.actual, /RUN-Z/);
  assert.ok(!/RUN-Z/.test(r.expected), "the regenerated head must not carry the stale sequence");
  assert.match(r.expected, /RUN-AP/);
});

// ── RED #2: a truth artefact that disagrees with the served feed ──────────────────────────────
test("AP4 RED — a stale truth cannot quietly agree with a stale head", () => {
  const truth = buildLedgerHead(LIVE_TRUTH_RAW).truth;
  const feed = {
    tests: { afterEveryWrite: { pass: 700, fail: 0 } },
    program: { sequence: "RUN-AP — the six screens that say nothing" },
    claims: { commitsAheadOfSharedLine: { value: 48 } },
  };
  const dir = tmpRepo({ truth, feed });
  const r = truthAgreesWithFeed(dir);
  assert.equal(r.ok, false, "the truth artefact and the served feed disagreed and it must be red");
  assert.equal(r.class, CLASSES.TRUTH_FEED_DISAGREE);
  assert.match(r.detail, /tests/);
});

test("AP4 GREEN — truth and feed carrying the same figures agree", () => {
  const truth = buildLedgerHead(LIVE_TRUTH_RAW).truth;
  const feed = {
    tests: { afterEveryWrite: { pass: 340, fail: 0 } },
    program: { sequence: "RUN-AP — the six screens that say nothing" },
    claims: { commitsAheadOfSharedLine: { value: 48 } },
  };
  const r = truthAgreesWithFeed(tmpRepo({ truth, feed }));
  assert.equal(r.ok, true, r.detail);
});

// ── RED #3: no truth at all — reported stale, never invented ──────────────────────────────────
test("AP4 RED — with no truth artefact the head is reported stale, not hand-stamped", async () => {
  const dir = tmpRepo({ truth: null });
  const r = await checkLedgerHeadOnDisk({ root: dir });
  assert.equal(r.ok, false);
  assert.equal(r.class, CLASSES.NO_TRUTH);
  const w = await regenerateLedgerHeadOnDisk({ root: dir, write: true });
  assert.equal(w.ok, false);
  assert.equal(w.written, false);
  assert.match(fs.readFileSync(path.join(dir, LEDGER_FILE), "utf8"), /RUN-Z/,
    "with nothing to regenerate from, the file is left exactly as it was");
});

// ── GREEN: regeneration fixes the drift and leaves the history byte-identical ──────────────────
test("AP4 GREEN — regeneration clears the drift and the history below END is byte-identical", async () => {
  const truth = buildLedgerHead(LIVE_TRUTH_RAW).truth;
  const dir = tmpRepo({ block: STALE_BLOCK, truth });
  const before = fs.readFileSync(path.join(dir, LEDGER_FILE), "utf8");

  const w = await regenerateLedgerHeadOnDisk({ root: dir, write: true });
  assert.equal(w.ok, true, w.detail);
  assert.equal(w.written, true);
  assert.equal(w.historyUnchanged, true);

  const after = fs.readFileSync(path.join(dir, LEDGER_FILE), "utf8");
  const tail = (s) => s.slice(s.indexOf(END_MARKER) + END_MARKER.length);
  assert.equal(tail(after), tail(before), "Rule 15 — the record below the END marker is never rewritten");
  assert.equal(tail(after), HISTORY);

  const r = await checkLedgerHeadOnDisk({ root: dir });
  assert.equal(r.ok, true, r.detail);
  assert.match(splitHeadRegion(after, BEGIN_MARKER, END_MARKER).region, /RUN-AP/);
});

// ── THE ONE THAT MATTERS: the real file, on the real repository ───────────────────────────────
test("AP4 — the REAL ledger head on disk matches the truth this cycle emitted", async () => {
  const truth = readProgramTruth(ROOT);
  assert.ok(truth, `${TRUTH_FILE} is missing — the emit must record the truth it published from`);

  const agree = truthAgreesWithFeed(ROOT);
  assert.equal(agree.ok, true, `truth artefact disagrees with the served feed: ${agree.detail}`);

  const r = await checkLedgerHeadOnDisk({ root: ROOT });
  assert.equal(r.ok, true,
    `the generated block in ${LEDGER_FILE} has drifted from the truth.\n` +
    `--- on disk ---\n${(r.actual || "").slice(0, 900)}\n--- regenerated ---\n${(r.expected || "").slice(0, 900)}`);
});

test("AP4 — regenerating the real ledger is a no-op, which is the point", async () => {
  const w = await regenerateLedgerHeadOnDisk({ root: ROOT, write: false });
  assert.equal(w.ok, true, w.detail);
  assert.equal(w.changed, false,
    "the head on disk already equals its regeneration — if this is ever true-and-changed, the cycle wrote a feed without regenerating the head");
  assert.equal(w.historyUnchanged, true);
});
