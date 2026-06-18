/**
 * aria-cost-tracker — LLM token usage logger + budget alert
 *  POST { event: 'log', tokens_in, tokens_out, model, customer_id? }
 *  POST { event: 'status' } -> returns current month spend + cap
 *  POST { event: 'history' } -> returns last 6 months
 *
 *  v0.2 (2026-06-18): Netlify Blobs durable counting with in-memory fallback.
 *  Cat 25 — Cost + budget management.
 */
const PRICES = {
  'claude-opus-4-7':           { in: 15,   out: 75 },
  'claude-opus-4-6':           { in: 15,   out: 75 },
  'claude-sonnet-4-6':         { in: 3,    out: 15 },
  'claude-sonnet-4-20250514':  { in: 3,    out: 15 },
  'claude-haiku-4-5-20251001': { in: 1,    out: 5 },
  'claude-haiku-4-5':          { in: 1,    out: 5 },
  'gpt-4o':                    { in: 5,    out: 20 },
  'gpt-4o-mini':               { in: 0.15, out: 0.60 }
};

let _memCache = { month: monthKey(), total_usd: 0, by_model: {}, last_alert_at: 0 };
let _blobs = null;
async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-cost-tracker', consistency: 'strong' });
  } catch (e) {
    _blobs = false; // Blobs not available — fall back to in-memory
  }
  return _blobs;
}

function monthKey(d) { return (d || new Date()).toISOString().slice(0, 7); }
function round(n) { return Math.round(n * 10000) / 10000; }

async function loadMonth(month) {
  const store = await getStore();
  if (!store) return null;
  try {
    const blob = await store.get('month-' + month, { type: 'json' });
    return blob || null;
  } catch (e) {
    console.warn('[cost-tracker] blob get failed:', e.message);
    return null;
  }
}

async function saveMonth(month, data) {
  const store = await getStore();
  if (!store) return false;
  try {
    await store.setJSON('month-' + month, data);
    return true;
  } catch (e) {
    console.warn('[cost-tracker] blob set failed:', e.message);
    return false;
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || 'log').trim();
  const month = monthKey();

  // Hydrate from blob if available
  let state = await loadMonth(month);
  if (!state) {
    if (_memCache.month !== month) {
      _memCache = { month, total_usd: 0, by_model: {}, last_alert_at: 0 };
    }
    state = _memCache;
  }

  if (ev === 'status') {
    const cap = Number(process.env.ARIA_LLM_MONTHLY_CAP_USD || 100);
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      month: state.month || month,
      total_usd: round(state.total_usd || 0),
      by_model: state.by_model || {},
      cap_usd: cap,
      pct_of_cap: round(((state.total_usd || 0) / cap) * 100),
      remaining_usd: round(cap - (state.total_usd || 0)),
      durable: !!(await getStore()),
      note: (await getStore()) ? 'Netlify Blobs (durable)' : 'In-memory (resets on cold start). Enable Netlify Blobs for durable counting.'
    }) };
  }

  if (ev === 'history') {
    // Last 6 months
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const data = await loadMonth(key);
      months.push({ month: key, total_usd: round((data || {}).total_usd || 0) });
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, history: months }) };
  }

  if (ev === 'log') {
    const model = String(body.model || 'claude-sonnet-4-6').toLowerCase();
    const tin = Number(body.tokens_in || 0);
    const tout = Number(body.tokens_out || 0);
    const px = PRICES[model] || PRICES['claude-sonnet-4-6'];
    const cost = (tin / 1000000) * px.in + (tout / 1000000) * px.out;

    state.month = month;
    state.total_usd = (state.total_usd || 0) + cost;
    state.by_model = state.by_model || {};
    state.by_model[model] = state.by_model[model] || { tokens_in: 0, tokens_out: 0, cost_usd: 0 };
    state.by_model[model].tokens_in += tin;
    state.by_model[model].tokens_out += tout;
    state.by_model[model].cost_usd += cost;

    // Persist
    const saved = await saveMonth(month, state);
    if (!saved) {
      _memCache = state; // Keep in-memory in sync
    }

    // Alert at 80% / 95% / 100% of monthly cap
    const cap = Number(process.env.ARIA_LLM_MONTHLY_CAP_USD || 100);
    const pct = (state.total_usd / cap) * 100;
    if (pct >= 80 && (Date.now() - (state.last_alert_at || 0)) > 3600 * 1000) {
      state.last_alert_at = Date.now();
      await saveMonth(month, state);
      await alertAhmad(pct, state.total_usd, cap);
    }

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      logged_cost_usd: round(cost),
      month_total_usd: round(state.total_usd),
      pct_of_cap: round(pct),
      durable: saved
    }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
};

async function alertAhmad(pct, total, cap) {
  const to = process.env.ARIA_LLM_ALERT_TO || 'ahmad.wasee@iisupp.net';
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const subject = '[ARIA cost] ' + Math.round(pct) + '% of monthly LLM cap consumed';
  const html = '<p>ARIA LLM spend hit <strong>' + Math.round(pct) + '%</strong> of the monthly cap.</p>' +
    '<p>Total this month: <strong>$' + round(total) + '</strong> of $' + cap + ' cap.</p>' +
    '<p>Check: <code>POST /.netlify/functions/aria-cost-tracker {"event":"status"}</code></p>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>', to: [to], subject, html })
    });
  } catch (e) { console.warn('[cost-tracker] alert mail failed:', e.message); }
}
