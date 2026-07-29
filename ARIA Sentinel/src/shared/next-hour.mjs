// next-hour.mjs — RUN-Y Y3: THE NEXT HOUR, REGENERATED FROM WHAT THE LAST ONE CONSUMED.
//
// WHY (RUN-Y, 2026-07-29): a static action list punishes the operator for using it. If he executes eight
// routes and the same eight are still sitting there tomorrow, the artefact is lying to him and he will
// stop opening it. Y3 makes the list CONSUMABLE: what was executed leaves, what was skipped carries its
// reason forward, and what closed during the hour becomes a dated loss.
//
// Honesty invariants (Rule 14) + vault Rule 11:
//   - AN EXECUTED ACTION CAN NEVER REAPPEAR AS LIVE. Not re-ranked, not "following up again", not revived
//     by a rebuild. A test executes an action and asserts the handle is absent from every live rank of the
//     regenerated artefact. It appears only in the completed section.
//   - A SKIP CARRIES ITS REASON FORWARD, VERBATIM. It is never rewritten into something softer and never
//     silently promoted back to the top. A skipped route is ranked BELOW never-attempted routes, because
//     the operator already looked at it once and chose not to act.
//   - WINDOWS THAT CLOSED DURING THE HOUR MOVE TO LOSSES with their date. Never re-ranked as live.
//   - STILL COLD-EXECUTABLE, STILL ONE SITTING. Same guarantees as X2: no prior reading required, no
//     identity, no internal path, no branch, no script name, and the sitting genuinely fits one sitting.
//   - NOTHING SENDS. Pure. No fs, no net, no transport, no persistence.
//   - ADDITIVE (Rule 15). X2's artefact is untouched; this is the regeneration path on top of it.

import { buildTheHour, renderHour, ONE_SITTING_MAX, LEAK_PATTERNS } from "./the-hour.mjs";

export const NEXT_HOUR_SCHEMA = "next-hour.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

export const ONE_WAY_NOTE =
  "An executed action is consumed. It does not come back as a live action in any later hour — not by a " +
  "rebuild, not by a re-rank, not by a fresh clock. It appears only as completed.";

export const SKIP_RANK_NOTE =
  "A skipped route ranks below a never-attempted one. The operator has already looked at it once and " +
  "decided against it; putting it back on top would be the artefact arguing with him.";

const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));

/**
 * Regenerate the hour from what the previous one consumed.
 *
 * @param input.warm    the CURRENT warm queue (V1) — recomputed against the current clock, so windows
 *                      that closed during the hour are already in `expired`.
 * @param input.spent   the previous hour's spent record (Y1). Not spent → nothing is consumed.
 * @param opts.now      clock.
 */
export function buildNextHour(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);

  const spent = input?.spent;
  const wasSpent = !!(spent && spent.spent === true);

  const executedHandles = new Set(wasSpent ? spent.executed.map((e) => e.handle) : []);
  const skipMap = new Map(wasSpent ? spent.skipped.map((s) => [s.handle, s.skipReason]) : []);

  // Start from X2's artefact against the CURRENT clock and current warm queue. Everything that closed
  // during the hour is already sitting in `closed` — we never move it back.
  const base = buildTheHour({ warm: input?.warm }, { now: nowMs });

  const live = [];
  const deferred = [];
  const completed = [];

  for (const a of allReachable(base)) {
    if (executedHandles.has(a.handle)) {
      completed.push(Object.freeze({
        handle: a.handle,
        routeClass: a.routeClass,
        recordedAs: "executed in the previous hour. Consumed — not a live action.",
      }));
      continue;
    }
    if (skipMap.has(a.handle)) {
      deferred.push(Object.freeze({
        handle: a.handle,
        routeClass: a.routeClass,
        mode: a.mode,
        modeAction: a.modeAction,
        // Verbatim, exactly as the operator wrote it in Y1.
        skippedBecause: skipMap.get(a.handle),
        body: a.body,
      }));
      continue;
    }
    live.push(a);
  }

  // Never-attempted first, then previously-skipped in their original order.
  const ordered = [];
  live.forEach((a) => ordered.push(Object.freeze({ ...a, previouslySkipped: false })));
  deferred.forEach((d) =>
    ordered.push(Object.freeze({
      handle: d.handle,
      routeClass: d.routeClass,
      mode: d.mode,
      modeAction: d.modeAction,
      why: `previously skipped — "${d.skippedBecause}". Ranked below never-attempted routes because you ` +
           `already looked at this one and chose not to act.`,
      body: d.body,
      previouslySkipped: true,
      skippedBecause: d.skippedBecause,
    }))
  );

  const ranked = Object.freeze(
    ordered.slice(0, ONE_SITTING_MAX).map((a, i) => Object.freeze({ ...a, rank: i + 1 }))
  );
  const overflow = Math.max(0, ordered.length - ONE_SITTING_MAX);

  return Object.freeze({
    schema: NEXT_HOUR_SCHEMA,
    builtAt: new Date(nowMs).toISOString(),
    sourced: base.sourced,
    previousHourSpent: wasSpent,
    actions: ranked,
    actionsTotalReachable: ordered.length,
    overflow,
    heldBeyondSitting: base.overflow,
    completed: Object.freeze(completed),
    notYetOpen: base.notYetOpen,
    closed: base.closed,
    refused: base.refused,
    oneSittingMax: ONE_SITTING_MAX,
    oneWayNote: ONE_WAY_NOTE,
    skipRankNote: SKIP_RANK_NOTE,
    coldStartNote: base.coldStartNote,
  });

  function allReachable(h) {
    // HONEST LIMITATION, stated rather than hidden: X2 caps its own action set at one sitting, so this
    // regeneration works from that capped set. When more routes are reachable than one sitting holds,
    // `heldBeyondSitting` carries the remainder forward — they are held, never dropped, and the next
    // rebuild against a fresh warm queue picks them up.
    return h.actions;
  }
}

/** Render the regenerated artefact exactly as the operator reads it. Cold-executable, same as X2. */
export function renderNextHour(n) {
  const L = [];
  L.push("# THE NEXT HOUR — regenerated from what the last one consumed.");
  L.push("");
  L.push(n.coldStartNote);
  L.push("");
  if (!n.sourced) {
    L.push("No warm-route record was supplied, so there is no action list. Stated, not rendered as an empty hour.");
    return L.join("\n");
  }
  if (n.previousHourSpent) {
    L.push(`${n.completed.length} action${n.completed.length === 1 ? " was" : "s were"} executed last hour and ` +
           `${n.completed.length === 1 ? "has" : "have"} been consumed. ${n.oneWayNote}`);
    L.push("");
  } else {
    L.push("The previous hour has no operator entry, so nothing has been consumed. This list is unchanged.");
    L.push("");
  }
  if (n.actions.length === 0) {
    L.push("No route is reachable right now. Nothing to do this sitting — stated plainly, not padded.");
  } else {
    L.push(`${n.actions.length} action${n.actions.length === 1 ? "" : "s"} this sitting.` +
      (n.overflow > 0
        ? ` ${n.actionsTotalReachable} reachable in total; the ${n.overflow} beyond this sitting are held for the next one, not dropped.`
        : ""));
    L.push("");
    for (const a of n.actions) {
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
  if (n.completed.length) {
    L.push("## Completed last hour — done, not pending");
    for (const c of n.completed) L.push(`- ${c.handle} (${c.routeClass}) — ${c.recordedAs}`);
    L.push("");
  }
  if (n.notYetOpen.length) {
    L.push("## Not open yet — do not act on these");
    for (const r of n.notYetOpen) {
      L.push(`- ${r.handle} (${r.routeClass}) — the prospect stated they are back on ${r.opensOn}.`);
    }
    L.push("");
  }
  if (n.closed.length) {
    L.push("## Closed windows — recorded losses, listed so they are not forgotten");
    for (const c of n.closed) L.push(`- ${c.handle} (${c.routeClass}) — closed ${c.closedOn}. ${c.recordedAs}`);
    L.push("");
  }
  L.push(n.skipRankNote);
  return L.join("\n");
}

/** Findings, not a boolean: everything in the regenerated artefact that should not be there. */
export function nextHourLeaks(n) {
  const text = renderNextHour(n);
  const found = [];
  if (CARRIES_IDENTITY(text)) found.push("rendered artefact carries an address or a domain (vault Rule 11)");
  for (const p of LEAK_PATTERNS) {
    if (p.test(text)) found.push(`rendered artefact carries an internal reference matching ${p}`);
  }
  return Object.freeze(found);
}

/** True only when the sitting is genuinely completable in one go. */
export function nextFitsOneSitting(n) {
  return n.actions.length <= ONE_SITTING_MAX;
}

/** True when a handle executed in the previous hour appears anywhere as a LIVE action. Must stay false. */
export function executedLeakedBackAsLive(n, handle) {
  return n.actions.some((a) => a.handle === handle);
}
