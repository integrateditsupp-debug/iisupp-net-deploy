// STAGE 3 S3 (2026-07-16) — maintenance windows for the Autonomous Resolution Engine.
// Spec (STAGE-3-AUTONOMOUS-RESOLUTION-SPEC-2026-07-01): "Maintenance windows: user-set (e.g., 02:00);
// plans queue to the window." This module gates WHEN an unattended (Autonomous-mode) plan may run — it
// composes AFTER the earned-autonomy ladder (plan-autonomy-ladder.mjs), which gates WHETHER a plan may
// run unattended at all. Confirmed / Manual runs are NOT window-gated (the user is present and clicks).
//
// Pure + node-safe: an INJECTED clock (a Date), no Date.now surprises, no I/O, nothing spawned. It mirrors
// the house style of plan-autonomy-ladder (returns { allowed, reasons[] } so a plan card can say honestly
// WHY a plan is still waiting).
//
// Invariants this module honors (tests prove them):
//  * R11 is check #1 here too — a plan whose blob references the off-limits private folder is refused
//    outright and never contributes to a window decision.
//  * Rule 14 real-or-empty — nextWindowStart is a real Date or `null` (never a fabricated time); an empty /
//    disabled config produces an honest "not window-gated", never an invented window.
//  * This gate can ONLY withhold an unattended run — it can never force one, and it never overrides the
//    kill-switch or the dry-run checkbox (those still win everywhere, enforced upstream in the executor).
//  * Zero edits to supervisor-agent / action-countdown / tier-0-executor / plan-autonomy-ladder — this file
//    only READS the ladder predicate.
import { isBlockedPath } from "../shared/path-guard.mjs";
import { canRunUnattended } from "./plan-autonomy-ladder.mjs";

const MIN = 60_000;
const DAY_MIN = 24 * 60;

// Named day-sets. Numbers are JS getDay(): 0 = Sunday .. 6 = Saturday.
export const DAY_SETS = Object.freeze({
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
});

export function emptyWindowConfig() { return { enabled: false, windows: [] }; }

/** "HH:MM" -> minutes-of-day (0..1439), or null if unparseable / out of range. */
export function parseHHMM(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

/** Normalize a window's day selector to a sorted unique int array in 0..6, or null if it resolves to nothing. */
function normalizeDays(days) {
  let arr;
  if (typeof days === "string") arr = DAY_SETS[days.trim().toLowerCase()];
  else if (Array.isArray(days)) arr = days;
  else if (days == null) arr = DAY_SETS.daily; // default: every day
  if (!Array.isArray(arr)) return null;
  const out = [...new Set(arr.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  return out.length ? out : null;
}

/** Validate + normalize one window -> { days:int[], startMin:int, durationMin:int } or null (dropped honestly).
 *  Idempotent: accepts either { start:"HH:MM" } or an already-normalized { startMin:int }. */
export function normalizeWindow(w) {
  if (!w || typeof w !== "object") return null;
  const days = normalizeDays(w.days);
  const startMin = (Number.isInteger(w.startMin) && w.startMin >= 0 && w.startMin <= 1439) ? w.startMin : parseHHMM(w.start);
  let durationMin = Number(w.durationMin);
  if (!days || startMin == null) return null;
  if (!Number.isInteger(durationMin) || durationMin <= 0) return null;
  if (durationMin > DAY_MIN) durationMin = DAY_MIN; // a 24h window = "always on that day"; cap, never overflow past a full day
  return { days, startMin, durationMin };
}

/** Normalize a whole config. enabled defaults to (has >=1 valid window) when not explicitly set. */
export function normalizeWindowConfig(config) {
  if (!config || typeof config !== "object") return emptyWindowConfig();
  const windows = Array.isArray(config.windows) ? config.windows.map(normalizeWindow).filter(Boolean) : [];
  const enabled = config.enabled === undefined ? windows.length > 0 : !!config.enabled;
  return { enabled: enabled && windows.length > 0, windows };
}

// Local wall-clock helpers — built from the INJECTED `now` Date's own local parts, so tests that inject a
// fixed local Date are fully deterministic (construction uses the same tz as the clock).
function localDayOfWeek(now, dayOffset) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset).getDay();
}
function atLocalMinutes(now, dayOffset, minutes) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 0, 0, 0, 0).getTime() + minutes * MIN;
}

/**
 * Is `now` currently inside any configured window? Handles windows that cross midnight (a window that
 * started yesterday can still be active now). start inclusive, end exclusive.
 * @returns {{ within:boolean, window:(object|null) }}
 */
export function isWithinWindow(config, now) {
  const cfg = normalizeWindowConfig(config);
  if (!cfg.enabled || !(now instanceof Date) || Number.isNaN(now.getTime())) return { within: false, window: null };
  const t = now.getTime();
  for (const win of cfg.windows) {
    // dayOffset -1 catches a midnight-crossing window that began yesterday.
    for (const dayOffset of [-1, 0]) {
      if (!win.days.includes(localDayOfWeek(now, dayOffset))) continue;
      const start = atLocalMinutes(now, dayOffset, win.startMin);
      const end = start + win.durationMin * MIN;
      if (t >= start && t < end) return { within: true, window: win };
    }
  }
  return { within: false, window: null };
}

/**
 * The next window START strictly after `now`, or null if nothing is configured. Scans the next 8 days so a
 * weekly (single-day) window is always found. Real-or-empty: a real Date or null, never a fabricated time.
 */
export function nextWindowStart(config, now) {
  const cfg = normalizeWindowConfig(config);
  if (!cfg.enabled || !(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  const t = now.getTime();
  let best = null;
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const dow = localDayOfWeek(now, dayOffset);
    for (const win of cfg.windows) {
      if (!win.days.includes(dow)) continue;
      const start = atLocalMinutes(now, dayOffset, win.startMin);
      if (start > t && (best === null || start < best)) best = start;
    }
  }
  return best === null ? null : new Date(best);
}

/**
 * Maintenance-window decision for a run.
 * @param {{ plan:object, windowConfig:object, now:Date, unattended?:boolean }} args
 *  unattended=false (Confirmed/Manual, user present) -> never window-gated.
 *  unattended=true -> must be inside a configured window; if no window is configured, this gate does not
 *  apply (returns allowed with windowConfigured:false — the autonomy ladder is the real unattended gate).
 * @returns {{ allowed:boolean, reasons:string[], within:boolean, activeWindow:(object|null),
 *            nextWindowStart:(Date|null), windowConfigured:boolean }}
 */
export function checkMaintenanceWindow({ plan, windowConfig, now, unattended = true } = {}) {
  // R11 — check #1.
  let blob = "";
  try { blob = JSON.stringify(plan || {}); } catch { blob = String(plan); }
  if (isBlockedPath(blob)) {
    return { allowed: false, reasons: ["R11: plan references the off-limits private folder"], within: false, activeWindow: null, nextWindowStart: null, windowConfigured: false };
  }
  const cfg = normalizeWindowConfig(windowConfig);
  const windowConfigured = cfg.enabled && cfg.windows.length > 0;
  const { within, window } = isWithinWindow(windowConfig, now);
  const next = nextWindowStart(windowConfig, now);

  if (!unattended) {
    // Attended run — the user is present and clicks; windows don't apply.
    return { allowed: true, reasons: [], within, activeWindow: within ? window : null, nextWindowStart: next, windowConfigured };
  }
  if (!windowConfigured) {
    // No window set -> this gate is a no-op (the autonomy ladder still blocks unattended on its own).
    return { allowed: true, reasons: ["no maintenance window configured — not window-gated (autonomy ladder still applies)"], within: false, activeWindow: null, nextWindowStart: null, windowConfigured: false };
  }
  if (within) {
    return { allowed: true, reasons: [], within: true, activeWindow: window, nextWindowStart: next, windowConfigured: true };
  }
  const when = next ? next.toISOString() : "unknown";
  return { allowed: false, reasons: [`outside maintenance window — queued to next window (${when})`], within: false, activeWindow: null, nextWindowStart: next, windowConfigured: true };
}

/**
 * Convenience combiner: a plan may run UNATTENDED only when BOTH the earned-autonomy ladder AND the
 * maintenance-window gate allow it. Reasons from both are concatenated so the card lists every blocker.
 * This does not mutate or re-implement the ladder — it only calls its predicate.
 */
export function gateUnattendedRun({ plan, planHistory, vettedCountOf, mode, windowConfig, now, unattendedEnabled } = {}) {
  const ladder = canRunUnattended({ plan, planHistory, vettedCountOf, mode, unattendedEnabled });
  const win = checkMaintenanceWindow({ plan, windowConfig, now, unattended: true });
  return { allowed: ladder.allowed && win.allowed, reasons: [...ladder.reasons, ...win.reasons], ladder, window: win };
}
