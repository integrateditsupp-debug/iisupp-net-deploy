/**
 * forum.mjs — IIS Knowledge Commons: real boards, threads, and replies.
 * ---------------------------------------------------------------------------
 * Storage: Netlify Blobs, store "iis-forum"
 *   idx:<board>  -> [{ id, title, name, at, replies }]   (newest first, cap 300)
 *   t:<id>       -> { id, board, title, posts: [{ name, body, at }] } (cap 500)
 *
 * API (same-origin, JSON) at /api/forum:
 *   GET  ?action=counts                  -> { ok, counts: { board: n } }
 *   GET  ?action=list&board=<slug>       -> { ok, threads: [...] }
 *   GET  ?action=thread&id=<id>          -> { ok, thread: {...} }
 *   POST { action:"thread", board, title, body, name?, website? }
 *   POST { action:"reply",  id, body, name?, website? }
 *
 * Guards (honest, low-cost):
 *   · board whitelist · length caps · control-char strip
 *   · honeypot field ("website") — bots get a fake ok
 *   · per-IP token bucket (6 writes/min, process-local)
 *   · 2-minute duplicate suppression
 * Rendering safety: content is stored as plain text; the client renders it
 * with textContent only — no HTML is ever interpreted.
 */
import { getStore } from '@netlify/blobs';

const BOARDS = ['announcements', 'aria', 'm365', 'security', 'automation', 'library'];
const CAPS = { title: 120, body: 4000, name: 40, threadsPerBoard: 300, postsPerThread: 500, listReturn: 100 };

/* ---------- tiny process-local rate limit (house pattern) ---------- */
const buckets = new Map();
function limited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > b.resetAt) { b.count = 0; b.resetAt = now + 60000; }
  b.count += 1;
  buckets.set(ip, b);
  return b.count > 6;
}

const CTRL = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');
function clean(s, cap) {
  return String(s == null ? '' : s)
    .replace(CTRL, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, cap);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default async (req, context) => {
  let store;
  try {
    store = getStore({ name: 'iis-forum' });
  } catch (e) {
    return json({ ok: false, error: 'store unavailable' }, 503);
  }

  const url = new URL(req.url);

  /* ------------------------------ READS ------------------------------ */
  if (req.method === 'GET') {
    const action = url.searchParams.get('action') || 'counts';

    if (action === 'counts') {
      const counts = {};
      for (const b of BOARDS) {
        const idx = (await store.get('idx:' + b, { type: 'json' })) || [];
        counts[b] = idx.length;
      }
      return json({ ok: true, counts });
    }

    if (action === 'list') {
      const board = url.searchParams.get('board') || '';
      if (!BOARDS.includes(board)) return json({ ok: false, error: 'unknown board' }, 400);
      const idx = (await store.get('idx:' + board, { type: 'json' })) || [];
      return json({ ok: true, board, threads: idx.slice(0, CAPS.listReturn) });
    }

    if (action === 'thread') {
      const id = clean(url.searchParams.get('id'), 40);
      if (!id) return json({ ok: false, error: 'missing id' }, 400);
      const thread = await store.get('t:' + id, { type: 'json' });
      if (!thread) return json({ ok: false, error: 'not found' }, 404);
      return json({ ok: true, thread });
    }

    return json({ ok: false, error: 'unknown action' }, 400);
  }

  /* ------------------------------ WRITES ----------------------------- */
  if (req.method === 'POST') {
    const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown';
    if (limited(ip)) return json({ ok: false, error: 'Slow down a little — try again in a minute.' }, 429);

    let payload;
    try { payload = await req.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }

    /* honeypot: silently accept, store nothing */
    if (clean(payload.website, 10)) return json({ ok: true, id: newId() });

    const name = clean(payload.name, CAPS.name) || 'Guest';
    const body = clean(payload.body, CAPS.body);
    if (!body || body.length < 2) return json({ ok: false, error: 'Say a little more — the message is empty.' }, 400);
    const at = Date.now();

    if (payload.action === 'thread') {
      const board = String(payload.board || '');
      if (!BOARDS.includes(board)) return json({ ok: false, error: 'unknown board' }, 400);
      const title = clean(payload.title, CAPS.title);
      if (!title || title.length < 3) return json({ ok: false, error: 'Give your thread a title.' }, 400);

      const idxKey = 'idx:' + board;
      const idx = (await store.get(idxKey, { type: 'json' })) || [];

      /* duplicate suppression: same title within 2 minutes */
      const dupe = idx.find((t) => t.title === title && at - t.at < 120000);
      if (dupe) return json({ ok: true, id: dupe.id, deduped: true });

      const id = newId();
      const thread = { id, board, title, posts: [{ name, body, at }] };
      await store.setJSON('t:' + id, thread);

      idx.unshift({ id, title, name, at, replies: 0 });
      await store.setJSON(idxKey, idx.slice(0, CAPS.threadsPerBoard));
      return json({ ok: true, id });
    }

    if (payload.action === 'reply') {
      const id = clean(payload.id, 40);
      if (!id) return json({ ok: false, error: 'missing id' }, 400);
      const thread = await store.get('t:' + id, { type: 'json' });
      if (!thread) return json({ ok: false, error: 'thread not found' }, 404);
      if (thread.posts.length >= CAPS.postsPerThread) {
        return json({ ok: false, error: 'This thread is full — start a fresh one.' }, 409);
      }

      /* duplicate suppression: identical body within 2 minutes */
      const last = thread.posts[thread.posts.length - 1];
      if (last && last.body === body && at - last.at < 120000) {
        return json({ ok: true, deduped: true });
      }

      thread.posts.push({ name, body, at });
      await store.setJSON('t:' + id, thread);

      const idxKey = 'idx:' + thread.board;
      const idx = (await store.get(idxKey, { type: 'json' })) || [];
      const meta = idx.find((t) => t.id === id);
      if (meta) {
        meta.replies = thread.posts.length - 1;
        meta.lastAt = at;
        await store.setJSON(idxKey, idx);
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: 'unknown action' }, 400);
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
};

export const config = { path: '/api/forum' };
