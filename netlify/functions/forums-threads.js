// IIS Forums — discussions store (MVP). Lightweight REAL data layer on Netlify Blobs following
// the aria-session-memory.js pattern. Rule 14: nothing is synthesized — empty list means empty;
// reply/vote counts are computed from stored posts/voters only. Reading needs no auth; writing
// needs the caller's session email (the site's existing soft identity — aria_session_email).
//
// SECURITY (gate review 2026-07-02):
//  - per-IP + global token-bucket rate limiting on every write op (anti-flood).
//  - identity: an aria-magic-link session token (optional) is HMAC-verified; a post is marked
//    `verified` only when the token's email matches the posting email. Until verified sessions are
//    the norm, the UI shows a visible "names are self-reported" disclosure — we never imply the
//    display name is confirmed.
//  - emails are stored as a SALTED HMAC (never raw, never a bare sha256).
//  - text is stored RAW (validated: trimmed + capped); it is escaped exactly ONCE, at render
//    (forums.js md()/esc) — storing pre-escaped text double-encoded code-heavy posts (D3).
//  - ADMIN-env-gated `delete` op for moderation (dead until FORUMS_ADMIN_TOKEN is set).
const crypto = require('crypto');
const { checkRateLimit } = require('./_rate-limit');

const HEADERS = {
  'Access-Control-Allow-Origin': 'https://iisupp.net',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};
const CAPS = { title: 140, body: 6000, tag: 24, tags: 5, name: 40 };
// Email hash salt: prefer a dedicated secret, fall back to the shared JWT secret, then a static
// last resort so hashing is always deterministic within a deploy (needed for vote-dedup + accept).
const HASH_SALT = process.env.FORUMS_HASH_SALT || process.env.APERTURE_JWT_SECRET || 'forums-mvp-static-salt-v1';

let _store = null;
function store() {
  if (_store) return _store;
  try {
    const { getStore } = require('@netlify/blobs');
    _store = getStore({ name: 'forums-threads', consistency: 'strong' });
  } catch {
    const mem = new Map();
    _store = { // dev fallback — in-memory, honest (empty on restart)
      async get(k, _o) { return mem.has(k) ? mem.get(k) : null; },
      async setJSON(k, v) { mem.set(k, v); },
      async delete(k) { mem.delete(k); },
    };
  }
  return _store;
}

// ── pure core (unit-tested; no I/O) ─────────────────────────────────────────────────────────
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));
// Salted HMAC — not a bare hash; the salt keeps the map from being a rainbow-table lookup.
const hashEmail = (e) => crypto.createHmac('sha256', HASH_SALT).update(String(e).toLowerCase().trim()).digest('hex').slice(0, 24);
// RAW validated text: strip CRs, trim, cap. NO HTML escaping here — escaping happens once at
// render (forums.js). Storing escaped text double-encodes code snippets (& < > " → entities).
const clean = (s, cap) => String(s || '').replace(/\r/g, '').trim().slice(0, cap);

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
// Verify an aria-magic-link session token (same HMAC scheme as netlify/functions/aria-magic-link.js).
// Returns the payload ({email, exp}) when valid + unexpired, else null. Pure (env secret only).
function verifySessionToken(token, secret = process.env.APERTURE_JWT_SECRET) {
  if (!token || !secret) return null;
  try {
    const [data, sig] = String(token).split('.');
    if (!data || !sig) return null;
    const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest());
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - data.length % 4) % 4), 'base64').toString('utf-8'));
    const expMs = payload && payload.exp ? (payload.exp < 1e12 ? payload.exp * 1000 : payload.exp) : 0;
    if (expMs && Date.now() > expMs) return null;
    return payload;
  } catch { return null; }
}
// Is this poster's email backed by a verified session token?
function isVerified({ email, sessionToken }) {
  const p = verifySessionToken(sessionToken);
  return !!(p && p.email && String(p.email).toLowerCase() === String(email || '').toLowerCase());
}

function authorFrom(email, verified) {
  const name = clean(String(email).split('@')[0], CAPS.name) || 'member';
  return { id: hashEmail(email), name, verified: !!verified };
}

function validateThreadInput({ title, body, tags, email }) {
  const errors = [];
  if (!emailOk(email)) errors.push('a signed-in session email is required to post');
  const t = clean(title, CAPS.title);
  const b = clean(body, CAPS.body);
  if (t.length < 8) errors.push('title must be at least 8 characters');
  if (b.length < 10) errors.push('body must be at least 10 characters');
  const tg = (Array.isArray(tags) ? tags : []).map((x) => clean(x, CAPS.tag).toLowerCase()).filter(Boolean).slice(0, CAPS.tags);
  return { ok: errors.length === 0, errors, title: t, body: b, tags: tg };
}

function newThread(input, now) {
  const v = validateThreadInput(input);
  if (!v.ok) return { ok: false, errors: v.errors };
  const author = authorFrom(input.email, input.verified);
  const id = `${v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)}-${now.toString(36)}`;
  return {
    ok: true,
    thread: {
      v: 'forums-thread-v1', id, title: v.title, tags: v.tags, ts: now,
      authorId: author.id, acceptedPostId: null, graduated: false,
      posts: [{ id: `p-${now.toString(36)}`, author, body: v.body, ts: now, voters: {}, accepted: false }]
    }
  };
}

function addReply(thread, { body, email, verified }, now) {
  if (!emailOk(email)) return { ok: false, errors: ['sign in to reply'] };
  const b = clean(body, CAPS.body);
  if (b.length < 2) return { ok: false, errors: ['reply is empty'] };
  const post = { id: `p-${now.toString(36)}-${thread.posts.length}`, author: authorFrom(email, verified), body: b, ts: now, voters: {}, accepted: false };
  return { ok: true, thread: { ...thread, posts: [...thread.posts, post] } };
}

// One vote per voter per post, ±1, revotes overwrite — the count is always Σ real voters.
// NOTE (watch-item): read-modify-write vote is MVP-acceptable; a Blobs CAS lands with verified sessions.
function applyVote(thread, { postId, dir, email }) {
  if (!emailOk(email)) return { ok: false, errors: ['sign in to vote'] };
  const d = dir === 'down' ? -1 : 1;
  if (!thread.posts.some((p) => p.id === postId)) return { ok: false, errors: ['post not found'] };
  const posts = thread.posts.map((p) => (p.id === postId ? { ...p, voters: { ...p.voters, [hashEmail(email)]: d } } : p));
  return { ok: true, thread: { ...thread, posts } };
}

// Only the thread author accepts; accepting graduates the thread (two-way Solutions backlink).
function acceptPost(thread, { postId, email }) {
  if (!emailOk(email) || hashEmail(email) !== thread.authorId) return { ok: false, errors: ['only the original poster can accept an answer'] };
  if (!thread.posts.some((p) => p.id === postId)) return { ok: false, errors: ['post not found'] };
  const posts = thread.posts.map((p) => ({ ...p, accepted: p.id === postId }));
  return { ok: true, thread: { ...thread, posts, acceptedPostId: postId, graduated: true } };
}

const voteCount = (p) => Object.values(p.voters || {}).reduce((a, b) => a + b, 0);
function publicThread(t) {
  return {
    id: t.id, title: t.title, tags: t.tags, ts: t.ts, graduated: !!t.graduated, acceptedPostId: t.acceptedPostId,
    // `verified` is per-post; the UI shows a "self-reported" disclosure wherever it is false.
    posts: t.posts.map((p) => ({ id: p.id, author: p.author.name, verified: !!(p.author && p.author.verified), body: p.body, ts: p.ts, votes: voteCount(p), accepted: !!p.accepted, isOP: p.author.id === t.authorId }))
  };
}
function listRow(t) {
  return { id: t.id, title: t.title, tags: t.tags, ts: t.ts, author: t.posts[0] ? t.posts[0].author.name : '', verified: !!(t.posts[0] && t.posts[0].author && t.posts[0].author.verified), replies: Math.max(0, t.posts.length - 1), accepted: !!t.acceptedPostId, graduated: !!t.graduated };
}

// ── handler ─────────────────────────────────────────────────────────────────────────────────
const INDEX_KEY = 'threads-index-v1';
const WRITE_OPS = new Set(['create', 'reply', 'vote', 'accept', 'delete']);
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'bad JSON' }) }; }

  // Rate limit every write: per-IP (anti-abuse) AND a global bucket (anti-flood of the brand page).
  if (WRITE_OPS.has(body.op)) {
    const perIp = checkRateLimit(event, { scope: 'forums-write', limit: 20, windowMs: 10 * 60 * 1000 });
    const global = checkRateLimit(event, { key: 'forums-global', limit: 240, windowMs: 10 * 60 * 1000 });
    if (!perIp.ok || !global.ok) {
      const which = perIp.ok ? global : perIp;
      return { statusCode: 429, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'rate_limited', retry_after_sec: which.retryAfterSec }) };
    }
  }

  const s = store();
  const now = Date.now();
  const index = (await s.get(INDEX_KEY, { type: 'json' })) || { ids: [] };
  const load = async (id) => (id && index.ids.includes(id) ? await s.get(`thread-${id}`, { type: 'json' }) : null);
  const save = async (t) => { await s.setJSON(`thread-${t.id}`, t); if (!index.ids.includes(t.id)) { index.ids.unshift(t.id); await s.setJSON(INDEX_KEY, index); } };
  const reply = (code, obj) => ({ statusCode: code, headers: HEADERS, body: JSON.stringify(obj) });
  const verified = isVerified({ email: body.email, sessionToken: body.sessionToken });

  try {
    switch (body.op) {
      case 'list': {
        const rows = [];
        for (const id of index.ids.slice(0, 50)) { const t = await load(id); if (t) rows.push(listRow(t)); }
        return reply(200, { ok: true, threads: rows });
      }
      case 'thread': {
        const t = await load(String(body.id || ''));
        return t ? reply(200, { ok: true, thread: publicThread(t) }) : reply(404, { ok: false, error: 'thread not found' });
      }
      case 'create': {
        const r = newThread({ ...body, verified }, now);
        if (!r.ok) return reply(400, { ok: false, errors: r.errors });
        await save(r.thread);
        return reply(200, { ok: true, id: r.thread.id, thread: publicThread(r.thread) });
      }
      case 'reply': case 'vote': case 'accept': {
        const t = await load(String(body.id || ''));
        if (!t) return reply(404, { ok: false, error: 'thread not found' });
        const r = body.op === 'reply' ? addReply(t, { ...body, verified }, now) : body.op === 'vote' ? applyVote(t, body) : acceptPost(t, body);
        if (!r.ok) return reply(400, { ok: false, errors: r.errors });
        await save(r.thread);
        return reply(200, { ok: true, thread: publicThread(r.thread) });
      }
      case 'delete': {
        // ADMIN-env-gated moderation. Dead until FORUMS_ADMIN_TOKEN is set on the deploy.
        const admin = process.env.FORUMS_ADMIN_TOKEN || '';
        const tok = String(body.adminToken || '');
        if (!admin || tok.length !== admin.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(admin))) {
          return reply(403, { ok: false, error: 'moderation is admin-only' });
        }
        const id = String(body.id || '');
        if (!index.ids.includes(id)) return reply(404, { ok: false, error: 'thread not found' });
        index.ids = index.ids.filter((x) => x !== id);
        await s.setJSON(INDEX_KEY, index);
        if (s.delete) { try { await s.delete(`thread-${id}`); } catch { /* index already updated */ } }
        return reply(200, { ok: true, deleted: id });
      }
      default:
        return reply(400, { ok: false, error: 'unknown op' });
    }
  } catch (e) {
    return reply(500, { ok: false, error: 'store error — nothing was lost, retry shortly' });
  }
};

// pure core exports for the test battery
exports._core = { validateThreadInput, newThread, addReply, applyVote, acceptPost, publicThread, listRow, authorFrom, voteCount, hashEmail, verifySessionToken, isVerified };
