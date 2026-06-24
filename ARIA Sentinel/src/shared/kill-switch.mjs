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

export const KILL_TOAST = "ARIA terminated · last action undone";

/** The most recent un-rolled-back restore point — the "last action" the kill-switch undoes. */
export function pickUndoTarget(restorePoints = []) {
  const list = Array.isArray(restorePoints) ? restorePoints : [];
  // restorePoints are stored newest-first; pick the first that has not already been rolled back.
  return list.find((p) => p && p.id && !p.rolledBack) || null;
}

/**
 * Build the deterministic result of a kill-switch activation, given the live children + restore points.
 * @returns {{ killedCount:number, undoId:string|null, undone:boolean, toast:string, globeState:'dim' }}
 */
export function buildKillResult({ children = [], restorePoints = [] } = {}) {
  const target = pickUndoTarget(restorePoints);
  return {
    killedCount: Array.isArray(children) ? children.filter(Boolean).length : 0,
    undoId: target ? target.id : null,
    undone: Boolean(target),
    toast: KILL_TOAST,
    globeState: "dim"
  };
}
