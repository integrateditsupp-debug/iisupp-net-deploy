// candidate-bridge.mjs — RUN-Q Q3: THE BRIDGE INTO THE ASK CHAIN.
//
// WHY (RUN-Q, 2026-07-28): Q1 records a candidate and Q2 ranks it. The moment a candidate replies
// and a real engagement starts, that work must flow into N1 account intake WITHOUT anyone retyping
// a name, an address or a provenance sentence - because a retyped fact is a fact that can quietly
// change on the way across, and a fact that changes on the way across is how a real record turns
// into a flattering one.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - LOSSLESS. Every recorded value AND its provenance sentence crosses unchanged. Nothing is
//     summarised, normalised, re-worded or dropped in transit; a round-trip check proves it.
//   - THE BRIDGE CANNOT ASSERT A REAL ACCOUNT. `realAccount` stays a human act, exactly as `sent`
//     and `paid` do. `assertRealAccount()` exists ONLY to refuse, so the impossibility is
//     discoverable and testable rather than merely absent.
//   - IT INVENTS NOTHING N1 NEEDS. A candidate has no engagement minutes and no cost basis; the
//     bridge leaves those empty and NAMES them, so N1's own gates refuse the account rather than
//     the bridge papering over the gap.
//   - CANDIDATES IS A FOURTH, SEPARATE NUMBER. Not pipeline, not progress, not a step toward
//     revenue - a count of names written down. `momentumSafe()` is asserted over its wording, and
//     P3's drift lock proves all three surfaces agree about it (program-truth.mjs).
//   - PURE. No fs, no net, no spawn, no env.
//   - Rule 15 additive: Q1, Q2 and N1 are read-only collaborators, untouched and unmutated.

import { CANDIDATE_RECORD_SCHEMA } from "./candidate-record.mjs";
import { CANDIDATE_FIT_SCHEMA } from "./candidate-fit.mjs";
import { GATES, GATE_KEYS, PRIVACY_NOTE } from "./account-intake.mjs";
import { ZERO_CANDIDATES_STATEMENT } from "./program-truth.mjs";

export const CANDIDATE_BRIDGE_SCHEMA = "candidate-bridge.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// The whole point of the module, stated as constants so a test asserts rather than trusts.
export const CAN_ASSERT_REAL_ACCOUNT = false;
export const HAS_TRANSPORT = false;

export { GATES, GATE_KEYS, PRIVACY_NOTE, ZERO_CANDIDATES_STATEMENT };

export const REAL_ACCOUNT_REFUSAL =
  "Refused: nothing in this software may assert that an account is real. A real account is asserted " +
  "by a human who actually engaged with them, exactly as sent requires a sent artefact and paid " +
  "requires a receipt. The bridge carries facts across; it does not promote them.";

export const NO_CANDIDATE_STATEMENT =
  "No candidate. The bridge exists to carry a real recorded candidate into intake - never to " +
  "manufacture one.";

// What a candidate structurally cannot supply, named up front so the caller sees the gap here
// rather than discovering it as a mysterious N1 refusal three steps later.
export const CANDIDATE_CANNOT_SUPPLY = Object.freeze([
  Object.freeze({ gate: "engagement", why: "a candidate has no engagement minutes yet - nobody has worked with them" }),
  Object.freeze({ gate: "evidence", why: "a candidate has no earned proof pack - nothing has been proven for them" }),
  Object.freeze({ gate: "priced", why: "a candidate has no quote against an observed cost floor" }),
]);

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

/**
 * Carry ONE recorded candidate into the shape N1 `buildAccountIntake()` consumes.
 *
 * input: { candidate, fit? }   // candidate = a Q1 record; fit = its Q2 score, optional
 *
 * Returns { bridged, accountInput, carried, missingGates, ... } or a refusal. The produced
 * accountInput is DELIBERATELY INCOMPLETE - it carries the demand signal a candidate genuinely has
 * and leaves engagement, cost basis and price empty so N1's gates do their job.
 */
export function bridgeCandidateToIntake(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const c = src.candidate;
  const fit = src.fit && src.fit.schema === CANDIDATE_FIT_SCHEMA ? src.fit : null;

  const base = {
    schema: CANDIDATE_BRIDGE_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    canAssertRealAccount: CAN_ASSERT_REAL_ACCOUNT,
    hasTransport: HAS_TRANSPORT,
    privacyNote: PRIVACY_NOTE,
  };

  const ok = !!(c && typeof c === "object" && nonEmpty(c.key, 2)
    && c.name && nonEmpty(c.name.value) && nonEmpty(c.name.source, 8)
    && c.contact && nonEmpty(c.contact.value) && nonEmpty(c.contact.source, 8)
    && c.problemBasis && nonEmpty(c.problemBasis.value) && nonEmpty(c.problemBasis.source, 8));

  if (!ok) {
    return {
      ...base,
      bridged: false,
      refused: true,
      accountInput: null,
      carried: null,
      missingGates: GATE_KEYS.slice(),
      refusal: NO_CANDIDATE_STATEMENT,
    };
  }

  // Lossless: the value AND the provenance sentence cross unchanged, character for character.
  const carried = {
    key: c.key.trim(),
    name: { value: c.name.value, source: c.name.source },
    contact: { value: c.contact.value, source: c.contact.source },
    problemBasis: { value: c.problemBasis.value, source: c.problemBasis.source },
    notes: typeof c.notes === "string" ? c.notes : null,
    enteredBy: nonEmpty(c.enteredBy) ? c.enteredBy : null,
    recordedAt: nonEmpty(c.recordedAt) ? c.recordedAt : null,
    fitScore: fit ? fit.score : null,
    fitScoreable: fit ? fit.scoreable : null,
  };

  // The ONE gate a candidate can honestly supply: a demand signal, with the candidate's own
  // provenance as its source and the candidate's recordedAt as when it was first seen. Nothing is
  // backdated - if the candidate has no recordedAt, firstSeenAt stays absent and N1 refuses.
  const accountInput = {
    key: carried.key,
    demandSignal: {
      id: `cand-${carried.key}`,
      kind: "demand",
      source: carried.problemBasis.source,
      firstSeenAt: carried.recordedAt || null,
      email: carried.contact.value,
      company: carried.name.value,
    },
    // Left EMPTY on purpose. A candidate has none of these, and the bridge will not invent them.
    engagements: [],
    costBasis: null,
    // realAccount is NOT set here and cannot be. It is a human assertion, made in N1's own vocabulary.
    realAccount: false,
  };

  const missingGates = CANDIDATE_CANNOT_SUPPLY.map((g) => g.gate);

  return {
    ...base,
    bridged: true,
    refused: false,
    accountInput,
    carried,
    missingGates,
    cannotSupply: CANDIDATE_CANNOT_SUPPLY,
    statement:
      `Carried ${carried.key} into intake with every recorded fact and its provenance intact. ` +
      `It is NOT an account: ${missingGates.length} of N1's gates (${missingGates.join(", ")}) have ` +
      "nothing behind them yet, and only a human who actually engaged with them can assert this is real.",
    refusal: null,
  };
}

/**
 * Exists solely to refuse. Kept as a named export so the impossibility is discoverable and testable
 * rather than merely absent - an absent function is an invitation to write one.
 */
export function assertRealAccount() {
  return {
    schema: CANDIDATE_BRIDGE_SCHEMA,
    refused: true,
    realAccount: false,
    canAssertRealAccount: CAN_ASSERT_REAL_ACCOUNT,
    refusal: REAL_ACCOUNT_REFUSAL,
  };
}

/**
 * The candidates count, in the exact shape program-truth's `revenue.candidates` consumes, derived
 * from a Q1 list rather than typed by hand on any surface.
 */
export function candidatesCountFrom(list) {
  const ok = list && list.schema === CANDIDATE_RECORD_SCHEMA && Number.isFinite(list.count);
  return ok ? Math.max(0, Math.floor(list.count)) : 0;
}

export function candidateBridgeMarkdown(result) {
  if (!result || result.schema !== CANDIDATE_BRIDGE_SCHEMA) return "_no bridge_\n";
  if (result.refused) {
    return ["## Candidate to intake", "", result.refusal, "", "_Nothing was carried across._", ""].join("\n");
  }
  return [
    `## Candidate to intake - ${result.carried.key}`,
    "",
    result.statement,
    "",
    ...result.cannotSupply.map((g) => `- **${g.gate}** - ${g.why}`),
    "",
    `_${REAL_ACCOUNT_REFUSAL}_`,
    "",
  ].join("\n");
}
