// proof-metrics — a content-blind store of REAL measured ARIA outcomes. One record per handled query /
// fix, persisted to ~/.aria-sentinel/proof-metrics.json. 🔒 HARD RULE 14: nothing here is ever fabricated —
// a record is written only when the app actually handles something, and aggregation shows the measured
// truth (zero stays zero). 🔒 R11 / content-blind: a record holds ONLY booleans, a ms duration, a symbolic
// source, and a timestamp — never the question, the answer, a path, or any PII. The math reuses metrics.mjs
// so the Metrics view, the tests, and metrics.json all show the same numbers.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { autoVsEscalated, kbHitRate, mean, pct } from "./metrics.mjs";

export const PROOF_SCHEMA = 1;
export const PROOF_SOURCES = ["chat", "local-kb", "fix", "self-test", "slack", "teams"];
const MAX_EVENTS = 5000; // bounded local store

export function metricsPath() {
  return path.join(os.homedir(), ".aria-sentinel", "proof-metrics.json");
}
export function publicMetricsPath() {
  return path.join(os.homedir(), ".aria-sentinel", "metrics.json");
}

export function emptyStore() {
  return { schema: PROOF_SCHEMA, events: [], updatedAt: null };
}

/** Coerce any input to the strict content-blind record shape. Extra keys are dropped on the floor. */
export function sanitizeEvent(input = {}, now = Date.now()) {
  return {
    ts: Number.isFinite(input.ts) ? input.ts : now,
    source: PROOF_SOURCES.includes(input.source) ? input.source : "chat",
    resolved: Boolean(input.resolved),
    escalated: Boolean(input.escalated),
    matchedKb: Boolean(input.matchedKb),
    resolveMs: Math.max(0, Math.round(Number(input.resolveMs) || 0))
  };
}

export function loadStore(file = metricsPath()) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.events)) return emptyStore();
    return { schema: PROOF_SCHEMA, events: raw.events.map((e) => sanitizeEvent(e)), updatedAt: raw.updatedAt || null };
  } catch {
    return emptyStore(); // missing/corrupt → empty (honest zero), never throws
  }
}

export function writeStore(store, file = metricsPath()) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const out = { schema: PROOF_SCHEMA, events: (store.events || []).slice(-MAX_EVENTS), updatedAt: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
    return true;
  } catch {
    return false;
  }
}

/** Append ONE measured record and persist. Returns the stored record. Never throws. */
export function recordEvent(input, { file = metricsPath(), now = Date.now() } = {}) {
  const store = loadStore(file);
  const ev = sanitizeEvent({ ...input, ts: now }, now);
  store.events.push(ev);
  writeStore(store, file);
  return ev;
}

/**
 * Aggregate the measured records into the proof numbers:
 *   queriesHandled, autoResolved, escalated, deflectionPct (auto / total),
 *   avgResolutionMs/Sec (mean over resolved records with a measured duration), kbHitRatePct.
 * Pure — accepts a store or a bare events array. Zero in → honest zeros out.
 */
export function aggregate(eventsOrStore = []) {
  const events = Array.isArray(eventsOrStore) ? eventsOrStore : (eventsOrStore.events || []);
  const total = events.length;
  const split = autoVsEscalated(events);              // {auto, escalated, autoPct}
  const resolvedMs = events.filter((e) => e.resolved).map((e) => e.resolveMs).filter((n) => n > 0);
  const avgResolutionMs = Math.round(mean(resolvedMs));
  return {
    queriesHandled: total,
    autoResolved: split.auto,
    escalated: split.escalated,
    deflectionPct: pct(split.auto, total),
    avgResolutionMs,
    avgResolutionSec: Math.round(avgResolutionMs / 100) / 10,
    kbHitRatePct: kbHitRate(events),
    sampleSize: total,
    generatedAt: new Date().toISOString()
  };
}

/** Website-readable artifact (aggregates only — content-blind, safe to surface later). */
export function toPublicJson(eventsOrStore = []) {
  return {
    schema: PROOF_SCHEMA,
    measured: true,
    note: "Real measured ARIA outcomes — zero is shown honestly; no values are fabricated.",
    ...aggregate(eventsOrStore)
  };
}

/** Read the store and (re)write the public metrics.json. Returns the JSON it wrote. Never throws. */
export function emitPublicJson({ file = metricsPath(), out = publicMetricsPath() } = {}) {
  const json = toPublicJson(loadStore(file));
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(json, null, 2));
  } catch { /* emission is best-effort; the store remains the source of truth */ }
  return json;
}
