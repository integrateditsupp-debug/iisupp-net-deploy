// spent-hour.mjs — RUN-Y Y1: AN HOUR ACTUALLY SPENT, RECORDED BY THE PERSON WHO SPENT IT.
//
// WHY (RUN-Y, 2026-07-29): RUN-X collapsed the remaining human action into one cold-executable artefact
// and made the cost of not spending it a rising number. What the program has never had is the OTHER SIDE
// of that hour — what happens in the minutes AFTER a message actually leaves. A send today would land in
// a system that can count it (U1), rank what is left (V1), hold a reply (W1) and price the delay (X1),
// but nothing records THE ACT ITSELF.
//
// The failure this module is designed against: an hour that gets spent once, produces no visible record,
// and therefore never gets spent again.
//
// Honesty invariants (Rule 14):
//   - OPERATOR-ENTERED, NEVER INFERRED. Nothing here may conclude that a message was sent because a draft
//     exists, because a queue was built, or because time passed. Only an explicit operator entry counts.
//     A test asserts that a fully-populated hour artefact with NO entry still renders `not spent`.
//   - `not spent` IS NOT `0 actions` AND IS NOT `unverified`. Three distinct states, deliberately:
//       not spent  → no operator entry exists at all. The hour has not happened.
//       0 actions  → the operator sat down, entered the hour, and executed nothing.
//       unverified → an entry exists but the field it describes was never stated.
//   - A SKIP IS A FIRST-CLASS ENTRY. A skipped action carries its reason and is never a silent absence.
//     A skip reason is recorded VERBATIM and is never rewritten into a softer one — a test supplies a
//     blunt reason and asserts the stored string is byte-identical.
//   - NO SOFTWARE PROGRESS. Every build counter is accepted at the door and discarded unread.
//   - NO IDENTITY (vault Rule 11). Opaque handles only. A test greps this module and the real record for
//     an address and fails on a hit.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence. New surface; replaces nothing.

export const SPENT_HOUR_SCHEMA = "spent-hour.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;
export const INFERS_SENDS = false;

/** The three states that must never collapse into one another. */
export const NOT_SPENT = "not spent";
export const UNVERIFIED = "unverified";

export const EMPTY_STATES_NOTE =
  "`not spent` means no operator entry exists — the hour has not happened. `0 actions` means the operator " +
  "sat down and executed nothing, which is a real and different fact. `unverified` means an entry exists " +
  "but never stated this field. None of the three is rendered as any of the others.";

/** What an operator may record per ranked action. Nothing is derived; each is stated. */
export const DISPOSITIONS = Object.freeze(["executed", "skipped"]);

/** Software-progress inputs accepted at the door and discarded unread (U1/W2/X1 immunity). */
export const DISCARDED_INPUTS = Object.freeze([
  "sequencesCompleted", "tasksMerged", "testsGreen", "commits", "merges",
  "suitesGreen", "filesChanged", "runsCompleted", "linesChanged", "modulesBuilt",
]);

export const INFERENCE_NOTE =
  "Nothing in this module may conclude a message was sent. A drafted body is not a send. A built queue is " +
  "not a send. Elapsed time is not a send. Only the operator's own entry, or the mail record, establishes " +
  "that an action was executed.";

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));

/**
 * Normalize one operator-entered action outcome.
 * Unknown dispositions are REFUSED, not coerced into `executed` — coercion is how a program starts
 * inventing sends.
 */
export function normalizeEntry(raw = {}) {
  const handle = isStr(raw.handle) ? raw.handle.trim() : null;
  const stated = isStr(raw.disposition) ? raw.disposition.trim().toLowerCase() : null;
  const disposition = DISPOSITIONS.includes(stated) ? stated : null;

  // The skip reason is stored EXACTLY as the operator wrote it. No softening, no normalising, no
  // mapping into a friendlier vocabulary. A test asserts byte-identity.
  const skipReason = isStr(raw.skipReason) ? raw.skipReason : null;
  const observed = isStr(raw.observed) ? raw.observed : null;

  const refusals = [];
  if (!handle) refusals.push("no handle stated");
  if (!disposition) {
    refusals.push(
      stated ? `disposition "${stated}" is not one of ${DISPOSITIONS.join(", ")}` : "no disposition stated"
    );
  }
  if (disposition === "skipped" && !skipReason) {
    refusals.push("a skip was recorded with no reason — a skip without a reason is not a record");
  }
  if (CARRIES_IDENTITY(handle) || CARRIES_IDENTITY(skipReason) || CARRIES_IDENTITY(observed)) {
    refusals.push("entry carries an address or a domain (vault Rule 11) — refused");
  }

  const ok = refusals.length === 0;
  return Object.freeze({
    ok,
    handle,
    disposition,
    skipReason,
    observed: observed ?? UNVERIFIED,
    refusals: Object.freeze(refusals),
  });
}

/**
 * Build the spent-hour record.
 *
 * @param record            the operator's own entry. Absent/empty → `not spent`.
 * @param record.spentAt    when the operator sat down. Absent → unverified (never "now").
 * @param record.entries[]  one per ranked action they looked at.
 * @param opts.now          clock.
 */
export function buildSpentHour(record = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);

  // Every build counter is read here ONLY to be thrown away. Named explicitly so the discard is visible.
  for (const k of DISCARDED_INPUTS) { void record?.[k]; }

  const rawEntries = Array.isArray(record?.entries) ? record.entries : null;
  const hasOperatorEntry = !!(record && (isStr(record.spentAt) || rawEntries !== null));

  if (!hasOperatorEntry) {
    return Object.freeze({
      schema: SPENT_HOUR_SCHEMA,
      computedAt: new Date(nowMs).toISOString(),
      state: NOT_SPENT,
      spent: false,
      spentAt: UNVERIFIED,
      entries: Object.freeze([]),
      executed: Object.freeze([]),
      skipped: Object.freeze([]),
      refused: Object.freeze([]),
      executedCount: NOT_SPENT,
      skippedCount: NOT_SPENT,
      emptyStatesNote: EMPTY_STATES_NOTE,
      inferenceNote: INFERENCE_NOTE,
      note:
        "No operator entry exists for this hour. This renders `not spent`, which is deliberately not the " +
        "same as an hour spent on nothing. The program will not infer a send from a draft, a queue or a date.",
    });
  }

  const normalized = (rawEntries || []).map(normalizeEntry);
  const good = normalized.filter((e) => e.ok);
  const refused = normalized.filter((e) => !e.ok);

  const executed = Object.freeze(
    good.filter((e) => e.disposition === "executed").map((e) =>
      Object.freeze({ handle: e.handle, observed: e.observed })
    )
  );
  const skipped = Object.freeze(
    good.filter((e) => e.disposition === "skipped").map((e) =>
      // Verbatim. This string is exactly what the operator wrote.
      Object.freeze({ handle: e.handle, skipReason: e.skipReason, observed: e.observed })
    )
  );

  return Object.freeze({
    schema: SPENT_HOUR_SCHEMA,
    computedAt: new Date(nowMs).toISOString(),
    state: "spent",
    spent: true,
    spentAt: isStr(record.spentAt) ? record.spentAt : UNVERIFIED,
    entries: Object.freeze(good.map((e) =>
      Object.freeze({ handle: e.handle, disposition: e.disposition, skipReason: e.skipReason, observed: e.observed })
    )),
    executed,
    skipped,
    refused: Object.freeze(refused.map((e) =>
      Object.freeze({ handle: e.handle, refusals: e.refusals })
    )),
    executedCount: executed.length,
    skippedCount: skipped.length,
    emptyStatesNote: EMPTY_STATES_NOTE,
    inferenceNote: INFERENCE_NOTE,
    note:
      executed.length === 0
        ? "The operator entered this hour and executed nothing. That is a real, recorded fact and is not " +
          "rendered as `not spent` — sitting down and doing nothing is different from never sitting down."
        : "Every executed action below was entered by the operator. Nothing here was inferred.",
  });
}

/** Flat fact set for the AXIS feed / ledger. Numbers and states only, no identity. */
export function spentHourFacts(s) {
  return Object.freeze({
    schema: SPENT_HOUR_SCHEMA,
    state: s.state,
    spentAt: s.spentAt,
    executed: s.executedCount,
    skipped: s.skippedCount,
    refused: s.refused.length,
  });
}

/** One honest markdown block for the ledger. */
export function spentHourMarkdown(s) {
  if (!s.spent) {
    return [
      `- The hour: **${NOT_SPENT}**.`,
      `  - No operator entry exists. This is not the same as an hour spent on nothing.`,
    ].join("\n");
  }
  const L = [
    `- The hour: **spent** (${s.spentAt}).`,
    `  - executed: ${s.executedCount}`,
    `  - skipped: ${s.skippedCount}`,
  ];
  for (const k of s.skipped) L.push(`    - ${k.handle} skipped — "${k.skipReason}"`);
  if (s.refused.length) L.push(`  - refused entries (shown, never dropped): ${s.refused.length}`);
  return L.join("\n");
}
