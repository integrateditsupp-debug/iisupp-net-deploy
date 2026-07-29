// staged-hour.mjs — RUN-T T3: THE HOUR HAS A PLACE ON THE CALENDAR.
//
// WHY (RUN-T, 2026-07-28): R1 plans the hour, S1 takes the name, S2 gives the sentence, S3 walks all
// four in one pass — and none of it has ever been run, because nothing ever put the hour anywhere. A
// loop that requires a human to decide WHEN, WHO and WHAT FIRST before it can start is a loop that
// starts on the day the human has spare decision-making, which is never. T3 removes all three
// decisions and leaves exactly one: do it, or record that it did not happen.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - STAGED IS NOT SCHEDULED AND NOT SENT. There is no calendar write, no invite, no reminder and no
//     transport anywhere in this path. Booking it is Ahmad's one click and the artefact says so in
//     the first line, not in a footnote.
//   - AN UNWALKED HOUR IS A FINDING, NOT A ROLLOVER. If the hour does not happen it is recorded as
//     not happened, it keeps the T2 counter honest, and it explicitly does NOT re-stage itself as
//     though it were still pending. A to-do that quietly rolls over forever is how nineteen sequences
//     produced zero hours.
//   - THE RECORD PATH CLOSES BACK INTO R2. The same artefact that staged the hour carries the outcome
//     into conversation-outcome, so the walk from S3 is the walk that actually gets walked.
//   - WITH NO CANDIDATE IT STILL STAGES AN HOUR. "Go get the first name" is a real errand with a real
//     hour, not an empty state - refusing to stage anything until a name exists is how the name never
//     gets got.
//   - PURE. No fs, no net, no spawn, no env, no scheduler, no persistence — static-scanned.
//   - Rule 11 privacy: a real name reaches this module only from untracked operator state and is
//     never written to a tracked file by it. Rule 15 additive throughout.

import { buildHourPlan, HOUR_PLAN_SCHEMA, FIRST_NAME_ERRAND } from "./hour-plan.mjs";
import { recordOutcome, CONVERSATION_OUTCOME_SCHEMA } from "./conversation-outcome.mjs";
import { momentumSafe, UNKNOWN } from "./program-truth.mjs";

export const STAGED_HOUR_SCHEMA = "staged-hour.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;
export const HAS_TRANSPORT = false;
export const HAS_SCHEDULER = false;
export const WRITES_CALENDAR = false;
export const PERSISTS = false;
export const ROLLS_OVER = false;

export const STAGED_NOT_SCHEDULED =
  "STAGED, NOT SCHEDULED. Nothing has been written to a calendar, no invite exists, no reminder is " +
  "set and nothing has been sent. Putting this hour in the calendar is Ahmad's one click and only his.";

export const NO_ROLLOVER_NOTE =
  "An hour that does not happen is recorded as not happened. It is NOT quietly re-staged as if it " +
  "were still pending - a to-do that rolls over forever is indistinguishable from one nobody intended " +
  "to do, and the elapsed counter keeps reading the truth either way.";

export const ONE_DECISION_NOTE =
  "Everything that could be decided in advance has been. What hour, which errand, which name and what " +
  "to open with are all filled in below. The only decision left is to spend the hour or to record that " +
  "it was not spent.";

/** What can happen to a staged hour. There is no fifth state and no "in progress". */
export const HOUR_STATES = Object.freeze([
  Object.freeze({ key: "staged", label: "staged and not yet walked", terminal: false }),
  Object.freeze({ key: "walked", label: "the hour was spent and an outcome was recorded", terminal: true }),
  Object.freeze({ key: "not-walked", label: "the hour was not spent - recorded as a finding, not rolled over", terminal: true }),
]);

export const HOUR_STATE_KEYS = Object.freeze(HOUR_STATES.map((s) => s.key));

function str(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min ? v.trim() : null;
}

/**
 * Stage one specific hour.
 *
 *  plan       - an R1 hour plan (or the inputs to build one). Required: with no real plan the module
 *               says it cannot stage an hour rather than inventing an errand.
 *  candidate  - optional S1/Q1 candidate record. Absent => the errand is "go get the first name".
 *  opening    - optional S2 opening. Absent (or refused) => stated as absent, never fabricated.
 *  when       - optional operator-chosen slot in plain words ("Thursday 9-10am"). Absent => `not established`.
 */
export function stageHour(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};

  const plan = src.plan && src.plan.schema === HOUR_PLAN_SCHEMA
    ? src.plan
    : (src.plan ? buildHourPlan(src.plan, { now }) : null);

  if (!plan) {
    return {
      schema: STAGED_HOUR_SCHEMA,
      generatedAt: new Date(now).toISOString(),
      honest: true,
      staged: false,
      state: null,
      refused: true,
      refusedReason:
        "No hour plan was supplied, so there is no real errand to stage. An hour invented without a " +
        "plan is a calendar entry with nothing in it.",
      nothingSent: NOTHING_SENT, sent: SENT, signed: SIGNED, charged: CHARGED,
      writesCalendar: WRITES_CALENDAR, hasScheduler: HAS_SCHEDULER, hasTransport: HAS_TRANSPORT,
    };
  }

  const candidate = src.candidate && typeof src.candidate === "object" && src.candidate.recorded !== false
    ? src.candidate
    : null;

  // The one errand this hour is for. With no candidate that is R1's own first-name errand, verbatim —
  // not a placeholder, not an empty state.
  const errand = candidate
    ? {
        key: "spend-the-hour-on-a-recorded-name",
        label: "Spend the hour on the candidate already recorded",
        why: "The name is written down with its provenance. Nothing else needs to be decided first.",
        fromFirstNameErrand: false,
      }
    : {
        // R1's own first-name errand, verbatim. Not a placeholder and not an empty state.
        key: "go-get-the-first-name",
        label: FIRST_NAME_ERRAND.errand,
        why: FIRST_NAME_ERRAND.why,
        fromFirstNameErrand: true,
      };

  const opening = src.opening && typeof src.opening === "object" && src.opening.refused !== true
    ? (str(src.opening.opening) || null)
    : null;

  const openingStatement = opening
    ? "An opening exists and is quoted below - it was rendered from the candidate's own recorded basis."
    : (candidate
        ? "No opening exists for this candidate. S2 refuses to render one without a recorded problem basis, and an invented one would be a fabrication with a friendly tone."
        : "No opening exists yet because there is no name yet. This hour is for getting the name, not for saying anything.");

  return {
    schema: STAGED_HOUR_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    staged: true,
    refused: false,
    state: "staged",
    // Every one of these is a fact carried from a real module, never typed here.
    when: str(src.when) || UNKNOWN,
    durationMinutes: 60,
    errand,
    candidateKey: candidate ? (str(candidate.key) || null) : null,
    hasCandidate: !!candidate,
    opening,
    openingStatement,
    planSchema: plan.schema,
    // Hard properties, asserted by the test.
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    writesCalendar: WRITES_CALENDAR,
    hasScheduler: HAS_SCHEDULER,
    hasTransport: HAS_TRANSPORT,
    persists: PERSISTS,
    rollsOver: ROLLS_OVER,
    stagedNotScheduled: STAGED_NOT_SCHEDULED,
    noRolloverNote: NO_ROLLOVER_NOTE,
    oneDecisionNote: ONE_DECISION_NOTE,
  };
}

/**
 * The hour was spent. Carries the outcome straight into R2 — the artefact that staged the hour is the
 * artefact that records it, so the loop closes where it opened.
 */
export function walkStagedHour(staged, outcomeInput = {}, { now = Date.now() } = {}) {
  if (!staged || staged.schema !== STAGED_HOUR_SCHEMA || staged.staged !== true) {
    return { walked: false, refused: true, refusedReason: "There is no staged hour to walk." };
  }

  const outcome = recordOutcome(
    { ...outcomeInput, candidateKey: outcomeInput.candidateKey ?? staged.candidateKey ?? undefined },
    { now },
  );

  if (!outcome || outcome.recorded !== true) {
    return {
      walked: false,
      refused: true,
      refusedReason: (outcome && outcome.refusedReason)
        || "R2 refused the outcome, so the hour is not recorded as walked. An hour whose outcome we cannot state is not an hour we can claim.",
      outcome,
    };
  }

  return {
    walked: true,
    refused: false,
    state: "walked",
    schema: STAGED_HOUR_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    // The hour was spent regardless of how it went. That is the whole point of counting it separately.
    spentAt: new Date(now).toISOString(),
    hourCounted: true,
    outcome,
    outcomeSchema: CONVERSATION_OUTCOME_SCHEMA,
    statement: "The hour was spent and the outcome is recorded through R2. Hours spent moves by one; " +
      "whether conversations held moves is R2's decision from what actually happened, not this module's.",
  };
}

/**
 * The hour did NOT happen. Recorded as a finding. It does not re-stage itself, it does not roll over,
 * and it counts no hour — because no hour was spent.
 */
export function recordUnwalkedHour(staged, { reason = null, now = Date.now() } = {}) {
  if (!staged || staged.schema !== STAGED_HOUR_SCHEMA || staged.staged !== true) {
    return { recorded: false, refused: true, refusedReason: "There is no staged hour to record as unwalked." };
  }

  const why = str(reason);

  return {
    recorded: true,
    refused: false,
    state: "not-walked",
    schema: STAGED_HOUR_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    walked: false,
    // Nothing is counted, because nothing was spent. An unwalked hour is not a cheap hour.
    hourCounted: false,
    spentAt: null,
    conversationHeld: false,
    // The property the whole task exists for.
    reStaged: false,
    rollsOver: false,
    reason: why,
    statement: why
      ? `The hour was staged and did not happen: ${why}. It has not been re-staged and nothing has been counted.`
      : "The hour was staged and did not happen, and no reason was recorded. It has not been re-staged and nothing has been counted. " +
        "An unrecorded reason is itself the finding - it means nobody looked at why.",
    noRolloverNote: NO_ROLLOVER_NOTE,
  };
}

export function stagedHourIsMomentumSafe(staged) {
  return !!staged && momentumSafe(stagedHourMarkdown(staged));
}

export function stagedHourMarkdown(staged) {
  if (!staged || staged.schema !== STAGED_HOUR_SCHEMA) return "_no staged hour_";
  if (staged.refused) return `# No hour staged\n\n_${staged.refusedReason}_\n`;

  return [
    "# The hour",
    "",
    `**${staged.stagedNotScheduled}**`,
    "",
    `- When: ${staged.when}`,
    `- For: ${staged.durationMinutes} minutes`,
    `- Errand: ${staged.errand.label}`,
    `- Why this one: ${staged.errand.why ?? UNKNOWN}`,
    `- Name: ${staged.hasCandidate ? `the candidate recorded as ${staged.candidateKey}` : "there is no name yet - this hour is for getting one"}`,
    "",
    "## What to open with",
    "",
    staged.opening ? `> ${staged.opening}` : `_${staged.openingStatement}_`,
    "",
    `_${staged.oneDecisionNote}_`,
    "",
    `_${staged.noRolloverNote}_`,
    "",
  ].join("\n");
}

export { UNKNOWN };
