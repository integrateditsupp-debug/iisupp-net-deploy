// hour-plan.mjs — RUN-R R1: ONE HOUR'S WORTH OF WORK, AND NOT ONE MINUTE MORE.
//
// WHY (RUN-R, 2026-07-28): seventeen sequences of software are green and the chain is idle, because
// no hour has been spent in front of a person. This module turns the Q2 ranking into the smallest
// honest thing a human can act on: the specific candidates to touch, the specific errand for each,
// in order. It is deliberately NOT a call list, NOT a sequence and NOT a campaign - nothing here
// may be consumed by an automation, because the whole point is that a person does it.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - IT REFUSES TO FILL AN HOUR. Two errands' worth of real work makes a two-errand plan, and the
//     plan says so in plain words. Padding an hour is the same lie as padding a score.
//   - ZERO CANDIDATES PRODUCES EXACTLY ONE ITEM: go and get the first name, stated in Q1's own
//     vocabulary. No second item is invented beneath it to make the screen look busy.
//   - NO MOMENTUM LANGUAGE. momentumSafe() is asserted on every string.
//   - PURE. No fs, no net, no spawn, no clock beyond the injected `now` - static-scanned by R1.
//   - Rule 15 additive: reads the Q1 list and the Q2 ranking, replaces neither.

import { CANDIDATE_FIT_SCHEMA } from "./candidate-fit.mjs";
import { CANDIDATE_RECORD_SCHEMA, REQUIRED_FIELDS, NO_AUTOMATION_NOTE } from "./candidate-record.mjs";
import { UNKNOWN, momentumSafe } from "./program-truth.mjs";

export const HOUR_PLAN_SCHEMA = "hour-plan.v1";

export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// This module cannot be driven by a machine. Asserted, not merely documented.
export const HAS_TRANSPORT = false;
export const HAS_SCHEDULER = false;
export const MACHINE_CONSUMABLE = false;

export { UNKNOWN, NO_AUTOMATION_NOTE };

/** An hour holds this many real errands at most. Fewer is normal. More is a different hour. */
export const ERRANDS_PER_HOUR = 6;

/** Stated on the plan itself so no reader, and no future agent, can repurpose it. */
export const IS_NOT = Object.freeze([
  "not a call list",
  "not a sequence",
  "not a campaign",
  "not an automation input",
]);

export const NO_PADDING_NOTE =
  "This plan is exactly as long as the real work. It will not be padded to fill an hour - a padded hour is the same lie as a padded score.";

/** The zero case, in Q1's own vocabulary: the first entry needs these fields and nothing else. */
export const FIRST_NAME_ERRAND = Object.freeze({
  key: null,
  kind: "get-the-first-name",
  errand:
    "Get ONE real name written down. A first entry needs exactly: " +
    REQUIRED_FIELDS.map((f) => f.key).join(", ") +
    " - each with the sentence saying where it came from. Nothing may be inferred.",
  why: "There is no one to plan an hour around yet. This is the whole hour.",
  fromRanking: false,
});

export const ZERO_STATEMENT =
  "0 candidates recorded, so this hour has exactly one item: go and get the first real name. No second item is invented beneath it.";

function nonEmpty(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function errandFor(scored) {
  const lever = scored && scored.mostChangingFact ? scored.mostChangingFact : null;
  if (lever && nonEmpty(lever.findOut)) {
    return {
      errand: lever.findOut,
      why: scored.scoreable
        ? `Scored ${scored.display}. ${lever.label} is the heaviest dimension still short of full marks.`
        : `Not scoreable - ${lever.label} was never recorded. One fact changes this position more than any other.`,
    };
  }
  // No lever means every dimension is already at full marks: the only honest errand left is the
  // conversation itself, and we say that rather than manufacturing a research task.
  return {
    errand: "Nothing is left to find out. Have the conversation.",
    why: scored && scored.scoreable
      ? `Scored ${scored.display} with every dimension recorded at full marks.`
      : UNKNOWN,
  };
}

/**
 * Build one hour's plan from a real Q2 ranking. A foreign shape is never treated as "some work".
 */
export function buildHourPlan({ rank = null, list = null } = {}, { now = Date.now() } = {}) {
  const rankOk = rank && rank.schema === CANDIDATE_FIT_SCHEMA && Array.isArray(rank.ranked) && Array.isArray(rank.needsOneFact);
  const listOk = list && list.schema === CANDIDATE_RECORD_SCHEMA;

  // Unscoreable candidates come FIRST - Q2 surfaces them first because one recorded fact is usually
  // the cheapest move on the board - then the scored ones in ranked order.
  const source = rankOk
    ? [
        ...rank.needsOneFact.map((s) => ({ scored: s, kind: "find-one-fact" })),
        ...rank.ranked.map((s) => ({ scored: s, kind: "advance-a-scored-candidate" })),
      ]
    : [];

  const realWork = source.map(({ scored, kind }, i) => {
    const { errand, why } = errandFor(scored);
    return { order: i + 1, key: scored.key, kind, errand, why, display: scored.display, fromRanking: true };
  });

  const items = realWork.length === 0 ? [{ order: 1, ...FIRST_NAME_ERRAND }] : realWork.slice(0, ERRANDS_PER_HOUR);
  const deferredCount = Math.max(0, realWork.length - items.length);
  const empty = realWork.length === 0;

  const statement = empty
    ? ZERO_STATEMENT
    : `${items.length} errand(s) in this hour` +
      (deferredCount > 0
        ? `. ${deferredCount} more real errand(s) exist and belong to a different hour - they are not squeezed into this one.`
        : `, which is all the real work there is. The hour is not filled out to look full.`);

  return {
    schema: HOUR_PLAN_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    padded: false,
    empty,
    items,
    itemCount: items.length,
    deferredCount,
    realWorkCount: realWork.length,
    capacity: ERRANDS_PER_HOUR,
    statement,
    noPaddingNote: NO_PADDING_NOTE,
    isNot: [...IS_NOT],
    noAutomationNote: NO_AUTOMATION_NOTE,
    hasTransport: HAS_TRANSPORT,
    hasScheduler: HAS_SCHEDULER,
    machineConsumable: MACHINE_CONSUMABLE,
    sourceRankTotal: rankOk ? rank.total : 0,
    sourceListCount: listOk ? list.count : null,
    sent: SENT,
  };
}

/** Every string on the plan must survive the momentum guard. */
export function hourPlanIsMomentumSafe(plan) {
  if (!plan || plan.schema !== HOUR_PLAN_SCHEMA) return false;
  const strings = [
    plan.statement,
    plan.noPaddingNote,
    plan.noAutomationNote,
    ...plan.isNot,
    ...plan.items.flatMap((i) => [i.errand, i.why]),
  ];
  return strings.every((s) => momentumSafe(s));
}

export function hourPlanMarkdown(plan) {
  if (!plan || plan.schema !== HOUR_PLAN_SCHEMA) return "_no hour plan_\n";
  const out = ["## The next hour", "", plan.statement, ""];
  for (const item of plan.items) {
    out.push(`${item.order}. ${item.key ? `**${item.key}** - ` : ""}${item.errand}`);
    if (item.why) out.push(`   - Why: ${item.why}`);
  }
  out.push("", `_This is ${plan.isNot.join(", ")}._`, "", `_${plan.noPaddingNote}_`, "");
  return out.join("\n");
}
