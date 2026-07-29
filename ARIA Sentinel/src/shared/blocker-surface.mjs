// blocker-surface.mjs — RUN-X X3: THE TWO BLOCKERS, NAMED EVERYWHERE, WITH THEIR PRICE.
//
// WHY (RUN-X, 2026-07-29): a blocker mentioned in one place is a note. A blocker rendered identically on
// every surface, carrying a number that rises, is a fact the program cannot walk past. Two things move
// the outcome ladder and neither is code:
//   1. the unsent hour — twelve drafted second messages nobody has sent;
//   2. the missing code-hosting credential — verified sequences that cannot reach the shared line.
//
// X3 renders both on the AXIS feed, the ledger and the operator brief FROM ONE FACTS OBJECT, so a drift
// between surfaces is a test failure rather than a discrepancy someone notices months later.
//
// Honesty invariants (Rule 14):
//   - ONE SOURCE, THREE RENDERINGS. Feed / ledger / brief lines are generated from the same array. A
//     test asserts they are byte-identical.
//   - A BLOCKER CANNOT BE MARKED RESOLVED WITHOUT ITS REAL EVENT. `resolved` is computed only from
//     evidence in the record (a send that happened; a landed sequence). There is no manual override and
//     no "in progress" state — in-progress implies motion nobody has caused.
//   - THE PRICE IS X1'S NUMBER, UNCHANGED. This module does no arithmetic of its own; it renders what
//     cost-of-delay computed, including `unverified`.
//   - NAMED AS THE OPERATOR'S CLICK, NOT A SOFTWARE TASK. Each blocker states plainly who can clear it.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport. New surface; replaces nothing.

import { UNVERIFIED } from "./cost-of-delay.mjs";

export const BLOCKER_SURFACE_SCHEMA = "blocker-surface.v1";

export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;

export const BLOCKER_KEYS = Object.freeze(["unsent-hour", "missing-code-hosting-credential"]);

export const NO_OVERRIDE_NOTE =
  "Neither blocker has a manual resolve. `unsent-hour` clears when the mail record shows a second " +
  "message actually left; `missing-code-hosting-credential` clears when a verified sequence is recorded " +
  "as landed. Nothing else clears either one.";

const v = (x) => (x === UNVERIFIED ? UNVERIFIED : String(x));

/**
 * Build the blocker surface.
 * @param input.cost           an object built by buildCostOfDelay (X1)
 * @param input.secondMessagesSent  real count from the reply record (W1). > 0 clears the unsent hour.
 */
export function buildBlockerSurface(input = {}) {
  const cost = input?.cost || null;
  const sourced = !!(cost && cost.schema);

  const secondMessagesSent = Number.isFinite(input?.secondMessagesSent) && input.secondMessagesSent >= 0
    ? Math.floor(input.secondMessagesSent)
    : 0;

  const unlanded = sourced ? cost.unlandedSequences : UNVERIFIED;
  const daysSince = sourced ? cost.daysSinceMailLeft : UNVERIFIED;
  const closed = sourced ? cost.warmWindowsClosed : UNVERIFIED;
  const atRisk = sourced ? cost.warmWindowsAtRisk : UNVERIFIED;

  const blockers = Object.freeze([
    Object.freeze({
      key: "unsent-hour",
      name: "The unsent hour",
      is: "twelve second messages exist as text and none has been sent.",
      clearedBy: "one human writing to another from the operator's own mailbox.",
      whose: "the operator's click — this is not a software task and no agent can do it.",
      price: Object.freeze({
        daysSinceMailLeft: daysSince,
        warmWindowsClosed: closed,
        warmWindowsOpenAndUnanswered: atRisk,
      }),
      resolved: secondMessagesSent > 0,
      resolvedBecause:
        secondMessagesSent > 0
          ? `the mail record shows ${secondMessagesSent} second message(s) actually left.`
          : "the mail record shows no second message has left. Nothing else can mark this cleared.",
    }),
    Object.freeze({
      key: "missing-code-hosting-credential",
      name: "The missing code-hosting credential",
      is: "verified sequences are built, tested and cannot reach the shared line from the build sandbox.",
      clearedBy: "a credential on the build machine, or the operator running the staged one-click on his own machine.",
      whose: "the operator's click — the sandbox has no credential and will not invent one.",
      price: Object.freeze({
        unlandedSequences: unlanded,
      }),
      resolved: unlanded !== UNVERIFIED && unlanded === 0,
      resolvedBecause:
        unlanded === UNVERIFIED
          ? "the landed count is unverified, so this blocker is stated as unresolved rather than guessed clear."
          : unlanded === 0
            ? "every verified sequence is recorded as landed."
            : `${unlanded} verified sequence(s) are still not landed.`,
    }),
  ]);

  return Object.freeze({
    schema: BLOCKER_SURFACE_SCHEMA,
    sourced,
    costIndex: sourced ? cost.costIndex : UNVERIFIED,
    blockers,
    noOverrideNote: NO_OVERRIDE_NOTE,
  });
}

/** THE canonical lines. Every surface renders exactly these — no surface composes its own. */
export function blockerLines(s) {
  return Object.freeze(
    s.blockers.map((b) => {
      const price = Object.entries(b.price)
        .map(([k, val]) => `${k} ${v(val)}`)
        .join(", ");
      const state = b.resolved ? "cleared" : "open";
      return `${b.name} — ${state}. ${b.is} Price: ${price}. Cleared by ${b.clearedBy} This is ${b.whose}`;
    })
  );
}

/** The three renderings. Same lines, different wrappers. A drift here is a test failure. */
export function feedRendering(s) {
  return blockerLines(s).join(" ");
}

export function ledgerRendering(s) {
  return blockerLines(s).map((l) => `- ${l}`).join("\n");
}

export function briefRendering(s) {
  return blockerLines(s).map((l, i) => `${i + 1}. ${l}`).join("\n");
}

/** Every rendering, stripped of its wrapper, for byte-consistency assertions. */
export function allBlockerRenderings(s) {
  const lines = blockerLines(s);
  return Object.freeze({
    feed: lines,
    ledger: ledgerRendering(s).split("\n").map((l) => l.replace(/^- /, "")),
    brief: briefRendering(s).split("\n").map((l) => l.replace(/^\d+\. /, "")),
  });
}

/** Findings, not a boolean. Empty means every surface agrees and nothing is over-claimed. */
export function blockerDrift(s) {
  const r = allBlockerRenderings(s);
  const found = [];
  for (const key of ["ledger", "brief"]) {
    if (r[key].length !== r.feed.length) {
      found.push(`${key} rendering has ${r[key].length} blocker lines, feed has ${r.feed.length}`);
      continue;
    }
    r[key].forEach((line, i) => {
      if (line !== r.feed[i]) found.push(`${key} blocker line ${i + 1} differs from the feed rendering`);
    });
  }
  for (const b of s.blockers) {
    if (b.resolved && !/mail record shows \d+ second message|every verified sequence is recorded as landed/.test(b.resolvedBecause)) {
      found.push(`blocker "${b.key}" is marked resolved without a real event in the record`);
    }
  }
  return Object.freeze(found);
}
