// reply-capture.mjs — RUN-W W1: THE REPLY-CAPTURE RECORD.
//
// WHY (RUN-W, 2026-07-29): RUN-V built everything up to the send — a ranked warm queue (V1), a
// refusable second message per route class (V2), and the reply-rate number that will report whether
// it worked (V3). It stopped exactly where it must: sending is one human writing to another.
//
// W1 catches the NEXT thing that happens, the one RUN-V could not: a warm route actually replies.
// That reply is the first raw material this program will ever have that a prospect ORIGINATED in
// response to us — not an autoresponder, not a bounce, not a return date sitting in an out-of-office.
// It is the first real two-way signal, and it must be recordable honestly the moment it exists and
// NOT ONE MOMENT BEFORE.
//
// The failure to design against here is the INVERSE of U1's. U1 caught the counters UNDERSTATING real
// activity (0 sends published during a 41-send week). W1 must stop them OVERSTATING: a drafted message
// is not a sent one, a sent one is not a reply, a reply is not a meeting, a meeting is not revenue.
//
// Honesty invariants (Rule 14 real-or-empty) + vault Rule 11:
//   - CANNOT INVENT A REPLY. With no inbound event the record renders `no reply yet` — a state
//     distinct from `0` and from `unverified`. "We are waiting" is a different fact from "we counted
//     zero" and from "we never looked".
//   - A DECLINE IS NOT SOFTENED. `declined` stays `declined`. There is no code path that promotes a
//     disposition upward, and a test asserts a decline can never render as interest.
//   - DISPOSITION IS THE PROSPECT'S WORD, NOT OURS. Five disposition states, all rejected by name if
//     unknown rather than coerced into the nearest flattering one.
//   - ELAPSED TIME IS FROM THE SECOND MESSAGE, NOT FROM THE FIRST. A reply to the second message is
//     evidence about the second message. Mis-attributing it to the original send flatters the wrong
//     artefact.
//   - OPAQUE HANDLES ONLY (Rule 11). Keyed to V1's warm-route handle. No name, address, domain or
//     company enters this module or its record; a test greps the source and fails on a hit.
//   - PURE. No fs, no net, no spawn, no persistence, no transport. Recording a reply is not replying.
//   - ADDITIVE (Rule 15). New surface; edits and replaces nothing.

export const REPLY_CAPTURE_SCHEMA = "reply-capture.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

/** The three empty-states this module keeps apart. Strings, so arithmetic breaks loudly. */
export const NO_REPLY_YET = "no reply yet";
export const UNVERIFIED = "unverified";

export const EMPTY_STATES_NOTE =
  "`no reply yet`, `0` and `unverified` are three different facts. `no reply yet` means the second " +
  "message is out and the prospect has not answered — a live, unresolved state. `0` means a window " +
  "was counted and contained no reply. `unverified` means no inbound source was read at all. " +
  "Rendering any of the three as any other is the overstatement class RUN-W exists to kill.";

/**
 * How a prospect's reply is classified. Ordered COOLEST-FIRST on purpose: nothing in this module
 * may move a reply up this list, and keeping the flattering end last makes an accidental promotion
 * visible in review.
 */
export const DISPOSITIONS = Object.freeze([
  "declined",       // a human said no. It is a real reply and it is counted as one — never softened.
  "not-now",        // deferred with no date, or a date they did not commit to
  "unclear",        // a reply we cannot honestly classify. The default — never "interested".
  "asked-for-info",  // they asked a question. Engagement, not agreement.
  "interested",     // they stated interest in their own words. The ONLY rung that may say so.
]);

/** Dispositions that must NEVER be rendered as interest, however the surface phrases things. */
export const NOT_INTEREST = Object.freeze(["declined", "not-now", "unclear"]);

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const HOUR_MS = 3600000;
// Same identity refusal U1/V1 use. Identity never enters this path.
const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));

/**
 * Normalize one inbound reply event. Refuses identity (Rule 11) and unknown dispositions
 * (rejected by name, never coerced to the nearest flattering value).
 */
export function normalizeReply(raw = {}) {
  const problems = [];

  const handle = isStr(raw.handle) ? raw.handle.trim() : null;
  if (!handle) problems.push("reply has no warm-route handle — an unattributed reply is not evidence about any route");
  else if (CARRIES_IDENTITY(handle)) problems.push("handle carries an address or domain — identity never enters this path (vault Rule 11)");

  const repliedAt = isStr(raw.repliedAt) ? Date.parse(raw.repliedAt) : NaN;
  if (!Number.isFinite(repliedAt)) problems.push("reply has no parseable `repliedAt` — an undated reply is not evidence");

  // The second message is the artefact under test. A reply with no second-message timestamp still
  // counts as a reply, but its elapsed time is unverified rather than guessed from the first send.
  const secondMessageAt = isStr(raw.secondMessageAt) ? Date.parse(raw.secondMessageAt) : NaN;

  const disposition = isStr(raw.disposition) ? raw.disposition.trim() : null;
  if (!disposition) problems.push("reply has no disposition — unclassified is not the same as unclear, and we do not guess");
  else if (!DISPOSITIONS.includes(disposition)) {
    problems.push(`unknown disposition "${disposition}" — refused rather than counted as something else`);
  }

  if (problems.length) return { ok: false, problems, reply: null };

  const hasSecond = Number.isFinite(secondMessageAt);
  const elapsedHours = hasSecond && repliedAt >= secondMessageAt
    ? Math.round(((repliedAt - secondMessageAt) / HOUR_MS) * 10) / 10
    : UNVERIFIED;

  return {
    ok: true,
    problems: [],
    reply: Object.freeze({
      handle,
      disposition,
      repliedAt,
      repliedAtISO: new Date(repliedAt).toISOString(),
      secondMessageAtISO: hasSecond ? new Date(secondMessageAt).toISOString() : null,
      // Elapsed from the SECOND message, never from the first send.
      elapsedHoursFromSecondMessage: elapsedHours,
      elapsedBasis: hasSecond
        ? "measured from the second message, the artefact this reply is evidence about"
        : "no second-message timestamp was read — elapsed is unverified, not inferred from the original send",
      // A decline is a real reply and is recorded as one. Nothing here may promote it.
      isInterest: disposition === "interested",
      countsAsReply: true,
    }),
  };
}

/**
 * Build the reply-capture state from a record of inbound replies.
 * @param record  { replies: [...] } — opaque handles only.
 * @param opts.sourced  false when no inbound source was read at all (=> `unverified`, not `no reply yet`).
 */
export function buildReplyCapture(record = {}, { now = Date.now(), sourced = true } = {}) {
  const raw = Array.isArray(record.replies) ? record.replies : null;

  // No inbound source read at all → unverified. This is NOT "no reply yet" and NOT 0.
  if (!sourced || raw === null) {
    return Object.freeze({
      schema: REPLY_CAPTURE_SCHEMA,
      sourced: false,
      state: UNVERIFIED,
      replies: Object.freeze([]),
      rejected: Object.freeze([]),
      count: UNVERIFIED,
      byDisposition: Object.freeze({}),
      firstReply: null,
      note: "No inbound source was read. Whether a warm route replied is unknown, which is not the same as no reply and not the same as zero.",
      emptyStates: EMPTY_STATES_NOTE,
      readAt: new Date(now).toISOString(),
    });
  }

  const accepted = [];
  const rejected = [];
  for (const r of raw) {
    const n = normalizeReply(r);
    if (n.ok) accepted.push(n.reply);
    else rejected.push(Object.freeze({ problems: n.problems }));
  }

  accepted.sort((a, b) => a.repliedAt - b.repliedAt);

  const byDisposition = {};
  for (const d of DISPOSITIONS) byDisposition[d] = 0;
  for (const r of accepted) byDisposition[r.disposition] += 1;

  const state = accepted.length === 0 ? NO_REPLY_YET : "replied";

  return Object.freeze({
    schema: REPLY_CAPTURE_SCHEMA,
    sourced: true,
    state,
    replies: Object.freeze(accepted),
    rejected: Object.freeze(rejected),
    count: accepted.length,
    byDisposition: Object.freeze(byDisposition),
    // The first prospect-originated reply this program has ever held, or null until one exists.
    firstReply: accepted[0] || null,
    note: accepted.length === 0
      ? "The inbound source was read and contains no reply to a warm route. The second message is out or staged; the prospect has not answered yet."
      : `${accepted.length} prospect-originated repl${accepted.length === 1 ? "y" : "ies"} recorded. Declines are counted as replies and are never rendered as interest.`,
    emptyStates: EMPTY_STATES_NOTE,
    readAt: new Date(now).toISOString(),
  });
}

/** Flat facts for surface rendering. One truth, many surfaces. */
export function replyCaptureFacts(rc) {
  return Object.freeze({
    state: rc.state,
    sourced: rc.sourced,
    count: rc.count,
    interested: rc.sourced ? rc.byDisposition.interested : UNVERIFIED,
    declined: rc.sourced ? rc.byDisposition.declined : UNVERIFIED,
    firstReplyAt: rc.firstReply ? rc.firstReply.repliedAtISO : null,
    firstReplyDisposition: rc.firstReply ? rc.firstReply.disposition : null,
  });
}

/** Plain-words rendering. Never claims a reply the record does not hold. */
export function replyCaptureMarkdown(rc) {
  const lines = ["## The first answered reply"];
  if (!rc.sourced) {
    lines.push(`- Status: ${UNVERIFIED} — no inbound source was read.`);
  } else if (rc.state === NO_REPLY_YET) {
    lines.push(`- Status: ${NO_REPLY_YET}. The second message is drafted and staged; no warm route has replied.`);
  } else {
    lines.push(`- Replies from warm routes: ${rc.count}`);
    for (const d of DISPOSITIONS) {
      if (rc.byDisposition[d] > 0) lines.push(`- ${d}: ${rc.byDisposition[d]}`);
    }
    const f = rc.firstReply;
    lines.push(`- First reply: ${f.disposition}, ${f.elapsedHoursFromSecondMessage === UNVERIFIED
      ? "elapsed unverified"
      : `${f.elapsedHoursFromSecondMessage}h after the second message`}.`);
  }
  lines.push(rc.note);
  return lines.join("\n");
}
