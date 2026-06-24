// RUN 21 §4 — startup-tamper detection. If ARIA is removed from startup (Task Manager, registry, or
// Task Scheduler), warn the user (non-blocking), require a DOUBLE confirm to keep it off, and write a
// hash-chained audit entry. Pure + node-safe; main.mjs supplies the WMI/registry change events.

export const REMOVAL_METHODS = ["task-manager", "registry", "task-scheduler", "unknown"];

/** Classify how startup was disabled from the probe evidence. */
export function classifyRemoval(evidence = {}) {
  if (REMOVAL_METHODS.includes(evidence.source)) return evidence.source;
  if (evidence.registryMissing && !evidence.taskMissing) return "registry";
  if (evidence.taskMissing && !evidence.registryMissing) return "task-scheduler";
  if (evidence.viaTaskManager) return "task-manager";
  return "unknown";
}

/** The audit entry (joins the RUN 17 hash-chained transparencyLog). */
export function buildTamperAudit({ method, now, userConfirmed = false } = {}) {
  return {
    event: "startup-disabled",
    timestamp: new Date(now).toISOString(),
    userConfirmed: Boolean(userConfirmed),
    method: REMOVAL_METHODS.includes(method) ? method : "unknown"
  };
}

/** The first warning modal model (non-blocking). */
export function warningModel() {
  return {
    title: "Heads up — ARIA was just removed from startup",
    body: "I can't monitor or help while I'm not running. Re-enable startup?",
    actions: ["Re-enable", "Keep off"]
  };
}

// Double-confirm: keeping ARIA off requires TWO explicit confirmations.
export function requiresSecondConfirm(choice) {
  return choice === "keep-off";
}
export function secondConfirmModel() {
  return {
    title: "Confirm: ARIA will not auto-start",
    body: "You'll need to launch it manually each time.",
    actions: ["Cancel", "Yes, keep off"]
  };
}
/**
 * Resolve the full keep-off flow. Returns the outcome only when BOTH steps are confirmed.
 * @param steps array of user answers, e.g. ["keep-off", "yes-keep-off"]
 */
export function resolveKeepOff(steps = []) {
  const first = steps[0] === "keep-off";
  const second = steps[1] === "yes-keep-off";
  if (!first) return { keptOff: false, confirmedSteps: 0, reEnabled: steps[0] === "re-enable" };
  if (!second) return { keptOff: false, confirmedSteps: 1, reEnabled: false }; // cancelled at step 2 → stays on
  return { keptOff: true, confirmedSteps: 2, reEnabled: false };
}

/** Persistent About-tab banner shown while auto-start is disabled. */
export function disabledBanner(disabledAtIso) {
  const date = disabledAtIso ? new Date(disabledAtIso).toLocaleDateString() : "an earlier date";
  return `⚠ Auto-start disabled on ${date}. ARIA only runs when manually launched.`;
}
