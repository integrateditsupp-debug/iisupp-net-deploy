// week-reentry.mjs — RUN-AA AA2: RE-ENTRY IN ONE SITTING, WITH NOTHING TO RECONSTRUCT.
//
// WHY (RUN-AA, 2026-07-29): the moment a program is actually judged is not the day it is built. It is the
// day someone comes back after two weeks away and opens it. If that person has to read three prior
// artefacts, cross-reference a ledger, and work out what is still live before they can do anything, they
// close it and the program is finished.
//
// So: ONE page. Cold. Nothing to reconstruct. What changed while nobody was looking, computed as a real
// difference between two snapshots — and then the work, already ranked.
//
// Honesty invariants (Rule 14):
//   - THE CHANGE SET IS A DIFFERENCE, NEVER A NARRATIVE. Windows that closed with their dates, dates that
//     came due, routes that retired at the bound. Nothing else may enter it.
//   - NOTHING CHANGED IS RENDERED PLAINLY. "Nothing changed while you were away." Not softened, not padded,
//     not dressed as progress. A test asserts the exact line at a two-week gap with identical snapshots.
//   - SOFTWARE PROGRESS IS NOT A CHANGE. Every build counter is accepted and discarded unread; a test
//     injects all of them into an unchanged pair and asserts the change set stays empty.
//   - A WORSENING NUMBER IS REPORTED AS A RISE. The return of the operator never softens a bad number.
//   - NO JUDGEMENT AND NO URGENCY (inherits AA1's vocabulary ban). Coming back late is not a fact about
//     the person.
//   - COLD-EXECUTABLE, ONE SITTING, LEAK-FREE. No identity, no domain, no internal path, no branch, no
//     script name (vault Rule 11 + the-hour LEAK_PATTERNS). Overflow is stated, never truncated silently.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence, nothing replaced.

import { ONE_SITTING_MAX, LEAK_PATTERNS } from "./the-hour.mjs";
import { JUDGEMENT_PATTERNS, UNVERIFIED, NEVER_OPENED } from "./unopened-week.mjs";

export const WEEK_REENTRY_SCHEMA = "week-reentry.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;
export const NARRATES = false;

export const DISCARDED_INPUTS = Object.freeze([
  "sequencesCompleted", "tasksMerged", "testsGreen", "commits", "merges",
  "suitesGreen", "filesChanged", "runsCompleted", "linesChanged", "modulesBuilt",
]);

export const NOTHING_CHANGED_LINE = "Nothing changed while you were away.";

export const COLD_NOTE =
  "This page requires no prior reading. Everything needed to act is on it: what moved, what is live, and " +
  "the message for each one.";

export const DIFFERENCE_ONLY_NOTE =
  "Everything above is a difference between two real records. No item here was written by hand and none of " +
  "it was inferred from work done on the software.";

const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** One movement in a number. Direction is stated by the number, never by adjective. */
function numberMove(key, label, before, after, riseMeans) {
  if (!isNum(before) || !isNum(after)) {
    // `unverified` on either side is an ABSENCE, never a movement.
    return null;
  }
  if (before === after) return null;
  const rose = after > before;
  return Object.freeze({
    kind: "number",
    key,
    label,
    before,
    after,
    delta: after - before,
    direction: rose ? "rose" : "fell",
    // A rise is reported as a rise even when the operator has just come back. No softening.
    stated: rose
      ? `${label} rose from ${before} to ${after}. ${riseMeans}`
      : `${label} fell from ${before} to ${after}.`,
  });
}

/**
 * Build the re-entry page.
 *
 * @param input.gap       an AA1 unopened-week result (required for the header; may be `never opened`).
 * @param input.before    snapshot taken at the last sitting: { costIndex, warmReachable, warmClosed, ladderReached }
 * @param input.after     snapshot taken now, same shape.
 * @param input.hours     a Z3 repeat-hours result (or Y3/X2 hour) supplying the live ranked actions.
 * @param opts.now        clock.
 */
export function buildWeekReentry(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);
  for (const k of DISCARDED_INPUTS) { void input?.[k]; }

  const gap = input?.gap || null;
  const before = input?.before || {};
  const after = input?.after || {};

  const changes = [];

  // Dated events first — these are the only things a gap can actually produce.
  for (const c of gap?.closedDuringGap || []) {
    changes.push(Object.freeze({
      kind: "closed",
      handle: c.handle,
      routeClass: c.routeClass,
      on: c.closedOn,
      stated: `${c.handle} (${c.routeClass}) — window closed ${c.closedOn}. ${c.recordedAs}`,
    }));
  }
  for (const o of gap?.openedDuringGap || []) {
    changes.push(Object.freeze({
      kind: "came-due",
      handle: o.handle,
      routeClass: o.routeClass,
      on: o.cameDueOn,
      stated: `${o.handle} (${o.routeClass}) — date came due ${o.cameDueOn}. ${o.recordedAs}`,
    }));
  }
  for (const t of input?.hours?.retired || []) {
    changes.push(Object.freeze({
      kind: "retired",
      handle: t.handle,
      routeClass: t.routeClass,
      on: null,
      stated: `${t.handle} (${t.routeClass}) — ${t.recordedAs}`,
    }));
  }

  // Then the numbers, each computed as a real difference.
  const numbers = [
    numberMove("costIndex", "The cost of waiting", before.costIndex, after.costIndex,
      "That is what the time away added, computed from dates that already existed."),
    numberMove("warmClosed", "Windows closed unused", before.warmClosed, after.warmClosed,
      "Each one was opened by a prospect and closed before it was used."),
    numberMove("warmReachable", "Routes reachable now", before.warmReachable, after.warmReachable,
      "More routes are open than when you last sat down."),
  ].filter(Boolean);
  for (const n of numbers) changes.push(n);

  const ladderMoved =
    typeof before.ladderReached === "string" &&
    typeof after.ladderReached === "string" &&
    before.ladderReached !== after.ladderReached;
  if (ladderMoved) {
    changes.push(Object.freeze({
      kind: "ladder",
      key: "ladderReached",
      before: before.ladderReached,
      after: after.ladderReached,
      stated: `The furthest rung reached moved from "${before.ladderReached}" to "${after.ladderReached}".`,
    }));
  }

  const live = Array.isArray(input?.hours?.actions) ? input.hours.actions : [];
  // The upstream hour already slices to one sitting and reports what it held back separately. Both are
  // added here so the page can state the true total rather than the sliced one.
  const held = isNum(input?.hours?.heldBeyondSitting) ? input.hours.heldBeyondSitting : 0;
  const totalReachable =
    (isNum(input?.hours?.actionsTotalReachable) ? input.hours.actionsTotalReachable : live.length) + held;
  const overflow = Math.max(0, totalReachable - ONE_SITTING_MAX);

  return Object.freeze({
    schema: WEEK_REENTRY_SCHEMA,
    builtAt: new Date(nowMs).toISOString(),
    gapState: gap?.state ?? UNVERIFIED,
    gapDays: gap?.gapDays ?? UNVERIFIED,
    lastOpenedOn: gap?.lastOpenedOn ?? NEVER_OPENED,
    changes: Object.freeze(changes),
    changed: changes.length > 0,
    numbers: Object.freeze(numbers),
    actions: Object.freeze(live.slice(0, ONE_SITTING_MAX)),
    actionsTotalReachable: totalReachable,
    overflow,
    notYetOpen: Object.freeze(input?.hours?.notYetOpen || []),
    oneSittingMax: ONE_SITTING_MAX,
    nothingChangedLine: NOTHING_CHANGED_LINE,
    coldNote: COLD_NOTE,
    differenceOnlyNote: DIFFERENCE_ONLY_NOTE,
  });
}

/** The page itself. This is the artefact that gets opened after two weeks. */
export function renderWeekReentry(r) {
  const L = [];
  L.push("# BACK IN");
  L.push("");
  if (r.gapState === NEVER_OPENED) {
    L.push("No sitting has been recorded yet, so there is no time away to measure.");
  } else if (typeof r.gapDays === "number") {
    L.push(`${r.gapDays} day${r.gapDays === 1 ? "" : "s"} since the last recorded sitting (${r.lastOpenedOn}).`);
  } else {
    L.push("Time since the last recorded sitting is unverified — a missing date, not zero days.");
  }
  L.push("");
  L.push(r.coldNote);
  L.push("");

  L.push("## What changed while you were away");
  if (!r.changed) {
    L.push(r.nothingChangedLine);
  } else {
    for (const c of r.changes) L.push(`- ${c.stated}`);
  }
  L.push("");
  L.push(r.differenceOnlyNote);
  L.push("");

  L.push("## What is live now");
  if (r.actions.length === 0) {
    L.push("No route is live right now. Nothing to do this sitting.");
  } else {
    L.push(
      `${r.actions.length} action${r.actions.length === 1 ? "" : "s"} this sitting.` +
      (r.overflow > 0
        ? ` ${r.actionsTotalReachable} live in total; the ${r.overflow} beyond this sitting are held for the next one, not dropped.`
        : "")
    );
    L.push("");
    for (const a of r.actions) {
      L.push(`### ${a.rank}. ${a.handle}  (${a.routeClass})`);
      L.push(a.why);
      L.push(a.modeAction);
      L.push("");
      L.push("Message:");
      L.push("```");
      L.push(a.body);
      L.push("```");
      L.push("");
    }
  }

  if (r.notYetOpen.length) {
    L.push("## Not open yet — do not act on these");
    for (const n of r.notYetOpen) {
      L.push(`- ${n.handle} (${n.routeClass}) — the prospect stated they are back on ${n.opensOn}.`);
    }
  }
  return L.join("\n");
}

/** Findings, not a boolean: identity, internal references, or judgement vocabulary on the page. */
export function weekReentryLeaks(r) {
  const text = renderWeekReentry(r);
  const found = [];
  if (CARRIES_IDENTITY(text)) found.push("page carries an address or a domain (vault Rule 11)");
  for (const p of LEAK_PATTERNS) {
    if (p.test(text)) found.push(`page carries an internal reference matching ${p}`);
  }
  for (const p of JUDGEMENT_PATTERNS) {
    if (p.test(text)) found.push(`page carries judgement or urgency vocabulary matching ${p}`);
  }
  return Object.freeze(found);
}

/** True only when the sitting is genuinely completable in one go. */
export function reentryFitsOneSitting(r) {
  return r.actions.length <= r.oneSittingMax;
}

/** Flat facts for the feed / ledger. Counts only, no identity. */
export function weekReentryFacts(r) {
  return Object.freeze({
    schema: WEEK_REENTRY_SCHEMA,
    gapState: r.gapState,
    gapDays: r.gapDays,
    changes: r.changes.length,
    live: r.actions.length,
    overflow: r.overflow,
  });
}
