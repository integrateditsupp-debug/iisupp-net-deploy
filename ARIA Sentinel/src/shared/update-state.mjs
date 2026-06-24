// RUN 21 — HMAC-signed update-state (3-strike + time-window machine state). The state file in userData
// is signed so a user can't hand-edit it to dodge a mandatory patch. Pure + node-safe.
import crypto from "node:crypto";

export const STRIKE_WINDOW_MS = 24 * 60 * 60 * 1000;        // normal: 24h per strike
export const MANDATORY_WINDOW_MS = 3 * 60 * 60 * 1000;      // mandatory: 3h per strike
export const PHASES = ["IDLE", "FRESH", "STRIKE1", "STRIKE2", "STRIKE3", "AUTO", "INSTALLED"];

export function defaultUpdateState() {
  return {
    phase: "IDLE",
    strike: 0,
    version: null,
    firstSeenAt: null,
    lastNoticeAt: null,
    lastCheckAt: null,
    installedAt: null,
    pauses: [],          // ISO timestamps of "Pause updates 7 days" uses (quarterly-limited)
    mandatory: false
  };
}

/** Window length for one strike, compressed to 3h when the update is mandatory. */
export function strikeWindowMs(mandatory) {
  return mandatory ? MANDATORY_WINDOW_MS : STRIKE_WINDOW_MS;
}

export function signState(state, key = "aria-sentinel-update") {
  return crypto.createHmac("sha256", String(key)).update(JSON.stringify(state)).digest("hex");
}

export function verifyState(state, signature, key = "aria-sentinel-update") {
  const expected = signState(state, key);
  const a = Buffer.from(String(signature || ""), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

/** Serialize { state, sig } for disk. */
export function sealState(state, key) {
  return JSON.stringify({ state, sig: signState(state, key) }, null, 2);
}

/** Read a sealed blob; returns the state only if the signature verifies (else the default state). */
export function openState(raw, key) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && parsed.state && verifyState(parsed.state, parsed.sig, key)) return parsed.state;
  } catch { /* fall through to default */ }
  return defaultUpdateState();
}
