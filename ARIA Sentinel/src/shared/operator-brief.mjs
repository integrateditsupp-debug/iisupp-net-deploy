// operator-brief.mjs — RUN-O O1: ONE CURRENT ENTRY POINT.
//
// WHY (RUN-O, 2026-07-28): fifteen sequences have produced fifty-plus operator scripts, a staging
// area with eight bundles, and a ledger measured in thousands of lines. To act on any of it a
// human first has to do archaeology: which script is current, what will it do, what will it refuse
// to do, and what is genuinely blocked on a person. The operator surface has been growing faster
// than the operator's time, and that — not the code — is the binding constraint on revenue.
// O1 is one screen that answers those four questions from real state only.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - EXACTLY ONE CURRENT SCRIPT. Every other operator script is marked SUPERSEDED IN PLACE with a
//     pointer to the current one — never deleted, never renamed (Rule 15). If the input cannot
//     identify a single current script, the brief says so rather than guessing.
//   - EMPTY IS A VALID STATE and reads as "nothing is staged", never as momentum. `momentumSafe()`
//     is asserted over every rendered line by the test.
//   - ZERO HAND-WRITTEN STATE. Everything displayed is derived from the same normalised truth the
//     AXIS feed and the ledger head read (program-truth.mjs). `factsOf()` must deep-equal theirs.
//   - REFUSALS NAME THEIR GATE. A blocked item without a named gate is dropped and counted, never
//     shown as a vague "waiting".
//   - PURE. No fs, no net, no spawn — static-scanned. The filesystem scan that feeds it lives in
//     scripts/lib/operator-surface-scan.mjs, outside the send-incapable chain.
//   - Rule 15 additive: describes the operator surface, mutates nothing on it.

import { normalizeProgramTruth, factsOf, momentumSafe, PROGRAM_TRUTH_SCHEMA } from "./program-truth.mjs";

export const OPERATOR_BRIEF_SCHEMA = "operator-brief.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// The brief is operator-internal. It names scripts and staging paths; it is never public.
export const INTERNAL_ONLY = true;
export const PUBLIC_SAFE = false;

export const NOTHING_STAGED = "Nothing is staged. There is no pending one-click and nothing waiting to be published.";
export const NO_CURRENT_SCRIPT = "No single current script could be identified from real state — resolve that before running anything.";
export const SUPERSEDED_MARKER = "SUPERSEDED";

// The only legitimate reasons a thing waits on a human. Anything else is a hold, and a hold is a
// failure — it gets dropped from the brief and counted, never rendered as a soft "pending".
export const HUMAN_GATES = [
  "publish",        // public deploy of the site
  "push",           // publishing the verified line (blocked only by a missing credential)
  "send",           // outreach leaving the building
  "sign",           // signature
  "pay",            // payment, invoicing, charge
  "account",        // account creation
  "consent",        // admin consent
];

function str(v) { return typeof v === "string" && v.trim() ? v.trim() : null; }

/**
 * input: {
 *   truth,        // raw program-truth input, or an already-normalised program-truth.v1
 *   staging: [ { id, path, headDescribed?, stagedAt?, suiteResult?, current? } ],
 *   scripts: [ { name, purpose?, refuses?, forRun?, current? } ],
 *   blocked: [ { gate, what, why? } ],
 * }
 */
export function buildOperatorBrief(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};

  const truth = src.truth && src.truth.schema === PROGRAM_TRUTH_SCHEMA
    ? src.truth
    : normalizeProgramTruth(src.truth || {}, { now });

  const staging = Array.isArray(src.staging)
    ? src.staging.filter((s) => s && typeof s === "object" && str(s.id))
    : [];
  const rawScripts = Array.isArray(src.scripts)
    ? src.scripts.filter((s) => s && typeof s === "object" && str(s.name))
    : [];

  // --- exactly one current script -----------------------------------------------------------
  const flaggedCurrent = rawScripts.filter((s) => s.current === true);
  const currentScript = flaggedCurrent.length === 1 ? flaggedCurrent[0] : null;

  const scripts = rawScripts.map((s) => {
    const isCurrent = currentScript ? s.name === currentScript.name : false;
    return {
      name: str(s.name),
      purpose: str(s.purpose),
      refuses: str(s.refuses),
      forRun: str(s.forRun),
      current: isCurrent,
      // Rule 15: superseded is a MARKER, applied in place. Nothing is deleted or renamed.
      status: isCurrent ? "CURRENT" : SUPERSEDED_MARKER,
      supersededBy: isCurrent ? null : (currentScript ? currentScript.name : null),
    };
  });

  // --- what is staged right now ---------------------------------------------------------------
  const staged = staging.map((s) => ({
    id: str(s.id),
    path: str(s.path),
    headDescribed: str(s.headDescribed),
    stagedAt: str(s.stagedAt),
    suiteResult: str(s.suiteResult),
    current: currentScript ? s.current === true : false,
  }));

  // --- what is genuinely blocked on a human ----------------------------------------------------
  const rawBlocked = Array.isArray(src.blocked) ? src.blocked.filter((b) => b && typeof b === "object") : [];
  const blocked = [];
  const droppedUnnamed = [];
  for (const b of rawBlocked) {
    const gate = str(b.gate);
    const what = str(b.what);
    if (!gate || !HUMAN_GATES.includes(gate) || !what) { droppedUnnamed.push(b); continue; }
    blocked.push({ gate, what, why: str(b.why) });
  }

  const empty = staged.length === 0 && scripts.length === 0;

  const headline = empty
    ? NOTHING_STAGED
    : (currentScript
        ? `One current script: ${currentScript.name}. ${staged.length} bundle(s) staged. ${blocked.length} item(s) need a person.`
        : NO_CURRENT_SCRIPT);

  const brief = {
    schema: OPERATOR_BRIEF_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    internalOnly: INTERNAL_ONLY,
    publicSafe: PUBLIC_SAFE,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,

    empty,
    headline,

    // the four questions this screen exists to answer
    whatIsStaged: staged,
    currentScript: currentScript
      ? {
          name: str(currentScript.name),
          purpose: str(currentScript.purpose),
          willRefuse: str(currentScript.refuses),
          forRun: str(currentScript.forRun),
        }
      : null,
    supersededScripts: scripts.filter((s) => !s.current),
    blockedOnAHuman: blocked,

    // one truth, three surfaces
    truth,
    programStatement: truth.tests.statement,
    revenueStatement: truth.revenue.revenueStatement,
    asksStatement: truth.revenue.asksStatement,
    // RUN-P P3 — staged and sent are separate lines on this surface too. Never one line, never merged.
    stagedStatement: truth.revenue.stagedStatement,
    // RUN-R R3 — conversations held is a FIFTH separate line and the first one a reader sees.
    conversationsStatement: truth.revenue.conversationsStatement,
    // RUN-S S3 — hours spent, a SIXTH line, immediately beside the fifth it qualifies.
    hoursStatement: truth.revenue.hoursStatement,
    // RUN-T T2 — how long it has been. `never` is a different fact from `0 days` on this surface too.
    elapsedHourStatement: truth.elapsed.hourStatement,
    elapsedConversationStatement: truth.elapsed.conversationStatement,
    // RUN-Q Q3 — candidates is a FOURTH separate line. A written-down name is not an ask.
    candidatesStatement: truth.revenue.candidatesStatement,
    unpushedStatement: truth.unpushed.statement,
    mainRefStatement: truth.mainRef.statement,

    counts: {
      staged: staged.length,
      scripts: scripts.length,
      superseded: scripts.filter((s) => !s.current).length,
      blocked: blocked.length,
      droppedUnnamedGates: droppedUnnamed.length,
    },
  };

  return brief;
}

/** Must deep-equal ledgerHeadFacts() and the AXIS headline facts. Drift = suite red. */
export function operatorBriefFacts(brief) {
  if (!brief || brief.schema !== OPERATOR_BRIEF_SCHEMA) return null;
  return factsOf(brief.truth);
}

export function operatorBriefMarkdown(brief) {
  if (!brief || brief.schema !== OPERATOR_BRIEF_SCHEMA) return "_no brief_";
  const L = ["# Operator brief — start here (internal only)", "", brief.headline, ""];

  L.push("## Run this, and only this", "");
  if (!brief.currentScript) {
    L.push(`_${NO_CURRENT_SCRIPT}_`, "");
  } else {
    L.push(`**${brief.currentScript.name}**`, "");
    if (brief.currentScript.purpose) L.push(`- What it does: ${brief.currentScript.purpose}`);
    if (brief.currentScript.willRefuse) L.push(`- What it refuses to do: ${brief.currentScript.willRefuse}`);
    if (brief.currentScript.forRun) L.push(`- Covers: ${brief.currentScript.forRun}`);
    L.push("");
  }

  L.push("## Staged right now", "");
  if (!brief.whatIsStaged.length) L.push("_nothing is staged._", "");
  for (const s of brief.whatIsStaged) {
    L.push(`- ${s.id}${s.suiteResult ? ` — suite ${s.suiteResult}` : ""}${s.stagedAt ? ` (staged ${s.stagedAt})` : ""}`);
  }

  L.push("", "## Waiting on a person", "");
  if (!brief.blockedOnAHuman.length) L.push("_nothing is waiting on a person._", "");
  for (const b of brief.blockedOnAHuman) L.push(`- [${b.gate}] ${b.what}${b.why ? ` — ${b.why}` : ""}`);

  L.push("", "## Where the program actually stands", "",
    `- ${brief.programStatement}`,
    `- ${brief.unpushedStatement}`,
    `- ${brief.mainRefStatement}`,
    `- ${brief.conversationsStatement}`,
    `- ${brief.hoursStatement}`,
    `- ${brief.elapsedHourStatement}`,
    `- ${brief.elapsedConversationStatement}`,
    `- ${brief.candidatesStatement}`,
    `- ${brief.stagedStatement}`,
    `- ${brief.asksStatement}`,
    `- ${brief.revenueStatement}`, "");

  L.push("## Superseded scripts (kept in place, never deleted)", "");
  if (!brief.supersededScripts.length) L.push("_none._", "");
  for (const s of brief.supersededScripts) {
    L.push(`- ${s.name} — ${SUPERSEDED_MARKER}${s.supersededBy ? `, use ${s.supersededBy}` : ""}`);
  }
  L.push("");
  return L.join("\n");
}

/** Guard used by the test: no rendered line may wear momentum language. */
export function briefIsMomentumSafe(brief) {
  return momentumSafe(operatorBriefMarkdown(brief));
}
