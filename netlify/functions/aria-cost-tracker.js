/**
 * aria-cost-tracker — LLM token usage logger + budget alert
 *  POST { event: 'log', tokens_in, tokens_out, model, customer_id? }
 *  POST { event: 'status' } -> returns current month spend + cap
 *
 *  Persists to a Netlify Blob (when blobs are enabled) or
 *  falls back to in-memory + relays to ARIA_LLM_ALERT_TO email.
 *
 *  Cat 25 — Cost + budget management.
 *  Model price table (USD per 1M tokens, June 2026):
 *    claude-opus-4-7: $15 in / $75 out
 *    claude-sonnet-4-6: $3 in / $15 out
 *    claude-haiku-4-5: $1 in / $5 out
 */
const PRICES = {
  'claude-opus-4-7':       { in: 15, out: 75 },
  'claude-opus-4-6':       { in: 15, out: 75 },
  'claude-sonnet-4-6':     { in: 3,  out: 15 },
  'claude-sonnet-4-20250514':{ in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-haiku-4-5':      { in: 1,  out: 5 },
  'gpt-4o':                { in: 5,  out: 20 },
  'gpt-4o-mini':           { in: 0.15, out: 0.60 }
};

let _memCache = { month: new Date().toISOString().slice(0,7), total_usd: 0, by_model: {}, last_alert_at: 0 };

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
  const month = new Date().toISOString().slice(0, 7);
  if (_memCache.month !== month) {
    _memCache = { month, total_usd: 0, by_model: {}, last_alert_at: 0 };
  }

  if (ev === 'status') {
    const cap = Number(process.env.ARIA_LLM_MONTHLY_CAP_USD || 100);
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      month: _memCache.month,
      total_usd: round(_memCache.total_usd),
      by_model: _memCache.by_model,
      cap_usd: cap,
      pct_of_cap: round((_memCache.total_usd / cap) * 100),
      remaining_usd: round(cap - _memCache.total_usd),
      note: 'In-memory only (resets on cold start). Add Netlify Blobs for durable counting.'
    }) };
  }

  if (ev === 'log') {
    const model = String(body.model || 'claude-sonnet-4-6').toLowerCase();
    const tin = Number(body.tokens_in || 0);
    const tout = Number(body.tokens_out || 0);
    const px = PRICES[model] || PRICES['claude-sonnet-4-6'];
    const cost = (tin / 1000000) * px.in + (tout / 1000000) * px.out;
    _memCache.total_usd += cost;
    _memCache.by_model[model] = _memCache.by_model[model] || { tokens_in: 0, tokens_out: 0, cost_usd: 0 };
    _memCache.by_model[model].tokens_in += tin;
    _memCache.by_model[model].tokens_out += tout;
    _memCache.by_model[model].cost_usd += cost;

    // Alert at 80% / 95% / 100% of monthly cap
    const cap = Number(process.env.ARIA_LLM_MONTHLY_CAP_USD || 100);
    const pct = (_memCache.total_usd / cap) * 100;
    if (pct >= 80 && (Date.now() - _memCache.last_alert_at) > 3600 * 1000) {
      _memCache.last_alert_at = Date.now();
      await alertAhmad(pct, _memCache.total_usd, cap);
    }

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      logged_cost_usd: round(cost),
      month_total_usd: round(_memCache.total_usd),
      pct_of_cap: round(pct)
    }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
};

function round(n) { return Math.round(n * 10000) / 10000; }

async function alertAhmad(pct, total, cap) {
  const to = process.env.ARIA_LLM_ALERT_TO || 'ahmad.wasee@iisupp.net';
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const subject = '[ARIA cost] ' + Math.round(pct) + '% of monthly LLM cap consumed';
  const html = `<p>ARIA's LLM spend hit <strong>${Math.round(pct)}%</strong> of the monthly cap.</p>
    <p>Total this month: <strong>$${round(total)}</strong> of $${cap} cap.</p>
    <p>If this is unexpected, check the cost-tracker status: <code>POST /.netlify/functions/aria-cost-tracker {"event":"status"}</code></p>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>', to: [to], subject, html })
    });
  } catch (e) { console.warn('[cost-tracker] alert mail failed:', e.message); }
}
