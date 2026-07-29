// STAGE 3 · F1 × FEEDS JOIN — the DURABLE autonomous-resolution feed for RUN-B B1 / Stage-4 Trust Center.
//
// The gap this closes (verified in the real code, not assumed). The brain audit's F1 finding is explicit:
// "Deflection metric counts DURABLE resolutions, not first-pass patches." Today two different numbers exist
// and they disagree:
//   • plan-deflection.mjs  → planProofFeed().autonomousResolutionPct — counts a plan the moment its goalProbe
//     passes. That is a FIRST-PASS patch rate. It is the number actually wired toward B1/Stage-4.
//   • durability-ledger.mjs → durabilityMetrics().deflection — counts durable resolutions, but only over the
//     ledger, with no knowledge of journal-grade exclusions (dry-run, tamper, no-op-neutral, pre-exec abort).
// So the sellable number can still say "fixed" for something that came back the next morning — exactly the
// failure Ahmad named ("the problem comes back easily"). This module is the pure JOIN: plan-deflection owns
// WHICH runs are honest attempts, durability-ledger owns WHETHER a fix actually held, and the headline the
// buyer sees is the intersection of the two.
//
// Composition law (Rule 14 — the join may only ever move the number DOWN, never up):
//   • a run must FIRST survive plan-deflection's honesty gates (goalProbe-declared, real-change, non-dry-run,
//     hash-chain-verified, live-execution) before durability is even consulted;
//   • a surviving resolution counts in the numerator ONLY when the ledger says it stayed gone through the quiet
//     monitoring window with no recurrence since (isDurablyResolved);
//   • a resolution that recurred inside the recurrence window is DEMOTED out of the numerator and reported as
//     `recurred` — it stays in the denominator, because we really did attempt it;
//   • a resolution still inside the quiet window is `monitoring`, and a resolution the ledger has never seen is
//     `unrecorded` — neither is ever counted as durable, and neither is silently rounded up;
//   • 🔒 R11: a planId that is path-guard blocked earns NO issue signature, so its durability is unknowable —
//     it is graded `r11-unverifiable` and excluded from the numerator. Unknowable never resolves to optimistic.
// Therefore durableResolutionPct <= autonomousResolutionPct for every possible input (asserted by the tests).
//
// Pure + node-safe: no DOM, no Electron, no fs, no clock of its own (`now` is injected). It reuses
// plan-deflection and durability-ledger UNCHANGED — zero edits to them, zero edits to any frozen file.

import { classifyPlanRun, planDeflectionStats, planProofFeed } from "./plan-deflection.mjs";
import { issueSignature, isDurablyResolved, FIX_LADDER, TOP_RUNG } from "./durability-ledger.mjs";

export const DURABILITY_FEED_SCHEMA = "plan-durability-feed.v1";

// How a run that already passed every plan-deflection honesty gate is graded for DURABILITY.
// Exactly one of these applies, and exactly one of them ("durable") may enter the numerator.
export const DURABILITY_GRADE = Object.freeze([
  "durable",           // stayed gone through the quiet monitoring window, no recurrence since -> THE numerator
  "recurred",          // came back inside the recurrence window -> the fix did not hold; demoted, still attempted
  "monitoring",        // resolved, quiet window not yet elapsed -> honestly pending, never counted early
  "unrecorded",        // ledger has never seen this issue -> durability unknown, never assumed
  "r11-unverifiable",  // 🔒 blocked planId earns no signature -> unknowable, never optimistic
  "not-a-resolution"   // the run was not a resolved-fix at all (escalated / aborted / excluded)
]);

/** The planId a journal belongs to (the executor stamps it on the first entry), or "" when absent. */
export function journalPlanId(journal) {
  const entries = Array.isArray(journal) ? journal : (journal && Array.isArray(journal.entries) ? journal.entries : []);
  const first = entries.length ? entries[0] : null;
  return (first && first.planId) ? String(first.planId) : "";
}

/**
 * Grade ONE plan-run journal for durability. plan-deflection decides honesty first; the ledger decides whether
 * the fix held. Pure read of both — nothing is mutated, nothing is persisted.
 */
export function gradeDurability({ journal = [], ledger = null, now = Date.now(), opts = {} } = {}) {
  const base = classifyPlanRun(journal);
  const planId = journalPlanId(journal);

  // Honesty gates first: only a goalProbe-proven, real-change, trusted, non-rehearsal run can ever be durable.
  if (!base.deflected) {
    return {
      status: base.status, grade: "not-a-resolution", planId,
      attempted: !!base.attempted, deflected: false, durable: false,
      reason: `plan-deflection classified this run as "${base.status}" — durability is not applicable`
    };
  }

  // 🔒 R11 is check #1 on the durability layer: an off-limits id can never earn a signature, so its durability
  // is unknowable. Unknowable is reported as such and excluded — never quietly counted as a durable win.
  const sig = issueSignature(planId);
  if (!sig) {
    return {
      status: base.status, grade: "r11-unverifiable", planId: "",
      attempted: true, deflected: true, durable: false,
      reason: "path-guard blocked (or empty) plan id — no issue signature, durability unverifiable"
    };
  }

  const issue = (ledger && ledger.issues) ? ledger.issues[sig] : null;
  if (!issue || !issue.resolutions || issue.resolutions.length === 0) {
    return {
      status: base.status, grade: "unrecorded", planId,
      attempted: true, deflected: true, durable: false,
      reason: "the durability ledger has no recorded resolution for this issue — the fix has not been observed holding"
    };
  }

  // Did the SAME issue come back after the fix? Read straight off the ledger's own recurrence log (pure data
  // read — the ladder-climbing decision itself stays owned by durability-ledger, we only report it).
  const last = issue.resolutions[issue.resolutions.length - 1];
  const recurrences = Array.isArray(issue.recurrences) ? issue.recurrences : [];
  const recurredSince = recurrences.some((r) => Number(r.ts) >= Number(last.ts));
  if (recurredSince) {
    const rung = Math.min(TOP_RUNG, Number(issue.rung) || 0);
    return {
      status: base.status, grade: "recurred", planId,
      attempted: true, deflected: true, durable: false,
      reason: `the issue returned after this fix — the ledger has climbed to "${FIX_LADDER[rung]}"`
    };
  }

  if (isDurablyResolved(ledger, planId, now, opts)) {
    return {
      status: base.status, grade: "durable", planId,
      attempted: true, deflected: true, durable: true,
      reason: "stayed gone through the quiet monitoring window with no recurrence"
    };
  }

  return {
    status: base.status, grade: "monitoring", planId,
    attempted: true, deflected: true, durable: false,
    reason: "resolved, still inside the quiet monitoring window — not yet durable"
  };
}

/**
 * Stats over MANY plan-run journals, joined against the durability ledger. The denominator is unchanged from
 * plan-deflection (real live attempts only); the numerator is tightened to durable resolutions.
 * Every field is real-or-empty: with no attempts, both rates are null so the surface shows an honest "--".
 */
export function durableDeflectionStats(journals = [], ledger = null, now = Date.now(), opts = {}) {
  const list = Array.isArray(journals) ? journals : [];
  const raw = planDeflectionStats(list);

  const grades = { durable: 0, recurred: 0, monitoring: 0, unrecorded: 0, "r11-unverifiable": 0, "not-a-resolution": 0 };
  for (const j of list) {
    const g = gradeDurability({ journal: j, ledger, now, opts }).grade;
    if (Object.prototype.hasOwnProperty.call(grades, g)) grades[g] += 1;
  }

  const attempted = raw.attempted;
  const durable = grades.durable;
  const durablePct = attempted === 0 ? null : Math.max(0, Math.min(100, Math.round((durable / attempted) * 100)));

  return {
    schema: DURABILITY_FEED_SCHEMA,
    attempted,                                   // unchanged denominator — real live attempts only
    firstPassResolved: raw.resolved,             // what the un-joined feed would have published
    firstPassPct: raw.deflectionPct,             // kept visible so the two numbers can never silently diverge
    durableResolved: durable,                    // the honest numerator
    durableResolutionPct: durablePct,            // THE headline for B1 / Stage-4 (null until real)
    recurred: grades.recurred,                   // fixes that did not hold — the reason the number is lower
    monitoring: grades.monitoring,               // resolved, quiet window still running (pending, not counted)
    unrecorded: grades.unrecorded,               // no ledger record — durability unknown
    r11Unverifiable: grades["r11-unverifiable"], // 🔒 blocked ids — unknowable, never optimistic
    escalated: raw.escalated,                    // the honest hand-off to IIS (the retainer story)
    abortedDuringExecution: raw.abortedDuringExecution,
    alreadyHealthy: raw.alreadyHealthy,          // excluded upstream (no-op-neutral is never a fix)
    dryRun: raw.dryRun,                          // excluded upstream (a rehearsal claims nothing)
    interrupted: raw.interrupted,
    untrusted: raw.untrusted,                    // excluded upstream (a tampered chain can never inflate)
    sample: attempted
  };
}

/**
 * The feed RUN-B B1 and the Stage-4 Trust Center consume. Same shape as planProofFeed (drop-in superset) with
 * the headline replaced by the DURABLE rate and the first-pass number retained beside it for honest contrast.
 */
export function durableProofFeed(journals = [], ledger = null, now = Date.now(), opts = {}) {
  const st = durableDeflectionStats(journals, ledger, now, opts);
  const raw = planProofFeed(journals);
  const has = st.attempted > 0;
  return {
    ...raw,
    schema: DURABILITY_FEED_SCHEMA,
    // The headline the buyer sees: fixes that actually STAYED fixed.
    durableResolutionPct: st.durableResolutionPct,     // null until real
    plansDurablyFixed: has ? st.durableResolved : null,
    plansAttempted: has ? st.attempted : null,
    // Kept from the first-pass feed so the two can be compared openly rather than quietly swapped.
    firstPassResolutionPct: raw.autonomousResolutionPct,
    plansRecurred: has ? st.recurred : null,
    plansMonitoring: st.monitoring,
    plansDurabilityUnrecorded: st.unrecorded,
    plansDurabilityUnverifiable: st.r11Unverifiable
  };
}

/**
 * The honest one-liner for the Trust Center tile. Real-or-empty: with no attempts it says so plainly instead of
 * showing a flattering 0% or 100%. Never claims a monitoring/unrecorded run as a durable win.
 */
export function durabilityHeadline(feed = {}) {
  const pct = feed.durableResolutionPct;
  const n = feed.plansAttempted;
  if (pct === null || pct === undefined || !n) {
    return "No completed resolution plans yet — nothing to report.";
  }
  const pending = Number(feed.plansMonitoring || 0);
  const tail = pending > 0 ? ` ${pending} more still inside the monitoring window.` : "";
  return `${pct}% of ${n} attempted plans were fixed and stayed fixed.${tail}`;
}

/** Dashboard tile descriptor — null value renders as "--", never a fabricated %. */
export function durabilityTile(journals = [], ledger = null, now = Date.now(), opts = {}) {
  const st = durableDeflectionStats(journals, ledger, now, opts);
  return {
    id: "plan-durable-deflection",
    label: "Fixed and stayed fixed (durable resolutions)",
    value: st.durableResolutionPct,
    unit: "%",
    sample: st.sample,
    resolved: st.durableResolved,
    attempted: st.attempted,
    monitoring: st.monitoring,
    recurred: st.recurred
  };
}
