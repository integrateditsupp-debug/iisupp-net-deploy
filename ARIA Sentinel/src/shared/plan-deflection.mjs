// plan-deflection — STAGE 3 (ARE) Feeds: the PLAN-LEVEL autonomous-resolution rate, computed straight from
// the hash-chained Resolution-Plan journal. This is the sellable Stage-3 number ("Sentinel fixed it end-to-end,
// unattended") and it is a DIFFERENT grain from resolution-outcome.mjs's chat "was this fixed?" deflection
// (RUN-B B1). The spec's Feeds line asks for exactly this: "Real deflection % FROM JOURNAL -> RUN-B B1 ->
// Stage-4 Trust Center -> Stage-5 conversion." Until now only the chat-grain number existed.
//
// Pure + node-safe: no DOM, no Electron, no I/O. It READS journal entries the main process already persists
// (~/.aria-sentinel/plans/<planRunId>.jsonl) and owns every counting decision so it is fully unit-tested. It
// reuses plan-journal's replayState/verifyChain UNCHANGED (0 edits to the journal, 0 edits to any frozen file).
//
// Rule 14 (honesty IS the moat) - every field is REAL-OR-EMPTY and the rate can only ever move DOWN or stay
// honest; it can never be inflated:
//   - Success is declared by the goalProbe, never by step completion - so ONLY a terminal PLAN.RESOLVED counts,
//     and the plan-executor emits PLAN.RESOLVED solely after the goalProbe passes.
//   - no-op-neutral is never a fix: a PLAN.RESOLVED carrying extra.noChange === true ("already healthy - not
//     counted as an ARIA fix") is EXCLUDED from both numerator and denominator.
//   - a dry-run never claims success: dry-run runs (terminal ABORTED code DRY_RUN, or any dryRun-marked entry)
//     are excluded entirely - a rehearsal is not an attempt.
//   - a tampered chain can never inflate the number: if verifyChain fails, the run is UNTRUSTED and excluded,
//     even if its last entry says RESOLVED.
//   - the denominator is only plans that actually reached a LIVE attempt (resolved / escalated / aborted-after-
//     execution). Pre-execution aborts (user declined, kill-switch, countdown, R11-blocked, unattended-off...)
//     are NOT counted as attempts - we never "tried and failed" if we never touched the machine.
//   - deflectionPct is null until at least one real attempt exists - NEVER a flattering default.

import { verifyChain, replayState } from "./plan-journal.mjs";

export const PLAN_DEFLECTION_SCHEMA = "plan-deflection.v1";

// The mutually-exclusive outcome buckets a single plan-run journal can fall into.
export const PLAN_RUN_STATUS = Object.freeze([
  "resolved-fix",          // goalProbe passed AND a step changed something  -> the ONE numerator
  "already-healthy",       // goalProbe passed but nothing changed           -> excluded (no-op-neutral)
  "escalated",             // handed to IIS                                  -> attempted, not deflected
  "aborted-executed",      // aborted/rolled-back AFTER a live step ran       -> attempted, not deflected
  "aborted-pre-execution", // aborted BEFORE any live step (declined/kill/...)-> excluded (never attempted)
  "dry-run",               // rehearsal preview                               -> excluded (claims nothing)
  "interrupted",           // started, no terminal entry yet                  -> excluded (pending)
  "untrusted",             // hash chain broken/tampered                      -> excluded (cannot trust)
  "empty"                  // no entries                                      -> excluded
]);

const EXECUTION_EVENTS = new Set(["PLAN.STEP.EXEC", "PLAN.STEP.POST", "PLAN.STEP.ROLLBACK"]);

function asEntries(journal) {
  if (Array.isArray(journal)) return journal;
  if (journal && Array.isArray(journal.entries)) return journal.entries;
  return [];
}

// Did this run reach a LIVE step? (structural, not a brittle code list - these events only exist post-approval,
// and the executor never writes STEP.EXEC/POST under dry-run.)
function reachedLiveExecution(entries) {
  return entries.some((e) => e && EXECUTION_EVENTS.has(e.event));
}

function looksDryRun(entries) {
  const last = entries.length ? entries[entries.length - 1] : null;
  if (last && last.event === "PLAN.ABORTED" && last.extra && last.extra.code === "DRY_RUN") return true;
  return entries.some((e) => e && e.extra && (e.extra.dryRun === true || e.extra.dry_run === true));
}

/**
 * Classify ONE plan-run journal (an array of entries, or { entries }). Total + honest: every real ARE outcome
 * maps to exactly one bucket, and the only bucket that feeds the deflection numerator is "resolved-fix".
 */
export function classifyPlanRun(journal) {
  const entries = asEntries(journal);
  if (entries.length === 0) return { status: "empty", attempted: false, deflected: false };

  // A tampered chain is untrustworthy in BOTH directions - a forged "RESOLVED" must never inflate the rate.
  if (!verifyChain(entries).ok) return { status: "untrusted", attempted: false, deflected: false };

  // A rehearsal is not an attempt.
  if (looksDryRun(entries)) return { status: "dry-run", attempted: false, deflected: false };

  const state = replayState(entries);
  if (!state.terminal) return { status: "interrupted", attempted: false, deflected: false };

  const last = entries[entries.length - 1];
  const extra = (last && last.extra) || {};

  if (state.outcomeEvent === "PLAN.RESOLVED") {
    // Success is goalProbe-declared (the executor only writes RESOLVED after the probe passes). But a probe that
    // passed WITHOUT any step changing anything is "already healthy" - honestly excluded, never counted as a fix.
    if (extra.noChange === true) return { status: "already-healthy", attempted: false, deflected: false };
    return { status: "resolved-fix", attempted: true, deflected: true };
  }
  if (state.outcomeEvent === "PLAN.ESCALATED") return { status: "escalated", attempted: true, deflected: false };

  // Terminal ABORTED: only counts as an attempt if a live step actually ran (mid-plan failure / rollback).
  if (reachedLiveExecution(entries)) return { status: "aborted-executed", attempted: true, deflected: false };
  return { status: "aborted-pre-execution", attempted: false, deflected: false };
}

/**
 * Full plan-level stats block over an array of plan-run journals. Every field real-or-empty. `deflectionPct`
 * is the autonomous-resolution rate = resolved-fix / live attempts, null until a real attempt exists.
 */
export function planDeflectionStats(journals = []) {
  const list = Array.isArray(journals) ? journals : [];
  const tally = {
    resolvedFix: 0, escalated: 0, abortedExecuted: 0,
    alreadyHealthy: 0, abortedPreExecution: 0, dryRun: 0, interrupted: 0, untrusted: 0, empty: 0
  };
  for (const j of list) {
    switch (classifyPlanRun(j).status) {
      case "resolved-fix": tally.resolvedFix++; break;
      case "escalated": tally.escalated++; break;
      case "aborted-executed": tally.abortedExecuted++; break;
      case "already-healthy": tally.alreadyHealthy++; break;
      case "aborted-pre-execution": tally.abortedPreExecution++; break;
      case "dry-run": tally.dryRun++; break;
      case "interrupted": tally.interrupted++; break;
      case "untrusted": tally.untrusted++; break;
      default: tally.empty++; break;
    }
  }
  const attempted = tally.resolvedFix + tally.escalated + tally.abortedExecuted;
  const deflectionPct = attempted === 0 ? null : Math.max(0, Math.min(100, Math.round((tally.resolvedFix / attempted) * 100)));
  return {
    schema: PLAN_DEFLECTION_SCHEMA,
    attempted,                              // live-fix attempts that reached a real outcome (the denominator)
    resolved: tally.resolvedFix,            // the numerator - goalProbe-proven, real-change fixes only
    escalated: tally.escalated,             // honestly handed to IIS (the MSP-retainer story)
    abortedDuringExecution: tally.abortedExecuted,
    alreadyHealthy: tally.alreadyHealthy,   // excluded (no-op-neutral)
    abortedPreExecution: tally.abortedPreExecution,
    dryRun: tally.dryRun,                   // excluded (rehearsals)
    interrupted: tally.interrupted,         // excluded (pending)
    untrusted: tally.untrusted,             // excluded (tamper-flagged)
    deflectionPct,
    sample: attempted                       // buyers always ask "out of how many?"
  };
}

// Autonomous-resolution rate = resolved / attempts, real-or-empty (null until a real attempt exists).
export function planDeflectionRate(journals = []) {
  return planDeflectionStats(journals).deflectionPct;
}

// Buyer-facing alias - the same real number under the name buyers use for Stage-3.
export const autonomousResolutionRate = planDeflectionRate;

// Dashboard tile descriptor - honest empty-state ("--") until real data exists, exactly like every other tile.
export function planDeflectionTile(journals = []) {
  const st = planDeflectionStats(journals);
  return {
    id: "plan-deflection",
    label: "Autonomous resolution (plans fixed end-to-end)",
    value: st.deflectionPct,     // null -> renderer shows "--", never a fabricated %
    unit: "%",
    sample: st.sample,
    resolved: st.resolved,
    attempted: st.attempted
  };
}

// The feed the RUN-B B1 surface + Stage-4 Trust Center consume. Real-or-empty throughout: with no attempts,
// rate/attempted/resolved stay null so downstream shows an honest empty-state instead of a flattering number.
export function planProofFeed(journals = []) {
  const st = planDeflectionStats(journals);
  const has = st.attempted > 0;
  return {
    schema: PLAN_DEFLECTION_SCHEMA,
    autonomousResolutionPct: st.deflectionPct,          // null until real
    plansFixed: has ? st.resolved : null,
    plansAttempted: has ? st.attempted : null,
    plansEscalated: has ? st.escalated : null,           // the escalation -> retainer story, honestly counted
    // context the Trust Center can show truthfully but that never touches the headline rate:
    alreadyHealthy: st.alreadyHealthy,
    pendingInterrupted: st.interrupted,
    untrustedFlagged: st.untrusted
  };
}
