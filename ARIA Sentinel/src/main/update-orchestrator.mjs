// RUN 21 §2 — 3-strike + time-window update orchestrator. Pure decision layer (node-safe); main.mjs
// wires the modals / installer / snapshot on top. State persists in HMAC-signed update-state.json.
//
//   IDLE → (detect) → FRESH → +window → STRIKE1 → +window → STRIKE2 → +window → STRIKE3 → +window → AUTO
//   user "install" at any phase → INSTALLED.   "later"/"snooze" → resets the window timer, same phase.
//   AUTO → installs at the next opportunity window (5pm preferred · 12pm after 2w · on-launch last resort),
//   but NEVER while the user is in a fullscreen app (game / video call / presentation).
import { defaultUpdateState, strikeWindowMs } from "../shared/update-state.mjs";

const PHASE_ORDER = ["FRESH", "STRIKE1", "STRIKE2", "STRIKE3", "AUTO"];
const STRIKE_FOR = { FRESH: 0, STRIKE1: 1, STRIKE2: 2, STRIKE3: 3, AUTO: 3 };
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const ROLLBACK_WINDOW_MS = 60 * 60 * 1000; // kill-switch can roll back within 60 min post-install

/** A new update was detected. Resets the machine to FRESH (only if it's a different/new version). */
export function detect(state, version, now, { mandatory = false } = {}) {
  const s = state || defaultUpdateState();
  if (s.version === version && s.phase !== "IDLE" && s.phase !== "INSTALLED") return s; // already tracking it
  const iso = new Date(now).toISOString();
  return { ...defaultUpdateState(), phase: "FRESH", strike: 0, version, mandatory: Boolean(mandatory), firstSeenAt: iso, lastNoticeAt: iso, lastCheckAt: iso, pauses: s.pauses || [] };
}

/** Is a fresh notice/advance due (the strike window has elapsed since the last notice)? */
export function isNoticeDue(state, now) {
  if (!state || !PHASE_ORDER.includes(state.phase) || state.phase === "AUTO") return false;
  const window = strikeWindowMs(state.mandatory) + pauseExtensionMs(state, now);
  return Date.parse(state.lastNoticeAt || 0) > 0 && (now - Date.parse(state.lastNoticeAt)) >= window;
}

/** Advance one phase when due (FRESH→STRIKE1→…→STRIKE3→AUTO). No-op if not due. */
export function advance(state, now) {
  if (!isNoticeDue(state, now)) return state;
  const idx = PHASE_ORDER.indexOf(state.phase);
  const nextPhase = PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)];
  return { ...state, phase: nextPhase, strike: STRIKE_FOR[nextPhase], lastNoticeAt: new Date(now).toISOString() };
}

/** User picked Install / Later / Snooze on the notice modal. */
export function userChoice(state, choice, now) {
  if (!state) return state;
  if (choice === "install") return { ...state, phase: "INSTALLED", installedAt: new Date(now).toISOString() };
  // "later" / "snooze 24h" just re-arm the window timer; the next advance() moves the phase.
  return { ...state, lastNoticeAt: new Date(now).toISOString() };
}

// ── Opportunity windows (only consulted once phase === AUTO) ────────────────────────────────────────
/**
 * @param ctx { on, running, localHour (0-23), fullscreen, now }
 * @returns { action:'install'|'defer', reason }
 */
export function nextOpportunity(state, ctx = {}) {
  if (state.phase !== "AUTO") return { action: "defer", reason: "not-in-auto" };
  // Anti-rage: never force-install during a fullscreen app (game / video call / presentation).
  if (ctx.fullscreen) return { action: "defer", reason: "fullscreen-busy" };
  if (!ctx.on || !ctx.running) return { action: "defer", reason: "machine-not-available" };

  const daysSinceFresh = state.firstSeenAt ? (ctx.now - Date.parse(state.firstSeenAt)) / (24 * 60 * 60 * 1000) : 0;
  // PREFERRED: machine on + app running + local time ≥ 17:00 → install now.
  if (ctx.localHour >= 17) return { action: "install", reason: "preferred-evening-window" };
  // FALLBACK: 2 weeks elapsed with no opportunity → install at 12:00 local the next day it's on.
  if (daysSinceFresh >= 14 && ctx.localHour >= 12) return { action: "install", reason: "fallback-2week-noon" };
  if (daysSinceFresh >= 14) return { action: "defer", reason: "fallback-awaiting-noon" };
  // LAST RESORT: handled by main on next launch (running just became true) outside the 5pm/12pm windows.
  if (ctx.lastResortOnLaunch) return { action: "install", reason: "last-resort-on-launch" };
  return { action: "defer", reason: "awaiting-evening-window" };
}

/** Hard gate used by main before ANY install (including mandatory): never over a fullscreen app. */
export function canInstallNow(ctx = {}) {
  return Boolean(ctx.on && ctx.running && !ctx.fullscreen);
}

// ── Pre-install snapshot + kill-switch rollback window ───────────────────────────────────────────────
export function snapshotName(version, now) {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  return `v${version || "unknown"}-presnapshot-${stamp}.tar.gz`;
}
/** True while the kill-switch (Ctrl+Alt+K) may still roll back a just-installed update (≤60 min). */
export function canRollback(installedAt, now) {
  if (!installedAt) return false;
  const t = Date.parse(installedAt);
  return t > 0 && (now - t) <= ROLLBACK_WINDOW_MS;
}

// ── "Pause updates 7 days" — max once per calendar quarter ───────────────────────────────────────────
export function quarterOf(now) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}
export function canPause(state, now) {
  const q = quarterOf(now);
  return !((state.pauses || []).some((p) => quarterOf(Date.parse(p)) === q));
}
export function recordPause(state, now) {
  if (!canPause(state, now)) return { state, ok: false, reason: "quarterly-limit-reached" };
  return { state: { ...state, pauses: [...(state.pauses || []), new Date(now).toISOString()] }, ok: true };
}
/** Active 7-day pauses extend the current strike window by 7d each. */
export function pauseExtensionMs(state, now) {
  const SEVEN = 7 * 24 * 60 * 60 * 1000;
  return (state.pauses || []).reduce((sum, p) => {
    const t = Date.parse(p);
    return (t > 0 && now - t < SEVEN) ? sum + (SEVEN - (now - t)) : sum;
  }, 0);
}

export { PHASE_ORDER, ROLLBACK_WINDOW_MS };
