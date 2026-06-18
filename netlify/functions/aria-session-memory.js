/**
 * aria-session-memory — Per-user cross-session memory persistence
 *  POST { event: 'save', email, turns: [{role, content, ts}] }  -> persists last 50 turns
 *  POST { event: 'load', email }                                -> returns last 50 turns
 *  POST { event: 'clear', email }                               -> wipes user's memory
 *
 *  Uses Netlify Blobs (durable). Falls back to in-memory if Blobs unavailable.
 *  Privacy: PII redacted before storage. TTL: 90 days inferred (last_write check on load).
 *
 *  Cat 21 — Knowledge graph + memory.
 */
const { redact } = require('./_pii-redact');

let _blobs = null;
let _memFallback = {}; // { emailHash: { turns: [...], updated_at } }

async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-session-memory', consistency: 'strong' });
  } catch (e) {
    _blobs = false;
  }
  return _blobs;
}

function hashEmail(email) {
  // SHA-256 to avoid storing raw email as key
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(email || '').toLowerCase().trim()).digest('hex').slice(0, 32);
}

const MAX_TURNS = 50;
const TTL_DAYS = 90;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://iisupp.net',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || 'load').trim();
  const email = String(body.email || '').toLowerCase().trim();
  if (!email || !/.+@.+\..+/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid email required' }) };
  }
  const key = 'user-' + hashEmail(email);

  const store = await getStore();

  if (ev === 'load') {
    let record = null;
    if (store) {
      try { record = await store.get(key, { type: 'json' }); }
      catch (e) { console.warn('[session-memory] load err:', e.message); }
    } else {
      record = _memFallback[key] || null;
    }

    if (!record) return ok({ ok: true, turns: [], cold: true });

    // TTL: if last update > 90 days, treat as expired
    const ageDays = (Date.now() - (record.updated_at || 0)) / 86400000;
    if (ageDays > TTL_DAYS) {
      return ok({ ok: true, turns: [], expired: true });
    }
    return ok({
      ok: true,
      turns: record.turns || [],
      updated_at: record.updated_at,
      durable: !!store
    });
  }

  if (ev === 'save') {
    const turns = Array.isArray(body.turns) ? body.turns : [];
    if (turns.length === 0) return ok({ ok: false, error: 'no turns to save' });

    // Sanitize: redact PII, cap content length, validate roles
    const sanitized = turns
      .filter(t => t && (t.role === 'user' || t.role === 'assistant'))
      .map(t => ({
        role: t.role,
        content: redact(String(t.content || '')).slice(0, 2000),
        ts: Number(t.ts) || Date.now()
      }))
      .slice(-MAX_TURNS); // keep most recent MAX_TURNS

    const record = { turns: sanitized, updated_at: Date.now() };

    if (store) {
      try { await store.setJSON(key, record); }
      catch (e) { console.warn('[session-memory] save err:', e.message); _memFallback[key] = record; }
    } else {
      _memFallback[key] = record;
    }
    return ok({ ok: true, saved: sanitized.length, durable: !!store });
  }

  if (ev === 'clear') {
    if (store) {
      try { await store.delete(key); }
      catch (e) { console.warn('[session-memory] clear err:', e.message); }
    }
    delete _memFallback[key];
    return ok({ ok: true, cleared: true });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }
};
