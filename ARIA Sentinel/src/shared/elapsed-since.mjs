// elapsed-since.mjs — RUN-T T2: THE COST OF THE HOUR NOT HAPPENING.
//
// WHY (RUN-T, 2026-07-28): nineteen sequences shipped, every suite green, and the six numbers that
// matter all read zero. Nothing in the system has ever noticed that. A program that only reports its
// own greenness will report greenness forever, because greenness is the one thing it can always
// produce on its own. T2 builds the counter that makes the absence expensive to ignore — and, more
// importantly, the counter that SHIPPING SOFTWARE CANNOT MOVE.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - `never` IS NOT `0`. "0 days since" means it happened today. "It has never happened" means it
//     has never happened. Collapsing the two is the exact lie this program keeps catching itself in,
//     and here it is a test failure on every surface.
//   - EVERY COUNTER READS A REAL LOG. There is no hand-typed date anywhere in this path; an absent
//     log produces `never`, not a friendly recent-looking timestamp.
//   - SOFTWARE PROGRESS CANNOT MOVE IT. Sequences, suite counts, commits and merges are accepted as
//     INPUT to the ratio line and are structurally incapable of touching the elapsed counters. A test
//     proves this by moving all three and deep-equalling the counters before and after.
//   - THE RATIO IS A NUMBER, NOT A SCOLD. No motivational language, no interpretation, no "should".
//     A number that argues with you gets ignored; a number that just sits there does not.
//   - PURE. No fs, no net, no spawn, no env, no persistence — static-scanned by the T-series tests.
//   - Rule 15 additive: adds counters, replaces nothing.

import { momentumSafe } from "./program-truth.mjs";
import { conversationsHeldFrom } from "./conversation-outcome.mjs";

export const ELAPSED_SINCE_SCHEMA = "elapsed-since.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;

/** The sentinel. Deliberately a string, so a surface that tries to do arithmetic on it breaks loudly
 *  instead of quietly rendering NaN or coercing to 0. */
export const NEVER = "never";

export const NEVER_VS_ZERO_NOTE =
  "`never` and `0 days` are different facts and are never rendered the same way. `0 days since` means " +
  "it happened today. `never` means it has not happened once. A surface that prints 0 for never is " +
  "reporting a good day where there is an empty history.";

export const NOT_A_SCOLD_NOTE =
  "The ratio below is a number with no interpretation attached. It is not a target, not a warning and " +
  "not encouragement - a number that argues gets argued with, and this one is only meant to be read.";

export const IMMUNITY_NOTE =
  "Shipping software cannot move any counter on this surface. Sequences, suite counts, commits and " +
  "merges are accepted only as inputs to the ratio line; they are structurally incapable of touching " +
  "days-since. Only a recorded hour, a recorded conversation or a recorded candidate moves anything.";

/** The three things whose absence is being counted, named once so every surface uses the same words. */
export const TRACKED_EVENTS = Object.freeze([
  Object.freeze({
    key: "hourSpent",
    label: "an hour spent in front of someone",
    neverStatement:
      "An hour in front of a real person has NEVER been spent - not zero days ago, not recently, not once.",
  }),
  Object.freeze({
    key: "conversationHeld",
    label: "a conversation held",
    neverStatement:
      "A conversation has NEVER been held - nobody has been spoken to, so there is no elapsed time to measure.",
  }),
  Object.freeze({
    key: "candidateRecorded",
    label: "a candidate recorded",
    neverStatement:
      "A candidate has NEVER been recorded - not one real name has been written down, so nothing has started to age.",
  }),
]);

export const TRACKED_EVENT_KEYS = Object.freeze(TRACKED_EVENTS.map((e) => e.key));

const DAY_MS = 24 * 60 * 60 * 1000;

function parseWhen(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v.trim());
  return Number.isFinite(t) ? t : null;
}

/** Latest real timestamp in a list of records, or null. `null` NEVER becomes "now". */
function latestOf(records, field) {
  if (!Array.isArray(records) || !records.length) return null;
  let best = null;
  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    const t = parseWhen(r[field] ?? r.at ?? r.heldAt ?? r.recordedAt ?? r.spentAt);
    if (t === null) continue;
    if (best === null || t > best) best = t;
  }
  return best;
}

/**
 * One counter. Returns `{ never: true, days: NEVER }` where nothing has ever happened.
 * A future timestamp clamps to 0 days rather than rendering a negative, and says it clamped.
 */
export function elapsedSince(lastAt, { now = Date.now() } = {}) {
  const t = parseWhen(lastAt);
  if (t === null) {
    return { never: true, days: NEVER, lastAt: null, clamped: false };
  }
  const raw = Math.floor((now - t) / DAY_MS);
  return { never: false, days: raw < 0 ? 0 : raw, lastAt: new Date(t).toISOString(), clamped: raw < 0 };
}

function statementFor(event, counter) {
  if (counter.never) return event.neverStatement;
  if (counter.days === 0) return `${cap(event.label)} happened TODAY - 0 days since, which is not the same fact as never.`;
  if (counter.days === 1) return `1 day since ${event.label}.`;
  return `${counter.days} days since ${event.label}.`;
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function nonNegInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Build the elapsed-since surface.
 *
 * Real-log inputs (the ONLY things that can move a counter):
 *   hourLog:       [{ spentAt }]           - recorded hours, from T3
 *   outcomes:      [R2 outcome records]    - the raw records, for their real `heldAt` dates
 *   outcomeLog:    an R2 buildOutcomeLog() - optional, for the held COUNT in R2's own words
 *   candidateList: [{ recordedAt }]        - from Q1 / S1
 *
 * Ratio-only inputs (structurally incapable of moving a counter):
 *   sequencesShipped, suitesGreen, commits
 */
export function buildElapsed(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};

  const hours = Array.isArray(src.hourLog) ? src.hourLog : [];
  const candidates = Array.isArray(src.candidateList)
    ? src.candidateList
    : (src.candidateList && Array.isArray(src.candidateList.candidates) ? src.candidateList.candidates : []);

  // The raw R2 records carry the real dates. The log object carries R2's own count. Neither is
  // guessed at, and an absent one produces `never` rather than a recent-looking timestamp.
  const outcomeRecords = Array.isArray(src.outcomes)
    ? src.outcomes
    : (Array.isArray(src.outcomeLog) ? src.outcomeLog : []);

  const counters = {
    hourSpent: elapsedSince(latestOf(hours, "spentAt"), { now }),
    conversationHeld: elapsedSince(latestOf(outcomeRecords, "heldAt"), { now }),
    candidateRecorded: elapsedSince(latestOf(candidates, "recordedAt"), { now }),
  };

  const lines = TRACKED_EVENTS.map((e) => ({
    key: e.key,
    label: e.label,
    never: counters[e.key].never,
    days: counters[e.key].days,
    lastAt: counters[e.key].lastAt,
    statement: statementFor(e, counters[e.key]),
  }));

  // Read from R2's own log where one was supplied, never typed in. With no log, counted from the raw
  // records using R2's own `countsAsConversationHeld` flag - not from a rule re-implemented here.
  const conversationsHeld = src.outcomeLog && !Array.isArray(src.outcomeLog)
    ? conversationsHeldFrom(src.outcomeLog)
    : outcomeRecords.filter((o) => o && o.countsAsConversationHeld === true).length;

  const hoursSpent = hours.length;
  const sequencesShipped = nonNegInt(src.sequencesShipped);

  const ratio = {
    sequencesShipped,
    hoursSpent,
    conversationsHeld,
    // Plain words, no interpretation. Where the sequence count is unknown it says so rather than
    // inventing one to make the sentence scan.
    statement: sequencesShipped === null
      ? `${hoursSpent} hour(s) spent and ${conversationsHeld} conversation(s) held. The number of sequences shipped was not supplied, so the ratio is not stated.`
      : `${sequencesShipped} sequence(s) shipped. ${hoursSpent} hour(s) spent in front of anyone. ${conversationsHeld} conversation(s) held.`,
  };

  const neverCount = lines.filter((l) => l.never).length;

  return {
    schema: ELAPSED_SINCE_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    counters,
    lines,
    ratio,
    neverCount,
    neverVsZeroNote: NEVER_VS_ZERO_NOTE,
    notAScoldNote: NOT_A_SCOLD_NOTE,
    immunityNote: IMMUNITY_NOTE,
    statement: neverCount === TRACKED_EVENTS.length
      ? "None of the three has happened once. Every counter below reads `never`, which is a different and worse fact than `0 days`."
      : `${neverCount} of ${TRACKED_EVENTS.length} tracked events have never happened.`,
  };
}

/** The compact fact set every surface must agree on. Drift = suite red. */
export function elapsedFacts(elapsed) {
  if (!elapsed || elapsed.schema !== ELAPSED_SINCE_SCHEMA) return null;
  return {
    daysSinceHourSpent: elapsed.counters.hourSpent.days,
    daysSinceConversationHeld: elapsed.counters.conversationHeld.days,
    daysSinceCandidateRecorded: elapsed.counters.candidateRecorded.days,
    neverCount: elapsed.neverCount,
    ratioStatement: elapsed.ratio.statement,
  };
}

export function elapsedIsMomentumSafe(elapsed) {
  return !!elapsed && momentumSafe(elapsedMarkdown(elapsed));
}

export function elapsedMarkdown(elapsed) {
  if (!elapsed || elapsed.schema !== ELAPSED_SINCE_SCHEMA) return "_no elapsed counter_";
  return [
    "## How long it has been",
    "",
    `_${elapsed.statement}_`,
    "",
    ...elapsed.lines.map((l) => `- **${l.never ? NEVER : `${l.days} day(s)`}** - ${l.statement}`),
    "",
    `- ${elapsed.ratio.statement}`,
    "",
    `_${elapsed.neverVsZeroNote}_`,
    "",
    `_${elapsed.immunityNote}_`,
    "",
  ].join("\n");
}
