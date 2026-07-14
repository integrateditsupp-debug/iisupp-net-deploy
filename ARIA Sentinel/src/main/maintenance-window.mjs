// STAGE 3 S3 — MAINTENANCE WINDOWS. "It fixed it overnight" — honestly earned, never silently.
// A user-set window (e.g. 02:00 for 2h) that disruptive plans QUEUE to instead of interrupting the
// user mid-work. Pure + injectable (no timers, no I/O): the caller asks "may this plan run now?" and
// gets a decision plus the next window start, so the plan card can say exactly when it will run.
//
// INVARIANTS (same as everywhere else in Stage 3):
//   🔒 R11 is check #1 — a plan that references the off-limits private folder is never queued, never run.
//   A window NEVER grants autonomy: it only decides WHEN. The earned-autonomy ladder, the supervisor,
//   the countdown, and the kill-switch all still gate the run itself.
//   Real-or-empty: no window configured → no deferral is invented; the plan runs under its normal gates.
import { isBlockedPath } from "../shared/path-guard.mjs";

export const WINDOW_DEFAULT_DURATION_MINS = 120; // 2h — enough for a multi-step plan + a reboot resume.
export const MS_PER_MIN = 60 * 1000;
export const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

/** "02:00" → minutes-from-midnight. Returns null for anything that is not a real HH:MM. */
export function parseHhMm(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Validate a window config. Real-or-empty: an invalid config is REJECTED (never coerced into a
 * plausible-looking default), because a wrong window would run a disruptive plan in the user's face.
 * @param {{enabled?:boolean, start?:string, durationMins?:number}} cfg
 */
export function validateWindow(cfg) {
  const c = cfg || {};
  if (c.enabled === false) return { ok: false, reason: "window-disabled" };
  const startMin = parseHhMm(c.start);
  if (startMin == null) return { ok: false, reason: "invalid-start" };
  const dur = c.durationMins == null ? WINDOW_DEFAULT_DURATION_MINS : Number(c.durationMins);
  if (!Number.isFinite(dur) || dur <= 0 || dur > 12 * 60) return { ok: false, reason: "invalid-duration" };
  return { ok: true, startMin, durationMins: dur };
}

/** Local minutes-from-midnight for a timestamp (injectable Date for tests: pass dateOf). */
function minutesOfDay(ts, dateOf) {
  const d = typeof dateOf === "function" ? dateOf(ts) : new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/** Is `now` inside the window? Wrap-around windows (23:00 + 4h) are handled. */
export function isInWindow(cfg, now = Date.now(), dateOf) {
  const v = validateWindow(cfg);
  if (!v.ok) return false;
  const cur = minutesOfDay(now, dateOf);
  const end = v.startMin + v.durationMins;
  if (end <= 24 * 60) return cur >= v.startMin && cur < end;
  return cur >= v.startMin || cur < (end - 24 * 60); // wraps past midnight
}

/** Next window opening (ms epoch), or null when there is no valid window. */
export function nextWindowStart(cfg, now = Date.now(), dateOf) {
  const v = validateWindow(cfg);
  if (!v.ok) return null;
  if (isInWindow(cfg, now, dateOf)) return Number(now);
  const cur = minutesOfDay(now, dateOf);
  const deltaMins = cur < v.startMin ? (v.startMin - cur) : (24 * 60 - cur + v.startMin);
  return Number(now) + deltaMins * MS_PER_MIN;
}

/** Plain-English line for the plan card. Never promises a time we cannot name. */
export function windowLine(cfg, now = Date.now(), dateOf) {
  const at = nextWindowStart(cfg, now, dateOf);
  if (at == null) return "No maintenance window is set — this plan runs under its normal gates.";
  if (at === Number(now)) return "The maintenance window is open now.";
  const mins = Math.max(1, Math.round((at - Number(now)) / MS_PER_MIN));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const eta = h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
  return `Queued for the maintenance window — starts in about ${eta}. You can run it now instead at any time.`;
}

/**
 * THE decision. Should this plan wait for the window?
 * Deferral applies ONLY to disruptive, unattended runs:
 *   - a plan the user is actively confirming (attended) is NEVER deferred — the user is right there;
 *   - `deferToWindow: false` on the plan opts out (e.g. "my printer is broken NOW");
 *   - a plan that does not disrupt (no system-state touch, low risk) does not need a window.
 * @returns {{defer:boolean, reason:string, nextStart:number|null, line:string}}
 */
export function shouldDeferToWindow({ plan, window: cfg, unattended = false, now = Date.now(), dateOf, userInitiated = false } = {}) {
  const line = (reason, defer, nextStart) => ({ defer, reason, nextStart: defer ? nextStart : null, line: defer ? windowLine(cfg, now, dateOf) : "" });
  // 🔒 R11 — check #1. A blocked plan is not queued and not run; the caller's R11 path handles it.
  let blob = "";
  try { blob = JSON.stringify(plan || {}); } catch { blob = String(plan); }
  if (isBlockedPath(blob)) return line("R11", false, null);

  const v = validateWindow(cfg);
  if (!v.ok) return line(`no-window (${v.reason})`, false, null);   // real-or-empty: no window → no deferral
  if (userInitiated === true) return line("user-initiated", false, null);
  if (unattended !== true) return line("attended-run", false, null); // the user is at the keyboard — respect that
  if (plan && plan.deferToWindow === false) return line("plan-opts-out", false, null);
  const disruptive = !!(plan && ((plan.riskEnvelope && plan.riskEnvelope.touchesSystemState === true)
    || (plan.riskEnvelope && plan.riskEnvelope.level === "high")
    || (Array.isArray(plan.steps) && plan.steps.some((s) => s && s.risk === "high"))));
  if (!disruptive) return line("not-disruptive", false, null);
  if (isInWindow(cfg, now, dateOf)) return line("window-open", false, null);
  return line("outside-window", true, nextWindowStart(cfg, now, dateOf));
}
