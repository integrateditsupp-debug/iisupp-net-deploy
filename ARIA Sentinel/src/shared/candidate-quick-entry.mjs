// candidate-quick-entry.mjs — RUN-S S1: THE ONE-MINUTE ENTRY PATH.
//
// WHY (RUN-S, 2026-07-28): Q1 has been able to record a candidate for a full cycle and the count is
// still zero. That is not a software gap — the software is waiting. What is missing is a place a
// human with a name in their head can PUT it, at the moment the name exists, from the surface they
// are already looking at (R1's hour plan), in under a minute. A name that has to wait for someone to
// open a tool is a name that never gets written down.
//
// S1 is a THIN ENTRY PATH over Q1. It is deliberately not a second recorder:
//   - EVERY REFUSAL IS Q1'S REFUSAL, VERBATIM. This module never phrases its own rejection and never
//     accepts a field Q1 would refuse. Speed may not be bought with a softer gate — that trade is the
//     exact mechanism by which a "fast CRM" fills with values nobody ever observed.
//   - IT DOES NOT RE-ASK FOR WHAT THE SYSTEM ALREADY HAS. The local handle is allocated from the
//     existing list and the operator's name is carried from the session. Neither is a fact ABOUT the
//     person, so neither can launder an inference into the record.
//   - IT IS REACHABLE WHERE THE HOUR PLAN RENDERS, not behind a tab nobody opens.
//   - Rule 11 absolute: the entry path targets untracked operator state ONLY. It holds nothing and
//     writes nothing, and exports constants a static test asserts rather than trusts.
//   - PURE + LOCAL. No fs, no net, no spawn, no env, no persistence, no transport, no scheduler.
//   - Rule 15 additive: Q1/Q2/Q3/R1/R2 are untouched.

import {
  recordCandidate,
  REQUIRED_FIELDS,
  REQUIRED_KEYS,
  CANDIDATE_RECORD_SCHEMA,
  PRIVACY_NOTE,
  NO_AUTOMATION_NOTE,
} from "./candidate-record.mjs";
import { HOUR_PLAN_SCHEMA } from "./hour-plan.mjs";

export const QUICK_ENTRY_SCHEMA = "candidate-quick-entry.v1";

// Belt-and-braces, asserted by the test. None of these can flip true anywhere in this module.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// This module cannot reach anything, and cannot be the thing that writes.
export const PERSISTS = false;
export const HAS_TRANSPORT = false;
export const HAS_SCHEDULER = false;
export const WRITES_TRACKED = false;
export const WRITES_SERVEABLE = false;

/** Where the caller — never this module — is permitted to put the result. */
export const WRITE_TARGET = Object.freeze({
  kind: "untracked-operator-state",
  tracked: false,
  serveable: false,
  vaultNote: false,
  note:
    "The caller writes the record into the operator's own untracked state. A candidate field may " +
    "never reach a tracked path, a serveable path, or a vault note (vault Rule 11).",
});

/** Where the entry point lives. Not a new tool, not a new tab — the surface already open. */
export const ENTRY_SURFACE = "hour-plan";

export const IS_NOT = Object.freeze([
  "not an importer",
  "not an enrichment step",
  "not a second recorder with its own rules",
  "not a queue anything is sent from",
]);

export const SPEED_NOTE =
  "One pass, three facts, each with the sentence saying where it came from. It is short because " +
  "there is little to say, not because anything was waived: every refusal is Q1's own, word for word.";

export const PREFILL_NOTE =
  "The local handle and the operator's name are filled from state the system already holds. Neither " +
  "is a fact about the person, so neither can stand as the source of one.";

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

function norm(v) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Allocate the next local handle from the existing list. Deterministic, gap-tolerant, and about the
 * RECORD rather than the person (vault Rule 11): cand-001, cand-002, ...
 */
export function nextCandidateKey(list = null) {
  const existing = list && list.schema === CANDIDATE_RECORD_SCHEMA && Array.isArray(list.candidates)
    ? list.candidates
    : [];
  let max = 0;
  for (const c of existing) {
    const m = /^cand-(\d+)$/.exec(norm(c && c.key));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `cand-${String(max + 1).padStart(3, "0")}`;
}

/**
 * The entry point itself, built to hang off the hour plan the human is already reading.
 * It carries Q1's field vocabulary UNCHANGED — the prompts a human sees are Q1's own `asks` strings,
 * so the form cannot drift away from the gate that judges it.
 */
export function buildQuickEntry({ plan = null, list = null, operator = null } = {}, { now = Date.now() } = {}) {
  const planOk = !!plan && plan.schema === HOUR_PLAN_SCHEMA;
  const knownOperator = nonEmpty(operator, 2) ? norm(operator) : null;

  return {
    schema: QUICK_ENTRY_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    surface: ENTRY_SURFACE,
    reachableFromPlan: planOk,
    // Absence of a plan is stated, never silently treated as "reachable anyway".
    reachabilityStatement: planOk
      ? "Reachable from the hour plan the operator is already reading - no new tool, no new tab."
      : "No hour plan was supplied, so this entry point is not attached to a surface yet. It is not reachable.",
    prefill: {
      key: nextCandidateKey(list),
      enteredBy: knownOperator,
      note: PREFILL_NOTE,
    },
    // Q1's own fields, in Q1's own words. Three, and no fourth may be added here.
    fields: REQUIRED_FIELDS,
    fieldKeys: [...REQUIRED_KEYS],
    fieldCount: REQUIRED_KEYS.length,
    // Each field carries its own provenance sentence, so the human types six things, not three.
    sentencesAsked: REQUIRED_KEYS.length * 2,
    speedNote: SPEED_NOTE,
    isNot: [...IS_NOT],
    noAutomationNote: NO_AUTOMATION_NOTE,
    privacyNote: PRIVACY_NOTE,
    writeTarget: WRITE_TARGET,
    persists: PERSISTS,
    hasTransport: HAS_TRANSPORT,
    hasScheduler: HAS_SCHEDULER,
    writesTracked: WRITES_TRACKED,
    writesServeable: WRITES_SERVEABLE,
    sent: SENT,
  };
}

/**
 * Submit one entry. The shape is flat because a human typing fast should not have to nest objects;
 * the fields are then handed to Q1 UNCHANGED and Q1 alone decides.
 *
 * input: { key?, enteredBy?, name, nameSource, contact, contactSource, problemBasis, problemBasisSource, notes? }
 *
 * Returns Q1's own result object, with the entry-path metadata attached BESIDE it — never merged
 * into it, so no caller can mistake this module's bookkeeping for Q1's verdict.
 */
export function submitQuickEntry(input = {}, { entry = null, now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const key = nonEmpty(src.key, 2) ? norm(src.key) : (entry && entry.prefill ? entry.prefill.key : "");
  const enteredBy = nonEmpty(src.enteredBy, 2)
    ? norm(src.enteredBy)
    : (entry && entry.prefill && entry.prefill.enteredBy ? entry.prefill.enteredBy : "");

  const q1Input = {
    key,
    enteredBy,
    name: { value: src.name, source: src.nameSource },
    contact: { value: src.contact, source: src.contactSource },
    problemBasis: { value: src.problemBasis, source: src.problemBasisSource },
    notes: src.notes,
  };

  // Q1 decides. This module adds nothing to the verdict and removes nothing from it.
  const result = recordCandidate(q1Input, { now });

  return {
    schema: QUICK_ENTRY_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    surface: ENTRY_SURFACE,
    viaQuickEntry: true,
    // The verdict, untouched.
    result,
    recorded: result.recorded === true,
    refused: result.refused === true,
    refusedFields: result.refusedFields ? result.refusedFields.slice() : [],
    candidate: result.candidate,
    // Where the CALLER must put it. This module did not write it anywhere.
    writeTarget: WRITE_TARGET,
    persists: PERSISTS,
    writesTracked: WRITES_TRACKED,
    writesServeable: WRITES_SERVEABLE,
    hasTransport: HAS_TRANSPORT,
    privacyNote: PRIVACY_NOTE,
    sent: SENT,
  };
}

export function quickEntryMarkdown(entry) {
  if (!entry || entry.schema !== QUICK_ENTRY_SCHEMA) return "_no entry point_\n";
  const out = ["### Write down a name", "", entry.reachabilityStatement, ""];
  for (const f of entry.fields) out.push(`- **${f.label}** - ${f.asks}`);
  out.push("", `_${entry.speedNote}_`, "", `_This is ${entry.isNot.join(", ")}._`, "", `_${entry.privacyNote}_`, "");
  return out.join("\n");
}
