// D2 (2026-07-03) — record each "Ask ARIA" interaction into local memory + stats so the Memory tab and the
// Dashboard "Operations at a glance" reflect REAL usage (real-or-empty, Rule 14: still zero until a real ask).
// Pure functions so they're unit-tested; main.mjs owns the fs read/write of ~/.aria-sentinel/sessions and the
// electron-store counters. 🔒 Local-only — none of this ever crosses a network boundary; parseSessions scrubs
// every field again on the way to the UI.

/**
 * Classify an answer for stats:
 *  - "kb"        → a KB hit (live kb-match OR a matched offline local-KB answer)  ← the $0 path
 *  - "anthropic" → an aria-chat (Anthropic) reply, no KB match
 *  - "miss"      → an abstain / no local match (KB had nothing relevant — D1)
 */
export function classifyAnswer({ provider, action, matched } = {}) {
  if (action === "kb-match" || (provider === "local-kb" && matched)) return "kb";
  if (provider === "aria-brain") return "anthropic"; // aria-chat reply (no kb match)
  return "miss";                                     // local-kb abstain / no relevant match
}

/** Fold one ask into a session object (turns[], kb_hits, anthropic_hits, asks). Never mutates the input. */
export function recordAsk(session, { message, reply, kind, at = null } = {}) {
  const s = session && typeof session === "object" ? { ...session } : {};
  s.turns = Array.isArray(s.turns) ? s.turns.slice() : [];
  s.turns.push({ role: "user", text: String(message || "").slice(0, 800) });
  s.turns.push({ role: "assistant", text: String(reply || "").slice(0, 800) });
  s.kb_hits = (Number(s.kb_hits) || 0) + (kind === "kb" ? 1 : 0);
  s.anthropic_hits = (Number(s.anthropic_hits) || 0) + (kind === "anthropic" ? 1 : 0);
  s.asks = (Number(s.asks) || 0) + 1;
  if (!s.started_at) s.started_at = at;
  s.updated_at = at;
  return s;
}

/** Fold one ask into the global counters the Dashboard/Performance read. Never mutates the input. */
export function foldStats(stats, kind) {
  const st = stats && typeof stats === "object" ? { ...stats } : {};
  st.asks = (Number(st.asks) || 0) + 1;
  st.kbHits = (Number(st.kbHits) || 0) + (kind === "kb" ? 1 : 0);
  st.anthropicHits = (Number(st.anthropicHits) || 0) + (kind === "anthropic" ? 1 : 0);
  st.misses = (Number(st.misses) || 0) + (kind === "miss" ? 1 : 0);
  return st;
}

/** KB hit rate as an integer percent, or null when there are no asks (real-or-empty, Rule 14). */
export function kbHitRate(stats) {
  const asks = Number(stats && stats.asks) || 0;
  if (!asks) return null;
  return Math.round(((Number(stats.kbHits) || 0) / asks) * 100);
}
