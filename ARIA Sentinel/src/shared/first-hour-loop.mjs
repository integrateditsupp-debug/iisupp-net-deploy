// first-hour-loop.mjs — RUN-S S3: THE LOOP A HUMAN CAN WALK IN AN HOUR.
//
// WHY (RUN-S, 2026-07-28): R1 plans the hour, S1 takes the name, S2 gives the sentence, R2 records
// what happened. Each is tested and none of them touch each other, which means the hour still has
// four separate steps a human has to remember to string together — and a loop nobody can walk in one
// pass is a loop nobody walks. S3 is the wiring, and the honest accounting of what the walk produced.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - CONVERSATIONS HELD COMES FROM R2'S REAL LOG. There is no hand-typed count anywhere in this
//     path; the number is read from recorded outcomes or it is zero.
//   - A NOTHING-HOUR IS RECORDED AS PROMINENTLY AS A GOOD ONE. "Could not reach them" produces a
//     full record and a full stated result — an hour that taught us nothing about the person still
//     taught us something about the approach, and the surfaces say so at the same volume.
//   - HOURS SPENT IS THE COUNTER-METRIC. Five unreachable prospects reads as five hours spent and
//     zero conversations held, not as an ambiguous absence. The two numbers may never be folded.
//   - NOTHING IS SENT, SCHEDULED OR PROMOTED. The loop ends at a recorded outcome; N1's own gates
//     decide what an engagement is worth, exactly as before.
//   - PURE. No fs, no net, no spawn, no env — static-scanned. Rule 15 additive throughout.

import { buildHourPlan, HOUR_PLAN_SCHEMA } from "./hour-plan.mjs";
import { buildQuickEntry, submitQuickEntry, QUICK_ENTRY_SCHEMA } from "./candidate-quick-entry.mjs";
import { buildOpening, HONEST_OPENING_SCHEMA } from "./honest-opening.mjs";
import {
  recordOutcome, buildOutcomeLog, conversationsHeldFrom,
  CONVERSATION_OUTCOME_SCHEMA,
} from "./conversation-outcome.mjs";
import { buildCandidateList, CANDIDATE_RECORD_SCHEMA } from "./candidate-record.mjs";
import { momentumSafe } from "./program-truth.mjs";

export const FIRST_HOUR_LOOP_SCHEMA = "first-hour-loop.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;
export const HAS_TRANSPORT = false;
export const HAS_SCHEDULER = false;
export const PERSISTS = false;

/** The four steps, named once, so every surface and every refusal uses the same words. */
export const STEPS = Object.freeze([
  Object.freeze({ key: "plan", label: "See the hour", module: "hour-plan (R1)" }),
  Object.freeze({ key: "enter", label: "Write the name down", module: "candidate-quick-entry (S1)" }),
  Object.freeze({ key: "say", label: "Say the honest thing", module: "honest-opening (S2)" }),
  Object.freeze({ key: "record", label: "Record what actually happened", module: "conversation-outcome (R2)" }),
]);

export const STEP_KEYS = Object.freeze(STEPS.map((s) => s.key));

export const NOTHING_HOUR_NOTE =
  "An hour that reached nobody is recorded with the same prominence as one that went well. It cost " +
  "the same hour, and what it teaches is about our approach rather than about them.";

export const NO_HAND_COUNT_NOTE =
  "Conversations held and hours spent are both read from the recorded outcome log. Neither number " +
  "can be typed in by hand anywhere in this path.";

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

/**
 * Walk the loop once, end to end, from real input.
 *
 * input: {
 *   rank?, list?,                          // R1's inputs — the plan renders from a real Q2 ranking
 *   operator?,                             // carried into S1's prefill; never a fact about the person
 *   entry?,                                // S1 submission (flat), optional if a candidate is picked
 *   pick?,                                 // an already-recorded candidate to use instead of entering one
 *   heardFrom?,                            // attribution for S2, where the basis came from a conversation
 *   outcome?,                              // R2 submission, optional — an hour may end without one
 *   priorOutcomes?,                        // outcomes recorded before this hour
 * }
 *
 * Returns the whole walk: every step's own result, plus the two numbers, read from the log.
 */
export function walkFirstHour(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};

  // STEP 1 — the hour, from R1, unchanged.
  const plan = buildHourPlan({ rank: src.rank || null, list: src.list || null }, { now });

  // STEP 2 — the name. Either entered through S1 or picked from what is already recorded.
  const entryPoint = buildQuickEntry(
    { plan, list: src.list || null, operator: src.operator || null },
    { now }
  );
  const submission = src.entry ? submitQuickEntry(src.entry, { entry: entryPoint, now }) : null;
  const picked = src.pick && src.pick.key ? src.pick : null;
  const candidate = submission && submission.recorded ? submission.candidate : picked;

  // STEP 3 — the sentence. Refused where the basis is missing; never generated around it.
  const opening = candidate ? buildOpening(candidate, { heardFrom: src.heardFrom || null, now }) : null;

  // STEP 4 — what actually happened. Recorded through R2, unchanged, including every negative form.
  const outcome = src.outcome ? recordOutcome(src.outcome, { now }) : null;

  const prior = Array.isArray(src.priorOutcomes) ? src.priorOutcomes : [];
  const allOutcomes = outcome && outcome.recorded ? [...prior, outcome] : [...prior];
  const log = buildOutcomeLog(allOutcomes, { now });

  // The numbers, READ from the log. Never accumulated here, never passed in.
  const conversationsHeld = conversationsHeldFrom(log);
  const hoursSpent = log.count;

  const walked = STEP_KEYS.filter((k) => {
    if (k === "plan") return !!plan;
    if (k === "enter") return !!candidate;
    if (k === "say") return !!opening && opening.refused === false;
    if (k === "record") return !!outcome && outcome.recorded === true;
    return false;
  });

  const complete = walked.length === STEP_KEYS.length;
  const nothingHour = !!outcome && outcome.recorded === true && outcome.countsAsConversationHeld !== true;

  const statement = complete
    ? (nothingHour
        ? `The hour was walked end to end and reached nobody. ${hoursSpent} hour(s) spent, ${conversationsHeld} conversation(s) held. ${NOTHING_HOUR_NOTE}`
        : `The hour was walked end to end. ${hoursSpent} hour(s) spent, ${conversationsHeld} conversation(s) held - and a conversation held is not an ask sent.`)
    : `The hour is incomplete: ${walked.length} of ${STEP_KEYS.length} steps walked (${walked.join(", ") || "none"}). ` +
      `${hoursSpent} hour(s) spent, ${conversationsHeld} conversation(s) held. Nothing is counted that did not happen.`;

  return {
    schema: FIRST_HOUR_LOOP_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    steps: STEPS,
    walked,
    complete,
    nothingHour,
    plan,
    entryPoint,
    submission,
    candidate,
    opening,
    outcome,
    log,
    // The two numbers this loop exists to move, both read from the log above.
    conversationsHeld,
    hoursSpent,
    statement,
    nothingHourNote: NOTHING_HOUR_NOTE,
    noHandCountNote: NO_HAND_COUNT_NOTE,
    persists: PERSISTS,
    hasTransport: HAS_TRANSPORT,
    hasScheduler: HAS_SCHEDULER,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
  };
}

/** The revenue-shaped slice program-truth reads. Two numbers, never derived from one another. */
export function loopRevenueFacts(walk) {
  if (!walk || walk.schema !== FIRST_HOUR_LOOP_SCHEMA) return { conversationsHeld: 0, hoursSpent: 0 };
  return { conversationsHeld: walk.conversationsHeld, hoursSpent: walk.hoursSpent };
}

export function loopIsMomentumSafe(walk) {
  if (!walk || walk.schema !== FIRST_HOUR_LOOP_SCHEMA) return false;
  return [walk.statement, walk.nothingHourNote, walk.noHandCountNote].every((s) => momentumSafe(s));
}

export function firstHourMarkdown(walk) {
  if (!walk || walk.schema !== FIRST_HOUR_LOOP_SCHEMA) return "_no hour_\n";
  const out = ["## The hour", "", walk.statement, ""];
  for (const s of walk.steps) {
    out.push(`- ${walk.walked.includes(s.key) ? "[x]" : "[ ]"} **${s.label}** - ${s.module}`);
  }
  out.push("", `_${walk.noHandCountNote}_`, "");
  return out.join("\n");
}

export { HOUR_PLAN_SCHEMA, QUICK_ENTRY_SCHEMA, HONEST_OPENING_SCHEMA, CONVERSATION_OUTCOME_SCHEMA, CANDIDATE_RECORD_SCHEMA, buildCandidateList };
