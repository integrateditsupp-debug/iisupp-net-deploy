// week-record.mjs — RUN-AA AA3: THE WEEK'S OWN RECORD, AND WHAT IT IS NOT.
//
// WHY (RUN-AA, 2026-07-29): a weekly roll-up is the single easiest place in any operating program to start
// lying, because a week is long enough that SOMETHING happened — and if the only things that happened were
// commits and green tests, a dishonest roll-up will quietly offer those as the week's result.
//
// This one states the counts that did NOT move FIRST, before anything that did. That ordering is the whole
// design: a week where nothing left the mailbox reads as a week where nothing left the mailbox, at the top,
// before any consolation.
//
// Honesty invariants (Rule 14):
//   - COMPUTED FROM OPERATOR ENTRIES ONLY. Y1 spent-hour records inside the window. Nothing else may enter.
//   - SOFTWARE PROGRESS IS NOT A RESULT. Every build counter is accepted at the door and discarded unread.
//     A test injects all of them and deep-equals the roll-up against the version without them.
//   - THE UNMOVED COUNTS COME FIRST. Rendered before executed actions, before hours, before anything.
//   - A ZERO WEEK IS A ZERO WEEK. No compensating language, no "but", no partial credit, no celebration.
//   - A ZERO WEEK != AN UNRECORDED WEEK. `nothing recorded` (no entry exists) and `recorded, nothing done`
//     are two different facts and never render as one another.
//   - SKIP REASONS ARE VERBATIM. Byte-identical to what the operator wrote, in the order given.
//   - REPLIES ARE COUNTED FROM THE REPLY RECORD ONLY. A drafted body is not a send; a send is not a reply.
//   - NO IDENTITY (vault Rule 11). Opaque handles only.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence, nothing replaced.

import { JUDGEMENT_PATTERNS } from "./unopened-week.mjs";

export const WEEK_RECORD_SCHEMA = "week-record.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;
export const ADMITS_SOFTWARE_PROGRESS = false;

export const NOTHING_RECORDED = "nothing recorded";
export const RECORDED_NOTHING_DONE = "recorded, nothing done";
export const UNVERIFIED = "unverified";

export const DISCARDED_INPUTS = Object.freeze([
  "sequencesCompleted", "tasksMerged", "testsGreen", "commits", "merges",
  "suitesGreen", "filesChanged", "runsCompleted", "linesChanged", "modulesBuilt",
]);

/** The counts a week is actually judged by. Stated first, always, moved or not. */
export const JUDGED_BY = Object.freeze(["sent", "replies", "meetings", "revenue"]);

export const UNMOVED_FIRST_NOTE =
  "The counts that did not move are stated first. That ordering is deliberate: a week is measured by what " +
  "left the mailbox and what came back, not by what was built.";

export const SOFTWARE_NOT_ADMITTED_NOTE =
  "No amount of software progress appears anywhere in this record. Commits, merges, green suites and " +
  "completed sequences are read and discarded — they are not a week's result.";

export const TWO_EMPTIES_NOTE =
  `"${NOTHING_RECORDED}" means no sitting was entered for this week at all. "${RECORDED_NOTHING_DONE}" ` +
  "means the operator sat down and executed nothing. They are different facts and are never merged.";

const DAY = 86400000;
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const parseMs = (v) => { if (!isStr(v)) return null; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const nonNegInt = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

/**
 * Roll up one week.
 *
 * @param input.spentHours[] Y1 spent-hour records (any order). Only records with `spent === true` and a
 *                           parseable `spentAt` inside the window can count toward the week.
 * @param input.windowEnd    ISO date the week ends (defaults to `now`).
 * @param input.windowDays   window length in days (default 7).
 * @param input.mail         { sent, meetingsBooked, revenue } counters from the mail record (U1 shape).
 * @param input.replies      { repliesReceived } from the reply record (W1). Absent => unverified.
 * @param opts.now           clock.
 */
export function buildWeekRecord(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);
  for (const k of DISCARDED_INPUTS) { void input?.[k]; }

  const endMs = parseMs(input?.windowEnd) ?? nowMs;
  const days = Number.isInteger(input?.windowDays) && input.windowDays > 0 ? input.windowDays : 7;
  const startMs = endMs - days * DAY;

  const inWindow = (Array.isArray(input?.spentHours) ? input.spentHours : []).filter((s) => {
    if (!s || s.spent !== true) return false;
    const t = parseMs(s.spentAt);
    return t !== null && t > startMs && t <= endMs;
  });

  const executed = [];
  const skipped = [];
  for (const s of inWindow) {
    for (const e of s.executed || []) {
      executed.push(Object.freeze({ handle: e.handle, observed: e.observed }));
    }
    for (const k of s.skipped || []) {
      // Verbatim. Byte-identical to what the operator wrote, in the order given.
      skipped.push(Object.freeze({ handle: k.handle, skipReason: k.skipReason }));
    }
  }

  const hoursSpent = inWindow.length;
  const state =
    hoursSpent === 0
      ? NOTHING_RECORDED
      : executed.length === 0
        ? RECORDED_NOTHING_DONE
        : "recorded";

  const sent = nonNegInt(input?.mail?.sent);
  const meetings = nonNegInt(input?.mail?.meetingsBooked);
  const revenue = nonNegInt(input?.mail?.revenue);
  const replies = nonNegInt(input?.replies?.repliesReceived);

  const counts = Object.freeze({
    sent: sent === null ? UNVERIFIED : sent,
    replies: replies === null ? UNVERIFIED : replies,
    meetings: meetings === null ? UNVERIFIED : meetings,
    revenue: revenue === null ? UNVERIFIED : revenue,
  });

  // Unmoved = a real, verified zero. An `unverified` count is an absence and is listed separately,
  // never quietly folded into "did not move".
  const unmoved = Object.freeze(JUDGED_BY.filter((k) => counts[k] === 0));
  const unverified = Object.freeze(JUDGED_BY.filter((k) => counts[k] === UNVERIFIED));
  const moved = Object.freeze(JUDGED_BY.filter((k) => typeof counts[k] === "number" && counts[k] > 0));

  return Object.freeze({
    schema: WEEK_RECORD_SCHEMA,
    computedAt: new Date(nowMs).toISOString(),
    windowStart: new Date(startMs).toISOString().slice(0, 10),
    windowEnd: new Date(endMs).toISOString().slice(0, 10),
    windowDays: days,
    state,
    hoursSpent,
    executed: Object.freeze(executed),
    executedCount: executed.length,
    skipped: Object.freeze(skipped),
    skippedCount: skipped.length,
    counts,
    unmoved,
    unverified,
    moved,
    judgedBy: JUDGED_BY,
    unmovedFirstNote: UNMOVED_FIRST_NOTE,
    softwareNotAdmittedNote: SOFTWARE_NOT_ADMITTED_NOTE,
    twoEmptiesNote: TWO_EMPTIES_NOTE,
  });
}

/** The week as the operator reads it. Unmoved counts first — always. */
export function renderWeekRecord(w) {
  const L = [];
  L.push(`# THE WEEK — ${w.windowStart} to ${w.windowEnd}`);
  L.push("");

  // FIRST. Before hours, before actions, before anything.
  L.push("## What did not move");
  if (w.unmoved.length === 0 && w.unverified.length === 0) {
    L.push("Every count this week is judged by moved.");
  } else {
    for (const k of w.unmoved) L.push(`- ${k}: 0`);
    for (const k of w.unverified) L.push(`- ${k}: unverified — no record states it. Not zero.`);
  }
  L.push("");
  L.push(w.unmovedFirstNote);
  L.push("");

  if (w.moved.length) {
    L.push("## What moved");
    for (const k of w.moved) L.push(`- ${k}: ${w.counts[k]}`);
    L.push("");
  }

  L.push("## The week's own record");
  if (w.state === NOTHING_RECORDED) {
    L.push("No sitting was entered for this week. That is an absence of a record, not a week of zero work.");
  } else if (w.state === RECORDED_NOTHING_DONE) {
    L.push(`${w.hoursSpent} sitting${w.hoursSpent === 1 ? " was" : "s were"} entered and nothing was executed. ` +
      "That is a recorded fact and is not the same as no sitting at all.");
  } else {
    L.push(`${w.hoursSpent} sitting${w.hoursSpent === 1 ? "" : "s"}. ${w.executedCount} action${w.executedCount === 1 ? "" : "s"} executed.`);
  }
  L.push("");

  if (w.executed.length) {
    L.push("### Executed");
    for (const e of w.executed) L.push(`- ${e.handle}${isStr(e.observed) ? ` — ${e.observed}` : ""}`);
    L.push("");
  }
  if (w.skipped.length) {
    L.push("### Skipped, with the reason given");
    for (const s of w.skipped) L.push(`- ${s.handle} — "${s.skipReason}"`);
    L.push("");
  }

  L.push(w.softwareNotAdmittedNote);
  L.push("");
  L.push(w.twoEmptiesNote);
  return L.join("\n");
}

/** Findings, not a boolean: judgement/consolation vocabulary anywhere in the week's record. */
export function weekRecordJudgements(w) {
  const text = renderWeekRecord(w);
  const found = [];
  for (const p of JUDGEMENT_PATTERNS) {
    if (p.test(text)) found.push(`week record carries judgement or urgency vocabulary matching ${p}`);
  }
  return Object.freeze(found);
}

/** Flat facts for the feed / ledger. Counts and states only, no identity. */
export function weekRecordFacts(w) {
  return Object.freeze({
    schema: WEEK_RECORD_SCHEMA,
    state: w.state,
    windowStart: w.windowStart,
    windowEnd: w.windowEnd,
    hoursSpent: w.hoursSpent,
    executed: w.executedCount,
    skipped: w.skippedCount,
    unmoved: w.unmoved.length,
    unverified: w.unverified.length,
    moved: w.moved.length,
  });
}
