// RUN-CU / CU4 (2026-10-08) — the ONE decision that sits between "a fix is proposed" and "a fix runs".
//
// Pure + dependency-free so every row of the truth table is unit-tested (tests/approval-policy.test.mjs).
// main.mjs calls decideExecution() from BOTH execution entry points — runSupervisedFix (a human or a deep
// link asked) and autoFireIfEligible (a watcher detected something) — so the autonomy level the customer
// chose in the Setup wizard is honoured everywhere, not just on one path.
//
// Inputs (all plain values the caller already knows):
//   level        'observe' | 'safe-auto' | 'approve-first' | 'full-auto'   (Setup wizard → Autonomy & contacts)
//   color        'green' | 'yellow' | 'red'                                 (recipe-runner tier of the fix)
//   tier         0 | 1 | 2                                                  (vetted-count tier, informational)
//   approverMode 'self' | 'admin' | 'either'                               (who may approve)
//   inWindow     boolean — inside a configured maintenance window right now
//   hasRestorePoint boolean — a REAL, verified restore point exists for this fix (never a store record)
//   killed       boolean — fleet / customer kill switch
//   blocked      boolean — endpoint paused / agent blocked
//
// Output: { action, reason, requiresRestorePoint, notifyBefore, notifyAfter }
//   action ∈ 'execute' | 'request-approval' | 'notify-only' | 'defer-window' | 'blocked'
//
// Truth table (Rule 14 — the copy on the wizard cards is exactly what this table does):
//   killed/blocked              → blocked
//   level observe               → notify-only            ("I find it, I tell you, I touch nothing")
//   red (any level)             → notify-only            ('red-never-automated')
//   approve-first               → request-approval       ("I ask before every fix")
//   safe-auto · green           → execute, notifyAfter   ("I fix the safe things myself and tell you after")
//   safe-auto · yellow          → request-approval
//   full-auto · green           → execute
//   full-auto · yellow · in window     → execute, requiresRestorePoint
//   full-auto · yellow · outside       → defer-window
//   any yellow execute WITHOUT a real restore point → request-approval ('restore-point-unavailable')

export const LEVELS = Object.freeze(["observe", "safe-auto", "approve-first", "full-auto"]);
export const COLORS = Object.freeze(["green", "yellow", "red"]);
export const ACTIONS = Object.freeze(["execute", "request-approval", "notify-only", "defer-window", "blocked"]);
export const APPROVER_MODES = Object.freeze(["self", "admin", "either"]);

function normLevel(v) { return LEVELS.includes(v) ? v : "approve-first"; }   // unknown → the asking default
function normColor(v) { return COLORS.includes(v) ? v : "red"; }             // unknown → never automated
function normApprover(v) { return APPROVER_MODES.includes(v) ? v : "self"; }

function result(action, reason, extra = {}) {
  return {
    action,
    reason,
    requiresRestorePoint: false,
    notifyBefore: false,
    notifyAfter: false,
    ...extra
  };
}

/**
 * Decide what happens to a proposed fix. Pure; never executes anything.
 * @returns {{action:string, reason:string, requiresRestorePoint:boolean, notifyBefore:boolean, notifyAfter:boolean, level:string, color:string, approverMode:string}}
 */
export function decideExecution(input = {}) {
  const level = normLevel(input.level);
  const color = normColor(input.color);
  const approverMode = normApprover(input.approverMode);
  const tier = Number.isInteger(input.tier) ? input.tier : 2;
  const inWindow = input.inWindow === true;
  const hasRestorePoint = input.hasRestorePoint === true;
  const meta = { level, color, approverMode, tier };

  if (input.killed === true) return result("blocked", "kill-switch", meta);
  if (input.blocked === true) return result("blocked", "agent-blocked", meta);

  if (level === "observe") return result("notify-only", "level-observe", { ...meta, notifyBefore: true });
  if (color === "red") return result("notify-only", "red-never-automated", { ...meta, notifyBefore: true });

  if (level === "approve-first") return result("request-approval", "level-approve-first", { ...meta, notifyBefore: true });

  if (level === "safe-auto") {
    if (color === "green") return result("execute", "safe-auto-green", { ...meta, notifyAfter: true });
    return result("request-approval", "safe-auto-yellow-needs-approval", { ...meta, notifyBefore: true });
  }

  // full-auto
  if (color === "green") return result("execute", "full-auto-green", { ...meta, notifyAfter: true });
  if (!inWindow) return result("defer-window", "outside-maintenance-window", { ...meta, notifyBefore: true, requiresRestorePoint: true });
  if (!hasRestorePoint) return result("request-approval", "restore-point-unavailable", { ...meta, notifyBefore: true, requiresRestorePoint: true });
  return result("execute", "full-auto-yellow-in-window", { ...meta, requiresRestorePoint: true, notifyAfter: true });
}

/** Human copy for an action (Rule 17 — plain, benefit first). Used by chat/voice + the approvals list. */
export function describeDecision(decision = {}) {
  switch (decision.action) {
    case "execute": return decision.requiresRestorePoint ? "Fixing it now — a restore point is in place so it can be undone." : "Fixing it now — I'll tell you when it's done.";
    case "request-approval": return decision.reason === "restore-point-unavailable" ? "I need a yes before this one — I couldn't make a restore point first." : "I've asked for approval before touching anything.";
    case "notify-only": return decision.reason === "red-never-automated" ? "This one needs a person — I've flagged it, nothing was changed." : "Found it and flagged it — I'm in observe mode, so nothing was changed.";
    case "defer-window": return "Queued for your next maintenance window — nothing changes until then.";
    case "blocked": return "Fixes are paused on this device right now, so nothing was changed.";
    default: return "";
  }
}
