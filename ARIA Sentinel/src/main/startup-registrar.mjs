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
  // PROD 2026-10-14 (audit M7) — never seen (undefined / "" / 0) is NOT a tamper: Date.parse(0) used to read as
  // the year 2000 and turn every clean first run into a "removed from startup" alarm.
  if (!lastBothPresentAt) return false;
  const t = Date.parse(lastBothPresentAt);
  return Number.isFinite(t) && t > 0 && (now - t) > TAMPER_GRACE_MS;
}

/** Filter a raw startup-item list to the R11-safe entries (never enumerate the private folder). */
export function safeStartupItems(items = []) {
  return (items || []).filter((it) => !isBlockedPath(it && (it.command || it.path || it)));
}

// ── PROD 2026-10-14 (audit M7) — honest first-run + headless auto-start ─────────────────────────────────────
export const STARTUP_ARG = "--startup";

/** True when this launch was started by the Run key / task (`--startup` in argv). Pure. */
export function isStartupLaunch(argv = []) {
  return (Array.isArray(argv) ? argv : []).some((a) => String(a) === STARTUP_ARG);
}

/**
 * Should the Settings window be shown at launch? Not for an auto-start (`--startup`), not for the boot smoke test.
 * A person who opens ARIA from the Start menu still gets the window. Pure.
 */
export function shouldShowWindowAtLaunch(argv = [], env = {}) {
  if (env && env.ARIA_BOOT_SMOKE) return false;
  return !isStartupLaunch(argv);
}

/** Should a second-instance launch pop the Settings window? Only when a PERSON launched it (not the Run key). */
export function shouldShowWindowOnSecondInstance(argv = []) {
  return !isStartupLaunch(argv);
}

/**
 * The startup-heal decision for one launch. Pure, so the first-run false alarm is pinned by a test:
 *   · not win32                         → { action:"skip" }  (no registry / task scheduler to heal)
 *   · user turned startup off           → { action:"skip" }
 *   · both entries present              → { action:"ok", seenAt:now }
 *   · Run key present, task missing     → { action:"ok" }   (the task is only the self-heal, never required)
 *   · Run key missing, never registered → { action:"register", tamper:false }  (first run — nothing to tamper with)
 *   · Run key missing, seen <24h ago    → { action:"register", tamper:false }  (grace — a reinstall, a sync blip)
 *   · Run key missing, seen >24h ago    → { action:"register", tamper:true }   (someone removed it: audit + warn)
 */
export function startupHealDecision({ platform, startupEnabled, status, lastBothPresentAt, now } = {}) {
  if (platform !== "win32") return { action: "skip", reason: "not-windows", tamper: false };
  if (startupEnabled === false) return { action: "skip", reason: "user-disabled", tamper: false };
  const st = status || {};
  if (st.registry) return { action: "ok", reason: st.task ? "both-present" : "run-key-present", tamper: false };
  const tamper = tamperSignal({ registry: false, task: Boolean(st.task) }, lastBothPresentAt, Number(now) || Date.now());
  return { action: "register", reason: lastBothPresentAt ? (tamper ? "removed-after-grace" : "within-grace") : "never-registered", tamper };
}

export { TAMPER_GRACE_MS };
