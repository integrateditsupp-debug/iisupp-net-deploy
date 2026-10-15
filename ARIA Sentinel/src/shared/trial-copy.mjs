// PROD 2026-10-14 (audit R3 / R13 / R20) — ONE source for every trial sentence the renderer prints.
// PURE + browser-safe (no node:/electron imports — license.mjs carries node:crypto and cannot be loaded by the
// renderer, so the TRUE trial numbers arrive in getState().gate.trial from main and this module only words them).
// Rule 14: never a fabricated countdown — a missing end date renders as a sentence without a number, never
// "undefined days left"; the day count always comes from the gate (durationMs/days) with one documented default
// that tests pin to license.mjs TRIAL_DAYS.

export const DEFAULT_TRIAL_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** The trial length in days for this gate (main sends gate.trial.days / gate.trialDays; default pinned to license.mjs). */
export function trialDays(gate = {}) {
  const t = (gate && gate.trial) || {};
  for (const v of [t.days, gate && gate.trialDays, t.durationMs != null ? Number(t.durationMs) / DAY_MS : null]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return DEFAULT_TRIAL_DAYS;
}

/** The trial length in ms (gate.trial.durationMs when main sent it, else days × 1 day). */
export function trialDurationMs(gate = {}) {
  const t = (gate && gate.trial) || {};
  const n = Number(t.durationMs);
  return Number.isFinite(n) && n > 0 ? n : trialDays(gate) * DAY_MS;
}

/** ISO end date of the trial, or null when no trial exists. */
export function trialEndsAt(gate = {}) {
  const t = (gate && gate.trial) || {};
  const iso = t.endsAt || (gate && gate.trialEndsAt) || null;
  return iso && Number.isFinite(Date.parse(iso)) ? iso : null;
}

/** Whole days left (ceil), 0 once expired, null when there is no trial end to count from. Never NaN/undefined. */
export function trialDaysLeft(gate = {}, now = Date.now()) {
  const t = (gate && gate.trial) || {};
  for (const v of [t.daysLeft, gate && gate.daysLeft]) {
    const n = Number(v);
    if (v != null && Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  const iso = trialEndsAt(gate);
  if (iso) return Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY_MS));
  const rem = Number(t.remainingMs);
  if (Number.isFinite(rem) && rem >= 0 && t.state === "active") return Math.max(0, Math.ceil(rem / DAY_MS));
  return null;
}

/** "active" | "expired" | "not-started" | "licensed". */
export function trialState(gate = {}) {
  if (gate && gate.licensed) return "licensed";
  const st = gate && gate.trial && gate.trial.state;
  if (st === "active" || st === "expired") return st;
  return "not-started";
}

const fmtDate = (iso) => { const t = Date.parse(iso || ""); return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : ""; };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** What still works at the free floor — the one honest sentence every lock surface shares. */
export function freeFloorLine(gate = {}) {
  const walk = Boolean(gate && gate.walkthroughEntitled);
  return `Dashboard, ARIA chat, Manual mode and Settings keep working${walk ? ", and your Walk-Through is yours to keep" : ""}.`;
}

/** The Settings → License sentence (never "undefined"). */
export function licenseStatusLine(license = {}, gate = {}, now = Date.now()) {
  const days = trialDays(gate);
  const state = trialState(gate);
  if (state === "licensed" || (license && license.licensed)) return `Licensed${(gate && gate.plan) || (license && license.plan) ? " · " + ((gate && gate.plan) || license.plan) : ""}.`;
  if (state === "active") {
    const left = trialDaysLeft(gate, now);
    const ends = trialEndsAt(gate);
    const when = ends ? ` (ends ${fmtDate(ends)})` : "";
    // REVIEW P2-9 (2026-10-14) — the trial unlocks the PRO plan (license-plan TRIAL_PLAN), not every tier's features.
    return left == null ? `Trial active — every Pro feature is unlocked${when}.` : `Trial active · ${plural(left, "day")} left${when} — every Pro feature is unlocked.`;
  }
  if (state === "expired") {
    const ends = trialEndsAt(gate);
    return `Your ${days}-day trial ended${ends ? " " + fmtDate(ends) : ""}. ${freeFloorLine(gate)} Subscribe to unlock Confirmed + Autonomous fixes, recipes, reports and the rest.`;
  }
  return `Manual mode (free). Start a ${days}-day trial of every Pro feature — Confirmed + Autonomous fixes, recipes and reports.`;
}

/** The top-bar / account chip text. */
export function trialBadgeText(gate = {}, now = Date.now()) {
  const state = trialState(gate);
  if (state === "licensed") return "Licensed";
  if (state === "active") {
    const t = (gate && gate.trial) || {};
    if (t.badge) return String(t.badge);
    const left = trialDaysLeft(gate, now);
    return left == null ? "Trial active" : `Trial · ${left}d left`;
  }
  if (state === "expired") return "Trial ended";
  return "Free";
}

/** Settings → Account line. */
export function accountStatusLine(gate = {}, now = Date.now()) {
  const state = trialState(gate);
  if (state === "licensed") return `Licensed${gate.plan ? " · " + gate.plan : ""}`;
  if (state === "active") return trialBadgeText(gate, now);
  if (state === "expired") return "Trial ended — choose a plan to unlock the rest. Manual mode and ARIA chat keep working.";
  return "Free — Manual mode and ARIA chat. Start the trial or enter a license to unlock the rest.";
}

/**
 * Locked-tab overlay copy: an honest message + the days line + whether the "Keep using your Walk-Through" button
 * is true for this person (only when the entitlement is real — never offer a locked tab as a consolation).
 */
export function lockedTabCopy(gate = {}, now = Date.now()) {
  const days = trialDays(gate);
  const state = trialState(gate);
  const ends = trialEndsAt(gate);
  const walk = Boolean(gate && gate.walkthroughEntitled);
  const message = state === "expired"
    ? `Your ${days}-day ARIA Sentinel trial has ended. This tab is part of the paid plans — subscribe to unlock monitoring, auto-fix, recipes and reports. ${freeFloorLine(gate)}`
    : `This tab is part of the paid ARIA Sentinel plans. Start the ${days}-day trial or subscribe to unlock it. ${freeFloorLine(gate)}`;
  let trialInfo = "";
  if (state === "expired" && ends) trialInfo = `Your ${days}-day trial ended ${fmtDate(ends)}.`;
  else if (state === "active") { const left = trialDaysLeft(gate, now); trialInfo = left == null ? "" : `${plural(left, "day")} left in your trial${ends ? " (ends " + fmtDate(ends) + ")" : ""}.`; }
  return { message, trialInfo, showWalkthroughButton: walk, days };
}

/** The wizard's License-step sentence (the trial starts at first launch; the wizard never pretends to start it). */
export function wizardTrialLine(gate = {}, now = Date.now()) {
  const days = trialDays(gate);
  const state = trialState(gate);
  if (state === "licensed") return "This device is licensed. You can paste a different key below if you need to.";
  if (state === "active") {
    const left = trialDaysLeft(gate, now);
    const ends = trialEndsAt(gate);
    return `Your free ${days}-day trial is already running${left != null ? ` — ${plural(left, "day")} left` : ""}${ends ? ` (ends ${fmtDate(ends)})` : ""}. Every Pro feature is unlocked while it runs. Paste a license key if you have one, or skip this — you can add it later in Settings.`;
  }
  if (state === "expired") return `Your ${days}-day trial has ended. Paste a license key to unlock everything, or skip this — Manual mode and ARIA chat keep working.`;
  return `A free ${days}-day trial of every Pro feature starts the first time ARIA runs. Paste a license key if you have one, or skip this — you can add it later in Settings.`;
}

/** Fraction of the trial remaining (0..1), from the gate's own numbers — never a hard-coded duration. */
export function trialFractionLeft(gate = {}) {
  const t = (gate && gate.trial) || {};
  const rem = Number(t.remainingMs);
  if (!Number.isFinite(rem) || rem < 0) return null;
  return Math.max(0, Math.min(1, rem / trialDurationMs(gate)));
}
