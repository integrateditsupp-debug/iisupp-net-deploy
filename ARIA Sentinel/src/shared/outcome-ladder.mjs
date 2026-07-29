// outcome-ladder.mjs — RUN-W W2: THE OUTCOME LADDER, ONE-WAY.
//
// WHY (RUN-W, 2026-07-29): every surface in this program wants to report the best thing that happened.
// That instinct is exactly how a drafted message becomes "outreach", how a send becomes "engagement",
// how a reply becomes "a conversation", and how a conversation becomes "pipeline". Each of those is a
// lie built by rounding one rung up to the next, and each one was available to us this week.
//
// W2 makes the rounding structurally impossible. Five rungs — drafted → sent → replied → meeting →
// revenue — each a SEPARATE, EVIDENCED state. Evidence for a lower rung leaves every higher rung
// untouched, and the ladder reads from the mail record (U1) and the reply record (W1) only. Software
// progress — sequences, suites, commits, merges — is not an accepted input at any rung.
//
// Honesty invariants (Rule 14):
//   - ONE-WAY. There is no code path that infers a higher rung from a lower one. `reached` is computed
//     as the HIGHEST rung with its OWN evidence, and a test asserts that adding drafted/sent evidence
//     leaves replied/meeting/revenue byte-identical.
//   - A DRAFT IS NOT A SEND. The single most available lie this cycle: RUN-V drafted twelve second
//     messages and sent none. `drafted` renders as drafted, forever, until a send event exists.
//   - EVERY RUNG CITES ITS OWN EVIDENCE KIND. A rung with no evidence renders `not reached`, never 0
//     and never "pending" — pending implies motion nobody has caused.
//   - IMMUNITY, INHERITED FROM U1/T2. `sequencesCompleted`, `tasksMerged`, `testsGreen`, `commits`,
//     `merges` are accepted in the input object and DISCARDED. A test deep-equals the ladder before
//     and after injecting them.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport. New surface; replaces nothing.
import { buildOutboundTruth, OUTBOUND_TRUTH_SCHEMA, NEVER, UNVERIFIED } from "./outbound-truth.mjs";
import { buildReplyCapture, REPLY_CAPTURE_SCHEMA, NO_REPLY_YET } from "./reply-capture.mjs";

export const OUTCOME_LADDER_SCHEMA = "outcome-ladder.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;

export const NOT_REACHED = "not reached";

/** The ladder, lowest rung first. Order is the whole point: index N may never be read as index N+1. */
export const RUNGS = Object.freeze(["drafted", "sent", "replied", "meeting", "revenue"]);

/** What each rung is, and — more usefully — what it is NOT. Rendered on the surfaces verbatim. */
export const RUNG_MEANING = Object.freeze({
  drafted: "A message exists as text. Nobody has received it. A draft is not outreach.",
  sent:    "A message left the mailbox. Nobody has answered it. A send is not a conversation.",
  replied: "A prospect typed a reply, whatever it said. A decline is a reply. A reply is not a meeting.",
  meeting: "A prospect committed to a real calendar slot. A meeting is not revenue.",
  revenue: "Money was actually received. This is the only rung that is a dollar.",
});

/** Inputs that are software progress and are DISCARDED at the door (U1/T2 immunity). */
export const DISCARDED_INPUTS = Object.freeze([
  "sequencesCompleted", "tasksMerged", "testsGreen", "commits", "merges",
  "suitesGreen", "filesChanged", "runsCompleted",
]);

export const IMMUNITY_NOTE =
  "Only mail and reply evidence move this ladder. Sequences, suites, commits, merges and run counts " +
  "are accepted as input keys and discarded unread, so shipping software is structurally incapable of " +
  "raising a rung. A test injects all of them and deep-equals the ladder before and after.";

export const ONE_WAY_NOTE =
  "Each rung carries its own evidence. A lower rung is never rendered as a higher one: a drafted " +
  "message shows as drafted, never as sent; a reply shows as replied, never as a booked meeting. " +
  "There is no inference upward anywhere in this module.";

const n = (counter) => {
  if (!counter || !counter.sourced) return UNVERIFIED;
  if (counter.state === NEVER) return 0;
  return counter.everTotal ?? counter.value ?? 0;
};

/**
 * Build the ladder.
 * @param input.mail      raw mail record, or an object already built by buildOutboundTruth (U1)
 * @param input.replies   raw reply record, or an object already built by buildReplyCapture (W1)
 * @param input.drafted   count of drafted second messages (V2 output length). Drafts only ever
 *                        evidence the `drafted` rung — never `sent`.
 * Any DISCARDED_INPUTS key present on `input` is ignored.
 */
export function buildOutcomeLadder(input = {}, { now = Date.now() } = {}) {
  const mail = input.mail && input.mail.schema === OUTBOUND_TRUTH_SCHEMA
    ? input.mail
    : buildOutboundTruth(input.mail || {}, { now });

  const rc = input.replies && input.replies.schema === REPLY_CAPTURE_SCHEMA
    ? input.replies
    : buildReplyCapture(input.replies || {}, { now, sourced: input.replies != null });

  const draftedCount = Number.isInteger(input.drafted) && input.drafted >= 0 ? input.drafted : 0;

  const sent = n(mail.counters.sent);
  const meetings = n(mail.counters.meetingsBooked);
  const revenue = n(mail.counters.revenue);

  // Each rung is computed from ITS OWN evidence only. No rung reads the rung below it.
  const rungs = {
    drafted: rung("drafted", draftedCount, "a drafted message (V2), which nobody has received"),
    sent:    rung("sent", sent, "a send event in the mail record"),
    replied: rung("replied",
                  rc.sourced ? rc.count : UNVERIFIED,
                  "a prospect-originated reply in the reply record (W1)"),
    meeting: rung("meeting", meetings, "a meeting-booked event in the mail record"),
    revenue: rung("revenue", revenue, "a revenue event in the mail record"),
  };

  // `reached` = the HIGHEST rung that has its own evidence. Never inferred from a neighbour.
  let reached = NOT_REACHED;
  for (const name of RUNGS) {
    if (rungs[name].reached) reached = name;
  }

  const waiting =
    reached === "sent" && rc.sourced && rc.state === NO_REPLY_YET
      ? "The second message is out and no warm route has replied yet."
      : reached === "drafted"
        ? "The second message is drafted and staged. Sending it is a human click; nothing has been sent."
        : null;

  return Object.freeze({
    schema: OUTCOME_LADDER_SCHEMA,
    reached,
    rungs: Object.freeze(rungs),
    order: RUNGS,
    waiting,
    meanings: RUNG_MEANING,
    oneWay: ONE_WAY_NOTE,
    immunity: IMMUNITY_NOTE,
    builtAt: new Date(now).toISOString(),
  });

  function rung(name, value, evidenceKind) {
    const unverified = value === UNVERIFIED;
    const count = unverified ? UNVERIFIED : value;
    return Object.freeze({
      name,
      // A rung is reached ONLY by its own evidence being a real, positive count.
      reached: !unverified && count > 0,
      count,
      state: unverified ? UNVERIFIED : count > 0 ? name : NOT_REACHED,
      evidenceKind,
      meaning: RUNG_MEANING[name],
    });
  }
}

/** Flat facts. One truth, three surfaces — feed, ledger and operator brief all read this. */
export function outcomeLadderFacts(l) {
  const out = { reached: l.reached };
  for (const name of RUNGS) out[name] = l.rungs[name].state;
  for (const name of RUNGS) out[`${name}Count`] = l.rungs[name].count;
  return Object.freeze(out);
}

/**
 * The one-line headline. It states the highest rung the evidence actually reaches and NOTHING above it.
 * Public-safe: no identity, no internal paths, no counts of software work.
 */
export function ladderHeadline(l) {
  const r = l.rungs;
  const say = (name) => (r[name].count === UNVERIFIED ? "unverified" : String(r[name].count));

  if (l.reached === NOT_REACHED) {
    return "Nothing has been drafted, sent, replied to, booked or paid. Revenue to date: none.";
  }
  const parts = [
    `Second messages drafted: ${say("drafted")}.`,
    `Sent: ${say("sent")}.`,
    `Prospect replies: ${say("replied")}.`,
    `Meetings booked: ${say("meeting")}.`,
    `Revenue to date: ${r.revenue.reached ? "received" : "none"}.`,
  ];
  if (l.waiting) parts.push(l.waiting);
  return parts.join(" ");
}

/** Markdown rendering for the ledger and the operator brief. Every rung, in order, with its state. */
export function outcomeLadderMarkdown(l) {
  const lines = ["## Outcome ladder — one-way, each rung evidenced separately"];
  for (const name of RUNGS) {
    const rg = l.rungs[name];
    const count = rg.count === UNVERIFIED ? "unverified" : rg.count;
    lines.push(`- **${name}**: ${rg.state} (${count}) — ${rg.meaning}`);
  }
  lines.push(`- Highest rung the evidence reaches: **${l.reached}**`);
  if (l.waiting) lines.push(`- ${l.waiting}`);
  lines.push(l.oneWay);
  return lines.join("\n");
}
