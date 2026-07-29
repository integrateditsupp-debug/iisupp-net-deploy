// ledger-head.mjs — RUN-O O3: THE LEDGER THAT ANSWERS IN ONE LINE.
//
// WHY (RUN-O, 2026-07-28): PROGRESS-LEDGER.md is the honest record and it must stay that way
// (Rule 15 — its full history is never touched). But answering "where are we?" currently means
// reading the last three hundred lines of it. O3 generates a short head that answers, from real
// state only: what is published, what is verified but unpublished, what the suite says, revenue
// received, asks sent. It is GENERATED — never hand-typed — from the same normalised truth the
// AXIS status feed and the operator brief read.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - ONE TRUTH, THREE SURFACES. `ledgerHeadFacts()` must deep-equal `operatorBriefFacts()` and the
//     AXIS headline facts. A drift is a TEST FAILURE.
//   - ZERO IN M3'S OWN WORDS. Revenue and asks-sent are rendered from the imported statements.
//   - RUN-P P3: STAGED AND SENT ARE SEPARATE LINES. A staged ask is an artefact waiting on a human;
//     it is never counted, phrased, or rounded into a sent one. Both render even when both are zero.
//   - NO TREND LANGUAGE OVER A ZERO SERIES — `momentumSafe()` asserted over the whole head.
//   - THE HISTORY IS UNTOUCHED. `applyLedgerHead()` replaces only the region between the two
//     markers and asserts the body below is byte-identical. It returns text; it never writes.
//   - PURE. No fs, no net, no spawn — static-scanned.

import { normalizeProgramTruth, factsOf, momentumSafe, PROGRAM_TRUTH_SCHEMA } from "./program-truth.mjs";

export const LEDGER_HEAD_SCHEMA = "ledger-head.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const BEGIN_MARKER = "<!-- LEDGER-HEAD:BEGIN (generated — do not hand-edit; regenerate from program-truth) -->";
export const END_MARKER = "<!-- LEDGER-HEAD:END -->";

export function buildLedgerHead(rawTruth = {}, { now = Date.now() } = {}) {
  const truth = rawTruth && rawTruth.schema === PROGRAM_TRUTH_SCHEMA
    ? rawTruth
    : normalizeProgramTruth(rawTruth || {}, { now });

  const lines = [
    // R3: stated FIRST, before the sequence and before the suite, because it is the constraint.
    `- **Conversations held:** ${truth.revenue.conversationsStatement}`,
    // S3: the honest counter-metric, immediately beneath the number it qualifies.
    `- **Hours spent:** ${truth.revenue.hoursStatement}`,
    // T2: how long it has been. `never` renders as `never`, never as a zero.
    `- **How long since an hour was spent:** ${truth.elapsed.hourStatement}`,
    `- **Sequence:** ${truth.program.sequence}` +
      (truth.program.tasksMerged !== null && truth.program.tasksTotal !== null
        ? ` — ${truth.program.tasksMerged}/${truth.program.tasksTotal} tasks merged`
        : ""),
    `- **Published line:** ${truth.mainRef.statement}`,
    `- **Verified but unpublished:** ${truth.unpushed.statement}`,
    `- **Tests:** ${truth.tests.statement}`,
    `- **Candidates recorded (none asked):** ${truth.revenue.candidatesStatement}`,
    `- **Asks staged (not sent):** ${truth.revenue.stagedStatement}`,
    `- **Asks sent:** ${truth.revenue.asksStatement}`,
    `- **Revenue received:** ${truth.revenue.revenueStatement}`,
  ];

  const head = {
    schema: LEDGER_HEAD_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    truth,
    lines,
    text: [
      BEGIN_MARKER,
      "",
      `## Where this stands, in ${lines.length} lines`,
      "",
      ...lines,
      "",
      "_Generated from the same source as the AXIS status feed and the operator brief. If these three disagree, the test suite goes red._",
      "",
      END_MARKER,
    ].join("\n"),
  };
  return head;
}

/** Must deep-equal operatorBriefFacts() and the AXIS headline facts. Drift = suite red. */
export function ledgerHeadFacts(head) {
  if (!head || head.schema !== LEDGER_HEAD_SCHEMA) return null;
  return factsOf(head.truth);
}

export function ledgerHeadIsMomentumSafe(head) {
  return !!head && momentumSafe(head.text);
}

/**
 * Splice the generated head into an existing ledger document.
 * Rule 15: the history below is never altered. Returns { text, historyUnchanged, replaced }.
 * Pure — takes and returns strings. Writing is the caller's job, outside the send-incapable chain.
 */
export function applyLedgerHead(existingText, head) {
  const doc = typeof existingText === "string" ? existingText : "";
  if (!head || head.schema !== LEDGER_HEAD_SCHEMA) return { text: doc, historyUnchanged: true, replaced: false };

  const b = doc.indexOf(BEGIN_MARKER);
  const e = doc.indexOf(END_MARKER);

  if (b !== -1 && e !== -1 && e > b) {
    const before = doc.slice(0, b);
    const after = doc.slice(e + END_MARKER.length);
    const text = before + head.text + after;
    return { text, historyUnchanged: after === doc.slice(e + END_MARKER.length), replaced: true };
  }

  // No head yet: prepend. Every byte of the existing document survives, in order.
  const text = head.text + "\n\n" + doc;
  return { text, historyUnchanged: text.endsWith(doc), replaced: false };
}
