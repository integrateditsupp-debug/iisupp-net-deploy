// ledger-head-fs.mjs — RUN-AP / AP4. THE INVARIANT THAT STOPS AT THE FILESYSTEM BOUNDARY.
//
// WHY THIS EXISTS (2026-08-05).
// `ledger-head.mjs` promises "ONE TRUTH, THREE SURFACES … a drift is a TEST FAILURE", and the
// generated block inside `senior-director-state/PROGRESS-LEDGER.md` repeats that promise to every
// human who opens it. On the morning this module was written, the block on disk said:
//
//     Sequence: RUN-Z — the second hour — 0/3 tasks merged
//     Verified but unpublished: 41 verified commit(s)
//     Tests: Suite 321/323 green.
//
// …while the served feed and that day's log said RUN-AO 3/3, 646/646 · 340/340, 48 unpublished.
// The suite was green through all of it. `o3-ledger-head.test.mjs` compares three IN-MEMORY
// computations off one truth object — which cannot drift, because it is one object — and the only
// `readFileSync` in it static-scans the module's own source for purity. **The artefact a person
// opens was never read.** The head had not been regenerated since RUN 151; the feed had been
// regenerated about eight times since.
//
// That is the whole class of bug: an invariant that is proven inside the process and abandoned at
// the filesystem boundary. This module carries it across.
//
// WHAT IT ASSERTS.
//   1. The block between the two markers in the REAL file equals `buildLedgerHead()` over the
//      truth this cycle emitted. A drift is red, and the failure prints both texts.
//   2. That truth is not free to drift either: the figures in it are compared against the served
//      AXIS feed, so a stale truth artefact cannot quietly agree with a stale head.
//   3. Regeneration replaces ONLY the marked region. The history below `LEDGER-HEAD:END` is
//      asserted byte-identical (Rule 15 — the record is never rewritten).
//
// WHAT IT REFUSES TO DO. If the regeneration cannot run, the head is left stale and REPORTED stale.
// Every figure in the block is measurable, so hand-stamping one is refused by class under AM1 — a
// hand-typed head is exactly the failure this module exists to catch.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

export const LEDGER_HEAD_FS_SCHEMA = "ledger-head-fs.v1";
export const SENDS = false;

export const LEDGER_FILE = "senior-director-state/PROGRESS-LEDGER.md";
export const TRUTH_FILE = "senior-director-state/program-truth.json";
export const FEED_FILE = "netlify/functions/_axis-status-full.json";

export const CLASSES = Object.freeze({
  OK: "head-on-disk-matches-the-truth-this-cycle-emitted",
  DRIFT: "head-on-disk-does-not-match-the-regenerated-head",
  NO_MARKERS: "ledger-file-carries-no-generated-head-region",
  NO_LEDGER: "ledger-file-is-not-on-disk",
  NO_TRUTH: "no-program-truth-artefact-was-emitted-this-cycle",
  TRUTH_FEED_DISAGREE: "the-truth-artefact-and-the-served-feed-disagree",
  HISTORY_ALTERED: "regeneration-altered-the-history-below-the-end-marker",
});

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** The head builder lives in the Sentinel tree; the directory name contains a space, so URL it. */
export async function loadLedgerHeadModule(root = REPO_ROOT) {
  const abs = path.join(root, "ARIA Sentinel/src/shared/ledger-head.mjs");
  return import(pathToFileURL(abs).href);
}

const readJson = (abs) => {
  try { return JSON.parse(fs.readFileSync(abs, "utf8")); } catch { return null; }
};

/** Split a ledger document into { before, region, after } around the generated markers. */
export function splitHeadRegion(text, BEGIN, END) {
  const doc = String(text || "");
  const b = doc.indexOf(BEGIN);
  const e = doc.indexOf(END);
  if (b === -1 || e === -1 || e < b) return null;
  return {
    before: doc.slice(0, b),
    region: doc.slice(b, e + END.length),
    after: doc.slice(e + END.length),
  };
}

/** The truth this cycle emitted, as written to disk beside the feed. */
export function readProgramTruth(root = REPO_ROOT) {
  return readJson(path.join(root, TRUTH_FILE));
}

/**
 * A stale truth artefact must not be able to agree with a stale head. The figures that both the
 * head and the feed carry are compared here; a disagreement is its own red.
 */
export function truthAgreesWithFeed(root = REPO_ROOT) {
  const truth = readProgramTruth(root);
  const feed = readJson(path.join(root, FEED_FILE));
  if (!truth) return { ok: false, class: CLASSES.NO_TRUTH, detail: `${TRUTH_FILE} is not on disk — the cycle emitted a feed without recording the truth it emitted it from` };
  if (!feed) return { ok: false, class: CLASSES.TRUTH_FEED_DISAGREE, detail: `${FEED_FILE} is not on disk` };

  const mismatches = [];
  const fTests = feed.tests && feed.tests.afterEveryWrite;
  if (fTests) {
    const green = truth.tests && (truth.tests.effectiveGreen ?? truth.tests.green);
    const total = truth.tests && (truth.tests.effectiveTotal ?? truth.tests.total);
    if (green !== fTests.pass) mismatches.push(`tests green: truth ${green} vs feed ${fTests.pass}`);
    if (total !== fTests.pass + fTests.fail) mismatches.push(`tests total: truth ${total} vs feed ${fTests.pass + fTests.fail}`);
  }
  if (feed.program && truth.program && feed.program.sequence && truth.program.sequence !== feed.program.sequence) {
    mismatches.push(`sequence: truth "${truth.program.sequence}" vs feed "${feed.program.sequence}"`);
  }
  const feedAhead = feed.claims && feed.claims.commitsAheadOfSharedLine && feed.claims.commitsAheadOfSharedLine.value;
  if (Number.isInteger(feedAhead) && truth.unpushed && truth.unpushed.commits !== feedAhead) {
    mismatches.push(`unpublished commits: truth ${truth.unpushed.commits} vs feed ${feedAhead}`);
  }

  return mismatches.length
    ? { ok: false, class: CLASSES.TRUTH_FEED_DISAGREE, detail: mismatches.join(" · "), mismatches }
    : { ok: true, class: CLASSES.OK, detail: "the truth artefact and the served feed carry the same figures" };
}

/**
 * THE ASSERTION. Reads the real ledger file and the real truth artefact and compares the block a
 * person opens against the block the truth would generate right now.
 */
export async function checkLedgerHeadOnDisk({ root = REPO_ROOT, truth = null } = {}) {
  const { buildLedgerHead, BEGIN_MARKER, END_MARKER } = await loadLedgerHeadModule();
  const ledgerAbs = path.join(root, LEDGER_FILE);
  if (!fs.existsSync(ledgerAbs)) {
    return { ok: false, class: CLASSES.NO_LEDGER, detail: `${LEDGER_FILE} is not on disk in this checkout` };
  }
  const doc = fs.readFileSync(ledgerAbs, "utf8");
  const split = splitHeadRegion(doc, BEGIN_MARKER, END_MARKER);
  if (!split) {
    return { ok: false, class: CLASSES.NO_MARKERS, detail: `${LEDGER_FILE} carries no generated head region` };
  }

  const t = truth || readProgramTruth(root);
  if (!t) {
    return {
      ok: false, class: CLASSES.NO_TRUTH,
      detail: `${TRUTH_FILE} is not on disk, so the head on disk cannot be checked against anything — reported stale rather than edited`,
      actual: split.region,
    };
  }

  const expected = buildLedgerHead(t).text;
  if (expected.trim() !== split.region.trim()) {
    return {
      ok: false, class: CLASSES.DRIFT,
      detail: "the generated block in the ledger does not match the head this cycle's truth generates",
      expected, actual: split.region,
    };
  }
  return { ok: true, class: CLASSES.OK, detail: "the block a person opens equals the block the truth generates", expected };
}

/**
 * Regenerate the block in place. Returns the new document text and proves the history survived.
 * Writing is opt-in: pass `write: true`. Rule 15 — everything below END_MARKER is byte-identical.
 */
export async function regenerateLedgerHeadOnDisk({ root = REPO_ROOT, truth = null, write = false, now = Date.now() } = {}) {
  const { buildLedgerHead, applyLedgerHead, END_MARKER } = await loadLedgerHeadModule();
  const ledgerAbs = path.join(root, LEDGER_FILE);
  const before = fs.readFileSync(ledgerAbs, "utf8");
  const t = truth || readProgramTruth(root);
  if (!t) {
    return { ok: false, class: CLASSES.NO_TRUTH, written: false,
      detail: "no truth artefact — the head is left stale and reported stale rather than hand-edited" };
  }

  const head = buildLedgerHead(t, { now });
  const applied = applyLedgerHead(before, head);

  const tailOf = (s) => { const i = s.indexOf(END_MARKER); return i === -1 ? null : s.slice(i + END_MARKER.length); };
  const historyUnchanged = tailOf(before) !== null ? tailOf(before) === tailOf(applied.text) : applied.text.endsWith(before);
  if (!historyUnchanged) {
    return { ok: false, class: CLASSES.HISTORY_ALTERED, written: false,
      detail: "regeneration would alter the history below the END marker; refused" };
  }

  const changed = applied.text !== before;
  if (write && changed) fs.writeFileSync(ledgerAbs, applied.text);
  return {
    ok: true, class: CLASSES.OK, written: !!(write && changed), changed, historyUnchanged,
    text: applied.text, headText: head.text,
  };
}

export default {
  LEDGER_HEAD_FS_SCHEMA, LEDGER_FILE, TRUTH_FILE, FEED_FILE, CLASSES, SENDS,
  loadLedgerHeadModule, splitHeadRegion, readProgramTruth, truthAgreesWithFeed,
  checkLedgerHeadOnDisk, regenerateLedgerHeadOnDisk,
};
