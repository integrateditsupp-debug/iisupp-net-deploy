// RUN 21 §5 — daily heartbeat (doubles as the update poll + license keepalive). CONTENT-BLIND: only a
// fixed allowlist of meta fields ever leaves the device — no usernames, machine names, or file paths.
// Pure + node-safe; main.mjs does the POST on the jittered daily timer.
import { isBlockedPath, redactPrivate } from "../shared/path-guard.mjs";

// The ONLY keys allowed in a heartbeat payload. Anything else is dropped.
export const HEARTBEAT_FIELDS = ["licenseId", "version", "lastUpdateState", "startupEnabled", "uptimeHours", "healthScore", "platform", "osBuild", "timestamp"];

function scalar(v) {
  // Strings are redacted of any private-folder reference; non-scalars are coerced to safe primitives.
  if (typeof v === "string") return redactPrivate(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v == null) return null;
  return redactPrivate(String(v));
}

/**
 * Build the content-blind heartbeat payload. Drops every field not on HEARTBEAT_FIELDS and refuses any
 * value that references the off-limits private folder.
 */
export function buildHeartbeatPayload(input = {}, now = new Date().toISOString()) {
  const src = { ...input, timestamp: input.timestamp || now };
  const out = {};
  for (const k of HEARTBEAT_FIELDS) {
    if (!(k in src)) { out[k] = null; continue; }
    if (typeof src[k] === "string" && isBlockedPath(src[k])) { out[k] = null; continue; } // R11: never transmit
    out[k] = scalar(src[k]);
  }
  return out;
}

/** Guard: a payload is content-blind only if it carries no PII-shaped values. */
export function isContentBlind(payload = {}) {
  const blob = JSON.stringify(payload);
  if (isBlockedPath(blob)) return false;
  if (/[a-z]:\\users\\[^\\]+/i.test(blob)) return false;     // windows user path
  if (/\\\\[a-z0-9._-]+/i.test(blob)) return false;          // UNC machine name
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(blob)) return false; // email
  return Object.keys(payload).every((k) => HEARTBEAT_FIELDS.includes(k));
}
