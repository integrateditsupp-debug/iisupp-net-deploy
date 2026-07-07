// chat-activity — Phase F (D2 lane closure). Real chat use must SHOW UP in ARIA → Memory and the
// Dashboard ops metrics (they read ~/.aria-sentinel/sessions/*.json via parseSessions), instead of
// "0 sessions · 0 asks" after real questions. This module is the PURE recorder: given the current
// day-session object (or null) and one ask/reply exchange, it returns the updated session to persist.
// main.mjs owns the fs read/write. Everything stays local — no send, no telemetry, no new outbound.
//
// Honesty (Rule 14): kb_hits increments ONLY on a real KB-tier hit (kb_match from the brain, or a
// matched local-KB answer); anthropic_hits ONLY when the aria-chat tier (the locked chain's Anthropic
// tier) actually produced the reply. An offline no-match counts as neither — asked, not answered.
// 🔒 R11 — stored text is path-scrubbed here as defense-in-depth (parseSessions scrubs again on render).

export const MAX_SESSION_TURNS = 200;
export const MAX_TURN_TEXT = 800;

function scrubPath(text) {
  return String(text == null ? "" : text)
    .replace(/([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi, "<private-folder>")
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt)\/[^\s"'()]+/gi, "[path]");
}

/** One session file per local day: sentinel-YYYY-MM-DD.json. */
export function sessionFileName(nowMs = Date.now()) {
  return `sentinel-${new Date(nowMs).toISOString().slice(0, 10)}.json`;
}

/**
 * Append one ask/reply exchange to a session object (a fresh one is minted when `session` is null
 * or malformed). Returns the updated session — the caller persists it.
 * @param {object|null} session  the parsed existing day-session JSON, or null
 * @param {object} exchange { message, reply, provider, kbHit, anthropicHit, now }
 */
export function appendChatActivity(session, { message = "", reply = "", provider = "", kbHit = false, anthropicHit = false, now = Date.now() } = {}) {
  const iso = new Date(now).toISOString();
  const s = session && typeof session === "object" && !Array.isArray(session) ? session : null;
  const base = s || { id: sessionFileName(now).replace(/\.json$/, ""), started_at: iso, turns: [], kb_hits: 0, anthropic_hits: 0 };
  base.turns = Array.isArray(base.turns) ? base.turns : [];
  base.turns.push({ role: "user", text: scrubPath(message).slice(0, MAX_TURN_TEXT), ts: iso });
  base.turns.push({ role: "assistant", text: scrubPath(reply).slice(0, MAX_TURN_TEXT), ts: iso, provider: String(provider || "").slice(0, 40) });
  if (base.turns.length > MAX_SESSION_TURNS) base.turns = base.turns.slice(-MAX_SESSION_TURNS);
  base.kb_hits = (Number(base.kb_hits) || 0) + (kbHit ? 1 : 0);
  base.anthropic_hits = (Number(base.anthropic_hits) || 0) + (anthropicHit ? 1 : 0);
  base.updated_at = iso;
  return base;
}
