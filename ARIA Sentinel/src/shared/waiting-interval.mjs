// waiting-interval.mjs — RUN-Z Z1: WHEN THE NEXT HOUR IS WORTH SITTING DOWN FOR — COMPUTED, NEVER CHOSEN.
//
// WHY (RUN-Z, 2026-07-29): RUN-X made the first hour executable cold and RUN-Y made it consumable. Both
// assume the hour is spent ONCE. What actually happens after a first hour is a handful of sends, a couple
// of skips, and then silence for several days. At that point the program either goes quiet (and the
// operator forgets it exists) or it manufactures a reason to act (and the operator stops trusting it).
// Both end the same way.
//
// This module answers exactly one question — "is today worth sitting down for?" — from real dates only.
//
// Honesty invariants (Rule 14):
//   - IT MUST BE ABLE TO SAY NO. A module that always produces a reason to act is a module that invents
//     one. `nothing today` is a first-class, fully-supported answer and is rendered plainly.
//   - NO INVENTED CADENCE. There is no "follow up in 3 days" default, no nudge interval, no decay curve.
//     A date is actionable only because a prospect stated it or a window is closing. A test asserts that
//     an empty set of real dates yields `nothing today` and NOT a manufactured interval.
//   - `unverified` != `nothing today`. Not knowing whether there is anything to do is a different fact
//     from knowing there is nothing to do. The two never collapse.
//   - NO URGENCY LANGUAGE. Nothing here may say now/urgent/act fast/don't miss/last chance. A test greps
//     every rendered line for a manufactured-urgency vocabulary and fails on a hit.
//   - NO IDENTITY (vault Rule 11). Opaque handles only.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence, nothing replaced.

export const WAITING_INTERVAL_SCHEMA = "waiting-interval.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;
export const INVENTS_CADENCE = false;

export const NOTHING_TODAY = "nothing today";
export const UNVERIFIED = "unverified";

export const NOTHING_TODAY_LINE =
  "Nothing is worth sitting down for today. No prospect-stated date opens today, nothing closes today, " +
  "and no route is reachable that was not already looked at. This is the honest answer, not an empty list.";

export const UNVERIFIED_LINE =
  "No warm-route record was supplied, so whether today is worth sitting down for is unverified. That is " +
  "not the same as knowing there is nothing to do.";

export const NO_CADENCE_NOTE =
  "There is no default interval in this program. No follow-up-in-three-days, no weekly nudge, no decay " +
  "curve. A date appears below only because a prospect stated it or because a window they opened is " +
  "closing. If no real date supports acting, the answer is that there is nothing to do.";

/** Manufactured-urgency vocabulary. Nothing this module renders may contain any of it. */
export const URGENCY_PATTERNS = Object.freeze([
  /\burgent\b/i, /\bact (now|fast|today)\b/i, /\blast chance\b/i, /\bdon'?t miss\b/i,
  /\bhurry\b/i, /\brunning out\b/i, /\bfinal (call|notice)\b/i, /\bimmediately\b/i,
  /\bcritical\b/i, /\bASAP\b/,
]);

/** Reasons a date can be real. Each is a fact somebody else created, never one we invented. */
export const REAL_REASONS = Object.freeze([
  "a prospect stated they are back on this date",
  "a window a prospect opened closes on this date",
  "a route was handed back with no date and has never been actioned",
]);

const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));
const DAY = 86400000;
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Compute whether today is worth sitting down for.
 *
 * @param input.warm    the CURRENT warm queue (V1). Absent → `unverified`.
 * @param input.spent   previous spent-hour records (Y1), newest last. Absent → nothing consumed.
 * @param opts.now      clock.
 */
export function buildWaitingInterval(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);
  const today = dayKey(nowMs);

  const warm = input?.warm;
  const sourced = !!(warm && Array.isArray(warm.queue) && Array.isArray(warm.expired));

  const spentList = Array.isArray(input?.spent) ? input.spent.filter((s) => s && s.spent === true) : [];
  const actioned = new Set();
  for (const s of spentList) {
    for (const e of s.executed || []) actioned.add(e.handle);
    for (const k of s.skipped || []) actioned.add(k.handle);
  }

  const lastSatDown = spentList.length
    ? spentList.map((s) => s.spentAt).filter((v) => typeof v === "string" && v !== UNVERIFIED).pop() || UNVERIFIED
    : UNVERIFIED;

  if (!sourced) {
    return Object.freeze({
      schema: WAITING_INTERVAL_SCHEMA,
      computedAt: new Date(nowMs).toISOString(),
      state: UNVERIFIED,
      worthSittingToday: false,
      today,
      lastSatDown,
      reasonsToday: Object.freeze([]),
      nextRealDate: UNVERIFIED,
      daysUntilNextRealDate: UNVERIFIED,
      upcoming: Object.freeze([]),
      noCadenceNote: NO_CADENCE_NOTE,
      line: UNVERIFIED_LINE,
    });
  }

  const reasonsToday = [];
  const upcoming = [];

  for (const r of warm.queue) {
    if (actioned.has(r.handle)) continue;

    const opensRaw = r.replyPossibleFrom;
    const opensMs = typeof opensRaw === "string" ? Date.parse(opensRaw) : NaN;

    if (Number.isFinite(opensMs)) {
      if (opensMs <= nowMs) {
        reasonsToday.push(Object.freeze({
          handle: r.handle,
          routeClass: r.routeClass,
          realDate: opensRaw,
          because: REAL_REASONS[0],
        }));
      } else {
        upcoming.push(Object.freeze({
          handle: r.handle,
          routeClass: r.routeClass,
          realDate: opensRaw,
          daysAway: Math.ceil((opensMs - nowMs) / DAY),
          because: REAL_REASONS[0],
        }));
      }
      continue;
    }

    // No date stated by the prospect. Reachable, and never looked at — that is a real reason, and it is
    // the ONLY reason in this module that is not a calendar date. It is not a cadence: it does not repeat.
    if (r.reachableNow) {
      reasonsToday.push(Object.freeze({
        handle: r.handle,
        routeClass: r.routeClass,
        realDate: UNVERIFIED,
        because: REAL_REASONS[2],
      }));
    }
  }

  upcoming.sort((a, b) => Date.parse(a.realDate) - Date.parse(b.realDate));

  const nextRealDate = upcoming.length ? upcoming[0].realDate : NOTHING_TODAY;
  const daysUntil = upcoming.length ? upcoming[0].daysAway : NOTHING_TODAY;
  const worth = reasonsToday.length > 0;

  const line = worth
    ? `${reasonsToday.length} route${reasonsToday.length === 1 ? " is" : "s are"} supported by a real date ` +
      `today. Each one is listed with the date that put it there.`
    : upcoming.length
      ? `${NOTHING_TODAY_LINE} The next date supported by anything real is ${upcoming[0].realDate} ` +
        `(${upcoming[0].daysAway} day${upcoming[0].daysAway === 1 ? "" : "s"} away).`
      : NOTHING_TODAY_LINE;

  return Object.freeze({
    schema: WAITING_INTERVAL_SCHEMA,
    computedAt: new Date(nowMs).toISOString(),
    state: worth ? "worth sitting down" : NOTHING_TODAY,
    worthSittingToday: worth,
    today,
    lastSatDown,
    reasonsToday: Object.freeze(reasonsToday),
    nextRealDate,
    daysUntilNextRealDate: daysUntil,
    upcoming: Object.freeze(upcoming),
    noCadenceNote: NO_CADENCE_NOTE,
    line,
  });
}

/** Render exactly what the operator reads. Cold — no prior reading required. */
export function renderWaitingInterval(w) {
  const L = [];
  L.push("# IS TODAY WORTH SITTING DOWN FOR?");
  L.push("");
  L.push(w.line);
  L.push("");
  if (w.state === UNVERIFIED) {
    L.push(w.noCadenceNote);
    return L.join("\n");
  }
  if (w.reasonsToday.length) {
    L.push("## Supported by a real date today");
    for (const r of w.reasonsToday) {
      L.push(`- ${r.handle} (${r.routeClass}) — ${r.because}` +
        (r.realDate === UNVERIFIED ? ", and no date was ever stated." : `: ${r.realDate}.`));
    }
    L.push("");
  }
  if (w.upcoming.length) {
    L.push("## Dates that open later — not today, and not a cadence");
    for (const u of w.upcoming) {
      L.push(`- ${u.handle} (${u.routeClass}) — ${u.because}: ${u.realDate} (${u.daysAway} day${u.daysAway === 1 ? "" : "s"} away).`);
    }
    L.push("");
  }
  L.push(w.noCadenceNote);
  return L.join("\n");
}

/** Findings, not a boolean: manufactured urgency or identity anywhere in the rendered output. */
export function waitingIntervalLeaks(w) {
  const text = renderWaitingInterval(w);
  const found = [];
  if (CARRIES_IDENTITY(text)) found.push("rendered output carries an address or a domain (vault Rule 11)");
  for (const p of URGENCY_PATTERNS) {
    if (p.test(text)) found.push(`rendered output carries manufactured urgency matching ${p}`);
  }
  return Object.freeze(found);
}

/** Flat fact set for the AXIS feed / ledger. States and counts only, no identity. */
export function waitingIntervalFacts(w) {
  return Object.freeze({
    schema: WAITING_INTERVAL_SCHEMA,
    state: w.state,
    worthSittingToday: w.worthSittingToday,
    reasonsToday: w.reasonsToday.length,
    nextRealDate: w.nextRealDate,
    lastSatDown: w.lastSatDown,
  });
}
