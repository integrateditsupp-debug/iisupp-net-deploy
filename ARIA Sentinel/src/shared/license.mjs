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

// ===== RUN 13 — 12-hour trial gate (replaces RUN 10's 30-day issue/verify flow for the trial) =====
export const TRIAL_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours from first launch

/**
 * Pure trial-state computation. The main process reads ~/.aria-sentinel/trial.json and passes its
 * started_at (ISO string) here; a missing file → not-started.
 * @returns {{state:'not-started'|'active'|'expired', remainingMs:number}}
 */
export function computeTrialStatus(startedAtIso, now = Date.now()) {
  if (!startedAtIso) return { state: "not-started", remainingMs: 0 };
  const started = Date.parse(startedAtIso);
  if (!Number.isFinite(started)) return { state: "not-started", remainingMs: 0 };
  const remaining = TRIAL_DURATION_MS - (now - started);
  return { state: remaining > 0 ? "active" : "expired", remainingMs: Math.max(0, remaining) };
}

// Human "Xh Ym left" label for the trial countdown badge.
export function trialBadge(remainingMs) {
  const total = Math.max(0, Number(remainingMs) || 0);
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
