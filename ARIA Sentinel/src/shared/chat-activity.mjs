// chat-activity — JULY PORT 2026-10-14 (a7f9e111 "Phase F D2 lane closure", cc/security-lockdown-2026-07-01). Real chat
// use must SHOW UP in ARIA → Memory and the Dashboard ops metrics (they read ~/.aria-sentinel/sessions/*.json via
// parseSessions). This module is the PURE recorder: given the current session object (or null) and one ask/reply
// exchange, it returns the updated session to persist. main.mjs owns the fs read/write. Everything stays local — no
// send, no telemetry, no new outbound.
//
// On the production line main already records every ask through chat-stats.recordAsk (one session per app run); this
// module adds what July had on top of that, as helpers main calls at that single choke point: the on-disk scrub of
// every stored turn (defense in depth — parseSessions scrubs again on render) and the growth cap. appendChatActivity
// (July's day-session recorder) is kept whole for callers that want July's shape.
//
// Honesty (Rule 14): kb_hits increments ONLY on a real KB-tier hit; anthropic_hits ONLY when the aria-chat tier
// actually produced the reply. An offline no-match counts as neither — asked, not answered.
// 🔒 The excluded-folder guard is the EXISTING path-guard.mjs redactPrivate (never re-implemented); drive / home
// paths are then reduced to "[path]".
import { redactPrivate } from "./path-guard.mjs";

export const MAX_SESSION_TURNS = 200;
export const MAX_TURN_TEXT = 800;

/** Scrub one stored chat text: excluded folders through the guard, then any drive / home path → "[path]". */
export function scrubChatText(text) {
  return redactPrivate(String(text == null ? "" : text))
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")
    .replace(/\\\\[^\s"'()]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt)\/[^\s"'()]+/gi, "[path]");
}

/** Keep only the newest MAX_SESSION_TURNS turns of a session (never mutates the input). */
export function capSessionTurns(session, max = MAX_SESSION_TURNS) {
  const s = session && typeof session === "object" && !Array.isArray(session) ? { ...session } : {};
  const turns = Array.isArray(s.turns) ? s.turns : [];
  s.turns = turns.length > max ? turns.slice(-max) : turns.slice();
  return s;
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
  base.turns.push({ role: "user", text: scrubChatText(message).slice(0, MAX_TURN_TEXT), ts: iso });
  base.turns.push({ role: "assistant", text: scrubChatText(reply).slice(0, MAX_TURN_TEXT), ts: iso, provider: String(provider || "").slice(0, 40) });
  if (base.turns.length > MAX_SESSION_TURNS) base.turns = base.turns.slice(-MAX_SESSION_TURNS);
  base.kb_hits = (Number(base.kb_hits) || 0) + (kbHit ? 1 : 0);
  base.anthropic_hits = (Number(base.anthropic_hits) || 0) + (anthropicHit ? 1 : 0);
  base.updated_at = iso;
  return base;
}
