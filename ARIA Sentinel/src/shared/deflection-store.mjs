// B1 (2026-06-29): Deflection store — real resolution events from "Was this fixed?" feedback.
// Rule 14: deflection % is ONLY ever derived from real user feedback events, never seeded or estimated.
// Stores to a local JSON file in userData; safe to delete (resets to 0 — never inflates).

import fs from "node:fs";
import path from "node:path";

const STORE_FILE = () => path.join(
  process.env.DEFLECTION_STORE_PATH || ".",
  "deflection-events.json"
);

const DEFAULT = () => ({ events: [], version: 1 });

export function readStore(filePath = STORE_FILE()) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.events)) return DEFAULT();
    return parsed;
  } catch { return DEFAULT(); }
}

export function writeStore(store, filePath = STORE_FILE()) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
  } catch { /* best-effort */ }
}

/**
 * Log a real resolution event. outcome: "resolved" | "unresolved".
 * Rule 14: only call on genuine user feedback — never on assumption or timeout.
 */
export function logResolutionEvent(store, { sessionId = "", question = "", outcome, score = null, source = "chat" }) {
  if (outcome !== "resolved" && outcome !== "unresolved") throw new Error("outcome must be resolved|unresolved");
  const event = {
    ts: new Date().toISOString(),
    sessionId: String(sessionId || "").slice(0, 64),
    question: String(question || "").slice(0, 200),
    outcome,
    score: score != null ? Number(score) : null,
    source
  };
  return { ...store, events: [...store.events, event] };
}

/**
 * Compute real deflection stats from stored events.
 * Returns { total, resolved, deflectionPct } — all real counts.
 * deflectionPct is null (empty-state) when total === 0 (Rule 14: never fake 0%).
 */
export function computeDeflectionStats(store) {
  const events = Array.isArray(store.events) ? store.events : [];
  const total = events.length;
  const resolved = events.filter(e => e.outcome === "resolved").length;
  return {
    total,
    resolved,
    unresolved: total - resolved,
    deflectionPct: total > 0 ? Math.round((resolved / total) * 100) : null
  };
}
