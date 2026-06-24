// RUN 21 §3 — Windows startup registration (belt + suspenders): HKCU Run key + a Task Scheduler
// at-logon task. HKCU ONLY (per-user, never HKLM → no admin elevation needed post-install). Pure +
// node-safe; main.mjs runs the actual `reg`/`schtasks` via the injected runners. R11-guarded.
import { assertSafePath, isBlockedPath } from "../shared/path-guard.mjs";

export const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
export const RUN_VALUE_NAME = "ARIASentinel";
export const TASK_NAME = "ARIA Sentinel Startup";
export const TASK_LOGON_DELAY_SECONDS = 30; // don't fight other startup apps for resources
const TAMPER_GRACE_MS = 24 * 60 * 60 * 1000;

/** The HKCU Run-key entry. HKCU only — asserted by the test; R11 blocks a private-folder exe path. */
export function registryRunEntry(exePath) {
  assertSafePath(exePath);
  return { hive: "HKCU", key: RUN_KEY, name: RUN_VALUE_NAME, value: `"${exePath}" --startup` };
}

/** The at-logon Task Scheduler definition (30s delay after login). */
export function taskDefinition(exePath) {
  assertSafePath(exePath);
  return {
    name: TASK_NAME,
    trigger: "AtLogon",
    delaySeconds: TASK_LOGON_DELAY_SECONDS,
    command: `"${exePath}" --startup`,
    runLevel: "limited" // never elevated
  };
}

/** Given a presence probe { registry, task }, does startup need (re-)registration? */
export function needsHeal(status = {}) {
  return !status.registry || !status.task;
}

/**
 * Tamper signal: BOTH entries missing AND the last time we saw them present was >24h ago.
 * (A single missing entry self-heals silently; both gone for a day is suspicious.)
 */
export function tamperSignal(status = {}, lastBothPresentAt, now) {
  if (status.registry || status.task) return false;
  const t = Date.parse(lastBothPresentAt || 0);
  return t > 0 && (now - t) > TAMPER_GRACE_MS;
}

/** Filter a raw startup-item list to the R11-safe entries (never enumerate the private folder). */
export function safeStartupItems(items = []) {
  return (items || []).filter((it) => !isBlockedPath(it && (it.command || it.path || it)));
}

export { TAMPER_GRACE_MS };
