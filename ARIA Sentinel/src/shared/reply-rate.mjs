// reply-rate.mjs — RUN-V V3: REPLY-RATE AS THE SIXTH NUMBER.
//
// WHY (RUN-V, 2026-07-29): when the second messages (V2) go out, ONE number says whether they worked:
// how many replies and meetings each hundred sends produced. It is computed from the SAME U1 mail record
// and nothing else, so it inherits U1's immunity — software progress cannot move it — and it must be
// incapable of flattering us.
//
// Honesty invariants (Rule 14), inherited from and consistent with U1:
//   - COMPUTED FROM THE MAIL RECORD ONLY. Inputs are U1's own counters. No sequence, suite, commit or
//     merge can move the ratio. A test proves the ratio changes ONLY when the mail record changes.
//   - `unverified` PRESERVED AS A DISTINCT STATE. No mail source read → the ratio is `unverified`, not 0.
//   - DIVIDE BY ZERO RENDERS `not established`, NEVER 0. Zero sends does not mean a 0% reply rate — it
//     means the rate is not established yet. 0/0 flattering as "0%" is the exact class of lie U1 killed.
//   - PURE + ADDITIVE (Rule 15). No fs, no net; extends the surface, replaces nothing.
import { buildOutboundTruth, NEVER, UNVERIFIED, OUTBOUND_TRUTH_SCHEMA } from "./outbound-truth.mjs";

export const REPLY_RATE_SCHEMA = "reply-rate.v1";
export const NOT_ESTABLISHED = "not established";

/** Read a counter's real number, or a symbolic state. Mirrors outboundFacts' `v`. */
function num(counter) {
  if (!counter || !counter.sourced) return UNVERIFIED;
  if (counter.state === NEVER) return 0;      // never happened → a true zero in the numerator
  return counter.everTotal ?? counter.value;  // use the all-time total for a rate, not just the window
}

/**
 * Compute reply-rate facts from an outbound-truth object (U1) or a raw mail record.
 * @param input  an object returned by buildOutboundTruth, OR a raw record (we build the truth ourselves).
 */
export function replyRateFacts(input = {}, { now = Date.now() } = {}) {
  const truth = input && input.schema === OUTBOUND_TRUTH_SCHEMA
    ? input
    : buildOutboundTruth(input, { now });

  const sent = num(truth.counters.sent);
  const personal = num(truth.counters.personalReplies);
  const meetings = num(truth.counters.meetingsBooked);

  // No mail read at all → the whole surface is unverified, not zero.
  if (sent === UNVERIFIED) {
    return Object.freeze({
      schema: REPLY_RATE_SCHEMA,
      sourced: false,
      repliesPerHundredSent: UNVERIFIED,
      meetingsPerHundredSent: UNVERIFIED,
      basis: { sent: UNVERIFIED, personalReplies: UNVERIFIED, meetingsBooked: UNVERIFIED },
      note: "No mail source was read. A rate with no denominator read is unverified, which is not 0%.",
    });
  }

  // Denominator of zero → not established. NEVER 0%.
  const per100 = (numerator) => {
    if (sent === 0) return NOT_ESTABLISHED;
    const n = numerator === UNVERIFIED ? 0 : numerator;
    return Math.round((n / sent) * 1000) / 10; // one decimal place
  };

  return Object.freeze({
    schema: REPLY_RATE_SCHEMA,
    sourced: true,
    repliesPerHundredSent: per100(personal),
    meetingsPerHundredSent: per100(meetings),
    basis: Object.freeze({
      sent,
      personalReplies: personal === UNVERIFIED ? 0 : personal,
      meetingsBooked: meetings === UNVERIFIED ? 0 : meetings,
    }),
    note:
      sent === 0
        ? "Zero sends read: the reply rate is not established, not 0%. It becomes a number only when the mail record shows a send."
        : "Replies and meetings per hundred sends, from the mail record only. Immune to software progress — the ratio moves only when the mail moves.",
  });
}

/** Plain-words rendering for the three surfaces. */
export function replyRateMarkdown(rr) {
  const say = (x) => (x === UNVERIFIED ? "unverified" : x === NOT_ESTABLISHED ? "not established" : `${x} per 100 sent`);
  return [
    "## Reply rate, from the mail record",
    `- Personal replies: ${say(rr.repliesPerHundredSent)}`,
    `- Meetings booked: ${say(rr.meetingsPerHundredSent)}`,
    rr.note,
  ].join("\n");
}
