// first-account-walk.mjs — RUN-O O2: THE FIRST ACCOUNT IN UNDER TEN MINUTES.
//
// WHY (RUN-O, 2026-07-28): N1 records an account and N2 turns it into a priced ask or a named gap
// list. Both are green. Nobody has ever walked the path, because walking it currently means
// reading two modules and a two-thousand-line ledger first. O2 is that walk, written for someone
// who has read nothing else: every field says WHERE ITS VALUE COMES FROM, and the walk refuses
// rather than defaults when the operator does not have it.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - EVERY FIELD NAMES ITS SOURCE. A field the operator cannot source is REFUSED, never filled
//     with a plausible default and never carried forward as if it were real.
//   - THE END IS BINARY. Either the packet location, or M1's named gap list in M1's own
//     vocabulary. Never a "nearly there" summary — `NEARLY_WORDS` are asserted absent by the test.
//   - RUNNABLE WITH NOTHING RECORDED. With zero accounts it says plainly that nothing is recorded
//     yet; it does not pretend to be mid-flight.
//   - A FIXTURE IS NOT A BUYER. `realAccount` must be explicitly asserted by the caller; a walk
//     over an unasserted account is marked `fixture: true` and is barred from claiming a real
//     customer exists.
//   - STRUCTURALLY SEND-INCAPABLE. Pure — no fs, no net, no spawn. Static-scanned by the test
//     across every module in the chain.
//   - Rule 15 additive: drives N1 and N2 as they are; changes neither.

import { buildAccountIntake, intakeRecord, missingForAskReady, GATES, GATE_KEYS } from "./account-intake.mjs";
import { runFirstPacketPass, NO_ACCOUNT_STATEMENT, ONE_CLICK_NOTE } from "./first-packet-pass.mjs";

export const FIRST_ACCOUNT_WALK_SCHEMA = "first-account-walk.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const OUTCOMES = ["packet", "gaps", "nothing-recorded"];

export const NOTHING_RECORDED_STATEMENT =
  "Nothing is recorded yet. No account has been entered, so there is nothing to price and nothing to ask for.";

export const FIXTURE_WARNING =
  "This walk ran over an account that was NOT asserted as a real customer. A test fixture is not a buyer: nothing here counts as a real account.";

// Language the walk may never produce. Binary means binary.
export const NEARLY_WORDS = ["nearly there", "almost ready", "close to ready", "on track to", "should be ready", "just about"];

// Every input the walk asks for, and — this is the point — where its value legitimately comes from.
// `refuseIfUnknown: true` means: if the operator cannot source it, STOP. Do not invent it.
export const WALK_FIELDS = [
  { field: "key", asks: "A short stable handle for this account", source: "Chosen by the operator. No real company name goes in the vault (privacy rule).", refuseIfUnknown: true },
  { field: "demandSignal.id", asks: "The id of the enquiry that started this", source: "The contact-form / inbox record itself.", refuseIfUnknown: true },
  { field: "demandSignal.source", asks: "Where that enquiry arrived", source: "The system that received it (site form, referral, inbound mail).", refuseIfUnknown: true },
  { field: "demandSignal.firstSeenAt", asks: "When it first arrived", source: "The timestamp on that record. Never today's date as a stand-in.", refuseIfUnknown: true },
  { field: "engagements[]", asks: "Real delivery sessions with real durations", source: "Ticket log or session records. Observed minutes only — never estimated.", refuseIfUnknown: true },
  { field: "costBasis", asks: "Monthly operator cost and available minutes", source: "The recorded cost basis document for the period.", refuseIfUnknown: true },
  { field: "quoteCad", asks: "The price you intend to ask", source: "The operator's own quote. Priced against the floor, never below it.", refuseIfUnknown: true },
  { field: "recipient", asks: "Who the ask would go to", source: "A real named person and address from the enquiry. No placeholder.", refuseIfUnknown: true },
];

// The modules this walk drives. Static-scanned send-incapable, all of them.
export const CHAIN_MODULES = [
  "account-intake.mjs",
  "first-packet-pass.mjs",
  "ask-ready-queue.mjs",
  "send-packet.mjs",
  "ask-ledger.mjs",
  "first-account-walk.mjs",
];

function str(v) { return typeof v === "string" && v.trim() ? v.trim() : null; }

/** The printed guide — stable, source-annotated, usable before any data exists. */
export function walkSteps() {
  return [
    {
      n: 1,
      title: "Record the account exactly as it happened",
      detail: "Enter only what you can point at. Every field below names its source; if you cannot source one, stop there — the walk will tell you what is missing rather than let you guess.",
      fields: WALK_FIELDS.map((f) => ({ ...f })),
    },
    {
      n: 2,
      title: "Run the pass",
      detail: "The pass records the account, checks it against the ask gates, and produces either a complete priced packet or the list of what is missing. It cannot produce both and it cannot produce neither.",
      gates: GATES.map((g) => ({ key: g.key, text: g.text || g.label || g.key })),
    },
    {
      n: 3,
      title: "Read the one line at the end",
      detail: "Either a packet location — staged, not sent — or a named gap list in the same words the gates use. There is no third outcome and no partial credit.",
      note: ONE_CLICK_NOTE,
    },
  ];
}

/**
 * input: {
 *   account?, artifacts?, recipient?, costAccountMonths?,   // exactly what N2 takes
 *   realAccount?: true                                       // the operator asserts this is not a fixture
 * }
 */
export function runFirstAccountWalk(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const account = src.account && typeof src.account === "object" ? src.account : null;
  const fixture = src.realAccount !== true;

  const base = {
    schema: FIRST_ACCOUNT_WALK_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    fixture,
    fixtureWarning: fixture ? FIXTURE_WARNING : null,
    steps: walkSteps(),
    chainModules: CHAIN_MODULES.slice(),
    oneClickNote: ONE_CLICK_NOTE,
  };

  // --- runnable with nothing recorded -----------------------------------------------------------
  if (!account || !str(account.key)) {
    return {
      ...base,
      outcome: "nothing-recorded",
      packet: null,
      packetLocation: null,
      gaps: [],
      statement: NOTHING_RECORDED_STATEMENT,
      noAccountStatement: NO_ACCOUNT_STATEMENT,
      refusals: [],
    };
  }

  const key = str(account.key);

  // --- which asked-for fields the operator could not source ------------------------------------
  // N1 is the authority on completeness; the walk only reports the refusal in the operator's terms.
  const intake = buildAccountIntake({ account }, { now });
  const record = intakeRecord(intake, key);
  const missing = record && record.complete ? [] : missingForAskReady(intake, key);
  const refusals = missing.map((m) => ({
    gate: m.gate || null,
    text: m.text || null,
    refusedRatherThanDefaulted: true,
  }));

  // --- run the real pass -------------------------------------------------------------------------
  const pass = runFirstPacketPass(
    { account, artifacts: src.artifacts, recipient: src.recipient, costAccountMonths: src.costAccountMonths },
    { now },
  );

  if (pass.outcome === "packet" && pass.packet) {
    return {
      ...base,
      outcome: "packet",
      packet: pass.packet,
      // Staged, never sent. The "location" is the staged packet's own identity, not a path on disk.
      packetLocation: { schema: pass.packet.schema || null, account: pass.packet.account || key, staged: true, sent: false },
      gaps: [],
      refusals: [],
      statement: fixture
        ? `A complete packet was produced for ${key}. ${FIXTURE_WARNING}`
        : `A complete packet was produced for ${key}. It is staged and unsent; sending is a deliberate human step.`,
      gateVocabulary: GATE_KEYS.slice(),
    };
  }

  const gaps = Array.isArray(pass.gaps) ? pass.gaps : [];
  return {
    ...base,
    outcome: "gaps",
    packet: null,
    packetLocation: null,
    gaps,
    refusals,
    statement: `${key} is not ask-ready. What is missing is named below, in the same words the gates use — nothing was defaulted to get past a gate.`,
    gateVocabulary: GATE_KEYS.slice(),
  };
}

export function firstAccountWalkMarkdown(walk) {
  if (!walk || walk.schema !== FIRST_ACCOUNT_WALK_SCHEMA) return "_no walk_";
  const L = ["# Your first account — the whole path", "", walk.statement, ""];
  if (walk.fixture) L.push(`> ${FIXTURE_WARNING}`, "");

  for (const s of walk.steps) {
    L.push(`## ${s.n}. ${s.title}`, "", s.detail, "");
    for (const f of s.fields || []) L.push(`- **${f.field}** — ${f.asks}. _Source:_ ${f.source}`);
    if (s.fields) L.push("");
  }

  L.push("## Result", "");
  if (walk.outcome === "packet") {
    L.push(`A complete packet for **${walk.packetLocation.account}** — staged, not sent.`, "");
  } else if (walk.outcome === "gaps") {
    L.push("Not ask-ready. Missing, in the gates' own words:", "");
    for (const g of walk.gaps) L.push(`- [${g.gate || "?"}] ${g.text || ""}`);
    L.push("");
  } else {
    L.push(`_${walk.statement}_`, "");
  }
  return L.join("\n");
}
