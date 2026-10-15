// license — stateless trial licensing. A key is HMAC(email + ":" + trialEnd, secret); verification
// recomputes the HMAC and checks expiry. No central DB. After the trial end the app falls back to
// Manual (free) mode — it never hard-locks the user out.
import crypto from "node:crypto";

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sign(email, trialEnd, secret) {
  return crypto.createHmac("sha256", String(secret || "")).update(`${normalizeEmail(email)}:${trialEnd}`).digest("hex");
}

/** Issue a license for `days` (default 30) from `now`. */
export function issueLicense({ email, days = 30, secret, now = Date.now() } = {}) {
  const trialEnd = now + Math.max(1, Number(days) || 30) * DAY_MS;
  return { email: normalizeEmail(email), trialEnd, key: sign(email, trialEnd, secret) };
}

/**
 * Verify a license. Returns { valid, expired, mode }. mode is "trial" while valid, else "manual".
 * A tampered key is invalid; an expired-but-authentic key falls back to manual (not locked out).
 */
export function verifyLicense({ email, trialEnd, key, secret, now = Date.now() } = {}) {
  const expected = sign(email, trialEnd, secret);
  const authentic = timingSafeEqualHex(key, expected);
  if (!authentic) return { valid: false, expired: false, mode: "manual", reason: "invalid-signature" };
  const expired = now > Number(trialEnd);
  return { valid: !expired, expired, mode: expired ? "manual" : "trial", reason: expired ? "trial-ended" : "ok" };
}

export function daysRemaining(trialEnd, now = Date.now()) {
  return Math.max(0, Math.ceil((Number(trialEnd) - now) / DAY_MS));
}

// ===== RUN 13 trial gate — PROD 2026-10-14 (audit M14 / R3): the trial is 30 DAYS from first launch =====
// The UI sells a 30-day trial in four places and the product design says 30-day; the code gave 12 hours (a
// Friday install showed "Your ARIA trial has ended" on Monday). One constant, exported for every surface.
export const TRIAL_DAYS = 30;
export const TRIAL_DURATION_MS = TRIAL_DAYS * DAY_MS; // 30 days from first launch

// REVIEW P1-3 (2026-10-14) — the trial clock cannot be wound back. A start a few minutes ahead of "now" is an NTP
// correction, not an attack; anything further ahead is an edited trial.json or a clock rolled back.
export const TRIAL_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Pure trial-state computation. The main process passes the trial start (ISO) it resolved — the EARLIEST of
 * ~/.aria-sentinel/trial.json, its mirrors and the server's first sight of this device (resolveTrialStart) — and the
 * monotonic last-seen high-water mark; a missing start → not-started.
 * REVIEW P1-3: elapsed = max(wall-clock elapsed, high-water − started), so a clock rolled back after the app has seen a
 * later time cannot give days back; a start in the future (beyond TRIAL_CLOCK_SKEW_MS) is refused — the trial counts as
 * ended (reason "started-in-future"), never as a fresh 30 days.
 * @param {string|null} startedAtIso
 * @param {number} [now]
 * @param {{highWaterMs?:number}} [opts]
 * @returns {{state:'not-started'|'active'|'expired', remainingMs:number, endsAt:string|null, daysLeft:number|null, durationMs:number, days:number, reason?:string}}
 */
export function computeTrialStatus(startedAtIso, now = Date.now(), opts = {}) {
  const base = { durationMs: TRIAL_DURATION_MS, days: TRIAL_DAYS };
  if (!startedAtIso) return { state: "not-started", remainingMs: 0, endsAt: null, daysLeft: null, ...base };
  const started = Date.parse(startedAtIso);
  if (!Number.isFinite(started)) return { state: "not-started", remainingMs: 0, endsAt: null, daysLeft: null, ...base };
  const endsAtMs = started + TRIAL_DURATION_MS;
  if (started > now + TRIAL_CLOCK_SKEW_MS) {
    return { state: "expired", remainingMs: 0, endsAt: new Date(endsAtMs).toISOString(), daysLeft: 0, reason: "started-in-future", ...base };
  }
  const hw = Number(opts && opts.highWaterMs);
  const elapsed = Math.max(0, now - started, Number.isFinite(hw) ? hw - started : 0);
  const remaining = Math.min(TRIAL_DURATION_MS, TRIAL_DURATION_MS - elapsed);
  return {
    state: remaining > 0 ? "active" : "expired",
    remainingMs: Math.max(0, remaining),
    endsAt: new Date(endsAtMs).toISOString(),
    daysLeft: Math.max(0, Math.ceil(Math.max(0, remaining) / DAY_MS)),
    ...base
  };
}

/**
 * REVIEW P1-3 — the trial start a device must use: the EARLIEST valid date among the local record, its mirrors and the
 * server's `trialStartedAt` (the first time the licence server saw this device). Adding or editing a source can only
 * make the start LATER, which loses, so no source can lengthen the trial. Returns an ISO string, or null when none is known.
 */
export function resolveTrialStart(...candidates) {
  let best = NaN;
  for (const c of candidates.flat()) {
    const t = typeof c === "number" ? c : Date.parse(String(c == null ? "" : c));
    if (Number.isFinite(t) && t > 0 && !(t >= best)) best = t;
  }
  return Number.isFinite(best) ? new Date(best).toISOString() : null;
}

/**
 * REVIEW P1-3 — the trial state for a device. `hasRunBefore` (a high-water mark or a mirrored start exists) stops a
 * missing trial.json from ever meaning "not started": with no start recoverable anywhere, the trial counts as ended
 * (reason "trial-record-missing") instead of restarting. Otherwise computeTrialStatus on the earliest start.
 */
export function trialStatusFor({ starts = [], hasRunBefore = false, now = Date.now(), highWaterMs } = {}) {
  const start = resolveTrialStart(starts);
  if (!start && hasRunBefore) {
    return { state: "expired", remainingMs: 0, endsAt: null, daysLeft: 0, reason: "trial-record-missing", durationMs: TRIAL_DURATION_MS, days: TRIAL_DAYS };
  }
  return computeTrialStatus(start, now, { highWaterMs });
}

// Human label for the trial countdown badge: days when a day or more is left ("Trial · 29d 4h left"), the RUN 13
// hours/minutes form inside the last day ("Trial · 8h 12m left").
export function trialBadge(remainingMs) {
  const total = Math.max(0, Number(remainingMs) || 0);
  if (total >= DAY_MS) {
    const d = Math.floor(total / DAY_MS);
    const h = Math.floor((total % DAY_MS) / (60 * 60 * 1000));
    return `Trial · ${d}d ${h}h left`;
  }
  const h = Math.floor(total / (60 * 60 * 1000));
  const m = Math.floor((total % (60 * 60 * 1000)) / (60 * 1000));
  return `Trial · ${h}h ${m}m left`;
}

/**
 * The single gate the whole app keys off: a valid license OR an active trial unlocks features.
 * @param {object} args { licenseValid:boolean, trialState:'not-started'|'active'|'expired' }
 */
export function isUnlocked({ licenseValid = false, trialState = "not-started" } = {}) {
  if (licenseValid) return true;
  return trialState === "active";
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}
