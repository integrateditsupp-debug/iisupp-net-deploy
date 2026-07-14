// STAGE 3 S2 — RESTORE POINTS (system-level checkpoint before a system-state plan).
// Spec: "Any plan whose riskEnvelope touches system state: Checkpoint-Computer before step 1
// (throttle-aware — Windows allows 1/24h by default; detect + degrade honestly to 'journal-only
// rollback' and SAY so in the plan card). Restore-point REVERT is never automatic — offered to the
// user, one click."
//
// Honesty rules baked in (Rule 14):
//   · We NEVER claim a checkpoint we did not create. Creation is PROVEN by re-reading the restore-point
//     list and seeing the count go UP — exit code 0 alone is not proof.
//   · When Windows' 24h throttle (or a disabled System Restore, or a failed checkpoint) blocks us, the
//     plan does NOT silently pretend it is protected: it degrades to JOURNAL-ONLY rollback and the plan
//     card says exactly that, in plain words, before the user confirms.
//   · REVERT: there is no revert command in this module and `Restore-Computer` is in TIER0_DENY — a
//     revert is surfaced as a one-click OFFER to the user and can never be fired by an agent.
// 🔒 R11 is check #1 (the description text is R11-scanned before anything spawns). Pure + injectable:
// `run` is passed in, nothing spawns in tests.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "../shared/path-guard.mjs";
import { validateTier0Command, defaultRun } from "./tier-0-executor.mjs";

export const RESTORE_THROTTLE_MS = 24 * 60 * 60 * 1000; // Windows SystemRestorePointCreationFrequency default = 1440 min.
export const RESTORE_DECISIONS = Object.freeze(["create", "not-needed", "journal-only"]);
export const RESTORE_POINT_PROBE = "(Get-ComputerRestorePoint | Measure-Object).Count";
const CHECKPOINT_CMD = (description) => `Checkpoint-Computer -Description "${description}" -RestorePointType MODIFY_SETTINGS`;
const DESC_MAX = 60; // Windows caps restore-point descriptions; keep it short and content-blind.

/** Content-blind checkpoint description — plan id only, never user text. */
export function checkpointDescription(planId) {
  const safe = redactPrivate(String(planId || "plan")).replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "plan";
  return `ARIA Sentinel before ${safe}`.slice(0, DESC_MAX);
}

async function safeRun(run, cmd) {
  try { return (await run(cmd)) || { stdout: "", stderr: "", exitCode: 1 }; }
  catch { return { stdout: "", stderr: "run-threw", exitCode: 1 }; }
}

function countOf(res) {
  const m = String((res && res.stdout) || "").match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Decide — BEFORE the plan-start countdown — whether this plan gets a real checkpoint.
 * @param {{plan:object, lastRestorePointAt?:number, systemRestoreEnabled?:boolean, now?:number, dryRun?:boolean}} args
 * @returns {{decision:string, protected:boolean, reason:string, planCardLine:string}}
 */
export function planRestorePoint({ plan, lastRestorePointAt = 0, systemRestoreEnabled = true, now = Date.now(), dryRun = false } = {}) {
  const touches = !!(plan && plan.riskEnvelope && plan.riskEnvelope.touchesSystemState);
  if (!touches) {
    return {
      decision: "not-needed", protected: false, reason: "plan-does-not-touch-system-state",
      planCardLine: "No system restore point needed — this plan doesn't change system state. Each step is rolled back individually if anything fails."
    };
  }
  if (dryRun) {
    return {
      decision: "not-needed", protected: false, reason: "dry-run",
      planCardLine: "Dry-run preview — nothing will be changed, so no restore point is created."
    };
  }
  if (!systemRestoreEnabled) {
    return {
      decision: "journal-only", protected: false, reason: "system-restore-disabled",
      planCardLine: "System Restore is turned off on this PC, so I can't create a restore point. I'll still roll every step back in reverse order and log it — but there's no system-wide undo. You can turn System Restore on and re-run this if you'd rather have one."
    };
  }
  const sinceMs = Number(now) - Number(lastRestorePointAt || 0);
  if (lastRestorePointAt && sinceMs < RESTORE_THROTTLE_MS) {
    const hours = Math.max(1, Math.round((RESTORE_THROTTLE_MS - sinceMs) / 3600000));
    return {
      decision: "journal-only", protected: false, reason: "windows-24h-throttle",
      planCardLine: `Windows only allows one restore point every 24h and one was made recently (another is possible in about ${hours}h), so this plan runs with journal-only rollback: every step is reversed in order and logged — but there's no system-wide undo.`
    };
  }
  return {
    decision: "create", protected: true, reason: "system-state-plan",
    planCardLine: "I'll create a Windows restore point before I touch anything, so this can be undone system-wide if needed."
  };
}

/**
 * Create the checkpoint and PROVE it. Never throws; never claims an unproven checkpoint.
 * @returns {{created:boolean, degraded:boolean, reason:string, before:number|null, after:number|null,
 *            planCardLine:string, revertOffer:object|null, surfaced?:string}}
 */
export async function createRestorePoint({ planId, run, now = Date.now() } = {}) {
  const runner = run || defaultRun;
  const description = checkpointDescription(planId);
  const cmd = CHECKPOINT_CMD(description);

  // 🔒 R11 — check #1: nothing spawns if the description or command touches the off-limits folder.
  if (isBlockedPath(cmd) || isBlockedPath(String(planId || ""))) {
    return { created: false, degraded: true, reason: "R11", before: null, after: null, surfaced: R11_SURFACE, revertOffer: null,
      planCardLine: "Restore point skipped (blocked reference). Rollback is journal-only for this run." };
  }
  if (!validateTier0Command(cmd) || !validateTier0Command(RESTORE_POINT_PROBE)) {
    return { created: false, degraded: true, reason: "not-allowlisted", before: null, after: null, revertOffer: null,
      planCardLine: "Restore point skipped (command not allowlisted). Rollback is journal-only for this run." };
  }

  const before = countOf(await safeRun(runner, RESTORE_POINT_PROBE));
  const exec = await safeRun(runner, cmd);
  const after = countOf(await safeRun(runner, RESTORE_POINT_PROBE));

  // PROOF, not optimism: exit 0 AND the restore-point list actually grew.
  const proven = exec.exitCode === 0 && before != null && after != null && after > before;
  if (!proven) {
    return {
      created: false, degraded: true, before, after, revertOffer: null,
      reason: exec.exitCode !== 0 ? "checkpoint-command-failed" : "checkpoint-not-verified",
      planCardLine: "I couldn't create a restore point (Windows refused or throttled it), so this run has journal-only rollback: every step is reversed in order and logged, but there's no system-wide undo."
    };
  }
  return {
    created: true, degraded: false, before, after, reason: "created", createdAt: Number(now),
    planCardLine: "Restore point created — this run can be undone system-wide if needed.",
    // The revert is an OFFER the user clicks. No agent path executes it (Restore-Computer is denied).
    revertOffer: Object.freeze({
      available: true, automatic: false, requiresUser: true,
      title: "Undo with the restore point",
      body: "This opens Windows System Restore and selects the checkpoint ARIA made before this fix. Windows performs the restore — ARIA never reverts your PC on its own.",
      userAction: "Open System Restore (rstrui.exe) and pick the checkpoint named \"" + description + "\"."
    })
  };
}

/** The honest one-line rollback posture for the plan card / under-globe surface. */
export function rollbackPosture({ restorePoint, plan } = {}) {
  const reverseOrder = !!(plan && plan.rollbackPolicy === "reverse-order");
  const protectedBySnapshot = !!(restorePoint && restorePoint.created);
  return {
    protectedBySnapshot,
    reverseOrder,
    line: protectedBySnapshot
      ? "Rollback: system restore point + per-step reverse-order rollback."
      : (reverseOrder
        ? "Rollback: journal-only (per-step, reverse order) — no system restore point for this run."
        : "Rollback: escalate-only — this plan does not auto-reverse; a human is looped in on failure.")
  };
}
