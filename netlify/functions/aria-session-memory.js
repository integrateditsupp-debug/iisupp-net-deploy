/**
 * aria-session-memory - Cross-session memory persistence
 *
 * Supported modes:
 * - POST { event: 'save', email, turns }     -> existing email-scoped memory
 * - POST { event: 'load', email }
 * - POST { event: 'clear', email }
 * - POST { event: 'remember', memory_key?, recent_turns, summary?, last_intent? }
 * - POST { event: 'get', memory_key }
 * - POST { event: 'forget', memory_key }
 *
 * Uses Netlify Blobs when available and falls back to in-memory state.
 * Anonymous memory is keyed by an opaque client-held memory_key so ARIA can
 * persist light session context before an authenticated account exists.
 */
'use strict';

const crypto = require('crypto');
const { redact } = require('./_pii-redact');

let blobsStore = null;
let memoryFallback = {};

const MAX_TURNS = 50;
const MAX_ANON_TURNS = 12;
const TTL_DAYS = 90;

async function getStore() {
  if (blobsStore !== null) return blobsStore;
  try {
    const { getStore } = require('@netlify/blobs');
    blobsStore = getStore({ name: 'aria-session-memory', consistency: 'strong' });
  } catch (_error) {
    blobsStore = false;
  }
  return blobsStore;
}

function hashEmail(email) {
  return crypto
    .createHash('sha256')
    .update(String(email || '').toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
}

function normalizeMemoryKey(value) {
  const text = String(value || '').trim();
  return /^mem_[a-z0-9]{12,}$/i.test(text) ? text.toLowerCase() : '';
}

function isValidEmail(value) {
  const email = String(value || '').toLowerCase().trim();
  return /.+@.+\..+/.test(email);
}

function sanitizeTurns(turns, maxLen, maxTurns) {
  return (Array.isArray(turns) ? turns : [])
    .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant'))
    .map((turn) => ({
      role: turn.role,
      content: redact(String(turn.content || '')).slice(0, maxLen),
      ts: Number(turn.ts) || Date.now()
    }))
    .slice(-maxTurns);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  const action = String(body.event || 'load').trim().toLowerCase();
  const email = String(body.email || '').toLowerCase().trim();
  const memoryKey = normalizeMemoryKey(body.memory_key);
  const usesAnonymous = ['remember', 'get', 'forget'].includes(action) || !!memoryKey;
  const key = usesAnonymous
    ? (memoryKey ? 'anon-' + memoryKey : '')
    : (isValidEmail(email) ? 'user-' + hashEmail(email) : '');

  if (!key) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: usesAnonymous ? 'valid memory_key required' : 'valid email required' })
    };
  }

  const store = await getStore();

  if (action === 'load' || action === 'get') {
    const record = await readRecord(store, key);
    if (!record) {
      return ok(headers, usesAnonymous ? { ok: true, memory_key: memoryKey || null, recent_turns: [], cold: true } : { ok: true, turns: [], cold: true });
    }

    const ageDays = (Date.now() - Number(record.updated_at || 0)) / 86400000;
    if (ageDays > TTL_DAYS) {
      return ok(headers, usesAnonymous ? { ok: true, memory_key: memoryKey || null, recent_turns: [], expired: true } : { ok: true, turns: [], expired: true });
    }

    if (usesAnonymous) {
      return ok(headers, {
        ok: true,
        memory_key: memoryKey,
        recent_turns: record.recent_turns || [],
        summary: record.summary || '',
        last_intent: record.last_intent || '',
        updated_at: record.updated_at,
        durable: !!store
      });
    }

    return ok(headers, {
      ok: true,
      turns: record.turns || [],
      updated_at: record.updated_at,
      durable: !!store
    });
  }

  if (action === 'save') {
    const turns = sanitizeTurns(body.turns, 2000, MAX_TURNS);
    if (!turns.length) return ok(headers, { ok: false, error: 'no turns to save' });

    const record = { turns, updated_at: Date.now() };
    await writeRecord(store, key, record);
    return ok(headers, { ok: true, saved: turns.length, durable: !!store });
  }

  if (action === 'remember') {
    const recentTurns = sanitizeTurns(body.recent_turns, 500, MAX_ANON_TURNS);
    const record = {
      memory_key: memoryKey || null,
      recent_turns: recentTurns,
      summary: redact(String(body.summary || '')).slice(0, 1000),
      last_intent: String(body.last_intent || '').slice(0, 120),
      updated_at: Date.now()
    };
    await writeRecord(store, key, record);
    return ok(headers, { ok: true, memory_key: memoryKey, saved: recentTurns.length, durable: !!store });
  }

  if (action === 'clear' || action === 'forget') {
    await deleteRecord(store, key);
    return ok(headers, usesAnonymous ? { ok: true, memory_key: memoryKey || null, cleared: true } : { ok: true, cleared: true });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
};

async function readRecord(store, key) {
  if (store) {
    try {
      return await store.get(key, { type: 'json' });
    } catch (error) {
      console.warn('[session-memory] load err:', error.message);
    }
  }
  return memoryFallback[key] || null;
}

async function writeRecord(store, key, record) {
  if (store) {
    try {
      await store.setJSON(key, record);
      return;
    } catch (error) {
      console.warn('[session-memory] save err:', error.message);
    }
  }
  memoryFallback[key] = record;
}

async function deleteRecord(store, key) {
  if (store) {
    try {
      await store.delete(key);
    } catch (error) {
      console.warn('[session-memory] clear err:', error.message);
    }
  }
  delete memoryFallback[key];
}

function ok(headers, body) {
  return { statusCode: 200, headers, body: JSON.stringify(body) };
}
