// hour-change.mjs — RUN-Y Y2: WHAT VISIBLY CHANGED BECAUSE THE HOUR WAS SPENT.
//
// WHY (RUN-Y, 2026-07-29): if the operator sends eight messages and every surface in this program looks
// identical afterwards, we have taught him that sending does not matter. That would be our design failure,
// not his discipline failure. Y2 renders — from real state only — exactly what moved.
//
// The harder half of this module is what it REFUSES to render. An hour that produced no real event must
// read as an hour spent with no change YET. Not as progress. Not as momentum. Not as a softened silence.
//
// Honesty invariants (Rule 14):
//   - EMPTY WHEN NOTHING MOVED. A spent hour with zero real events produces an EMPTY change set, and the
//     rendering says so in one plain sentence. A test asserts the set is empty and that no software-progress
//     input can populate it.
//   - REAL STATE ONLY, BOTH SIDES. A change is a difference between two computed snapshots (X1 cost, W2
//     ladder, V1 warm queue). Nothing is asserted from the operator's narrative alone.
//   - A CHANGE IS DIRECTIONAL AND NAMED. "cost component fell", "ladder rung gained evidence", "warm window
//     used rather than lost". A rise is reported as a rise — a worsening is never hidden because the hour
//     was spent.
//   - NO CELEBRATION LANGUAGE. No "great", no "momentum", no streaks. The module reports arithmetic.
//   - NO IDENTITY (vault Rule 11). Opaque handles only.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence.

import { UNVERIFIED } from "./cost-of-delay.mjs";
import { RUNGS } from "./outcome-ladder.mjs";

export const HOUR_CHANGE_SCHEMA = "hour-change.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

/** Software-progress inputs accepted at the door and discarded unread. */
export const DISCARDED_INPUTS = Object.freeze([
  "sequencesCompleted", "tasksMerged", "testsGreen", "commits", "merges",
  "suitesGreen", "filesChanged", "runsCompleted", "linesChanged", "modulesBuilt",
]);

export const NO_CHANGE_LINE =
  "The hour was spent and nothing has changed yet. No cost component fell, no rung gained evidence, and " +
  "no warm window was answered. This is stated rather than softened — a reply is the prospect's move and " +
  "has not happened.";

export const NOT_SPENT_LINE =
  "The hour has not been spent, so there is nothing to diff. This is not a change set of zero — it is the " +
  "absence of an hour.";

export const IMMUNITY_NOTE =
  "A change set can only be populated by a real difference between two computed snapshots. Suites, commits, " +
  "merges, tasks and run counts are accepted as input keys and discarded unread — a test injects all of them " +
  "into an otherwise-unchanged pair and asserts the change set stays empty.";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Build the change set.
 *
 * @param input.spent   a spent-hour record (Y1). If it is not spent, nothing is diffed.
 * @param input.before  { cost, ladder, warm } snapshots taken BEFORE the hour.
 * @param input.after   { cost, ladder, warm } snapshots taken AFTER the hour.
 * @param opts.now      clock.
 */
export function buildHourChange(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);

  // Read only to discard. Named explicitly so the discard is visible in the source.
  for (const k of DISCARDED_INPUTS) { void input?.[k]; }

  const spent = input?.spent;
  const hourWasSpent = !!(spent && spent.spent === true);

  const before = input?.before || {};
  const after = input?.after || {};

  const changes = [];

  if (hourWasSpent) {
    // ---- cost components (X1). A FALL is the only thing a send can cause here. -------------------
    const bC = before.cost, aC = after.cost;
    if (bC && aC) {
      for (const key of ["unlandedSequences", "daysSinceMailLeft", "warmWindowsClosed", "warmWindowsAtRisk"]) {
        const b = bC[key], a = aC[key];
        // An unverified side is not a change. It is an absence, and absence is never a movement.
        if (b === UNVERIFIED || a === UNVERIFIED) continue;
        const bn = num(b), an = num(a);
        if (bn === null || an === null || bn === an) continue;
        changes.push(Object.freeze({
          kind: "cost-component",
          key,
          from: bn,
          to: an,
          direction: an < bn ? "fell" : "rose",
          because:
            an < bn
              ? "a real event lowered this — a send, a landing or a reply. Software progress cannot."
              : "this rose. It is reported as a rise; a spent hour does not hide a worsening number.",
        }));
      }
    }

    // ---- ladder rungs (W2). Evidence gained, one-way. --------------------------------------------
    const bL = before.ladder, aL = after.ladder;
    if (bL && aL && bL.rungs && aL.rungs) {
      for (const rung of RUNGS) {
        const b = !!(bL.rungs[rung] && bL.rungs[rung].reached);
        const a = !!(aL.rungs[rung] && aL.rungs[rung].reached);
        if (a && !b) {
          changes.push(Object.freeze({
            kind: "ladder-rung",
            key: rung,
            from: "not reached",
            to: "evidenced",
            direction: "gained evidence",
            because: "this rung now has its own evidence. No lower rung promoted into it.",
          }));
        }
      }
    }

    // ---- warm windows (V1). Used rather than lost. ------------------------------------------------
    const bW = before.warm, aW = after.warm;
    if (bW && aW && bW.counts && aW.counts) {
      const bClosed = num(bW.expired ? bW.expired.length : null);
      const aClosed = num(aW.expired ? aW.expired.length : null);
      if (bClosed !== null && aClosed !== null && aClosed > bClosed) {
        changes.push(Object.freeze({
          kind: "warm-window",
          key: "closedDuringHour",
          from: bClosed,
          to: aClosed,
          direction: "rose",
          because: "a window closed. It is recorded as a loss with its date, not quietly removed.",
        }));
      }
    }
  }

  const changed = changes.length > 0;

  return Object.freeze({
    schema: HOUR_CHANGE_SCHEMA,
    computedAt: new Date(nowMs).toISOString(),
    hourWasSpent,
    changes: Object.freeze(changes),
    changed,
    immunityNote: IMMUNITY_NOTE,
    headline: hourWasSpent ? (changed ? null : NO_CHANGE_LINE) : NOT_SPENT_LINE,
  });
}

/** Render the change set exactly as the operator reads it. Empty renders as one plain sentence. */
export function renderHourChange(c) {
  if (!c.hourWasSpent) return NOT_SPENT_LINE;
  if (!c.changed) return NO_CHANGE_LINE;
  const L = ["What changed because the hour was spent:"];
  for (const ch of c.changes) {
    L.push(`- ${ch.key} ${ch.direction}: ${ch.from} → ${ch.to}. ${ch.because}`);
  }
  return L.join("\n");
}

/** Flat fact set for the AXIS feed / ledger. */
export function hourChangeFacts(c) {
  return Object.freeze({
    schema: HOUR_CHANGE_SCHEMA,
    hourWasSpent: c.hourWasSpent,
    changed: c.changed,
    changeCount: c.changes.length,
  });
}
