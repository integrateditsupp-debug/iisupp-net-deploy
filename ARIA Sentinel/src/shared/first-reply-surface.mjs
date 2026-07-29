// first-reply-surface.mjs — RUN-W W3: FIRST-ANSWERED-REPLY AS THE SURFACE HEADLINE, HONESTLY.
//
// WHY (RUN-W, 2026-07-29): W1 records a reply and W2 stops a rung being rounded up. W3 is the part
// that faces outward. Three surfaces read this program — the public AXIS status feed, PROGRESS-LEDGER,
// and the operator brief — and historically each phrased the same state in its own words, which is how
// a drift becomes a lie in one place and stays true in the other two.
//
// W3 renders ALL THREE from one object, and makes the surface structurally incapable of claiming a
// rung the mail record does not reach. Until a real reply exists the headline says so plainly, and
// that is a true state rather than a failure to hide.
//
// Honesty invariants (Rule 14):
//   - ONE TRUTH, THREE SURFACES. feed / ledger / brief are three renderings of one facts object.
//     A drift is a TEST FAILURE, matching the O3 contract already in ledger-head.
//   - THE SURFACE CANNOT OUTRUN THE EVIDENCE. A test asserts that with a mail record containing no
//     reply, no meeting and no revenue, NONE of the three renderings contains a claim of any of them.
//   - PUBLIC-SAFE BY CONSTRUCTION. The feed rendering is scanned against the same leak classes the
//     AXIS emitter enforces — no handle, no internal path, no branch name, no operator script, no
//     software-progress count. Detail stays operator-internal.
//   - NO TREND LANGUAGE OVER A ZERO SERIES. No "momentum", "growing", "accelerating", "on track"
//     while the ladder's top rung is unreached.
//   - PURE + ADDITIVE (Rule 15). No fs, no net. New surface; edits and replaces nothing.
import {
  buildOutcomeLadder, outcomeLadderFacts, ladderHeadline, outcomeLadderMarkdown,
  OUTCOME_LADDER_SCHEMA, NOT_REACHED, RUNGS,
} from "./outcome-ladder.mjs";
import { buildReplyCapture, replyCaptureMarkdown, REPLY_CAPTURE_SCHEMA, NO_REPLY_YET } from "./reply-capture.mjs";

export const FIRST_REPLY_SURFACE_SCHEMA = "first-reply-surface.v1";

export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;

/** Words that imply motion. Banned outright while the top rung is unreached. */
export const TREND_WORDS = Object.freeze([
  "momentum", "accelerating", "growing", "ramping", "trending", "on track", "picking up", "traction",
]);

/** Claim phrases the surface must never emit without the matching rung's own evidence. */
export const RUNG_CLAIMS = Object.freeze({
  sent:    ["messages sent", "we sent", "outreach went out"],
  replied: ["replied", "a prospect replied", "first reply"],
  meeting: ["meeting booked", "booked a meeting", "call scheduled"],
  revenue: ["revenue received", "first dollar", "paying customer"],
});

/** The honest headline when nothing above `drafted` is evidenced. Stated plainly, not hidden. */
export const NOT_YET_HEADLINE =
  "The second message is drafted and staged; no warm route has replied yet. Sending it is a human " +
  "click. Meetings booked: 0. Revenue to date: none.";

export function buildFirstReplySurface(input = {}, { now = Date.now() } = {}) {
  const ladder = input.ladder && input.ladder.schema === OUTCOME_LADDER_SCHEMA
    ? input.ladder
    : buildOutcomeLadder(input, { now });

  const rc = input.replies && input.replies.schema === REPLY_CAPTURE_SCHEMA
    ? input.replies
    : buildReplyCapture(input.replies || {}, { now, sourced: input.replies != null });

  const facts = outcomeLadderFacts(ladder);
  const replied = ladder.rungs.replied.reached;
  const topUnreached = !ladder.rungs.revenue.reached;

  // The feed headline: the highest rung reached, the rungs below it, nothing above it.
  const feed = replied || ladder.rungs.meeting.reached || ladder.rungs.revenue.reached
    ? ladderHeadline(ladder)
    : ladder.reached === NOT_REACHED
      ? "Nothing drafted, sent, replied to, booked or paid. Revenue to date: none."
      : ladder.rungs.sent.reached
        ? `${ladderHeadline(ladder)}`
        : NOT_YET_HEADLINE;

  return Object.freeze({
    schema: FIRST_REPLY_SURFACE_SCHEMA,
    facts,
    reached: ladder.reached,
    ladder,
    replyState: rc.sourced ? rc.state : "unverified",
    // Three renderings, one source.
    feedHeadline: feed,
    ledgerMarkdown: [outcomeLadderMarkdown(ladder), "", replyCaptureMarkdown(rc)].join("\n"),
    operatorBriefLines: Object.freeze([
      `Highest evidenced rung: ${ladder.reached}.`,
      `Reply state: ${rc.sourced ? rc.state : "unverified"}.`,
      ...RUNGS.map((r) => `- ${r}: ${ladder.rungs[r].state}`),
      ladder.waiting || "",
    ].filter(Boolean)),
    trendSafe: topUnreached ? "no trend language while the top rung is unreached" : null,
    builtAt: new Date(now).toISOString(),
  });
}

/** All three renderings as one array — what the drift test scans. */
export function allRenderings(s) {
  return [s.feedHeadline, s.ledgerMarkdown, ...s.operatorBriefLines];
}

/**
 * Does any rendering claim a rung the ladder has not evidenced?
 * Returns an array of violations; empty means the surface is honest. Asserted by the test.
 */
export function surfaceOverclaims(s) {
  const bad = [];
  for (const [rung, phrases] of Object.entries(RUNG_CLAIMS)) {
    if (s.ladder.rungs[rung].reached) continue; // evidenced — may be claimed
    for (const text of allRenderings(s)) {
      for (const p of phrases) {
        // "no warm route has replied yet" contains "replied" but negates it — allow explicit negations.
        const hay = String(text).toLowerCase();
        const idx = hay.indexOf(p);
        if (idx === -1) continue;
        const window = hay.slice(Math.max(0, idx - 40), idx + p.length + 12);
        if (/\b(no|not|none|never|nobody|zero|0)\b/.test(window) || /not reached|yet\b/.test(window)) continue;
        bad.push(`${rung} is ${s.ladder.rungs[rung].state} but a rendering claims "${p}"`);
      }
    }
  }
  return bad;
}

/** Trend language over an unreached top rung is banned. Returns violations; empty is clean. */
export function surfaceTrendViolations(s) {
  if (s.ladder.rungs.revenue.reached) return [];
  const bad = [];
  for (const text of allRenderings(s)) {
    const hay = String(text).toLowerCase();
    for (const w of TREND_WORDS) if (hay.includes(w)) bad.push(`trend word "${w}" over an unreached top rung`);
  }
  return bad;
}
