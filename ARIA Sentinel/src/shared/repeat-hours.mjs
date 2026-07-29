// repeat-hours.mjs — RUN-Z Z3: THE REPEAT — ONE-WAY AND BOUNDED.
//
// WHY (RUN-Z, 2026-07-29): Y3 regenerated the hour from ONE spent hour. That is not the shape of the real
// problem. The real shape is three or four hours spread over two weeks, each consuming a little, each
// leaving a skip reason behind, and a handful of routes that have now been looked at more times than any
// route deserves.
//
// Two failures are being designed against, and they pull in opposite directions:
//   1. Work coming back. A route executed in hour one reappearing as live in hour three would make the
//      artefact a liar and the operator would stop opening it.
//   2. Work never leaving. A route skipped four times still sitting at the bottom of every list is the
//      program refusing to accept an answer it has already been given four times.
//
// Honesty invariants (Rule 14):
//   - THE UNION OF EVERYTHING EXECUTED IS CONSUMED PERMANENTLY. Across ALL spent hours, not just the last.
//     A test spends three hours in sequence and asserts no executed handle ever returns as live.
//   - SKIP REASONS ACCUMULATE, THEY DO NOT OVERWRITE. A route skipped twice for different reasons carries
//     BOTH, verbatim, in the order they were given. A test supplies two blunt reasons and asserts both
//     survive byte-identical and in order.
//   - A BOUNDED ROUTE STOPS APPEARING, AND SAYS SO. After REPEAT_MAX actions the route is retired with the
//     fact stated — it is never silently dropped. Rule 15: nothing disappears, it is stated.
//   - RETIREMENT IS A COUNT, NOT A JUDGEMENT. It records that the route was actioned N times. It does not
//     say the prospect declined, was uninterested, or is a bad fit.
//   - STILL COLD-EXECUTABLE, STILL ONE SITTING at every step.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence, nothing replaced.

import { buildTheHour, ONE_SITTING_MAX, LEAK_PATTERNS } from "./the-hour.mjs";

export const REPEAT_HOURS_SCHEMA = "repeat-hours.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

/**
 * How many times a single route may be actioned (executed or skipped) before it stops appearing.
 * Three is not a cadence and not a rule of thumb about prospects: it is the point past which the program
 * is repeating a question the operator has already answered three times.
 */
export const REPEAT_MAX = 3;

export const ONE_WAY_NOTE =
  "Every action executed in any previous hour is consumed permanently. Not by the last hour only — by all " +
  "of them. Nothing executed comes back as a live action.";

export const ACCUMULATION_NOTE =
  "A route skipped more than once carries every reason it was skipped, verbatim, in the order they were " +
  "given. A later reason never overwrites an earlier one, and none of them is softened.";

export const RETIREMENT_NOTE =
  `A route actioned ${REPEAT_MAX} times stops appearing as a live action, and the count that retired it is ` +
  "stated. This records how many times it was looked at. It says nothing about what the prospect wants.";

const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));

/**
 * Fold a list of spent hours (Y1 records, oldest first) into per-handle history.
 * Pure; returns Maps of plain frozen data.
 */
export function foldSpentHours(spentHours = []) {
  const executed = new Set();
  const skipReasons = new Map();   // handle -> [reason, ...] verbatim, in order
  const actionCount = new Map();   // handle -> number of times actioned (executed or skipped)

  const bump = (h) => actionCount.set(h, (actionCount.get(h) || 0) + 1);

  for (const s of Array.isArray(spentHours) ? spentHours : []) {
    if (!s || s.spent !== true) continue;
    for (const e of s.executed || []) {
      if (!e || typeof e.handle !== "string") continue;
      executed.add(e.handle);
      bump(e.handle);
    }
    for (const k of s.skipped || []) {
      if (!k || typeof k.handle !== "string") continue;
      const list = skipReasons.get(k.handle) || [];
      // Push, never replace. Verbatim, exactly as the operator wrote it.
      list.push(k.skipReason);
      skipReasons.set(k.handle, list);
      bump(k.handle);
    }
  }

  return Object.freeze({
    executed,
    skipReasons,
    actionCount,
    hoursCounted: (Array.isArray(spentHours) ? spentHours : []).filter((s) => s && s.spent === true).length,
  });
}

/**
 * Regenerate the hour across MULTIPLE spent hours.
 *
 * @param input.warm         the CURRENT warm queue (V1), recomputed against the current clock.
 * @param input.spentHours[] every spent-hour record so far, oldest first.
 * @param opts.now           clock.
 */
export function buildRepeatedHours(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);
  const history = foldSpentHours(input?.spentHours);

  const base = buildTheHour({ warm: input?.warm }, { now: nowMs });

  const fresh = [];
  const deferred = [];
  const completed = [];
  const retired = [];

  for (const a of base.actions) {
    const count = history.actionCount.get(a.handle) || 0;

    if (history.executed.has(a.handle)) {
      completed.push(Object.freeze({
        handle: a.handle,
        routeClass: a.routeClass,
        actionedTimes: count,
        recordedAs: "executed in a previous hour. Consumed permanently — not a live action.",
      }));
      continue;
    }

    if (count >= REPEAT_MAX) {
      retired.push(Object.freeze({
        handle: a.handle,
        routeClass: a.routeClass,
        actionedTimes: count,
        skipReasons: Object.freeze([...(history.skipReasons.get(a.handle) || [])]),
        recordedAs:
          `actioned ${count} times without being executed. It stops appearing as a live action. This is a ` +
          `count of how many times it was looked at and is not a statement about the prospect.`,
      }));
      continue;
    }

    const reasons = history.skipReasons.get(a.handle);
    if (reasons && reasons.length) {
      deferred.push(Object.freeze({ action: a, reasons: Object.freeze([...reasons]), count }));
      continue;
    }

    fresh.push(a);
  }

  const ordered = [];
  // Never-attempted first.
  for (const a of fresh) {
    ordered.push(Object.freeze({ ...a, previouslySkipped: false, skippedTimes: 0, skipReasons: Object.freeze([]) }));
  }
  // Then previously-skipped, fewest skips first — a route skipped once outranks one skipped twice.
  deferred.sort((x, y) => x.reasons.length - y.reasons.length);
  for (const d of deferred) {
    const quoted = d.reasons.map((r) => `"${r}"`).join(" then ");
    ordered.push(Object.freeze({
      handle: d.action.handle,
      routeClass: d.action.routeClass,
      mode: d.action.mode,
      modeAction: d.action.modeAction,
      why:
        `previously skipped ${d.reasons.length} time${d.reasons.length === 1 ? "" : "s"} — ${quoted}. ` +
        `Ranked below never-attempted routes because you have already looked at this one. ` +
        `${REPEAT_MAX - d.count} action${REPEAT_MAX - d.count === 1 ? "" : "s"} remain before it stops appearing.`,
      body: d.action.body,
      previouslySkipped: true,
      skippedTimes: d.reasons.length,
      skipReasons: Object.freeze([...d.reasons]),
    }));
  }

  const ranked = Object.freeze(
    ordered.slice(0, ONE_SITTING_MAX).map((a, i) => Object.freeze({ ...a, rank: i + 1 }))
  );

  return Object.freeze({
    schema: REPEAT_HOURS_SCHEMA,
    builtAt: new Date(nowMs).toISOString(),
    sourced: base.sourced,
    hoursSpent: history.hoursCounted,
    actions: ranked,
    actionsTotalReachable: ordered.length,
    overflow: Math.max(0, ordered.length - ONE_SITTING_MAX),
    heldBeyondSitting: base.overflow,
    completed: Object.freeze(completed),
    retired: Object.freeze(retired),
    notYetOpen: base.notYetOpen,
    closed: base.closed,
    refused: base.refused,
    oneSittingMax: ONE_SITTING_MAX,
    repeatMax: REPEAT_MAX,
    oneWayNote: ONE_WAY_NOTE,
    accumulationNote: ACCUMULATION_NOTE,
    retirementNote: RETIREMENT_NOTE,
    coldStartNote: base.coldStartNote,
  });
}

/** Render the artefact exactly as the operator reads it on the second, third or fourth sitting. */
export function renderRepeatedHours(r) {
  const L = [];
  L.push("# THE NEXT SITTING — regenerated from every hour spent so far.");
  L.push("");
  L.push(r.coldStartNote);
  L.push("");
  if (!r.sourced) {
    L.push("No warm-route record was supplied, so there is no action list. Stated, not rendered as an empty hour.");
    return L.join("\n");
  }
  L.push(`Hours spent so far: ${r.hoursSpent}. ${r.oneWayNote}`);
  L.push("");
  if (r.actions.length === 0) {
    L.push("No route is live right now. Nothing to do this sitting — stated plainly, not padded.");
    L.push("");
  } else {
    L.push(`${r.actions.length} action${r.actions.length === 1 ? "" : "s"} this sitting.` +
      (r.overflow > 0
        ? ` ${r.actionsTotalReachable} live in total; the ${r.overflow} beyond this sitting are held for the next one, not dropped.`
        : ""));
    L.push("");
    for (const a of r.actions) {
      L.push(`## ${a.rank}. ${a.handle}  (${a.routeClass})`);
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
  if (r.completed.length) {
    L.push("## Executed in a previous hour — done, not pending");
    for (const c of r.completed) L.push(`- ${c.handle} (${c.routeClass}) — ${c.recordedAs}`);
    L.push("");
  }
  if (r.retired.length) {
    L.push("## No longer appearing — stated, not silently dropped");
    for (const t of r.retired) {
      L.push(`- ${t.handle} (${t.routeClass}) — ${t.recordedAs}`);
      for (const reason of t.skipReasons) L.push(`  - skipped: "${reason}"`);
    }
    L.push("");
  }
  if (r.notYetOpen.length) {
    L.push("## Not open yet — do not act on these");
    for (const n of r.notYetOpen) {
      L.push(`- ${n.handle} (${n.routeClass}) — the prospect stated they are back on ${n.opensOn}.`);
    }
    L.push("");
  }
  if (r.closed.length) {
    L.push("## Closed windows — recorded losses, listed so they are not forgotten");
    for (const c of r.closed) L.push(`- ${c.handle} (${c.routeClass}) — closed ${c.closedOn}. ${c.recordedAs}`);
    L.push("");
  }
  L.push(r.accumulationNote);
  L.push("");
  L.push(r.retirementNote);
  return L.join("\n");
}

/** Findings, not a boolean: identity or internal references in the rendered artefact. */
export function repeatedHoursLeaks(r) {
  const text = renderRepeatedHours(r);
  const found = [];
  if (CARRIES_IDENTITY(text)) found.push("rendered artefact carries an address or a domain (vault Rule 11)");
  for (const p of LEAK_PATTERNS) {
    if (p.test(text)) found.push(`rendered artefact carries an internal reference matching ${p}`);
  }
  return Object.freeze(found);
}

/** True only when the sitting is genuinely completable in one go. */
export function repeatFitsOneSitting(r) {
  return r.actions.length <= ONE_SITTING_MAX;
}

/** True when a handle executed in ANY previous hour appears as a live action. Must stay false, forever. */
export function executedReturnedAsLive(r, handle) {
  return r.actions.some((a) => a.handle === handle);
}

/** Flat fact set for the AXIS feed / ledger. Counts only, no identity. */
export function repeatHoursFacts(r) {
  return Object.freeze({
    schema: REPEAT_HOURS_SCHEMA,
    hoursSpent: r.hoursSpent,
    live: r.actions.length,
    completed: r.completed.length,
    retired: r.retired.length,
    repeatMax: r.repeatMax,
  });
}
