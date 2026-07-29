// program-truth.mjs — RUN-O: ONE TRUTH, THREE SURFACES.
//
// WHY (RUN-O, 2026-07-28): the same handful of facts — what is on the published line, what is
// verified but unpublished, what the suite says, revenue received, asks sent — are rendered in
// three places: the AXIS spoken status, the operator brief (O1) and the ledger head (O3). Every
// cycle they were re-typed, and every re-typing is a chance for one surface to read optimistic
// while another reads honest. This module is the single normaliser all three read. A drift
// between two surfaces is a TEST FAILURE, not a style issue.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - NOTHING IS DEFAULTED INTO EXISTENCE. An absent fact normalises to a stated unknown, never to
//     a friendly guess. `liveConfirmed` is false unless the caller proves it true.
//   - ZERO IS ZERO. Revenue and asks-sent render through statements re-exported from M3's own
//     vocabulary, so no surface can soften what the ask ledger says.
//   - NO TREND LANGUAGE OVER A ZERO SERIES. `momentumSafe()` refuses the vocabulary.
//   - PURE. No fs, no net, no spawn — static-scanned by the O-series tests.
//   - Rule 15 additive: reads, normalises, replaces nothing.

import { ZERO_SENT_STATEMENT, NO_REVENUE_STATEMENT } from "./ask-ledger.mjs";

export const PROGRAM_TRUTH_SCHEMA = "program-truth.v1";

// Belt-and-braces, asserted by the tests.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const ZERO_ASKS_STATEMENT = ZERO_SENT_STATEMENT;
export const ZERO_REVENUE_STATEMENT = NO_REVENUE_STATEMENT;

// RUN-P P3 — STAGED IS NOT SENT. A staged ask is an artefact sitting on disk waiting for a human.
// It is counted separately on every surface and may never be folded, phrased, or rounded into a
// sent one. The zero-staged wording deliberately refuses to sound like progress.
export const ZERO_STAGED_STATEMENT =
  "0 asks staged. Nothing is waiting for a human to send.";

// RUN-Q Q3 — CANDIDATES IS A FOURTH NUMBER. A candidate is a name someone wrote down. It is not an
// account, not an ask, not a customer and not revenue, and it may never be phrased as any of them
// or as a step toward one. It is counted separately on every surface for exactly that reason.
export const ZERO_CANDIDATES_STATEMENT =
  "0 candidates recorded. There is no one to render an ask for - not a shortlist, not a pipeline, zero.";

// RUN-R R3 — CONVERSATIONS HELD IS A FIFTH NUMBER, AND IT IS THE ONE THE PROGRAM IS JUDGED ON. It
// is stated FIRST on every surface — before sequence counts, before suite counts — because a green
// suite has never once been the constraint. A conversation held is not an ask sent, an ask sent is
// not revenue, and none of the five may be folded into another.
export const ZERO_CONVERSATIONS_STATEMENT =
  "0 conversations held. Nobody has been spoken to - not a slow start, not early days, zero. " +
  "Seventeen sequences of green software and zero conversations is a fact about us, not about the market.";

// RUN-S S3 — HOURS SPENT IS A SIXTH NUMBER, AND IT IS THE HONEST COUNTER-METRIC TO THE FIFTH. A week
// of five unreachable prospects is five hours spent and zero conversations held — which is a real
// result about the approach, not an ambiguous absence. Hours spent is never folded into conversations
// held, and holding a conversation never retro-credits an hour that was not spent.
export const ZERO_HOURS_STATEMENT =
  "0 hours spent in front of anyone. An hour that reached nobody would still be counted here - " +
  "none have been spent, so the zero above is not yet evidence about the market either.";

// RUN-T T2 — `never` IS NOT A ZERO. "0 days since" means it happened today; "never" means it has not
// happened once. Every surface renders the two differently or the drift test goes red. The sentinel is
// a STRING on purpose, so a surface that tries arithmetic on it fails loudly instead of printing 0.
export const NEVER = "never";

export const NEVER_STATEMENT =
  "It has NEVER happened - not zero days ago, not recently, not once. `never` and `0 days` are " +
  "different facts and this program does not render them the same way.";

export const UNKNOWN = "not established";

// Words that imply movement where there is none. A zero series may never wear them.
export const MOMENTUM_WORDS = [
  "momentum", "warming up", "in motion", "picking up", "on the way", "trending",
  "growing", "ramping", "accelerating", "gaining", "building steam", "nearly there",
];

// M3's own zero-statements NEGATE this vocabulary on purpose ("not pipeline, not in motion, not
// warm - zero sent"). A negated occurrence is the honest use and must not trip the guard; only a
// bare, asserting occurrence does.
export function momentumSafe(text) {
  const esc = MOMENTUM_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const negated = new RegExp(`\\b(?:not|never|no|zero)\\s+(?:${esc})`, "g");
  const t = String(text || "").toLowerCase().replace(negated, "");
  return !MOMENTUM_WORDS.some((w) => t.includes(w));
}

function str(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function count(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * raw: {
 *   program:  { series?, sequence?, tasksMerged?, tasksTotal?, exitCriteriaMet? },
 *   tests:    { green?, total?, effectiveGreen?, effectiveTotal?, note? },
 *   mainRef:  { value?, source?, liveConfirmed?, why? },
 *   unpushed: { commits?, headDescribed?, stagedAt? },
 *   revenue:  { receivedCad?, asksSent?, asksStaged?, candidates? },
 * }
 * Every field is optional. Absence normalises to a STATED unknown, never a flattering default.
 */
export function normalizeProgramTruth(raw = {}, { now = Date.now() } = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const p = src.program && typeof src.program === "object" ? src.program : {};
  const t = src.tests && typeof src.tests === "object" ? src.tests : {};
  const m = src.mainRef && typeof src.mainRef === "object" ? src.mainRef : {};
  const u = src.unpushed && typeof src.unpushed === "object" ? src.unpushed : {};
  const r = src.revenue && typeof src.revenue === "object" ? src.revenue : {};

  const tasksMerged = count(p.tasksMerged);
  const tasksTotal = count(p.tasksTotal);
  const pct = tasksMerged !== null && tasksTotal ? Math.round((tasksMerged / tasksTotal) * 100) : null;

  const green = count(t.green);
  const total = count(t.total);
  const effGreen = count(t.effectiveGreen);
  const effTotal = count(t.effectiveTotal);
  // "green" only if the caller supplied real numbers AND they agree. Unknown is never green.
  const testsGreen = effGreen !== null && effTotal !== null
    ? effGreen === effTotal
    : (green !== null && total !== null ? green === total : false);

  // A ref is live-confirmed ONLY on an explicit true. Silence means "not confirmed".
  const liveConfirmed = m.liveConfirmed === true;

  const receivedCad = count(r.receivedCad) ?? 0;
  const asksSent = count(r.asksSent) ?? 0;
  // Separate number, separate sentence. Never derived from asksSent and never merged into it.
  const asksStaged = count(r.asksStaged) ?? 0;
  // Q3: a FOURTH separate number. Never derived from asksStaged and never merged into it.
  const candidates = count(r.candidates) ?? 0;
  // R3: a FIFTH separate number, and the one that matters. Never derived from candidates and never
  // merged into asksSent — reaching someone is not asking them.
  const conversationsHeld = count(r.conversationsHeld) ?? 0;
  // S3: a SIXTH separate number. An hour spent is not a conversation held — the whole point of
  // counting it is that the two can diverge, and a program that only counts its wins cannot see that.
  const hoursSpent = count(r.hoursSpent) ?? 0;
  const unpushedCommits = count(u.commits) ?? 0;

  // T2: elapsed-since. A missing counter is `never`, NEVER 0. `count()` returns null for anything
  // that is not a real non-negative number, and null is exactly what must survive to the surface here.
  const e = src.elapsed && typeof src.elapsed === "object" ? src.elapsed : {};
  const elapsedDays = (v) => {
    const n = count(v);
    return n === null ? NEVER : n;
  };
  const daysSinceHourSpent = elapsedDays(e.daysSinceHourSpent);
  const daysSinceConversationHeld = elapsedDays(e.daysSinceConversationHeld);
  const daysSinceCandidateRecorded = elapsedDays(e.daysSinceCandidateRecorded);
  const elapsedStatement = (days, what) =>
    days === NEVER
      ? `${what}: ${NEVER_STATEMENT}`
      : (days === 0
          ? `${what}: 0 days - it happened today, which is not the same fact as never.`
          : `${what}: ${days} day(s) since.`);

  const truth = {
    schema: PROGRAM_TRUTH_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,

    program: {
      series: str(p.series) || UNKNOWN,
      sequence: str(p.sequence) || UNKNOWN,
      tasksMerged,
      tasksTotal,
      pct,
      exitCriteriaMet: p.exitCriteriaMet === true,
    },

    tests: {
      green, total, effectiveGreen: effGreen, effectiveTotal: effTotal,
      testsGreen,
      note: str(t.note),
      statement: (effGreen !== null && effTotal !== null)
        ? `Suite ${effGreen}/${effTotal} green.`
        : (green !== null && total !== null ? `Suite ${green}/${total} green.` : `Suite result ${UNKNOWN}.`),
    },

    mainRef: {
      value: str(m.value),
      source: str(m.source) || UNKNOWN,
      liveConfirmed,
      why: str(m.why),
      statement: liveConfirmed
        ? "The published line was read live from the remote."
        : "The published line is a last-known local reference, not a live read.",
    },

    unpushed: {
      commits: unpushedCommits,
      headDescribed: str(u.headDescribed),
      stagedAt: str(u.stagedAt),
      statement: unpushedCommits === 0
        ? "Nothing is verified-but-unpublished."
        : `${unpushedCommits} verified commit(s) are built and tested but not published.`,
    },

    revenue: {
      // Stated first, deliberately, because it is the constraint.
      conversationsHeld,
      conversationsStatement: conversationsHeld === 0
        ? ZERO_CONVERSATIONS_STATEMENT
        : `${conversationsHeld} conversation(s) held and none asked yet unless the ask ledger says otherwise - being in front of someone is not asking them.`,
      // S3: stated immediately beside it, because a zero above with no hours beneath it is
      // ambiguous, and a zero above with hours beneath it is a finding.
      hoursSpent,
      hoursStatement: hoursSpent === 0
        ? ZERO_HOURS_STATEMENT
        : `${hoursSpent} hour(s) spent to hold ${conversationsHeld} conversation(s) - an hour spent is not a conversation held.`,
      receivedCad,
      asksSent,
      asksStaged,
      // Zero renders in M3's own words. Never re-worded, never softened.
      revenueStatement: receivedCad === 0 ? ZERO_REVENUE_STATEMENT : `${receivedCad} CAD received on verified receipts.`,
      asksStatement: asksSent === 0 ? ZERO_ASKS_STATEMENT : `${asksSent} ask(s) sent.`,
      // A staged ask is stated as staged AND as not sent, in the same breath, so no reader can
      // mistake the one for the other.
      stagedStatement: asksStaged === 0
        ? ZERO_STAGED_STATEMENT
        : `${asksStaged} ask(s) staged and not sent - staged is not sent.`,
      candidates,
      // A candidate is stated as a written-down name AND as not an ask, in the same breath, so no
      // reader can mistake having a list for having asked anyone.
      candidatesStatement: candidates === 0
        ? ZERO_CANDIDATES_STATEMENT
        : `${candidates} candidate(s) recorded and none asked - a recorded name is not an ask.`,
    },

    // T2: how long it has been. Shipping software cannot move any of these - they are read from the
    // real hour, conversation and candidate logs upstream and arrive here already computed.
    elapsed: {
      daysSinceHourSpent,
      daysSinceConversationHeld,
      daysSinceCandidateRecorded,
      neverCount: [daysSinceHourSpent, daysSinceConversationHeld, daysSinceCandidateRecorded]
        .filter((d) => d === NEVER).length,
      hourStatement: elapsedStatement(daysSinceHourSpent, "An hour spent in front of someone"),
      conversationStatement: elapsedStatement(daysSinceConversationHeld, "A conversation held"),
      candidateStatement: elapsedStatement(daysSinceCandidateRecorded, "A candidate recorded"),
    },
  };

  // The compact fact set every surface must agree on. Surfaces render it differently; they may
  // never disagree about it. The drift test compares exactly this object across all three.
  truth.facts = {
    conversationsHeld: truth.revenue.conversationsHeld,
    conversationsStatement: truth.revenue.conversationsStatement,
    hoursSpent: truth.revenue.hoursSpent,
    hoursStatement: truth.revenue.hoursStatement,
    sequence: truth.program.sequence,
    tasksMerged: truth.program.tasksMerged,
    tasksTotal: truth.program.tasksTotal,
    testsGreen: truth.tests.testsGreen,
    testsStatement: truth.tests.statement,
    mainRefLiveConfirmed: truth.mainRef.liveConfirmed,
    unpushedCommits: truth.unpushed.commits,
    revenueReceivedCad: truth.revenue.receivedCad,
    asksSent: truth.revenue.asksSent,
    asksStaged: truth.revenue.asksStaged,
    candidates: truth.revenue.candidates,
    revenueStatement: truth.revenue.revenueStatement,
    asksStatement: truth.revenue.asksStatement,
    stagedStatement: truth.revenue.stagedStatement,
    candidatesStatement: truth.revenue.candidatesStatement,
    // T2: in the drift-locked fact set, so `never` cannot read as `0` on one surface and `never` on
    // another. The three surfaces render it differently; they may not disagree about it.
    daysSinceHourSpent: truth.elapsed.daysSinceHourSpent,
    daysSinceConversationHeld: truth.elapsed.daysSinceConversationHeld,
    daysSinceCandidateRecorded: truth.elapsed.daysSinceCandidateRecorded,
    elapsedHourStatement: truth.elapsed.hourStatement,
  };

  return truth;
}

/** The fact set a surface must reproduce verbatim. Every surface that renders program state exports
 *  a `factsOf()` returning exactly this shape; the drift test deep-equals them. */
export function factsOf(truth) {
  if (!truth || truth.schema !== PROGRAM_TRUTH_SCHEMA) return null;
  return { ...truth.facts };
}
