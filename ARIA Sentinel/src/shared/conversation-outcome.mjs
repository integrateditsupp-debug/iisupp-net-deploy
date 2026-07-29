// conversation-outcome.mjs — RUN-R R2: THE RECORD THAT CAN SAY "IT WENT NOWHERE".
//
// WHY (RUN-R, 2026-07-28): the program has never recorded a conversation, so it has never had to
// record a bad one. Every CRM ever built makes a "yes" one click and a "no" a small act of
// bureaucracy, and that asymmetry is how a pipeline fills with things that already died. Here a
// "no", a "no reply" and a "wrong person" are FIRST-CLASS outcomes with exactly the same shape,
// the same required fields and the same one call as interest. An hour that taught us nothing is
// data about the approach, not about the person, and it is still recorded.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - A NEGATIVE COSTS THE SAME AS A POSITIVE. Identical required fields, identical call. Asserted.
//   - NOTHING SOFTENS OR DEFERS A "NO". "nurture", "warm", "circle back", "not a no" and friends
//     are REFUSED BY NAME and quoted back, rather than accepted and quietly re-labelled.
//   - NO EXPIRY, NO PENDING, NO AMBIGUITY. There is no state a dead conversation can drift into.
//   - A CONVERSATION IS THE BEST PROVENANCE THAT EXISTS. Facts learned in one carry a provenance
//     sentence naming who said it and when, so Q1 accepts them without a human retyping anything.
//   - IT ONLY FEEDS N1 WHERE AN ENGAGEMENT GENUINELY OCCURRED. A "no" is a recorded conversation
//     and is never an engagement.
//   - PURE. No fs, no net, no spawn - static-scanned by R2. Rule 11: real names live only in the
//     caller's untracked operator state; nothing here persists or transports anything.

import { UNKNOWN, momentumSafe } from "./program-truth.mjs";
import { INFERENCE_MARKERS } from "./candidate-record.mjs";

export const CONVERSATION_OUTCOME_SCHEMA = "conversation-outcome.v1";

export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const PERSISTS = false;
export const HAS_TRANSPORT = false;
export const TRACKED = false;
export const SERVEABLE = false;
export const CAN_ASSERT_REAL_ACCOUNT = false;

export const PRIVACY_NOTE =
  "Rule 11: a real name, address or company recorded here lives ONLY in the operator's untracked state. This module never persists, transports, tracks or serves any of it.";

/**
 * Every outcome a real hour can produce. `engagement` is true ONLY where the person actually engaged
 * with the offer - it is the single gate N1 may hear about. Every other outcome is a recorded
 * conversation and nothing more. Note there is no "pending", no "maybe" and no "follow up later":
 * a conversation that has not happened is simply not recorded here.
 */
export const OUTCOMES = Object.freeze([
  Object.freeze({ key: "engaged", label: "Engaged with the offer", negative: false, engagement: true,
    means: "they responded to the actual ask - not politeness, not curiosity" }),
  Object.freeze({ key: "interested-no-ask-made", label: "Interested, but no ask was made", negative: false, engagement: false,
    means: "a good conversation in which we never asked for anything - our failure, recorded as ours" }),
  Object.freeze({ key: "no", label: "No", negative: true, engagement: false,
    means: "they said no. It is a complete outcome and it closes here" }),
  Object.freeze({ key: "no-reply", label: "No reply", negative: true, engagement: false,
    means: "we reached out and nothing came back. Silence is an outcome, not a waiting room" }),
  Object.freeze({ key: "wrong-person", label: "Wrong person", negative: true, engagement: false,
    means: "they are not the person who decides or feels the problem" }),
  Object.freeze({ key: "wrong-problem", label: "Wrong problem", negative: true, engagement: false,
    means: "they do not have the problem we solve. Our read was wrong, and that is the finding" }),
  Object.freeze({ key: "could-not-reach", label: "Could not reach them", negative: true, engagement: false,
    means: "the hour was spent and no conversation happened. Still recorded - it cost the same hour" }),
]);

export const OUTCOME_KEYS = Object.freeze(OUTCOMES.map((o) => o.key));
export const NEGATIVE_OUTCOME_KEYS = Object.freeze(OUTCOMES.filter((o) => o.negative).map((o) => o.key));
export const ENGAGEMENT_OUTCOME_KEYS = Object.freeze(OUTCOMES.filter((o) => o.engagement).map((o) => o.key));

/** The fields EVERY outcome needs - identical for a yes and for a no. That symmetry is the point. */
export const REQUIRED_FIELDS = Object.freeze([
  Object.freeze({ key: "candidateKey", label: "Candidate", missing: "no candidate - an outcome with no one attached is not a record" }),
  Object.freeze({ key: "heldAt", label: "When it happened", missing: "no date - an undated conversation cannot be counted" }),
  Object.freeze({ key: "who", label: "Who was spoken to", missing: "no person - 'the company' does not talk" }),
  Object.freeze({ key: "said", label: "What was actually said", missing: "no account of what was said - a verdict with no words behind it is an impression" }),
  Object.freeze({ key: "outcome", label: "Outcome", missing: "no outcome - and there is no neutral option to fall back on" }),
  Object.freeze({ key: "enteredBy", label: "Recorded by", missing: "no one recorded it" }),
]);

export const REQUIRED_KEYS = Object.freeze(REQUIRED_FIELDS.map((f) => f.key));

/**
 * Language whose only function is to stop a "no" from being a no. Refused BY NAME and quoted back.
 * A dead conversation that gets re-labelled is worse than one never recorded, because it will be
 * counted later as something it never was.
 */
export const SOFTENING_LABELS = Object.freeze([
  "nurture", "nurturing", "warm lead", "warm", "keep warm", "circle back", "revisit later",
  "not a no", "soft no", "not yet a no", "still open", "keeping the door open", "long game",
  "future opportunity", "re-engage later", "park it", "on the back burner", "maybe later",
  "drip", "stay in touch", "keep on the radar",
]);

export const NO_SOFTENING_NOTE =
  "A no is recorded as a no. There is no state in this module a dead conversation can drift into, and no label that keeps it alive.";

export const NO_AUTOMATION_NOTE =
  "An outcome is written by the human who had the conversation. No automation may produce one, and nothing here can send, schedule or follow up.";

export const EMPTY_STATEMENT =
  "0 conversations held. Nobody has been spoken to - not a slow start, not early days, zero. Seventeen sequences of green software and zero conversations is a fact about us, not about the market.";

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

function norm(v) {
  return typeof v === "string" ? v.trim() : "";
}

function fieldOf(key) {
  return REQUIRED_FIELDS.find((f) => f.key === key) || null;
}

function isIsoDate(v) {
  if (!nonEmpty(v)) return false;
  const s = norm(v);
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(s)) return false;
  return Number.isFinite(Date.parse(s));
}

/** Find any softening label in a piece of text. Returns the matched phrase, verbatim, or null. */
export function softeningIn(text) {
  const t = norm(text).toLowerCase();
  if (!t) return null;
  // Longest first so "warm lead" is reported rather than the bare "warm" inside it.
  const found = SOFTENING_LABELS.slice().sort((a, b) => b.length - a.length).find((w) => t.includes(w));
  return found || null;
}

/**
 * Record ONE real conversation. Every missing field is named AT ONCE - a form that reveals one
 * problem at a time teaches a human to give up.
 */
export function recordOutcome(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const problems = [];

  for (const key of REQUIRED_KEYS) {
    if (!nonEmpty(src[key])) problems.push(`${fieldOf(key).label}: ${fieldOf(key).missing}`);
  }

  if (nonEmpty(src.heldAt) && !isIsoDate(src.heldAt)) {
    problems.push("When it happened: not a real date (YYYY-MM-DD) - an approximate date makes the count approximate");
  }

  const outcomeKey = norm(src.outcome);
  const outcome = OUTCOMES.find((o) => o.key === outcomeKey) || null;
  if (nonEmpty(src.outcome) && !outcome) {
    problems.push(
      `Outcome: "${outcomeKey}" is not one of the recorded outcomes (${OUTCOME_KEYS.join(", ")}) - a new outcome is a deliberate decision made in this file, not an ad-hoc string`
    );
  }

  // A softening label anywhere in the record is refused and quoted back.
  for (const key of ["outcome", "said", "note"]) {
    const hit = softeningIn(src[key]);
    if (hit) {
      problems.push(
        `${key === "outcome" ? "Outcome" : key === "said" ? "What was actually said" : "Note"}: the phrase "${hit}" softens or defers the result - record what happened, not what it might still become`
      );
    }
  }

  // What was said is a first-hand account, so it may not confess to being reconstructed.
  const inferred = INFERENCE_MARKERS.find((m) => norm(src.said).toLowerCase().includes(m));
  if (inferred) {
    problems.push(`What was actually said: "${inferred}" admits this was reconstructed rather than heard - a remembered gist is not a quote`);
  }

  if (problems.length) {
    return {
      schema: CONVERSATION_OUTCOME_SCHEMA,
      refused: true,
      recorded: false,
      problems,
      reason: `Not recorded. ${problems.length} problem(s): ${problems.join("; ")}`,
      honest: true,
      sent: SENT,
    };
  }

  const negative = outcome.negative === true;

  return {
    schema: CONVERSATION_OUTCOME_SCHEMA,
    refused: false,
    recorded: true,
    generatedAt: new Date(now).toISOString(),
    candidateKey: norm(src.candidateKey),
    heldAt: norm(src.heldAt),
    who: norm(src.who),
    said: norm(src.said),
    enteredBy: norm(src.enteredBy),
    note: nonEmpty(src.note) ? norm(src.note) : null,
    outcome: outcome.key,
    outcomeLabel: outcome.label,
    outcomeMeans: outcome.means,
    negative,
    engagement: outcome.engagement === true,
    // No expiry, no pending, no re-open. The record is complete the moment it is written.
    open: false,
    expiresAt: null,
    deferred: false,
    softened: false,
    // The hour was spent either way, so it counts either way.
    countsAsConversationHeld: outcome.key !== "could-not-reach",
    hourSpent: true,
    statement:
      `${outcome.label} - ${outcome.means}.` +
      (negative ? " Recorded as it happened, closed here, and not carried forward as anything else." : ""),
    privacyNote: PRIVACY_NOTE,
    noSofteningNote: NO_SOFTENING_NOTE,
    noAutomationNote: NO_AUTOMATION_NOTE,
    honest: true,
    sent: SENT,
  };
}

/**
 * The provenance sentence a recorded conversation gives to Q1. A conversation is the strongest
 * provenance the program has, and it crosses without a human retyping it.
 */
export function provenanceFor(outcome) {
  if (!outcome || outcome.schema !== CONVERSATION_OUTCOME_SCHEMA || !outcome.recorded) return null;
  return `${outcome.who} said it in a real conversation on ${outcome.heldAt}, recorded by ${outcome.enteredBy}`;
}

/**
 * Turn a fact learned in the conversation into a Q1-shaped field: { value, source }. The source is
 * the conversation itself, so nothing is inferred and nothing is retyped.
 */
export function factForCandidate(outcome, value) {
  if (!nonEmpty(value)) return null;
  const source = provenanceFor(outcome);
  if (!source) return null;
  return { value: norm(value), source };
}

/**
 * The N1 engagement gate - and ONLY where an engagement genuinely occurred. Every other outcome,
 * including a good conversation in which we never asked, returns null. A "no" can never become an
 * engagement by passing through this function.
 */
export function engagementFactForIntake(outcome) {
  if (!outcome || outcome.schema !== CONVERSATION_OUTCOME_SCHEMA || !outcome.recorded) return null;
  if (outcome.engagement !== true) return null;
  return {
    gate: "engagement",
    value: outcome.said,
    source: provenanceFor(outcome),
  };
}

/** Refuses, always. Symmetry with the Q3 bridge: an outcome cannot promote anyone to an account. */
export function assertRealAccount() {
  throw new Error(
    "conversation-outcome cannot assert a real account. A recorded conversation is a recorded conversation; N1's own gates decide what it is worth."
  );
}

/** Build the log. Zero reads as zero, in plain words, first. */
export function buildOutcomeLog(outcomes = [], { now = Date.now() } = {}) {
  const src = Array.isArray(outcomes)
    ? outcomes.filter((o) => o && o.schema === CONVERSATION_OUTCOME_SCHEMA && o.recorded === true)
    : [];

  const held = src.filter((o) => o.countsAsConversationHeld === true);
  const byOutcome = {};
  for (const key of OUTCOME_KEYS) byOutcome[key] = src.filter((o) => o.outcome === key).length;

  const negatives = src.filter((o) => o.negative === true).length;
  const engagements = src.filter((o) => o.engagement === true).length;

  return {
    schema: CONVERSATION_OUTCOME_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    isLog: true,
    count: src.length,
    conversationsHeld: held.length,
    hoursSpent: src.length,
    negatives,
    engagements,
    byOutcome,
    empty: src.length === 0,
    statement: src.length === 0
      ? EMPTY_STATEMENT
      : `${held.length} conversation(s) held across ${src.length} recorded hour(s): ${engagements} engaged, ${negatives} went nowhere. A conversation held is not an ask sent.`,
    privacyNote: PRIVACY_NOTE,
    noSofteningNote: NO_SOFTENING_NOTE,
    sent: SENT,
  };
}

/** The number R3 puts on all three surfaces. An absent or foreign shape counts zero, never unknown. */
export function conversationsHeldFrom(log) {
  if (!log || log.schema !== CONVERSATION_OUTCOME_SCHEMA || log.isLog !== true) return 0;
  const n = Number(log.conversationsHeld);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function outcomeLogIsMomentumSafe(log) {
  if (!log || log.schema !== CONVERSATION_OUTCOME_SCHEMA) return false;
  return [log.statement, log.noSofteningNote].every((s) => momentumSafe(s));
}

export function outcomeLogMarkdown(log) {
  if (!log || log.schema !== CONVERSATION_OUTCOME_SCHEMA || log.isLog !== true) return "_no outcome log_\n";
  const out = ["## Conversations held", "", log.statement, ""];
  if (!log.empty) {
    for (const key of OUTCOME_KEYS) {
      if (log.byOutcome[key] > 0) {
        const o = OUTCOMES.find((x) => x.key === key);
        out.push(`- **${o.label}:** ${log.byOutcome[key]} - ${o.means}`);
      }
    }
    out.push("");
  }
  out.push(`_${log.noSofteningNote}_`, "");
  return out.join("\n");
}

export { UNKNOWN };
