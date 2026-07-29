// outbound-truth.mjs — RUN-U U1: THE COUNTERS READ THE MAIL.
//
// WHY (RUN 130, 2026-07-28): for nineteen sequences this program published `asksSent: 0`,
// `conversationsHeld: 0`, `candidates: 0` and `daysSinceHourSpent: never` — on the public AXIS feed,
// in the ledger, and out loud through the voice dock — while real outbound to real named businesses
// was already going out at volume. The numbers were false in the DOWNWARD direction, which is a
// Rule 14 failure of exactly the same class as inflation.
//
// The cause was structural, not clerical: `conversation-outcome`, `elapsed-since` and `program-truth`
// read an internal operator log that outbound was never written into. A counter that cannot be moved
// by the real activity it claims to count is not a strict counter — it is a broken one.
//
// U1 is the fix RUN 130 asked for by name: a counter whose ONLY input is the mail record itself.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - EVERY NUMBER CITES A MAIL SOURCE. A counter with no mail-derived source renders `unverified`,
//     never 0. `unverified` is a third state beside `never` and `0`, because "we did not look" is a
//     different fact from "we looked and it was zero".
//   - `never` !== `0` !== `unverified`. Three facts, three renderings, enforced by test.
//   - SOFTWARE PROGRESS CANNOT MOVE IT. Same immunity as T2: sequences, suites, commits and merges
//     are not accepted as inputs at all. Only mail events move these numbers.
//   - REPLIES ARE NOT INTEREST. An out-of-office is classified as an auto-reply and is NEVER counted
//     as a prospect reply, a conversation, a meeting or a lead. A bounce is counted as a data-quality
//     defect, not as a send that landed.
//   - SENDING IS NOT SELLING. sent/delivered/replied are reported as four SEPARATE numbers from
//     meetings booked, conversations held and revenue, so a busy outbound week can never hide a zero
//     further down the funnel. This is the failure mode RUN 130 caught and it is now structural.
//   - NO IDENTITY. Vault Rule 11: no name, address, domain or company ever enters this module or any
//     record it reads. Events carry opaque handles only. Identity stays in mail and CRM.
//   - PURE. No fs, no net, no spawn, no env, no persistence, no transport. Nothing here can send.
//   - Rule 15 additive: adds a counter and a reconciliation view. Edits and replaces nothing.

export const OUTBOUND_TRUTH_SCHEMA = "outbound-truth.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

/** Three distinct empty-states. Deliberately strings so arithmetic breaks loudly. */
export const NEVER = "never";
export const UNVERIFIED = "unverified";

export const THREE_STATES_NOTE =
  "`0`, `never` and `unverified` are three different facts and are never rendered the same way. `0` " +
  "means we read the mail and it had not happened in the window. `never` means it has not happened " +
  "once in any window. `unverified` means no mail source was read at all — the number is unknown, " +
  "not zero. Publishing 0 for unverified is how this program reported 0 sends during a 41-send week.";

export const IMMUNITY_NOTE =
  "Only mail events move these counters. Sequences, suite counts, commits, merges and ledger entries " +
  "are not accepted as inputs and cannot touch a single number here. Shipping software is structurally " +
  "incapable of making this surface look busier.";

export const SENDING_IS_NOT_SELLING_NOTE =
  "Emails sent, delivered, auto-replied and personally replied are four separate numbers, and none of " +
  "them is a meeting, a conversation or a dollar. They are reported side by side so a heavy sending " +
  "week can never stand in for a booked meeting that did not happen.";

/** Event kinds this module accepts. Anything else is rejected by name rather than silently dropped. */
export const EVENT_KINDS = Object.freeze([
  "sent",              // an outreach email left the mailbox
  "auto-reply",        // out-of-office / left-the-company / vacation autoresponder — NOT interest
  "personal-reply",    // a human being typed a reply, whatever it said
  "undeliverable",     // bounce, blocked, address not found — the send did not land
  "meeting-booked",    // a real calendar commitment from a prospect
  "conversation-held", // a real live conversation actually took place
  "revenue",           // money actually received
]);

/** Reply dispositions. A decline is a real reply and is counted as one — it is not softened. */
export const REPLY_DISPOSITIONS = Object.freeze(["declined", "interested", "referred", "unclear"]);

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const DAY_MS = 86400000;

/** Normalize one mail-derived event. Refuses anything carrying identity (Rule 11). */
export function normalizeEvent(raw = {}) {
  const problems = [];
  const kind = isStr(raw.kind) ? raw.kind.trim() : null;
  if (!kind) problems.push("event has no kind");
  else if (!EVENT_KINDS.includes(kind)) problems.push(`unknown event kind "${kind}" — refused rather than counted as something else`);

  const at = isStr(raw.at) ? Date.parse(raw.at) : NaN;
  if (!Number.isFinite(at)) problems.push("event has no parseable `at` timestamp — an undated mail event is not evidence");

  // Rule 11 guard: opaque handle only. Anything that looks like an address or a domain is refused.
  const handle = isStr(raw.handle) ? raw.handle.trim() : null;
  if (!handle) problems.push("event has no handle");
  else if (/@|\.(com|ca|net|org|gov|io|co)\b/i.test(handle)) problems.push("handle carries an address or domain — identity never enters this path (vault Rule 11)");

  const disposition = isStr(raw.disposition) ? raw.disposition.trim() : null;
  if (kind === "personal-reply" && disposition && !REPLY_DISPOSITIONS.includes(disposition)) {
    problems.push(`unknown reply disposition "${disposition}"`);
  }

  return {
    ok: problems.length === 0,
    problems,
    event: problems.length === 0
      ? Object.freeze({
          kind,
          at,
          atISO: new Date(at).toISOString(),
          handle,
          disposition: kind === "personal-reply" ? (disposition || "unclear") : null,
          // Optional, all non-identifying:
          redirectOffered: raw.redirectOffered === true,     // the autoresponder named someone else to contact
          returnDate: isStr(raw.returnDate) ? raw.returnDate.trim() : null, // prospect-stated, expires
          reason: isStr(raw.reason) ? raw.reason.trim() : null,
        })
      : null,
  };
}

/**
 * Build the outbound truth from a mail-derived record.
 * @param record {{source?:string, readAt?:string, windowDays?:number, events?:Array}}
 *   `source` names WHERE the numbers were read from. With no source, every counter is `unverified`.
 */
export function buildOutboundTruth(record = {}, { now = Date.now(), windowDays = 3 } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);
  const sourced = isStr(record.source);
  const win = Number.isFinite(record.windowDays) ? record.windowDays : windowDays;
  const cutoff = nowMs - win * DAY_MS;

  const accepted = [];
  const rejected = [];
  for (const raw of Array.isArray(record.events) ? record.events : []) {
    const n = normalizeEvent(raw);
    if (n.ok) accepted.push(n.event);
    else rejected.push({ problems: n.problems });
  }

  const inWindow = (k) => accepted.filter((e) => e.kind === k && e.at >= cutoff).length;
  const everCount = (k) => accepted.filter((e) => e.kind === k).length;
  const latest = (k) => {
    const hits = accepted.filter((e) => e.kind === k).map((e) => e.at);
    return hits.length ? Math.max(...hits) : null;
  };

  /** A counter is `unverified` with no source, `never` if it has never happened, else the number. */
  const counter = (kind) => {
    if (!sourced) return { value: UNVERIFIED, state: UNVERIFIED, sourced: false };
    const ever = everCount(kind);
    if (ever === 0) return { value: 0, state: NEVER, everHappened: false, sourced: true };
    return { value: inWindow(kind), state: "counted", everHappened: true, sourced: true, everTotal: ever };
  };

  const daysSince = (kind) => {
    if (!sourced) return UNVERIFIED;
    const last = latest(kind);
    if (last === null) return NEVER;
    return Math.max(0, Math.floor((nowMs - last) / DAY_MS));
  };

  const counters = {
    sent: counter("sent"),
    undeliverable: counter("undeliverable"),
    autoReplies: counter("auto-reply"),
    personalReplies: counter("personal-reply"),
    meetingsBooked: counter("meeting-booked"),
    conversationsHeld: counter("conversation-held"),
    revenue: counter("revenue"),
  };

  const sentInWindow = sourced ? inWindow("sent") : null;
  const bouncedInWindow = sourced ? inWindow("undeliverable") : null;
  const delivered = sourced ? Math.max(0, sentInWindow - bouncedInWindow) : UNVERIFIED;

  // Free, warm, and generated BY the sending — the source T1's ranked list could not contain because
  // it did not exist until mail was actually sent.
  const warmRedirects = accepted.filter((e) => e.kind === "auto-reply" && e.redirectOffered).length;
  const returnDates = accepted
    .filter((e) => isStr(e.returnDate))
    .map((e) => ({ handle: e.handle, returnDate: e.returnDate }))
    .sort((a, b) => String(a.returnDate).localeCompare(String(b.returnDate)));

  return Object.freeze({
    schema: OUTBOUND_TRUTH_SCHEMA,
    sourced,
    source: sourced ? record.source.trim() : null,
    readAt: isStr(record.readAt) ? record.readAt.trim() : null,
    windowDays: win,
    counters,
    delivered,
    warmRedirects: sourced ? warmRedirects : UNVERIFIED,
    returnDates: sourced ? returnDates : [],
    daysSince: {
      sent: daysSince("sent"),
      personalReply: daysSince("personal-reply"),
      meetingBooked: daysSince("meeting-booked"),
      conversationHeld: daysSince("conversation-held"),
      revenue: daysSince("revenue"),
    },
    accepted: accepted.length,
    rejected,
    notes: {
      threeStates: THREE_STATES_NOTE,
      immunity: IMMUNITY_NOTE,
      sendingIsNotSelling: SENDING_IS_NOT_SELLING_NOTE,
    },
  });
}

/**
 * RUN-U U2 — the reconciliation that would have caught RUN 110-129.
 * Compares what a legacy internal-log counter CLAIMS against what the mail record actually shows,
 * and names every counter the program was understating. Additive: mutates nothing.
 */
export function reconcileWithClaimed(truth, claimed = {}) {
  const findings = [];
  const map = [
    ["asksSent", "sent"],
    ["personalReplies", "personalReplies"],
    ["meetingsBooked", "meetingsBooked"],
    ["conversationsHeld", "conversationsHeld"],
  ];
  for (const [claimedKey, counterKey] of map) {
    if (!(claimedKey in claimed)) continue;
    const c = truth.counters[counterKey];
    if (!c || !c.sourced) {
      findings.push({
        counter: claimedKey, severity: "unverifiable",
        statement: `"${claimedKey}" cannot be checked: no mail source was read. It must render ${UNVERIFIED}, not a number.`,
      });
      continue;
    }
    const real = c.state === NEVER ? 0 : c.value;
    const said = claimed[claimedKey];
    const saidNum = said === NEVER || said === UNVERIFIED ? 0 : Number(said);
    if (!Number.isFinite(saidNum) || saidNum === real) continue;
    findings.push({
      counter: claimedKey,
      severity: saidNum < real ? "understated" : "overstated",
      claimed: said,
      real,
      statement: saidNum < real
        ? `"${claimedKey}" was published as ${said} while the mail record shows ${real}. Understating real activity is a Rule 14 failure in the same class as overstating it.`
        : `"${claimedKey}" was published as ${said} while the mail record shows ${real}.`,
    });
  }
  return Object.freeze({
    schema: OUTBOUND_TRUTH_SCHEMA,
    clean: findings.length === 0,
    findings,
    rule: "A counter that the real activity cannot move is broken. Any counter listed here must be re-based on the mail record before it is published again.",
  });
}

/** Flat fact set for the AXIS feed / ledger / operator brief. Numbers only, no interpretation. */
export function outboundFacts(truth) {
  const v = (c) => (!c.sourced ? UNVERIFIED : c.state === NEVER ? NEVER : c.value);
  return Object.freeze({
    schema: OUTBOUND_TRUTH_SCHEMA,
    windowDays: truth.windowDays,
    emailsSent: v(truth.counters.sent),
    undeliverable: v(truth.counters.undeliverable),
    delivered: truth.delivered,
    autoReplies: v(truth.counters.autoReplies),
    personalReplies: v(truth.counters.personalReplies),
    meetingsBooked: v(truth.counters.meetingsBooked),
    conversationsHeld: v(truth.counters.conversationsHeld),
    revenue: v(truth.counters.revenue),
    warmRedirects: truth.warmRedirects,
    returnDatesPending: truth.returnDates.length,
    daysSinceMeetingBooked: truth.daysSince.meetingBooked,
    daysSinceLiveConversation: truth.daysSince.conversationHeld,
    daysSinceRevenue: truth.daysSince.revenue,
  });
}

/** Plain-words rendering. No scold, no target, no encouragement. */
export function outboundMarkdown(truth) {
  const f = outboundFacts(truth);
  const say = (x) => (x === NEVER ? "never" : x === UNVERIFIED ? "unverified" : String(x));
  return [
    `## Outbound, read from the mail record (${truth.windowDays}-day window)`,
    truth.sourced ? `Source: ${truth.source}${truth.readAt ? ` · read ${truth.readAt}` : ""}` : `No mail source was read. Every number below is ${UNVERIFIED}, which is not zero.`,
    "",
    `- Emails sent: ${say(f.emailsSent)}`,
    `- Undeliverable: ${say(f.undeliverable)}`,
    `- Delivered: ${say(f.delivered)}`,
    `- Automatic / out-of-office replies: ${say(f.autoReplies)} (not interest)`,
    `- Personal replies from a human: ${say(f.personalReplies)}`,
    `- Meetings or calls booked: ${say(f.meetingsBooked)}`,
    `- Live conversations held: ${say(f.conversationsHeld)}`,
    `- Revenue received: ${say(f.revenue)}`,
    `- Warm redirects an autoresponder handed us for free: ${say(f.warmRedirects)}`,
    `- Prospect-stated return dates pending: ${say(f.returnDatesPending)}`,
    "",
    SENDING_IS_NOT_SELLING_NOTE,
  ].join("\n");
}
