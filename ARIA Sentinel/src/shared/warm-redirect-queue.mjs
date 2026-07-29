// warm-redirect-queue.mjs — RUN-V V1: THE WARM-REDIRECT QUEUE.
//
// WHY (RUN-V, 2026-07-29): 41 sends produced 1 personal reply and 0 booked meetings, but they also
// produced something RUN-T's ranked source list could NOT contain, because it did not exist until mail
// was actually sent: a person on the other side telling us who to talk to instead. Seven autoresponders
// handed back an alternate route; six prospects stated a return date. Those are the warmest openings this
// program has ever had, and they EXPIRE. The bottleneck is no longer sending — it is the second message,
// and this module records and ranks the routes the second message should go to.
//
// Honesty invariants (Rule 14) + vault Rule 11:
//   - OPAQUE HANDLES ONLY. No name, address, domain or company enters this module or its record. Any
//     value carrying an address or a domain is refused at the door, exactly as U1 refuses it. A test
//     greps the module AND its record for an address and fails on a hit.
//   - EXPIRY IS FIRST-CLASS. A route past its useful date renders `expired` with the date it expired,
//     never silently dropped and never quietly rolled forward. An expired warm route is a recorded loss.
//   - WARMTH IS THE PROSPECT'S, NOT OURS. Each entry carries the reason it is warm in the framing the
//     prospect supplied (redirected-to-a-colleague, successor-firm, back-from-vacation, declined-keep-on-file).
//     We never invent warmth; a route with no stated reason is ranked LAST, not dressed up.
//   - PURE. No fs, no net, no spawn, no transport. Nothing here can send. A route is a record, not an action.
//   - ADDITIVE (Rule 15). New surface; edits and replaces nothing.

export const WARM_REDIRECT_SCHEMA = "warm-redirect-queue.v1";

// Belt-and-braces, asserted by the test — same contract U1 proves.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

export const EXPIRED = "expired";

/** Route classes, warmest-first. Order here IS the tie-break rank when reply-timing is equal. */
export const ROUTE_CLASSES = Object.freeze([
  "redirected-to-a-colleague", // an autoresponder named a specific person to contact instead
  "successor-firm",            // the firm moved/merged; the responder named who took over
  "back-from-vacation",        // a prospect stated a date they return — a dated re-open
  "declined-keep-on-file",     // a human declined but asked to be kept on file — a real, if cool, opening
]);

/** How a route can be reached. A phone route is NOT an email route and is never counted as one. */
export const CONTACT_MODES = Object.freeze(["email", "phone", "unknown"]);

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const DAY_MS = 86400000;
// Same address/domain refusal U1 uses. Identity never enters this path.
const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));

/** Normalize one warm route. Refuses identity (Rule 11) and unknown route classes (rejected, not coerced). */
export function normalizeRoute(raw = {}) {
  const problems = [];

  const handle = isStr(raw.handle) ? raw.handle.trim() : null;
  if (!handle) problems.push("route has no handle");
  else if (CARRIES_IDENTITY(handle)) problems.push("handle carries an address or domain — identity never enters this path (vault Rule 11)");

  const routeClass = isStr(raw.routeClass) ? raw.routeClass.trim() : null;
  if (!routeClass) problems.push("route has no routeClass");
  else if (!ROUTE_CLASSES.includes(routeClass)) problems.push(`unknown routeClass "${routeClass}" — refused rather than ranked as something else`);

  const mode = isStr(raw.mode) ? raw.mode.trim() : "unknown";
  if (!CONTACT_MODES.includes(mode)) problems.push(`unknown contact mode "${mode}"`);

  // The prospect's own reason, opaque. Refuse if it smuggles identity.
  const reason = isStr(raw.reason) ? raw.reason.trim() : null;
  if (reason && CARRIES_IDENTITY(reason)) problems.push("reason carries an address or domain (vault Rule 11)");

  // A route MAY be dated (a stated return date). Undated routes are valid but rank below dated, reachable ones.
  const replyPossibleFrom = isStr(raw.replyPossibleFrom) ? raw.replyPossibleFrom.trim() : null;
  if (replyPossibleFrom && !Number.isFinite(Date.parse(replyPossibleFrom))) {
    problems.push(`replyPossibleFrom "${raw.replyPossibleFrom}" is not a parseable date`);
  }
  // An expiry date past which the warmth is gone (e.g. a temporary redirect window).
  const expiresAfter = isStr(raw.expiresAfter) ? raw.expiresAfter.trim() : null;
  if (expiresAfter && !Number.isFinite(Date.parse(expiresAfter))) {
    problems.push(`expiresAfter "${raw.expiresAfter}" is not a parseable date`);
  }

  return {
    ok: problems.length === 0,
    problems,
    route: problems.length === 0
      ? Object.freeze({
          handle,
          routeClass,
          mode,
          reason,
          replyPossibleFrom: replyPossibleFrom || null,
          expiresAfter: expiresAfter || null,
        })
      : null,
  };
}

/**
 * Build the ranked warm-redirect queue from a mail-derived record.
 * Ranking key (soonest a reply is POSSIBLE first):
 *   1. A route reachable NOW (no future replyPossibleFrom, or one already passed) outranks a future one.
 *      Among "now" routes, a PASSED return date is the most actionable and sorts first.
 *   2. A named person with an email/phone route outranks one without a reachable mode.
 *   3. Route class order (ROUTE_CLASSES) breaks remaining ties.
 * Expired routes are separated out, never ranked into the live queue.
 */
export function buildWarmRedirectQueue(record = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);
  const sourced = isStr(record.source);

  const accepted = [];
  const rejected = [];
  for (const raw of Array.isArray(record.routes) ? record.routes : []) {
    const n = normalizeRoute(raw);
    if (n.ok) accepted.push(n.route);
    else rejected.push({ problems: n.problems });
  }

  const live = [];
  const expired = [];
  for (const r of accepted) {
    const expMs = r.expiresAfter ? Date.parse(r.expiresAfter) : null;
    if (expMs !== null && expMs < nowMs) {
      expired.push(Object.freeze({ ...r, state: EXPIRED, expiredOn: r.expiresAfter }));
      continue;
    }
    const fromMs = r.replyPossibleFrom ? Date.parse(r.replyPossibleFrom) : null;
    const reachableNow = fromMs === null || fromMs <= nowMs;
    const datePassed = fromMs !== null && fromMs <= nowMs; // a stated return date that has arrived
    const hasReachableMode = r.mode === "email" || r.mode === "phone";
    live.push(Object.freeze({
      ...r,
      state: "live",
      reachableNow,
      datePassed,
      hasReachableMode,
      replyPossibleFromMs: fromMs,
    }));
  }

  const classRank = (c) => { const i = ROUTE_CLASSES.indexOf(c); return i < 0 ? ROUTE_CLASSES.length : i; };
  live.sort((a, b) => {
    if (a.reachableNow !== b.reachableNow) return a.reachableNow ? -1 : 1;        // reachable now first
    if (a.datePassed !== b.datePassed) return a.datePassed ? -1 : 1;             // a passed return date is most actionable
    if (a.reachableNow && a.datePassed && a.replyPossibleFromMs !== b.replyPossibleFromMs) {
      return a.replyPossibleFromMs - b.replyPossibleFromMs;                       // oldest passed date first
    }
    if (a.hasReachableMode !== b.hasReachableMode) return a.hasReachableMode ? -1 : 1; // a reachable mode outranks none
    if (!a.reachableNow && b.replyPossibleFromMs !== a.replyPossibleFromMs) {
      return a.replyPossibleFromMs - b.replyPossibleFromMs;                       // soonest future date first
    }
    return classRank(a.routeClass) - classRank(b.routeClass);                     // warmest class breaks ties
  });

  return Object.freeze({
    schema: WARM_REDIRECT_SCHEMA,
    sourced,
    source: sourced ? record.source.trim() : null,
    readAt: isStr(record.readAt) ? record.readAt.trim() : null,
    queue: Object.freeze(live),
    expired: Object.freeze(expired),
    counts: Object.freeze({
      live: live.length,
      expired: expired.length,
      reachableNow: live.filter((r) => r.reachableNow).length,
      byMode: Object.freeze({
        email: live.filter((r) => r.mode === "email").length,
        phone: live.filter((r) => r.mode === "phone").length,
        unknown: live.filter((r) => r.mode === "unknown").length,
      }),
    }),
    rejected,
    note:
      "Every route here was handed back by a prospect, not generated by us. Warmth is stated in the " +
      "prospect's own terms. An expired route is a recorded loss, not a silent drop — the warm openings " +
      "expire whether or not the second message is sent, and sending stays a human click.",
  });
}

/** Flat fact set for the AXIS feed / ledger. Numbers only, no identity. */
export function warmRedirectFacts(q) {
  return Object.freeze({
    schema: WARM_REDIRECT_SCHEMA,
    liveRoutes: q.counts.live,
    reachableNow: q.counts.reachableNow,
    expiredRoutes: q.counts.expired,
    phoneRoutes: q.counts.byMode.phone,
    emailRoutes: q.counts.byMode.email,
  });
}
