// STAGE 3 S2 — RESTORE POINT (system-level checkpoint before a system-changing Resolution Plan).
// Spec: any plan whose riskEnvelope touches system state earns a Checkpoint-Computer BEFORE step 1, and
// the restore point is offered back to the user as a ONE-CLICK revert — never applied automatically.
//
// The honesty problem this module refuses to fake:
//   Windows throttles System Restore to 1 point / 24h by default (SystemRestorePointCreationFrequency),
//   and — the notorious gotcha — `Checkpoint-Computer` SILENTLY no-ops inside that window while still
//   returning success. So exit-code-0 is NOT proof a checkpoint exists; trusting it is the exact
//   "service-state != user-outcome" trap the brain audit (F2) calls out. We instead verify by OUTCOME:
//   the restore-point sequence number must actually INCREASE. If we cannot prove a new point exists we
//   DEGRADE HONESTLY to journal-only rollback and SAY so on the plan card (Rule 14, real-or-empty) —
//   never a fabricated restore-point id. The hash-chained plan journal already gives reverse-order
//   rollback, so "journal-only" is a real, weaker-but-honest protection, not a dead end.
//
// R11 is check #1 (the plan id/title is path-guarded before anything runs); the kill-switch aborts
// before any checkpoint; dry-run never claims a real restore point. Pure + injectable: the caller injects
// the clock and the runner and NOTHING is ever really spawned here (the real guarded spawn stays in main),
// so the whole battery is deterministic and $0. The checkpoint description is a fixed, content-blind
// constant — no plan id, no user text, ever leaves in it.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "../shared/path-guard.mjs";

export const RESTORE_POINT_VERSION = "restore-point-v1";
// Windows default SystemRestorePointCreationFrequency = 1440 min. Inside this window Checkpoint-Computer
// silently no-ops, so we do not even spawn — we degrade to journal-only up front and say why.
export const CHECKPOINT_THROTTLE_MS = 24 * 60 * 60 * 1000; // 24h

export const PROTECTION = Object.freeze({ RESTORE_POINT: "restore-point", JOURNAL_ONLY: "journal-only" });

export const RESTORE_STATUS = Object.freeze([
  "created",              // verified: a new restore-point sequence number exists.
  "throttled-degraded",   // inside the 24h window -> Windows would silently no-op -> journal-only, honestly.
  "unverified-degraded",  // ran but the sequence number did not increase (throttle/failure) -> journal-only.
  "not-required",         // plan does not touch system state -> journal-only baseline is enough.
  "dry-run",              // dry-run wins: never a real checkpoint.
  "blocked",              // R11 — an off-limits plan id/title is never checkpointed.
  "aborted"               // kill-switch engaged before we checkpointed.
]);

// Content-blind, id-free description — nothing user-specific ever enters the restore point.
export const CHECKPOINT_DESCRIPTION = "ARIA Sentinel Resolution Plan";
// Command descriptors main can route through its own guarded spawn. The module itself only uses the
// injected runner; these are exported so wiring stays honest and centralized (no hidden spawn here).
export const RESTORE_COMMANDS = Object.freeze({
  list: "Get-ComputerRestorePoint | Select-Object -ExpandProperty SequenceNumber",
  create: `Checkpoint-Computer -Description "${CHECKPOINT_DESCRIPTION}" -RestorePointType MODIFY_SETTINGS`
});

/**
 * Does this plan change system state (and therefore earn a checkpoint)? Pure read of riskEnvelope.
 * Explicit flags win; otherwise infer from declared scopes; an irreversible step also qualifies.
 * Unknown -> false (no needless checkpoint), but any real system signal -> true.
 */
export function planTouchesSystemState(plan) {
  const env = (plan && plan.riskEnvelope) || {};
  if (env.systemState === true || env.touchesSystemState === true) return true;
  if (env.systemState === false || env.touchesSystemState === false) return false;
  if (env.level === "system" || env.level === "high") return true;
  const scopes = Array.isArray(env.scopes) ? env.scopes.map((s) => String(s).toLowerCase()) : [];
  const SYSTEM_SCOPES = ["system", "registry", "drivers", "driver", "network-stack", "services", "boot"];
  if (scopes.some((s) => SYSTEM_SCOPES.includes(s))) return true;
  const steps = Array.isArray(plan && plan.steps) ? plan.steps : [];
  if (steps.some((st) => st && (st.irreversible === true || st.rebootRequired === true))) return true;
  return false;
}

/** Inside the 24h throttle window a checkpoint would silently no-op. Pure; unknown last -> not throttled. */
export function isThrottled(lastCheckpointTs, now = Date.now(), opts = {}) {
  const windowMs = Number(opts.throttleMs) || CHECKPOINT_THROTTLE_MS;
  const last = Number(lastCheckpointTs);
  if (!Number.isFinite(last) || last <= 0) return false;
  const delta = Number(now) - last;
  return delta >= 0 && delta < windowMs;
}

/** Highest restore-point sequence number from `Get-ComputerRestorePoint` output. Content-blind: reads
 *  integers only. No points / unparseable -> null (never 0-as-success). */
export function sequenceOf(output) {
  const text = String(output == null ? "" : output);
  const nums = (text.match(/-?\d+/g) || []).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  if (!nums.length) return null;
  return Math.max(...nums);
}

/** Verified iff a NEW sequence number appeared. Real-or-empty: no proof -> false. */
export function verifyCreated(before, after) {
  if (after == null) return false;               // can't see any point -> not proven.
  if (before == null) return true;               // none before, one now -> created.
  return Number(after) > Number(before);         // strictly higher -> created (equal = silent no-op).
}

/** Honest one-line plan-card copy per status — the user always sees the true protection level. */
export function planCardLine(status, ctx = {}) {
  switch (status) {
    case "created":
      return `Restore point created (#${ctx.sequenceNumber}) — you can undo this whole fix in one click.`;
    case "throttled-degraded":
      return "Windows already made a restore point in the last 24h, so it won't make another — this fix is protected by step-by-step rollback instead (one-click undo per step).";
    case "unverified-degraded":
      return "Couldn't confirm a new restore point, so we're protecting this fix with step-by-step rollback instead — nothing is applied without an undo path.";
    case "not-required":
      return "This fix doesn't change system settings, so no restore point is needed — each step is still individually reversible.";
    case "dry-run":
      return "Dry run — no restore point and no changes were made.";
    case "blocked":
      return "This plan was blocked before any checkpoint (privacy guard).";
    case "aborted":
      return "Stopped before any restore point was created.";
    default:
      return "Protected by step-by-step rollback.";
  }
}

/**
 * A ONE-CLICK revert offer for a verified restore point. Never auto-executes — `auto` is always false and
 * this returns a DESCRIPTOR only; main performs the actual revert solely on a user click. No verified
 * checkpoint -> not available (real-or-empty).
 */
export function buildRevertOffer(checkpoint = {}) {
  const seq = checkpoint && checkpoint.created && checkpoint.sequenceNumber != null ? Number(checkpoint.sequenceNumber) : null;
  if (seq == null) {
    return { available: false, auto: false, oneClick: false, sequenceNumber: null, note: "No verified restore point to revert to." };
  }
  return {
    available: true,
    auto: false,           // revert is NEVER automatic — spec-locked.
    oneClick: true,
    sequenceNumber: seq,
    command: `Restore-Computer -RestorePoint ${seq}`, // descriptor for main's guarded, user-clicked path.
    note: "Offered to the user — a restore is only ever run on an explicit click."
  };
}

async function safeRun(run, cmd) {
  try {
    const r = await run(cmd);
    if (r == null) return { stdout: "", stderr: "", exitCode: 1 };
    if (typeof r === "string") return { stdout: r, stderr: "", exitCode: 0 };
    return r;
  } catch {
    return { stdout: "", stderr: "run-threw", exitCode: 1 };
  }
}

function result(status, extra = {}) {
  const created = status === "created";
  const protection = created ? PROTECTION.RESTORE_POINT : PROTECTION.JOURNAL_ONLY;
  const base = {
    v: RESTORE_POINT_VERSION,
    status,
    created,
    protection,
    degraded: !created && status !== "not-required" && status !== "dry-run",
    planCardLine: planCardLine(status, extra),
    revert: buildRevertOffer({ created, sequenceNumber: extra.sequenceNumber })
  };
  return { ...base, ...extra };
}

/**
 * Ensure (or honestly forgo) a restore point before a Resolution Plan runs. Pure orchestration over an
 * injected clock + runner — nothing is really spawned here. Order of guards is deliberate:
 *   1. R11 (plan id/title) — off-limits -> blocked, never checkpointed.
 *   2. kill-switch — aborted before any checkpoint.
 *   3. not system-touching — journal-only baseline is enough (not-required).
 *   4. dry-run — never a real checkpoint.
 *   5. throttled (24h) — Windows would silently no-op, so degrade up front (don't spawn).
 *   6. attempt + OUTCOME-verify (sequence increased) -> created, else unverified-degraded.
 * Always returns a real protection level and an honest plan-card line; revert offers are never automatic.
 */
export async function ensureRestorePoint({ plan, lastCheckpointTs, now = Date.now(), dryRun = false, isKilled = false, run, opts = {} } = {}) {
  const idish = `${(plan && plan.id) || ""} ${(plan && plan.title) || ""}`.trim();
  if (isBlockedPath((plan && plan.id) || "") || isBlockedPath((plan && plan.title) || "")) {
    return result("blocked", { surfaced: R11_SURFACE, planId: redactPrivate(idish) });
  }
  if (isKilled === true) return result("aborted", {});
  if (!planTouchesSystemState(plan)) return result("not-required", {});
  if (dryRun === true) return result("dry-run", {});
  if (isThrottled(lastCheckpointTs, now, opts)) return result("throttled-degraded", { throttled: true, lastCheckpointTs: Number(lastCheckpointTs) || 0 });

  if (typeof run !== "function") return result("unverified-degraded", { reason: "no-runner" });
  const before = sequenceOf((await safeRun(run, RESTORE_COMMANDS.list)).stdout);
  await safeRun(run, RESTORE_COMMANDS.create);
  const after = sequenceOf((await safeRun(run, RESTORE_COMMANDS.list)).stdout);
  if (verifyCreated(before, after)) return result("created", { sequenceNumber: after, checkpointedAt: Number(now) || 0 });
  return result("unverified-degraded", { reason: "sequence-not-increased" });
}
