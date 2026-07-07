// Browser outcome ledger: content-blind records from the companion extension.
// Stores only symbolic issue data, never URL, title, page text, credentials, or user content.
import { assertContentSafePayload } from "./safety.mjs";
import { endpointHandle, isoTimestamp } from "./telemetry-event.mjs";

export const BROWSER_OUTCOMES = ["resolved", "failed", "walkthrough", "live_help", "dismissed"];
export const BROWSER_FLEET_PACKET_VERSION = "browser-outcome-fleet-v1";
const ORIGIN_CATEGORIES = ["unknown", "localhost", "internal", "sso", "saas", "public"];

function cleanId(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9._:-]+/g, "")
    .slice(0, 120);
}

function cleanCode(value, fallback = "UNKNOWN.SIGNAL") {
  const out = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80);
  return out || fallback;
}

function cleanAction(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function cleanOutcome(value) {
  const out = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_");
  return BROWSER_OUTCOMES.includes(out) ? out : "failed";
}

function cleanCategory(value) {
  const out = String(value || "unknown").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return ORIGIN_CATEGORIES.includes(out) ? out : "unknown";
}

function cleanSeverity(value) {
  const out = String(value || "notice").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 40);
  return out || "notice";
}

function outcomeKey(record) {
  return [record.issueId, record.outcome, record.action].join(":");
}

function coerceTimestamp(value, fallback) {
  if (Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeForExport(input = {}, opts = {}) {
  const now = opts.now == null ? Date.now() : opts.now;
  const normalized = normalizeBrowserOutcome(input, { now });
  if (!normalized.ok) return normalized;
  return {
    ...normalized,
    record: {
      ...normalized.record,
      ts: coerceTimestamp(input.ts, now)
    }
  };
}

function emptyOutcomeCounts() {
  return Object.fromEntries(BROWSER_OUTCOMES.map((outcome) => [outcome, 0]));
}

function incrementBucket(map, key, outcome) {
  const bucketKey = key || "unknown";
  if (!map.has(bucketKey)) map.set(bucketKey, { total: 0, ...emptyOutcomeCounts() });
  const bucket = map.get(bucketKey);
  bucket.total += 1;
  bucket[outcome] = (bucket[outcome] || 0) + 1;
}

function bucketList(map, keyName) {
  return [...map.entries()]
    .map(([key, counts]) => ({ [keyName]: key, ...counts }))
    .sort((a, b) => b.total - a.total || String(a[keyName]).localeCompare(String(b[keyName])))
    .slice(0, 25);
}

export function normalizeBrowserOutcome(input = {}, { now = Date.now() } = {}) {
  const issueId = cleanId(input.issueId || input.id);
  const errors = [];
  if (!issueId) errors.push("issueId-required");
  const record = {
    id: cleanId(input.id) || `browser:${issueId}:${cleanOutcome(input.outcome)}`,
    issueId,
    source: "browser-extension",
    signal: cleanCode(input.signal),
    action: cleanAction(input.action),
    outcome: cleanOutcome(input.outcome),
    originCategory: cleanCategory(input.originCategory),
    severity: cleanSeverity(input.severity),
    ts: Number.isFinite(input.ts) ? input.ts : now
  };
  return errors.length ? { ok: false, errors, record: null } : { ok: true, errors: [], record };
}

export function appendBrowserOutcome(events = [], input = {}, opts = {}) {
  const normalized = normalizeBrowserOutcome(input, opts);
  if (!normalized.ok) return { ok: false, errors: normalized.errors, events: Array.isArray(events) ? events : [] };
  const list = Array.isArray(events) ? events : [];
  const key = outcomeKey(normalized.record);
  const existing = list.find((item) => outcomeKey(item) === key);
  if (existing) return { ok: true, deduped: true, record: existing, events: list };
  return {
    ok: true,
    deduped: false,
    record: normalized.record,
    events: [normalized.record, ...list].slice(0, 500)
  };
}

export function browserOutcomeToResolutionPayload(record = {}) {
  if (!record.issueId) return null;
  if (record.outcome === "resolved") {
    return { id: `browser:${record.issueId}`, outcome: "resolved", confidence: { level: "browser-extension" } };
  }
  if (record.outcome === "failed") {
    return { id: `browser:${record.issueId}:failed`, outcome: "not_resolved", confidence: { level: "browser-extension" } };
  }
  if (record.outcome === "live_help") {
    return { id: `browser:${record.issueId}:live-help`, outcome: "escalated", confidence: { level: "browser-extension" } };
  }
  return null;
}

export function browserOutcomeStats(events = [], opts = {}) {
  const now = opts.now == null ? Date.now() : opts.now;
  const bySignal = new Map();
  const byOriginCategory = new Map();
  const counts = { total: 0, ...emptyOutcomeCounts() };
  const normalizedEvents = [];

  for (const event of Array.isArray(events) ? events : []) {
    const normalized = normalizeForExport(event, { now });
    if (!normalized.ok) continue;
    const record = normalized.record;
    counts.total += 1;
    counts[record.outcome] = (counts[record.outcome] || 0) + 1;
    incrementBucket(bySignal, record.signal, record.outcome);
    incrementBucket(byOriginCategory, record.originCategory, record.outcome);
    normalizedEvents.push({
      issueHandle: endpointHandle(record.issueId),
      signal: record.signal,
      action: record.action,
      outcome: record.outcome,
      originCategory: record.originCategory,
      severity: record.severity,
      ts: record.ts
    });
  }

  return {
    counts,
    bySignal: bucketList(bySignal, "signal"),
    byOriginCategory: bucketList(byOriginCategory, "originCategory"),
    events: normalizedEvents
  };
}

export function buildBrowserOutcomeFleetPacket(events = [], opts = {}) {
  const now = opts.now == null ? Date.now() : opts.now;
  const maxRecent = Math.max(0, Math.min(50, Number(opts.maxRecent ?? 50) || 0));
  const stats = browserOutcomeStats(events, { now });
  const sorted = [...stats.events].sort((a, b) => b.ts - a.ts);
  const timestamps = sorted.map((event) => event.ts).filter((ts) => Number.isFinite(ts) && ts > 0);
  const endpoint = opts.endpointSeed ? endpointHandle(opts.endpointSeed) : null;

  const packet = {
    v: BROWSER_FLEET_PACKET_VERSION,
    source: "browser-extension",
    endpoint,
    generatedAt: isoTimestamp(now),
    window: {
      from: timestamps.length ? isoTimestamp(Math.min(...timestamps)) : "",
      to: timestamps.length ? isoTimestamp(Math.max(...timestamps)) : ""
    },
    counts: stats.counts,
    bySignal: stats.bySignal,
    byOriginCategory: stats.byOriginCategory,
    recent: sorted.slice(0, maxRecent).map((record) => ({
      issueHandle: record.issueHandle,
      signal: record.signal,
      action: record.action,
      outcome: record.outcome,
      originCategory: record.originCategory,
      severity: record.severity,
      ts: isoTimestamp(record.ts)
    }))
  };

  return packet;
}

export function isBrowserFleetPacketSafe(packet) {
  if (!packet || typeof packet !== "object") return false;
  if (packet.v !== BROWSER_FLEET_PACKET_VERSION) return false;
  if (packet.generatedAt && /^\d{10,}$/.test(String(packet.generatedAt))) return false;
  if (packet.window?.from && /^\d{10,}$/.test(String(packet.window.from))) return false;
  if (packet.window?.to && /^\d{10,}$/.test(String(packet.window.to))) return false;
  if (!Array.isArray(packet.recent)) return false;
  if (packet.recent.some((item) => !item.ts || /^\d{10,}$/.test(String(item.ts)))) return false;
  return assertContentSafePayload(packet);
}
