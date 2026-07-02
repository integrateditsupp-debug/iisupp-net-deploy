// IIS Forums — discussions store (MVP). Lightweight REAL data layer on Netlify Blobs following
// the aria-session-memory.js pattern. Rule 14: nothing is synthesized — empty list means empty;
// reply/vote counts are computed from stored posts/voters only. Reading needs no auth; writing
// needs the caller's session email (the site's existing soft identity — aria_session_email set
// via the IIS SSO / magic-link flow). Emails are stored HASHED; the display name is the
// caller-provided local-part, capped + escaped. No HTML is stored (plain text + fenced code).
const crypto = require('crypto');

const HEADERS = {
  'Access-Control-Allow-Origin': 'https://iisupp.net',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};
const CAPS = { title: 140, body: 6000, tag: 24, tags: 5, name: 40 };

let _store = null;
function store() {
  if (_store) return _store;
  try {
    const { getStore } = require('@netlify/blobs');
    _store = getStore({ name: 'forums-threads', consistency: 'strong' });
  } catch {
    const mem = new Map();
    _store = { // dev fallback — in-memory, honest (empty on restart)
      async get(k) { return mem.has(k) ? mem.get(k) : null; },
      async setJSON(k, v) { mem.set(k, v); },
    };
    _store.get = async (k, _o) => (mem.has(k) ? mem.get(k) : null);
  }
  return _store;
}

// ── pure core (unit-tested; no I/O) ─────────────────────────────────────────────────────────
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));
const hashEmail = (e) => crypto.createHash('sha256').update(String(e).toLowerCase().trim()).digest('hex').slice(0, 24);
const esc = (s) => String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const clean = (s, cap) => esc(String(s || '').replace(/\r/g, '').trim()).slice(0, cap);

function authorFrom(email) {
  const name = clean(String(email).split('@')[0], CAPS.name) || 'member';
  return { id: hashEmail(email), name };
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
  const author = authorFrom(input.email);
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

function addReply(thread, { body, email }, now) {
  if (!emailOk(email)) return { ok: false, errors: ['sign in to reply'] };
  const b = clean(body, CAPS.body);
  if (b.length < 2) return { ok: false, errors: ['reply is empty'] };
  const post = { id: `p-${now.toString(36)}-${thread.posts.length}`, author: authorFrom(email), body: b, ts: now, voters: {}, accepted: false };
  return { ok: true, thread: { ...thread, posts: [...thread.posts, post] } };
}

// One vote per voter per post, ±1, revotes overwrite — the count is always Σ real voters.
function applyVote(thread, { postId, dir, email }) {
  if (!emailOk(email)) return { ok: false, errors: ['sign in to vote'] };
  const d = dir === 'down' ? -1 : 1;
  const posts = thread.posts.map((p) => (p.id === postId ? { ...p, voters: { ...p.voters, [hashEmail(email)]: d } } : p));
  if (!thread.posts.some((p) => p.id === postId)) return { ok: false, errors: ['post not found'] };
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
    posts: t.posts.map((p) => ({ id: p.id, author: p.author.name, body: p.body, ts: p.ts, votes: voteCount(p), accepted: !!p.accepted, isOP: p.author.id === t.authorId }))
  };
}
function listRow(t) {
  return { id: t.id, title: t.title, tags: t.tags, ts: t.ts, author: t.posts[0] ? t.posts[0].author.name : '', replies: Math.max(0, t.posts.length - 1), accepted: !!t.acceptedPostId, graduated: !!t.graduated };
}

// ── handler ─────────────────────────────────────────────────────────────────────────────────
const INDEX_KEY = 'threads-index-v1';
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'bad JSON' }) }; }
  const s = store();
  const now = Date.now();
  const index = (await s.get(INDEX_KEY, { type: 'json' })) || { ids: [] };
  const load = async (id) => (id && index.ids.includes(id) ? await s.get(`thread-${id}`, { type: 'json' }) : null);
  const save = async (t) => { await s.setJSON(`thread-${t.id}`, t); if (!index.ids.includes(t.id)) { index.ids.unshift(t.id); await s.setJSON(INDEX_KEY, index); } };
  const reply = (code, obj) => ({ statusCode: code, headers: HEADERS, body: JSON.stringify(obj) });

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
        const r = newThread(body, now);
        if (!r.ok) return reply(400, { ok: false, errors: r.errors });
        await save(r.thread);
        return reply(200, { ok: true, id: r.thread.id, thread: publicThread(r.thread) });
      }
      case 'reply': case 'vote': case 'accept': {
        const t = await load(String(body.id || ''));
        if (!t) return reply(404, { ok: false, error: 'thread not found' });
        const r = body.op === 'reply' ? addReply(t, body, now) : body.op === 'vote' ? applyVote(t, body) : acceptPost(t, body);
        if (!r.ok) return reply(400, { ok: false, errors: r.errors });
        await save(r.thread);
        return reply(200, { ok: true, thread: publicThread(r.thread) });
      }
      default:
        return reply(400, { ok: false, error: 'unknown op' });
    }
  } catch (e) {
    return reply(500, { ok: false, error: 'store error — nothing was lost, retry shortly' });
  }
};

// pure core exports for the test battery
exports._core = { validateThreadInput, newThread, addReply, applyVote, acceptPost, publicThread, listRow, authorFrom, voteCount };
