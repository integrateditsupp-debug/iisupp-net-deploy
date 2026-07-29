// STAGE 3 S2 · Sentinel brain-audit F2 (pure half) — GOAL-PROBE GRADE + HONEST RESOLUTION CLAIM.
//
// The gap (F2, RED): `plan-executor` emits PLAN.RESOLVED the moment the goalProbe passes — but every
// probe grade the plan schema can express today is SERVICE STATE:
//     PROBE_INTERPRETS = ["service-running", "count-positive"]
// A spooler can be "Running" while printing still fails (offline printer, bad driver); the DNS cache
// can be flushed ("count-positive") while the site still will not resolve. Declaring "issue resolved"
// on service state is a false positive, and it is exactly why users see the problem "come back."
// The audit's rule: success = the user's problem is gone, never step completion, never service state.
//
// The EXECUTING half of F2 (actually printing a test page / resolving a known host) needs a NEW
// allowlisted PowerShell capability — safety-reviewed, Codex-gated, deliberately not built here.
// This module is the pure half that can land safely first and makes that later work honest:
//   1. GRADE every probe: outcome-grade vs service-state-grade vs unknown.
//   2. GATE the claim: only an outcome-grade probe may produce "resolved". A service-state probe that
//      passes yields "unverified" — a true statement ("the service is running again; I have not
//      verified the problem itself is gone"), never a resolution.
//   3. Declare the outcome-probe VOCABULARY the executor binding will implement, so the two halves
//      cannot drift apart. Declaring a name here executes nothing — this module has no I/O at all.
//
// Invariants carried (unchanged from the rest of the lane):
//   R11 is check #1 — an off-limits reference anywhere in the probe/claim input invalidates it
//      BEFORE any grading, and is surfaced content-blind.
//   - Rule 14 real-or-empty: no probe -> no claim. Missing/unknown grade -> "unverified", never a guess.
//   - no-op-neutral is never a fix: a probe that passes without any step changing anything is
//     "no-change" (already healthy), never "resolved" — matching plan-executor's `noChange` entry.
//   - dry-run never claims success — a preview is "preview", terminal, and can never be upgraded.
//   - This module NEVER declares durability. "resolved" here is a first-pass, outcome-proven fix;
//     "durably resolved" remains the durability ledger's decision after its quiet window (F1).
//
// Pure + node-safe: no fs, no spawn, no DOM, no Electron, injectable everything.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "./path-guard.mjs";

export const GRADE_VERSION = "goal-probe-grade-v1";

/** Grades, weakest -> strongest. Only OUTCOME may declare a resolution. */
export const GRADE_UNKNOWN = "unknown";
export const GRADE_SERVICE_STATE = "service-state";
export const GRADE_OUTCOME = "outcome";
export const GRADE_RANK = Object.freeze({ [GRADE_UNKNOWN]: 0, [GRADE_SERVICE_STATE]: 1, [GRADE_OUTCOME]: 2 });

/**
 * The probe grades the plan schema can express TODAY (`resolution-plan.mjs` PROBE_INTERPRETS).
 * Both prove a service/side-effect state, not the user's outcome — that is the whole F2 finding.
 */
export const SERVICE_STATE_INTERPRETS = Object.freeze(["service-running", "count-positive"]);

/**
 * The outcome-grade vocabulary F2's executor binding will implement (allowlisted capability, Codex
 * review). Listing a name here is a CONTRACT, not a capability: nothing in this file can run any of
 * them. `isOutcomeProbeBound` (injected) is what decides whether one is actually live yet.
 */
export const OUTCOME_INTERPRETS = Object.freeze([
  "print-test-page-succeeded", // printing works end-to-end, not "spooler is Running"
  "host-resolves",             // a known host actually resolves, not "cache was flushed"
  "endpoint-reachable",        // the thing the user was trying to reach answers
  "audio-playback-verified"    // sound actually plays out, not "audio service restarted"
]);

/** Claims this module can return. `resolved` is the ONLY one that may be shown as a fix. */
export const CLAIM_RESOLVED = "resolved";
export const CLAIM_UNVERIFIED = "unverified";
export const CLAIM_NOT_RESOLVED = "not-resolved";
export const CLAIM_NO_CHANGE = "no-change";
export const CLAIM_PREVIEW = "preview";
export const CLAIM_BLOCKED = "blocked";

const str = (v) => String(v == null ? "" : v);

function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch { return String(obj); }
}

/**
 * Grade a probe spec ({ command, interpret, description }).
 * R11 first. Real-or-empty: a missing/blank probe grades `unknown` and can never claim a fix.
 * @returns {{grade:string, interpret:string, canDeclareResolved:boolean, bound:boolean, reason:string, surfaced?:string}}
 */
export function gradeProbe(probe, opts = {}) {
  if (isBlockedPath(safeStringify(probe))) {
    return { grade: GRADE_UNKNOWN, interpret: "", canDeclareResolved: false, bound: false, reason: "R11: probe references the off-limits private folder", surfaced: R11_SURFACE };
  }
  if (!probe || typeof probe !== "object") {
    return { grade: GRADE_UNKNOWN, interpret: "", canDeclareResolved: false, bound: false, reason: "no probe — no success claim (real-or-empty)" };
  }
  const interpret = str(probe.interpret).trim();
  if (!interpret) {
    return { grade: GRADE_UNKNOWN, interpret: "", canDeclareResolved: false, bound: false, reason: "probe has no interpret grade" };
  }
  if (SERVICE_STATE_INTERPRETS.includes(interpret)) {
    return {
      grade: GRADE_SERVICE_STATE, interpret, canDeclareResolved: false, bound: true,
      reason: `"${interpret}" proves service state, not that the user's problem is gone (F2)`
    };
  }
  if (OUTCOME_INTERPRETS.includes(interpret)) {
    // A declared outcome probe still needs a LIVE binding before it may declare anything — otherwise
    // we would claim a fix on a probe that never ran. Default: not bound until the caller says so.
    const isBound = typeof opts.isOutcomeProbeBound === "function" ? opts.isOutcomeProbeBound : () => false;
    const bound = Boolean(isBound(interpret));
    return {
      grade: GRADE_OUTCOME, interpret, canDeclareResolved: bound, bound,
      reason: bound
        ? `"${interpret}" proves the user's outcome`
        : `"${interpret}" is outcome-grade but has no live executor binding yet (F2 binding pending) — cannot declare a fix`
    };
  }
  return { grade: GRADE_UNKNOWN, interpret, canDeclareResolved: false, bound: false, reason: `unknown probe grade "${interpret}" — never assumed to prove an outcome` };
}

/** Convenience: does this plan's goalProbe prove the user's outcome? */
export function planProvesOutcome(plan, opts = {}) {
  return gradeProbe(plan && plan.goalProbe, opts).canDeclareResolved === true;
}

/**
 * The honest claim for a finished plan run. This is the single decision the (gated) executor/renderer
 * wiring should consult before showing ANY "issue resolved" line.
 *
 * @param {object} input
 *  - plan            the Resolution Plan (its goalProbe is graded)
 *  - probePassed     did the goalProbe pass? (boolean; anything non-true is treated as not passed)
 *  - anyStepChanged  did any step actually change system state? (no-op-neutral is never a fix)
 *  - dryRun          preview run — can never claim success, at any grade
 *  - evidence        probe output; carried through R11-redacted, never invented
 */
export function resolutionClaim(input = {}, opts = {}) {
  const { plan = null, probePassed = false, anyStepChanged = false, dryRun = false, evidence = "" } = input;

  // 1 — R11 is check #1, before anything else is considered.
  if (isBlockedPath(safeStringify({ plan, evidence }))) {
    return {
      claim: CLAIM_BLOCKED, resolved: false, grade: GRADE_UNKNOWN, requiresOutcomeProbe: true,
      line: "Stopped — this touched an excluded folder.", evidence: "", surfaced: R11_SURFACE,
      reason: "R11: off-limits reference in plan or evidence"
    };
  }

  const graded = gradeProbe(plan && plan.goalProbe, opts);
  const safeEvidence = redactPrivate(str(evidence));

  // 2 — dry-run is terminal: a preview never claims success, whatever the grade says.
  if (dryRun === true) {
    return {
      claim: CLAIM_PREVIEW, resolved: false, grade: graded.grade, requiresOutcomeProbe: graded.grade !== GRADE_OUTCOME,
      line: "Preview only — nothing was changed.", evidence: safeEvidence,
      reason: "dry-run never claims success"
    };
  }

  // 3 — the probe did not pass: honest failure, never softened.
  if (probePassed !== true) {
    return {
      claim: CLAIM_NOT_RESOLVED, resolved: false, grade: graded.grade, requiresOutcomeProbe: graded.grade !== GRADE_OUTCOME,
      line: "Couldn't fix this safely — escalated to IIS.", evidence: safeEvidence,
      reason: graded.grade === GRADE_UNKNOWN ? graded.reason : "goalProbe did not pass"
    };
  }

  // 4 — probe passed but nothing changed: already healthy. Never counted as an ARIA fix (Rule 14).
  if (anyStepChanged !== true) {
    return {
      claim: CLAIM_NO_CHANGE, resolved: false, grade: graded.grade, requiresOutcomeProbe: graded.grade !== GRADE_OUTCOME,
      line: "Already healthy — nothing needed changing.", evidence: safeEvidence,
      reason: "no-op-neutral is never a fix"
    };
  }

  // 5 — the F2 gate: only an outcome-grade, live-bound probe may say "resolved".
  if (!graded.canDeclareResolved) {
    const what = graded.grade === GRADE_SERVICE_STATE
      ? "The service is running again — I have not verified the problem itself is gone."
      : "A change was made — I could not verify the problem itself is gone.";
    return {
      claim: CLAIM_UNVERIFIED, resolved: false, grade: graded.grade, requiresOutcomeProbe: true,
      line: `${what} Tell me if it still happens and I'll take it further.`,
      evidence: safeEvidence, reason: graded.reason
    };
  }

  return {
    claim: CLAIM_RESOLVED, resolved: true, grade: GRADE_OUTCOME, requiresOutcomeProbe: false,
    line: `Issue resolved — ${redactPrivate(str((plan && plan.goalProbe && plan.goalProbe.description) || graded.interpret))}.`,
    evidence: safeEvidence, reason: graded.reason
  };
}

/**
 * Deflection guard: which finished runs may be COUNTED as an autonomous resolution.
 * Same law as the claim — outcome-proven, real-change, non-preview only. Anything else is excluded,
 * so the sellable number can never be inflated by service-state passes (Rule 14).
 */
export function countsAsDeflection(input = {}, opts = {}) {
  return resolutionClaim(input, opts).claim === CLAIM_RESOLVED;
}
