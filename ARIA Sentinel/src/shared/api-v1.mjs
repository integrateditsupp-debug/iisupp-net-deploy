// api-v1 — pure auth + rate-limit + response shaping for the read-only v1 API (/aria-api/v1/events,
// /aria-api/v1/webhooks). Bearer token = the license key. Payloads are telemetry-event-v1 only.
import { verifyLicense } from "./license.mjs";
import { buildTelemetryEvent, isTelemetrySafe } from "./telemetry-event.mjs";

export const RATE_LIMIT = 60;          // requests
export const RATE_WINDOW_MS = 60_000;  // per minute

// Extract a bearer token from an Authorization header.
export function bearerToken(headers = {}) {
  const auth = headers.authorization || headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(auth));
  return m ? m[1].trim() : "";
}

/**
 * Authorize a request. The token must equal a known license key AND that license must be valid.
 * @returns {{ok:boolean, status:number, reason:string}} — 401 missing/invalid, 403 expired, 200 ok
 */
export function authorize(headers, license, opts = {}) {
  const token = bearerToken(headers);
  if (!token) return { ok: false, status: 401, reason: "missing-bearer" };
  if (!license || token !== license.key) return { ok: false, status: 401, reason: "bad-token" };
  const v = verifyLicense({ ...license, secret: opts.secret, now: opts.now });
  if (!v.valid) return { ok: false, status: 403, reason: v.reason };
  return { ok: true, status: 200, reason: "ok" };
}

// Sliding-window rate limit. `state` is a mutable { hits: number[] } per token; returns 429 when over.
export function checkRateLimit(state, now = Date.now()) {
  const s = state || { hits: [] };
  s.hits = (s.hits || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (s.hits.length >= RATE_LIMIT) return { ok: false, status: 429, reason: "rate-limited", state: s };
  s.hits.push(now);
  return { ok: true, status: 200, reason: "ok", state: s };
}

/** Shape an /events response — only content-blind telemetry-event-v1 records ever go out. */
export function buildEventsResponse(rawEvents = []) {
  const events = (Array.isArray(rawEvents) ? rawEvents : [])
    .map(buildTelemetryEvent)
    .filter(isTelemetrySafe);
  return { v: "telemetry-event-v1", count: events.length, events };
}
