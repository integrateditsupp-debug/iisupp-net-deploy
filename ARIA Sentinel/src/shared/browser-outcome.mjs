// Browser outcome ledger: content-blind records from the companion extension.
// Stores only symbolic issue data, never URL, title, page text, credentials, or user content.
//
// REVIEW P2-7 (2026-10-14) — CONTENT-BLIND BY VOCABULARY, NOT BY CHARACTER CLASS. The old cleaners kept every
// [A-Za-z0-9._-] character, so a bank page's address with a user name in its query string became the "signal"
// HTTPS.MYBANK.EXAMPLE.COM.ACCT.USER.JANE.DOE and a document path became the "action"
// c-users-jane.doe-documents-payroll.xlsx — and isBrowserFleetPacketSafe passed both. Now:
//   · signal / action / severity come from FIXED vocabularies (anything else → UNKNOWN.SIGNAL / "other" / "notice");
//   · an id is kept only when it is a bare `[a-z0-9-]{1,32}` token; anything else (dots, slashes, a domain, an e-mail, a
//     path, a long number) is replaced by sha256(id).slice(0,16) — a stable handle, never the text;
//   · isBrowserFleetPacketSafe checks every field against those vocabularies, so a packet carrying free text is refused.
// 🔒 Main-process / Node only (node:crypto) — the renderer never imports this module.
import { createHash } from "node:crypto";
import { assertContentSafePayload } from "./safety.mjs";
import { endpointHandle, isoTimestamp } from "./telemetry-event.mjs";

export const BROWSER_OUTCOMES = ["resolved", "failed", "walkthrough", "live_help", "dismissed"];
export const BROWSER_FLEET_PACKET_VERSION = "browser-outcome-fleet-v1";
const ORIGIN_CATEGORIES = ["unknown", "localhost", "internal", "sso", "saas", "public"];

/**
 * The signal codes a browser outcome may carry: every browser-family signal in the recipe registry
 * (tests/browser-outcome.test.mjs keeps this list in step with src/shared/recipes.mjs), the extension's own content-script
 * codes, and the two security verdicts. Anything else is UNKNOWN.SIGNAL.
 */
export const BROWSER_SIGNAL_VOCABULARY = Object.freeze([
  "UNKNOWN.SIGNAL",
  "BROWSER.CACHE.STALE", "BROWSER.ZOOM.WRONG", "BROWSER.SERVICE_WORKER.STUCK",
  "BROWSER.TAB_CRASH_LOOP", "BROWSER.DOWNLOAD.BLOCKED", "BROWSER.DOWNLOAD.STUCK", "BROWSER.CERT.EXPIRED",
  "BROWSER.MIXED_CONTENT", "BROWSER.EXT.CONFLICT", "BROWSER.SLOW_LOAD", "BROWSER.AUTOFILL.WRONG", "BROWSER.ADBLOCK.BREAK",
  "BROWSER.COOKIES.BLOCKED", "BROWSER.POPUP.BLOCKED", "BROWSER.TRANSLATE_BROKEN", "BROWSER.PASSWORD_NOT_SAVING",
  "BROWSER.SECURITY.SUSPICIOUS", "BROWSER.SECURITY.MALICIOUS",
  "CACHE.STALE", "SERVICE.WORKER.STUCK", "ZOOM.WEIRD", "PASSWORD.RETRY.2", "APP.CHROME.PROFILE_LOCKED", "APP.EDGE.SYNC_BROKEN"
]);
/** The actions a browser outcome may name: the browser recipes' action ids + the extension's outcome actions. */
export const BROWSER_ACTION_VOCABULARY = Object.freeze([
  "unknown", "other",
  "clear-origin-cache", "hard-reload", "clear-and-reload", "manual-login-check", "unregister-service-workers", "reset-zoom",
  "recover-tab", "download-guidance", "download-stuck-guide", "check-time", "mixed-content-guidance", "extension-binary-search",
  "slow-load-guidance", "autofill-guide", "adblock-guide", "cookies-guide", "popup-guide", "open-guidance",
  "live-help", "walkthrough", "dismiss", "warn-and-escalate"
]);
export const BROWSER_SEVERITIES = Object.freeze(["notice", "info", "warning", "danger", "critical"]);
const ID_TOKEN_RE = /^[a-z0-9-]{1,32}$/;
const HASHED_ID_RE = /^[0-9a-f]{16}$/;

/** A bare `[a-z0-9-]{1,32}` token stays; anything else becomes sha256(id).slice(0,16) — a handle, never the text. "" stays "". */
export function browserIdHandle(value) {
  const raw = String(value == null ? "" : value);
  if (!raw) return "";
  if (ID_TOKEN_RE.test(raw)) return raw;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function cleanId(value) {
  return browserIdHandle(value);
}

function cleanCode(value, fallback = "UNKNOWN.SIGNAL") {
  const out = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80);
  return BROWSER_SIGNAL_VOCABULARY.includes(out) ? out : fallback;
}

function cleanAction(value) {
  const out = String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
  return BROWSER_ACTION_VOCABULARY.includes(out) ? out : "other";
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
  return BROWSER_SEVERITIES.includes(out) ? out : "notice";
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
    // (review P2-7) the record id is our own construction from cleaned parts; a caller-supplied id is a handle too.
    id: input.id ? `browser:${cleanId(input.id)}` : `browser:${issueId}:${cleanOutcome(input.outcome)}`,
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

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const HANDLE_RE = /^ep-[0-9a-z]{7}$/;
/**
 * The fleet packet's boundary check. REVIEW P2-7 — every field is checked against its vocabulary (signal, action,
 * outcome, origin category, severity), every handle against its shape, every time against ISO — so a packet that carries
 * free text in ANY field (a URL folded into a "signal", a path folded into an "action") is refused, not just one that
 * still looks like a URL to the regexes.
 */
export function isBrowserFleetPacketSafe(packet) {
  if (!packet || typeof packet !== "object") return false;
  if (packet.v !== BROWSER_FLEET_PACKET_VERSION) return false;
  if (packet.source !== undefined && packet.source !== "browser-extension") return false;
  if (packet.endpoint != null && !HANDLE_RE.test(String(packet.endpoint))) return false;
  if (packet.generatedAt && !ISO_RE.test(String(packet.generatedAt))) return false;
  if (packet.window?.from && !ISO_RE.test(String(packet.window.from))) return false;
  if (packet.window?.to && !ISO_RE.test(String(packet.window.to))) return false;
  if (!Array.isArray(packet.recent)) return false;
  const itemOk = (item) => item && typeof item === "object"
    && HANDLE_RE.test(String(item.issueHandle || ""))
    && BROWSER_SIGNAL_VOCABULARY.includes(item.signal)
    && BROWSER_ACTION_VOCABULARY.includes(item.action)
    && BROWSER_OUTCOMES.includes(item.outcome)
    && ORIGIN_CATEGORIES.includes(item.originCategory)
    && BROWSER_SEVERITIES.includes(item.severity)
    && ISO_RE.test(String(item.ts || ""));
  if (!packet.recent.every(itemOk)) return false;
  for (const b of Array.isArray(packet.bySignal) ? packet.bySignal : []) if (!b || !BROWSER_SIGNAL_VOCABULARY.includes(b.signal)) return false;
  for (const b of Array.isArray(packet.byOriginCategory) ? packet.byOriginCategory : []) if (!b || !ORIGIN_CATEGORIES.includes(b.originCategory)) return false;
  return assertContentSafePayload(packet);
}
