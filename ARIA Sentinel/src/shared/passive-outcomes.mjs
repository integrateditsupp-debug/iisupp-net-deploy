// passive-outcomes.mjs — RUN-AB AB1: WHAT 45 SENDS ACTUALLY PRODUCED.
//
// WHY (RUN-AB, 2026-07-29): twenty-seven sequences have reported on events only a human hour can create.
// RUN-AA then surfaced that the top of the funnel was never empty: 45 messages have actually left the
// mailbox. Nobody has ever measured what they produced. This module measures it — from the record that
// already exists, end to end, not the 3-day window the counters were reading.
//
// The failure to design against is inventing a category because we want one to be non-zero.
//
// Honesty invariants (Rule 14):
//   - AN UNOBSERVED OUTCOME RENDERS `unobserved`, NEVER 0. The single most important line in this module.
//     `delivered` is the case that proves it: this mailbox has no delivery receipts, so a message that did
//     not bounce is NOT known to have landed. It is `unobserved`. Reporting "41 delivered" would be a
//     fabricated metric of exactly the class Rule 14 forbids, and it is the number a normal outreach tool
//     would print here without blinking.
//   - SILENCE IS DERIVED BY ABSENCE AND IS LABELLED AS SUCH. A send with no observed outcome is `silent`,
//     and `silent` carries its own note saying it is an absence of observation, not an observed event.
//   - NO RATE AGAINST A DENOMINATOR THE RECORD DOES NOT SUPPORT. A reply rate over `delivered` is refused
//     outright, because `delivered` is unobserved. Rates are only ever computed over `sent`, which is a
//     directly observed count, and every rate carries its denominator in the rendering.
//   - THE COMPLETENESS NOTE SURVIVES INTO EVERY RENDERING. The record says its own sends are a floor, not
//     a total. That sentence is carried, verbatim, into every output. A floor reported as a total is the
//     same lie in the other direction.
//   - AN AUTO-REPLY IS NOT A REPLY. A bounce is not a send that landed. A decline IS a personal reply and
//     is counted as one — the funnel does not get to drop an answer because the answer was no.
//   - NO IDENTITY (vault Rule 11). Opaque handles only.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence. Nothing replaced.

export const PASSIVE_OUTCOMES_SCHEMA = "passive-outcomes.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

export const UNOBSERVED = "unobserved";
export const UNVERIFIED = "unverified";

export const UNOBSERVED_NOTE =
  "`unobserved` means no record establishes this outcome either way. It is not 0. A count of 0 would " +
  "claim we looked and it had not happened; `unobserved` states that the record cannot answer.";

export const DELIVERED_NOTE =
  "Delivery is not observable from this mailbox. There are no delivery receipts, so a message that " +
  "produced no bounce is not known to have landed — it is only known not to have bounced. Delivered is " +
  "therefore reported as unobserved at every volume, and no rate is ever computed against it.";

export const SILENCE_NOTE =
  "Silent is an absence of observation, not an observed event. A silent send may have landed and been " +
  "read, may have been filtered, or may never have arrived. The record cannot tell these apart and this " +
  "module does not guess between them.";

export const DECLINE_NOTE =
  "A decline is a personal reply and is counted as one. The funnel does not get to drop an answer " +
  "because the answer was no. Disposition is reported separately from the reply count, never folded in.";

/** Outcome kinds this module recognises. Anything else is carried as unrecognised, never discarded. */
export const OBSERVED_KINDS = Object.freeze(["sent", "undeliverable", "auto-reply", "personal-reply"]);

/** Denominators a rate may legitimately be computed over. `delivered` is deliberately absent. */
export const LEGAL_DENOMINATORS = Object.freeze(["sent"]);

/** Build counters are accepted at the door and discarded unread. Software progress is not an outcome. */
export const DISCARDED_INPUTS = Object.freeze([
  "sequencesCompleted", "tasksMerged", "testsGreen", "commits", "merges",
  "suitesGreen", "filesChanged", "runsCompleted", "modulesBuilt",
]);

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const parseMs = (v) => { if (!isStr(v)) return null; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const dayOf = (v) => (isStr(v) ? String(v).slice(0, 10) : null);

/**
 * Read an outbound record end to end and report what the sends actually produced.
 * @param {object} record - outbound-record.v1
 * @returns {object} frozen measurement
 */
export function measureOutcomes(record, opts = {}) {
  const events = Array.isArray(record?.events) ? record.events : null;

  if (!events) {
    return Object.freeze({
      schema: PASSIVE_OUTCOMES_SCHEMA,
      state: UNVERIFIED,
      why: "No outbound record was read. Every count below is unverified — that is not the same as zero.",
      sent: UNVERIFIED,
      delivered: UNOBSERVED,
      undeliverable: UNVERIFIED,
      autoReplied: UNVERIFIED,
      personallyReplied: UNVERIFIED,
      silent: UNVERIFIED,
      completeness: UNVERIFIED,
      notes: Object.freeze([UNOBSERVED_NOTE, DELIVERED_NOTE]),
      rates: Object.freeze([]),
    });
  }

  const byKind = new Map();
  const unrecognised = [];
  const handlesWithOutcome = new Set();
  const sentHandles = new Set();
  const dates = [];

  for (const e of events) {
    const kind = isStr(e?.kind) ? e.kind : null;
    const at = parseMs(e?.at);
    if (at !== null) dates.push(e.at);
    if (!kind) { unrecognised.push({ reason: "event with no kind", at: e?.at ?? null }); continue; }
    if (!OBSERVED_KINDS.includes(kind)) { unrecognised.push({ reason: `unrecognised kind: ${kind}`, at: e?.at ?? null }); continue; }
    byKind.set(kind, (byKind.get(kind) || 0) + 1);
    if (kind === "sent" && isStr(e.handle)) sentHandles.add(e.handle);
    if (kind !== "sent" && isStr(e.handle)) handlesWithOutcome.add(e.handle);
  }

  const sent = byKind.get("sent") || 0;
  const undeliverable = byKind.get("undeliverable") || 0;
  const autoReplied = byKind.get("auto-reply") || 0;
  const personallyReplied = byKind.get("personal-reply") || 0;
  const observedOutcomes = undeliverable + autoReplied + personallyReplied;

  // Silence is derived by absence, and is labelled as derived everywhere it appears.
  const silent = Math.max(0, sent - observedOutcomes);

  // Dispositions of personal replies, reported separately and never folded into the reply count.
  const dispositions = [];
  for (const e of events) {
    if (e?.kind === "personal-reply") {
      dispositions.push(Object.freeze({
        handle: isStr(e.handle) ? e.handle : UNVERIFIED,
        at: isStr(e.at) ? e.at : UNVERIFIED,
        disposition: isStr(e.disposition) ? e.disposition : UNVERIFIED,
        reason: isStr(e.reason) ? e.reason : UNVERIFIED,
      }));
    }
  }

  const sortedDates = dates.slice().sort();
  const window = sortedDates.length
    ? Object.freeze({ firstObserved: dayOf(sortedDates[0]), lastObserved: dayOf(sortedDates[sortedDates.length - 1]) })
    : Object.freeze({ firstObserved: UNVERIFIED, lastObserved: UNVERIFIED });

  const completeness = isStr(record?.completeness) ? record.completeness : UNVERIFIED;

  return Object.freeze({
    schema: PASSIVE_OUTCOMES_SCHEMA,
    state: "measured",
    readAt: isStr(record?.readAt) ? record.readAt : UNVERIFIED,
    window,

    // Directly observed counts.
    sent,
    undeliverable,
    autoReplied,
    personallyReplied,

    // Derived by absence — labelled.
    silent,
    silentIsDerived: true,

    // Refused outright. This is the point of the module.
    delivered: UNOBSERVED,
    opened: UNOBSERVED,
    read: UNOBSERVED,
    forwarded: UNOBSERVED,

    dispositions: Object.freeze(dispositions),
    unrecognised: Object.freeze(unrecognised.map((u) => Object.freeze(u))),
    completeness,
    rates: Object.freeze(computeRates({ sent, undeliverable, autoReplied, personallyReplied })),
    notes: Object.freeze([UNOBSERVED_NOTE, DELIVERED_NOTE, SILENCE_NOTE, DECLINE_NOTE]),
    discardedInputs: DISCARDED_INPUTS,
  });
}

/**
 * Rates, only over `sent`. Every rate carries its denominator. A request for a rate over an
 * unobserved denominator is refused with a stated reason rather than silently substituted.
 */
export function computeRates({ sent, undeliverable, autoReplied, personallyReplied }) {
  if (!Number.isFinite(sent) || sent <= 0) {
    return [Object.freeze({
      name: "all rates",
      value: UNVERIFIED,
      denominator: "sent",
      why: "No observed sends, so no rate has a denominator the record supports.",
    })];
  }
  const pct = (n) => `${((n / sent) * 100).toFixed(1)}%`;
  return [
    Object.freeze({ name: "undeliverable rate", value: pct(undeliverable), denominator: `sent (${sent})`, observed: true }),
    Object.freeze({ name: "auto-reply rate", value: pct(autoReplied), denominator: `sent (${sent})`, observed: true }),
    Object.freeze({ name: "personal-reply rate", value: pct(personallyReplied), denominator: `sent (${sent})`, observed: true }),
    Object.freeze({
      name: "reply rate over delivered",
      value: UNOBSERVED,
      denominator: "delivered — unobserved",
      observed: false,
      why: DELIVERED_NOTE,
    }),
  ];
}

/** Render the measurement as plain operator text. The completeness note is carried verbatim. */
export function renderOutcomes(m) {
  const lines = [];
  lines.push("WHAT THE SENDS PRODUCED");
  lines.push("");
  if (m.state === UNVERIFIED) {
    lines.push(`State: ${UNVERIFIED}. ${m.why}`);
    lines.push("");
    for (const n of m.notes) lines.push(n);
    return lines.join("\n");
  }
  lines.push(`Observed window: ${m.window.firstObserved} to ${m.window.lastObserved}. Record read at ${m.readAt}.`);
  lines.push("");
  lines.push(`sent (observed):            ${m.sent}`);
  lines.push(`undeliverable (observed):   ${m.undeliverable}`);
  lines.push(`auto-replied (observed):    ${m.autoReplied}`);
  lines.push(`personally replied (obs.):  ${m.personallyReplied}`);
  lines.push(`silent (derived by absence):${String(m.silent).padStart(3)}`);
  lines.push("");
  lines.push(`delivered:                  ${m.delivered}`);
  lines.push(`opened:                     ${m.opened}`);
  lines.push(`read:                       ${m.read}`);
  lines.push(`forwarded:                  ${m.forwarded}`);
  lines.push("");
  lines.push("RATES");
  for (const r of m.rates) lines.push(`  ${r.name}: ${r.value}  [denominator: ${r.denominator}]`);
  lines.push("");
  if (m.dispositions.length) {
    lines.push("PERSONAL REPLIES, WITH DISPOSITION");
    for (const d of m.dispositions) lines.push(`  ${d.handle} on ${String(d.at).slice(0, 10)} — ${d.disposition}: ${d.reason}`);
    lines.push("");
  }
  lines.push("COMPLETENESS");
  lines.push(`  ${m.completeness}`);
  lines.push("");
  for (const n of m.notes) lines.push(n);
  return lines.join("\n");
}
