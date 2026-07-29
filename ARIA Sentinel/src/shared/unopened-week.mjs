// unopened-week.mjs — RUN-AA AA1: THE UNOPENED WEEK, STATED WITHOUT DRAMA.
//
// WHY (RUN-AA, 2026-07-29): every prior sequence assumed an operator who opens the artefact. That is the
// last soft spot in the chain. A tool that is only true when you look at it loses to a week where you did
// not look.
//
// There are exactly two wrong ways for a program to handle a week nobody opened:
//   1. Treat it as nothing. The thread is quietly lost, dates pass unrecorded, and the next sitting starts
//      from a false present.
//   2. Treat it as a crisis. Streaks, guilt, "you haven't logged in for 7 days", manufactured urgency —
//      exactly the pressure RUN-Z spent a whole sequence removing. That ends with the artefact unopened
//      forever, which is the failure it claimed to prevent.
//
// A gap is a fact with a date. Nothing more.
//
// Honesty invariants (Rule 14):
//   - NO GAP LENGTH PRODUCES A JUDGEMENT. 7 days, 30 days, 200 days: same neutral vocabulary. A test greps
//     every rendered line against a judgement/streak/guilt vocabulary and fails on a hit, at every length.
//   - NO GAP MOVES ANYTHING. A gap changes no rung of the W1 ladder, no X1 cost component, and no route
//     disposition. A test deep-equals a ladder and a cost across a 200-day gap.
//   - `never opened` != `opened and nothing happened`. Two different facts, never rendered as one another.
//   - NO EXCLAMATION, NO STREAK VOCABULARY, NO CADENCE. There is no "you should" in this module.
//   - Dates that opened and closed DURING the gap are stated with their real dates — the gap is where the
//     losses actually happen, and hiding them would be the drama-free version of lying.
//   - NO IDENTITY (vault Rule 11). Opaque handles only.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence, nothing replaced.

export const UNOPENED_WEEK_SCHEMA = "unopened-week.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;
export const JUDGES = false;
export const KEEPS_STREAKS = false;

export const NEVER_OPENED = "never opened";
export const NO_GAP = "no gap";
export const UNVERIFIED = "unverified";

/** Build counters are accepted at the door and discarded unread. Software progress is not an entry. */
export const DISCARDED_INPUTS = Object.freeze([
  "sequencesCompleted", "tasksMerged", "testsGreen", "commits", "merges",
  "suitesGreen", "filesChanged", "runsCompleted", "linesChanged", "modulesBuilt",
]);

// NOTE: this text may not name the vocabulary it disavows — a disavowal still renders the word, and the
// operator reads rendered text, not intent. It states the fact and stops.
export const GAP_IS_A_FACT_NOTE =
  "A gap is a number of days with no operator entry. It is a fact with a date and nothing else. It changes " +
  "no rung of the ladder, no component of the cost, and no route's disposition.";

export const NEVER_OPENED_NOTE =
  "No operator entry has ever been recorded. That is deliberately not the same as a gap: there is no " +
  "previous sitting to measure from, so no gap length exists.";

/** Vocabulary this module must never render, at any gap length. */
export const JUDGEMENT_PATTERNS = Object.freeze([
  /\bstreak\b/i, /\bfell behind\b/i, /\bbehind schedule\b/i, /\bmissed\b/i, /\bfailed to\b/i,
  /\bshould have\b/i, /\byou haven'?t\b/i, /\bneglect(ed)?\b/i, /\bslipp(ed|ing)\b/i,
  /\bmomentum\b/i, /\bback on track\b/i, /\bdon'?t give up\b/i, /\bkeep it up\b/i,
  /\bfinally\b/i, /\bat last\b/i, /\bunfortunately\b/i, /\bsadly\b/i, /!/,
  /\burgent(ly)?\b/i, /\bcritical\b/i, /\bimmediately\b/i, /\bhurry\b/i, /\blast chance\b/i,
]);

const DAY = 86400000;
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const parseMs = (v) => { if (!isStr(v)) return null; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const wholeDays = (fromMs, toMs) => Math.max(0, Math.floor((toMs - fromMs) / DAY));
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Build the unopened-week fact.
 *
 * @param input.spentHours[] every Y1 spent-hour record so far (any order). An entry is a record whose
 *                           `spent === true` AND which carries a parseable `spentAt`. A record with no
 *                           date cannot establish a last-opened moment and is counted as unverified.
 * @param input.warm         the V1 warm queue, recomputed against the current clock.
 * @param opts.now           clock.
 */
export function buildUnopenedWeek(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);

  // Read only to discard. Named so the discard is visible in the source.
  for (const k of DISCARDED_INPUTS) { void input?.[k]; }

  const records = Array.isArray(input?.spentHours) ? input.spentHours : [];
  const opened = records.filter((s) => s && s.spent === true);
  const dated = opened.map((s) => parseMs(s.spentAt)).filter((t) => t !== null);
  const undatedEntries = opened.length - dated.length;

  const everOpened = opened.length > 0;
  const lastOpenedMs = dated.length ? Math.max(...dated) : null;

  let state;
  let gapDays;
  if (!everOpened) {
    state = NEVER_OPENED;
    gapDays = NEVER_OPENED;           // deliberately not 0, and deliberately not a number.
  } else if (lastOpenedMs === null) {
    state = UNVERIFIED;               // it was opened, but no entry ever stated when.
    gapDays = UNVERIFIED;
  } else {
    gapDays = wholeDays(lastOpenedMs, nowMs);
    state = gapDays === 0 ? NO_GAP : "gap";
  }

  // What actually happened inside the gap. Only real dates; nothing inferred.
  const windowStartMs = lastOpenedMs === null ? null : lastOpenedMs;
  const warm = input?.warm && Array.isArray(input.warm.queue) && Array.isArray(input.warm.expired)
    ? input.warm
    : null;

  const closedDuringGap = [];
  const openedDuringGap = [];

  if (warm) {
    for (const e of warm.expired) {
      const t = parseMs(e.expiredOn);
      if (t === null) continue;
      if (windowStartMs === null || t >= windowStartMs) {
        closedDuringGap.push(Object.freeze({
          handle: e.handle,
          routeClass: e.routeClass,
          closedOn: day(t),
          recordedAs: "a window a prospect opened, which closed before it was used.",
        }));
      }
    }
    for (const r of warm.queue) {
      const t = parseMs(r.replyPossibleFrom);
      if (t === null) continue;
      if (t <= nowMs && (windowStartMs === null || t >= windowStartMs)) {
        openedDuringGap.push(Object.freeze({
          handle: r.handle,
          routeClass: r.routeClass,
          cameDueOn: day(t),
          recordedAs: "a date this prospect gave for their own return, which came due.",
        }));
      }
    }
  }

  const reachableNow = warm ? warm.queue.filter((r) => r.reachableNow).length : UNVERIFIED;

  return Object.freeze({
    schema: UNOPENED_WEEK_SCHEMA,
    computedAt: new Date(nowMs).toISOString(),
    state,
    everOpened,
    gapDays,
    lastOpenedOn: lastOpenedMs === null ? (everOpened ? UNVERIFIED : NEVER_OPENED) : day(lastOpenedMs),
    entriesRecorded: opened.length,
    entriesWithoutADate: undatedEntries,
    closedDuringGap: Object.freeze(closedDuringGap),
    openedDuringGap: Object.freeze(openedDuringGap),
    reachableNow,
    sourcedWarm: !!warm,
    gapIsAFactNote: GAP_IS_A_FACT_NOTE,
    neverOpenedNote: NEVER_OPENED_NOTE,
  });
}

/** Render exactly what the operator reads. Neutral at every gap length — that is the whole point. */
export function renderUnopenedWeek(u) {
  const L = [];
  L.push("# WHERE THIS STANDS");
  L.push("");

  if (u.state === NEVER_OPENED) {
    L.push(u.neverOpenedNote);
  } else if (u.state === UNVERIFIED) {
    L.push(
      `${u.entriesRecorded} sitting${u.entriesRecorded === 1 ? " was" : "s were"} recorded, none of them ` +
      "with a date. The time since the last one is unverified — that is a missing field, not zero days."
    );
  } else if (u.state === NO_GAP) {
    L.push(`Last sitting recorded today (${u.lastOpenedOn}). No days have passed since.`);
  } else {
    L.push(`${u.gapDays} day${u.gapDays === 1 ? "" : "s"} since the last recorded sitting (${u.lastOpenedOn}).`);
  }
  L.push("");
  L.push(u.gapIsAFactNote);
  L.push("");

  if (!u.sourcedWarm) {
    L.push("No route record was supplied, so what came due in that time is unverified. Stated, not assumed empty.");
    return L.join("\n");
  }

  if (u.openedDuringGap.length) {
    L.push("## Dates that came due in that time");
    for (const o of u.openedDuringGap) L.push(`- ${o.handle} (${o.routeClass}) — ${o.cameDueOn}. ${o.recordedAs}`);
    L.push("");
  }
  if (u.closedDuringGap.length) {
    L.push("## Windows that closed in that time");
    for (const c of u.closedDuringGap) L.push(`- ${c.handle} (${c.routeClass}) — ${c.closedOn}. ${c.recordedAs}`);
    L.push("");
  }
  if (!u.openedDuringGap.length && !u.closedDuringGap.length) {
    L.push("No date came due and no window closed in that time.");
    L.push("");
  }

  L.push(
    u.reachableNow === UNVERIFIED
      ? "How many routes are reachable now is unverified."
      : `Reachable now: ${u.reachableNow}.`
  );
  return L.join("\n");
}

/** Findings, not a boolean: any judgement, streak or urgency vocabulary in the rendered text. */
export function unopenedWeekJudgements(u) {
  const text = renderUnopenedWeek(u);
  const found = [];
  for (const p of JUDGEMENT_PATTERNS) {
    if (p.test(text)) found.push(`rendered text carries judgement or urgency vocabulary matching ${p}`);
  }
  return Object.freeze(found);
}

/**
 * A gap must change nothing. Returns the ladder/cost EXACTLY as handed in.
 * This exists so a test can prove the no-op rather than trust the prose.
 */
export function applyGapTo(u, subject) {
  void u;
  return subject;
}

/** Flat facts for the feed / ledger. Counts and states only, no identity. */
export function unopenedWeekFacts(u) {
  return Object.freeze({
    schema: UNOPENED_WEEK_SCHEMA,
    state: u.state,
    gapDays: u.gapDays,
    entriesRecorded: u.entriesRecorded,
    closedDuringGap: u.closedDuringGap.length,
    openedDuringGap: u.openedDuringGap.length,
    reachableNow: u.reachableNow,
  });
}
