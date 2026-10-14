// kill-switch — the pure decision layer for ARIA's 3 kill levels.
//
//   per-endpoint : tray "Pause for 24 hours"            (time-boxed)
//   per-customer : customer.json { disabled:true }       (MDM-set)
//   global/fleet : control-plane response { killed:true } (iisupp.net recipes endpoint)
//
// Any active level forces DETECT-ONLY mode: watchers keep running so the user still sees
// problems, but no recipe may APPLY a change. This module is side-effect free so the
// behaviour can be unit-tested without Electron; main.mjs wires it to the live state.

/** Read a control-plane (aria-recipes) response for a global kill directive. */
export function parseControlPlaneKill(body) {
  if (!body || typeof body !== "object" || !("killed" in body)) {
    return { present: false, killed: false, reason: "" };
  }
  const killed = Boolean(body.killed);
  return {
    present: true,
    killed,
    reason: killed ? String(body.reason || "control plane disabled fixes").slice(0, 200) : ""
  };
}

/**
 * Combine the three levels into a single decision.
 * @returns {{ killed:boolean, reason:string, detectOnly:boolean }}
 */
export function remediationDecision({ controlPlaneKilled = false, controlPlaneReason = "", customerDisabled = false } = {}) {
  if (controlPlaneKilled) {
    return { killed: true, detectOnly: true, reason: controlPlaneReason || "Control plane disabled fixes." };
  }
  if (customerDisabled) {
    return { killed: true, detectOnly: true, reason: "Customer policy disabled fixes." };
  }
  return { killed: false, detectOnly: false, reason: "" };
}

/** The exact result runRecipe must return when blocked, so detection still works but no fix applies. */
export function blockedRecipeResult(reason) {
  return { ok: false, error: "control_plane_killed", reason: reason || "remediation disabled" };
}

// ── RUN 19 §3 — panic kill-switch (Ctrl+Alt+K) ────────────────────────────────────────────────
// A single-purpose terminate: kill every ARIA child process, undo the last action, dim the globe.
// These helpers are pure so the behaviour is unit-testable without Electron; main.mjs does the actual
// process.kill() / rollback / globe-dim using the values returned here.

export const KILL_HOTKEY = Object.freeze({
  id: "kill",
  combo: "CommandOrControl+Alt+K",
  fallback: "CommandOrControl+Shift+Pause",
  action: "kill-aria",
  label: "Kill ARIA + undo last action",
  danger: true
});

export const KILL_TOAST = "ARIA terminated · last action undone"; // legacy constant — used ONLY when an undo really ran
export const KILL_TOAST_NOTHING = "ARIA terminated · nothing to undo";

/** The most recent un-rolled-back restore point — the "last action" the kill-switch undoes. */
export function pickUndoTarget(restorePoints = []) {
  const list = Array.isArray(restorePoints) ? restorePoints : [];
  // restorePoints are stored newest-first; pick the first that has not already been rolled back.
  // RUN-CU / CU4 (2026-10-08) — a record that carries a verification verdict (`created`, from the real
  // restore-point wrapper) is an undo target ONLY when created === true. Legacy records without the field
  // keep the original behaviour (Rule 15), so nothing that worked before stops working.
  return list.find((p) => p && p.id && !p.rolledBack && p.created !== false) || null;
}

/**
 * PROD 2026-10-14 (audit M19) — the toast says what HAPPENED (Rule 14). "last action undone" only when an inverse
 * action really ran; a verified restore point that exists but was not applied is offered, never claimed; nothing
 * else is "nothing to undo". Pure.
 */
export function killToast({ killedCount = 0, undone = false, undoAvailable = false, sequenceNumber = null } = {}) {
  const stopped = killedCount > 0 ? ` · ${killedCount} process${killedCount === 1 ? "" : "es"} stopped` : "";
  if (undone) return `${KILL_TOAST}${stopped}`;
  if (undoAvailable) return `ARIA terminated${stopped} · undo available: System Restore point${sequenceNumber != null ? ` #${sequenceNumber}` : ""} (restart required)`;
  return `${KILL_TOAST_NOTHING}${stopped}`;
}

/**
 * Build the deterministic result of a kill-switch activation, given the live children + restore points.
 * `undone` is TRUE only when the caller reports an inverse action actually ran (`undoRan:true`); a restore-point
 * RECORD is an undo target to offer, not an undo that happened.
 * @returns {{ killedCount:number, undoId:string|null, undone:boolean, undoAvailable:boolean, toast:string, globeState:'dim' }}
 */
export function buildKillResult({ children = [], restorePoints = [], undoRan = false } = {}) {
  const target = pickUndoTarget(restorePoints);
  const killedCount = Array.isArray(children) ? children.filter(Boolean).length : 0;
  const undoAvailable = Boolean(target && target.created === true);
  const undone = undoRan === true;
  return {
    killedCount,
    undoId: target ? target.id : null,
    undone,
    undoAvailable,
    toast: killToast({ killedCount, undone, undoAvailable, sequenceNumber: target ? target.sequenceNumber : null }),
    globeState: "dim"
  };
}
