// F5 (SENTINEL-BRAIN-AUDIT) — honest guided walkthrough for HIGH-VALUE Tier-0 recipes that the brain
// recommends but that have NO live executor binding yet (reset-network-stack, clear-print-queue).
//
// The audit's F5 fix has two halves:
//   1. S2 adds the real, safety-reviewed executor binding (netsh winsock reset needs reboot handling;
//      clearing the print queue deletes queued jobs — both are "bigger hammers" the S1 authors
//      deliberately deferred pending Codex safety review — see resolution-playbooks.mjs header).
//   2. UNTIL that binding lands, the brain must NOT surface a live-looking action card that silently
//      degrades to manual/fail (the exact F5 defect). It must show an HONEST guided walkthrough the
//      user runs themselves — "not a dead action" (SENTINEL-BRAIN-AUDIT F5, verbatim intent).
//
// This module is that honest half. It is PURE + node-safe (no DOM, no Electron, no child_process, no I/O):
// it only returns curated, human-readable step content grounded in the real Tier-0 catalog descriptors.
// It NEVER executes anything — every step is a plain instruction the user performs.
//
// 🔒 Rule 14 (honesty IS the moat): real-or-empty. Unknown recipe id → null (never an invented card).
//    Each walkthrough states WHY it is manual and, where a step is irreversible or needs a reboot, says so.
// 🔒 R11: the recipe id is path-scrubbed as check #1; a path-like id is treated as unknown (null).
// 🔒 Self-retiring: getGuidedWalkthrough accepts an injectable `isBound` predicate (e.g. resolveExecutorId
//    from tier-0-executor). If a recipe becomes BOUND (S2's real binding lands), the manual walkthrough
//    auto-disables for that id (returns null) so it never competes with the real automated plan.

// 🔒 R11 — strip anything path-like out of a free-text field before it is used (mirrors
// resolution-outcome.scrubField; kept local so this module stays dependency-free + node-safe).
export function scrubField(value) {
  return String(value == null ? "" : value)
    .replace(/[A-Za-z]:\\[^\s"']*/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"']*/gi, "[path]")
    .replace(/\\\\[^\s"']+/g, "[path]")
    .trim();
}

// Curated walkthroughs. Content is grounded in the Tier-0 catalog `whatItDoes` + `commands` so the guided
// steps match what the automated binding will eventually do — no drift between "guided now" and "auto later".
const WALKTHROUGHS = Object.freeze({
  "reset-network-stack": Object.freeze({
    recipeId: "reset-network-stack",
    title: "Reset the network stack (guided — you run each step)",
    category: "no-internet",
    manual: true,
    requiresReboot: true,
    reversible: false,
    whyManual: "Resetting Winsock and the TCP/IP stack is a bigger change that requires a reboot, so ARIA does not run it unattended yet — you stay in control and confirm each step.",
    steps: Object.freeze([
      Object.freeze({ n: 1, instruction: "Open the Start menu, type \"cmd\", right-click Command Prompt and choose \"Run as administrator\".", command: null }),
      Object.freeze({ n: 2, instruction: "Reset the Winsock catalog by running this command, then press Enter.", command: "netsh winsock reset" }),
      Object.freeze({ n: 3, instruction: "Reset the TCP/IP stack by running this command, then press Enter.", command: "netsh int ip reset" }),
      Object.freeze({ n: 4, instruction: "Restart your PC to finish — the reset does not fully apply until you reboot.", command: null })
    ]),
    safetyNote: "Safe and standard, but a reboot is required. If you use a manual/static IP or VPN, note your settings first — a stack reset returns network settings to Windows defaults.",
    officialSource: "Microsoft Support — \"Fix network connection issues in Windows\""
  }),
  "clear-print-queue": Object.freeze({
    recipeId: "clear-print-queue",
    title: "Clear a stuck print queue (guided — you run each step)",
    category: "printer-issues",
    manual: true,
    requiresReboot: false,
    reversible: false,
    whyManual: "Clearing the queue deletes the jobs waiting in it, which cannot be undone, so ARIA has you do it deliberately rather than auto-running it.",
    steps: Object.freeze([
      Object.freeze({ n: 1, instruction: "Open the Start menu, type \"cmd\", right-click Command Prompt and choose \"Run as administrator\".", command: null }),
      Object.freeze({ n: 2, instruction: "Stop the Print Spooler service so the queue files can be cleared.", command: "net stop spooler" }),
      Object.freeze({ n: 3, instruction: "Delete the stuck queue files (this removes queued jobs — you will need to re-print them).", command: "del /Q /F %systemroot%\\System32\\spool\\PRINTERS\\*" }),
      Object.freeze({ n: 4, instruction: "Start the Print Spooler service again.", command: "net start spooler" }),
      Object.freeze({ n: 5, instruction: "Re-send your document to the printer.", command: null })
    ]),
    safetyNote: "Any documents currently waiting to print are permanently removed and must be printed again. Your files and printer settings are not affected.",
    officialSource: "Microsoft Support — \"Fix printer connection and printing problems in Windows\""
  })
});

export const GUIDED_WALKTHROUGH_IDS = Object.freeze(Object.keys(WALKTHROUGHS));

/** True only for a curated, non-path-like recipe id that has a guided walkthrough. */
export function hasGuidedWalkthrough(recipeId) {
  const id = scrubField(recipeId);
  return id !== "[path]" && Object.prototype.hasOwnProperty.call(WALKTHROUGHS, id);
}

/**
 * Honest guided walkthrough for an UNBOUND high-value recipe, or null (real-or-empty).
 * @param {string} recipeId
 * @param {{ isBound?: (id:string)=>boolean }} [opts] inject resolveExecutorId; if the id is already bound,
 *        the manual walkthrough retires (returns null) — the automated plan takes over.
 * @returns {object|null} a deep-frozen copy the caller can render but never mutate.
 */
export function getGuidedWalkthrough(recipeId, opts = {}) {
  // 🔒 R11 — check #1: a path-like id never resolves to anything.
  const id = scrubField(recipeId);
  if (id === "[path]" || !Object.prototype.hasOwnProperty.call(WALKTHROUGHS, id)) return null;
  // 🔒 Self-retiring: if a real executor binding now exists, do NOT offer a manual fallback.
  const isBound = typeof opts.isBound === "function" ? opts.isBound : null;
  if (isBound && isBound(id)) return null;
  return deepFreeze(structuredClone(WALKTHROUGHS[id]));
}

function deepFreeze(o) {
  if (o && typeof o === "object") { for (const v of Object.values(o)) deepFreeze(v); Object.freeze(o); }
  return o;
}
