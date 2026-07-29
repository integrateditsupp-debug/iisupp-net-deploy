// STAGE 3 S2 — system restore point before a plan that touches system state.
// Windows throttles System Restore to ONE automatic checkpoint per 24h by default, and System
// Protection is often disabled outright. Pretending we have a checkpoint we don't have is exactly
// the kind of false safety net Rule 14 forbids — so this module DEGRADES HONESTLY:
//   { mode: "restore-point" }  → a real checkpoint exists; the plan card may say so
//   { mode: "journal-only", reason } → no checkpoint; the plan card MUST say "journal-only rollback"
// REVERT is never automatic. We create checkpoints; we never call Restore-Computer. Rolling a machine
// back is the user's one-click decision, surfaced with the reason — never an agent's.
// 🔒 R11 is check #1; every command goes through the Tier-0 allowlist; stdout is redacted at source.
// Pure + node-safe: run/now/journal are injected, so nothing spawns in tests.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "../shared/path-guard.mjs";
import { validateTier0Command, defaultRun } from "./tier-0-executor.mjs";

export const RESTORE_THROTTLE_MS = 24 * 60 * 60 * 1000; // Windows default: 1 automatic point / 24h
export const RESTORE_DEGRADE_REASONS = Object.freeze(["throttled-24h", "srp-disabled", "create-failed", "blocked", "not-windows"]);
export const JOURNAL_ONLY_NOTE = "journal-only rollback (no system restore point was created)";
export const RESTORE_POINT_NOTE = "system restore point created before the first step";

const NEWEST_POINT_CMD = "(Get-ComputerRestorePoint | Measure-Object).Count";
const CHECKPOINT_CMD = "Checkpoint-Computer -Description ARIA-plan -RestorePointType MODIFY_SETTINGS";

async function safeRun(run, cmd) {
  try { return (await run(cmd)) || { stdout: "", stderr: "", exitCode: 1 }; }
  catch { return { stdout: "", stderr: "run-threw", exitCode: 1 }; }
}

/**
 * Decide, from an injected "when was the last restore point created" reader, whether Windows would
 * throttle us. Pure so the 23h59m / 24h01m boundary is testable without a machine.
 * @param {number|null} lastCreatedMs  epoch ms of the newest restore point (null = none/unknown)
 * @param {number} now
 */
export function isThrottled(lastCreatedMs, now) {
  if (lastCreatedMs == null || !Number.isFinite(lastCreatedMs)) return false;
  return (Number(now) - Number(lastCreatedMs)) < RESTORE_THROTTLE_MS;
}

/**
 * Ensure a restore point before a system-touching plan.
 * @param {{run?:Function, now?:Function, journal?:Function, lastRestorePointAt?:number|null,
 *          systemProtectionEnabled?:boolean, planRunId?:string, touchesSystemState?:boolean}} opts
 * @returns {Promise<{mode:"restore-point"|"journal-only"|"not-needed", reason:string, note:string, evidence:string, surfaced?:string}>}
 */
export async function ensureRestorePoint(opts = {}) {
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const journal = typeof opts.journal === "function" ? opts.journal : () => {};
  const emit = (mode, reason, note, evidence = "") => {
    const out = { mode, reason, note, evidence };
    try { journal("PLAN.STEP.PRE", { detail: `restore point: ${note}`, extra: { restorePoint: true, mode, reason } }); } catch { /* journaling never blocks the plan */ }
    return out;
  };

  // A plan that does not touch system state does not get a checkpoint — and never pretends it did.
  if (opts.touchesSystemState === false) return emit("not-needed", "no-system-state", "no restore point needed (this plan does not change system state)");

  // 🔒 R11 — check #1.
  const planRunId = String(opts.planRunId || "");
  if (isBlockedPath(planRunId) || isBlockedPath(CHECKPOINT_CMD)) {
    return { ...emit("journal-only", "blocked", JOURNAL_ONLY_NOTE), surfaced: R11_SURFACE };
  }
  if (!validateTier0Command(CHECKPOINT_CMD) || !validateTier0Command(NEWEST_POINT_CMD)) {
    return emit("journal-only", "create-failed", JOURNAL_ONLY_NOTE);
  }
  if (opts.systemProtectionEnabled === false) return emit("journal-only", "srp-disabled", JOURNAL_ONLY_NOTE);
  if (isThrottled(opts.lastRestorePointAt, now())) return emit("journal-only", "throttled-24h", JOURNAL_ONLY_NOTE);

  const run = typeof opts.run === "function" ? opts.run : defaultRun;
  const res = await safeRun(run, CHECKPOINT_CMD);
  if (!res || res.exitCode !== 0) return emit("journal-only", "create-failed", JOURNAL_ONLY_NOTE);

  const count = await safeRun(run, NEWEST_POINT_CMD);
  const evidence = redactPrivate(String((count && count.stdout) || "")).trim().slice(0, 80);
  return emit("restore-point", "", RESTORE_POINT_NOTE, evidence);
}

/**
 * The one-click REVERT offer. Returns a description only — this module never reverts anything.
 * The caller renders it; the user decides. (Spec: "Restore-point REVERT is never automatic".)
 */
export function revertOffer(result = {}) {
  if (!result || result.mode !== "restore-point") {
    return { offer: false, reason: result && result.reason ? result.reason : "no-restore-point", text: JOURNAL_ONLY_NOTE, command: "" };
  }
  return {
    offer: true,
    reason: "",
    text: "A restore point was created before this plan. You can roll Windows back to it yourself from System Protection — ARIA will never do that for you.",
    command: "" // deliberately empty: we do not hand a Restore-Computer command to an automated path.
  };
}
