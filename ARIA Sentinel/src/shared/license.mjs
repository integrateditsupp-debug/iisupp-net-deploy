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

/**
 * Pure trial-state computation. The main process reads ~/.aria-sentinel/trial.json and passes its
 * started_at (ISO string) here; a missing file → not-started.
 * @returns {{state:'not-started'|'active'|'expired', remainingMs:number, endsAt:string|null, daysLeft:number|null, durationMs:number, days:number}}
 */
export function computeTrialStatus(startedAtIso, now = Date.now()) {
  const base = { durationMs: TRIAL_DURATION_MS, days: TRIAL_DAYS };
  if (!startedAtIso) return { state: "not-started", remainingMs: 0, endsAt: null, daysLeft: null, ...base };
  const started = Date.parse(startedAtIso);
  if (!Number.isFinite(started)) return { state: "not-started", remainingMs: 0, endsAt: null, daysLeft: null, ...base };
  const endsAtMs = started + TRIAL_DURATION_MS;
  const remaining = endsAtMs - now;
  return {
    state: remaining > 0 ? "active" : "expired",
    remainingMs: Math.max(0, remaining),
    endsAt: new Date(endsAtMs).toISOString(),
    daysLeft: Math.max(0, Math.ceil(Math.max(0, remaining) / DAY_MS)),
    ...base
  };
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
