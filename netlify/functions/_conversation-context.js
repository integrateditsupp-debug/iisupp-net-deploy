/**
 * _conversation-context — Multi-turn context manager for ARIA chat
 *
 *  Maintains a rolling window of last N turns per session, with summarization
 *  fallback if conversation exceeds token budget.
 *
 *  Usage in aria-chat.js:
 *    const ctx = require('./_conversation-context');
 *    const messages = ctx.buildMessages(sessionId, currentUserText, kbHits);
 *
 *  Cat 3 — AI / chat behavior.
 */
'use strict';

const MAX_TURNS = 12;            // last N turns kept verbatim
const MAX_CHARS_PER_TURN = 800;
const SUMMARIZE_THRESHOLD = 16;  // when total turns exceed this, summarize the older ones

// In-memory cache per function instance. For cross-instance, wrap with Netlify Blobs.
const _sessions = {};

function getSession(id) {
  if (!_sessions[id]) {
    _sessions[id] = { turns: [], summary: '', updated_at: Date.now() };
  }
  return _sessions[id];
}

function addTurn(sessionId, role, content) {
  const s = getSession(sessionId);
  s.turns.push({
    role,
    content: String(content || '').slice(0, MAX_CHARS_PER_TURN),
    ts: Date.now()
  });
  s.updated_at = Date.now();
  // Trim or summarize
  if (s.turns.length > SUMMARIZE_THRESHOLD) {
    const toSummarize = s.turns.splice(0, s.turns.length - MAX_TURNS);
    s.summary = condense(s.summary, toSummarize);
  } else if (s.turns.length > MAX_TURNS) {
    s.turns = s.turns.slice(-MAX_TURNS);
  }
}

function condense(priorSummary, turns) {
  // Simple deterministic condense — pull first sentence of each user turn
  const userTurns = turns.filter(t => t.role === 'user');
  const points = userTurns.map(t => {
    const m = t.content.match(/^(.{20,120}?[.?!])/);
    return m ? m[1] : t.content.slice(0, 80);
  });
  const new_summary = (priorSummary ? priorSummary + '\n' : '') +
    'User previously discussed: ' + points.slice(-6).join(' / ');
  return new_summary.slice(-1500);
}

function buildMessages(sessionId, currentUserText, kbHits) {
  const s = getSession(sessionId);
  const messages = [];
  if (s.summary) {
    messages.push({
      role: 'system',
      content: 'Prior conversation summary (older turns trimmed): ' + s.summary
    });
  }
  for (const t of s.turns) {
    messages.push({ role: t.role, content: t.content });
  }
  // Current user message gets added by caller (so we can include kb hits inline)
  return messages;
}

function clearSession(sessionId) {
  delete _sessions[sessionId];
}

function getActiveSessionCount() {
  // Prune sessions inactive > 1h
  const cutoff = Date.now() - 3600 * 1000;
  for (const k of Object.keys(_sessions)) {
    if (_sessions[k].updated_at < cutoff) delete _sessions[k];
  }
  return Object.keys(_sessions).length;
}

module.exports = { addTurn, buildMessages, clearSession, getActiveSessionCount, getSession };
