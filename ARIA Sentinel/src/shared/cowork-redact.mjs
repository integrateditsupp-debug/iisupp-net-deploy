// RUN 23 §8 — pure R11/PII redaction for the Cowork bridge (read-state / read-audit). Kept out of the
// Netlify function so the redaction is unit-testable without @netlify/blobs. 🔒 R11 — any audit entry or
// state field referencing the off-limits folder is dropped/redacted before it ever leaves the device store.
import { isBlockedPath, redactPrivate } from "./path-guard.mjs";

const numOrNull = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/** Last `limit` audit entries, R11-filtered + text redacted. Blocked entries are removed entirely. */
export function redactAuditSlice(entries = [], limit = 100) {
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => !isBlockedPath(safeStringify(e)))
    .slice(-Math.max(0, limit))
    .map((e) => ({
      ts: (e && e.ts) || "",
      tag: (e && e.tag) || "",
      text: redactPrivate(String((e && e.text) || "")),
      recipeId: redactPrivate(String((e && e.recipeId) || "")) || undefined
    }));
}

/** Content-blind operational slice of a tenant's Sentinel state (CPU/RAM/services/recipes/mode). */
export function redactState(state = {}) {
  const s = state || {};
  const services = Array.isArray(s.services)
    ? s.services.filter((x) => !isBlockedPath(String(x))).map((x) => redactPrivate(String(x))) // drop first, then redact
    : [];
  return {
    cpu: numOrNull(s.cpu),
    ram: numOrNull(s.ram),
    services,
    recipes: numOrNull(s.recipes),
    mode: String(s.mode || "")
  };
}

function safeStringify(o) {
  try { return JSON.stringify(o); } catch { return String(o); }
}
