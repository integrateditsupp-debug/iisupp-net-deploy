// telemetry-event — the ONE content-blind event shape every surface consumes: the status badge,
// Slack/Teams notify, the weekly digest, the multi-tenant fleet view and the v1 API. Defining it
// once means a fix recorded on Windows or macOS reads identically everywhere downstream.
//
// Hard rules baked in:
//   • Timestamps are ALWAYS ISO-8601 strings, never epoch-ms (a 13-digit epoch trips the
//     payment-card-length rule in assertContentSafePayload — the RUN 3 finding, fixed at the source).
//   • Only symbolic / aggregate fields: recipe id, outcome enum, an opaque endpoint HANDLE
//     (never a machine name), a duration and a tier. No path, URL, user string or command output.
import { assertContentSafePayload } from "./safety.mjs";

export const TELEMETRY_EVENT_VERSION = "telemetry-event-v1";

export const OUTCOMES = ["detected", "applied", "confirmed", "rolled_back", "escalated", "failed", "skipped"];

// A short, stable, NON-reversible handle for an endpoint — derived from a caller-supplied id,
// never a hostname. Same input → same handle, so the fleet view can group without ever learning
// the real machine name. (FNV-1a 32-bit; we only need stable grouping, not crypto.)
export function endpointHandle(seed) {
  const text = String(seed == null ? "" : seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return "ep-" + (h >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}

export function isoTimestamp(value) {
  // Accept a Date, an ISO string, or epoch-ms — always emit ISO-8601. Default: caller passes nowMs.
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && !/^\d+$/.test(value)) return value; // already ISO-ish
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : "";
}

/**
 * Build a telemetry-event-v1 record. Drops/normalizes everything to the content-blind shape.
 * @param {object} input { recipeId, signal, outcome, endpoint, durationMs, tier, ts }
 */
export function buildTelemetryEvent(input = {}) {
  const outcome = OUTCOMES.includes(input.outcome) ? input.outcome : "detected";
  return {
    v: TELEMETRY_EVENT_VERSION,
    recipeId: symbolicToken(input.recipeId),
    signal: symbolicToken(input.signal),
    outcome,
    endpoint: input.endpoint ? endpointHandle(input.endpoint) : null,
    tier: symbolicToken(input.tier) || "green",
    durationMs: Math.max(0, Number(input.durationMs) || 0),
    ts: isoTimestamp(input.ts == null ? Date.now() : input.ts)
  };
}

// Keep only code-shaped tokens (letters, digits, dot, dash, underscore). Anything else → "".
function symbolicToken(value) {
  const raw = String(value == null ? "" : value).trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(raw) ? raw : "";
}

/**
 * Final guard before an event crosses any boundary (webhook, digest, API). Returns true only when
 * the event is content-blind. Mirrors the privacy-verifier guarantee.
 */
export function isTelemetrySafe(event) {
  if (!event || typeof event !== "object") return false;
  if (event.v !== TELEMETRY_EVENT_VERSION) return false;
  if (event.ts && /^\d{10,}$/.test(String(event.ts))) return false; // epoch-ms leaked through
  return assertContentSafePayload(event);
}
