/**
 * aria-prompt-cache-tracker — track Anthropic prompt-caching savings.
 *  POST { admin_token } -> aggregate $ saved across last 30d via cache_read_input_tokens.
 *  Reads aria-llm-usage blob (already populated by aria-chat).
 *  Output drives margin-protection decisions.
 *  Cat 11 — Margin / cost intelligence.
 */
const RATE_INPUT = 3.0 / 1e6;        // claude-sonnet input $/token
const RATE_CACHE_READ = 0.30 / 1e6;  // claude cache-read $/token
const SAVINGS_PER_CACHE_TOKEN = RATE_INPUT - RATE_CACHE_READ;

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }
  const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!expected || body.admin_token !== expected) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
  }

  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: 'blobs unavailable' }) }; }

  const sums = { total_input_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, output_tokens: 0, calls: 0 };
  const cutoff = Date.now() - 30 * 86400000;
  try {
    const store = getStore({ name: 'aria-llm-usage', consistency: 'eventual' });
    const list = await store.list();
    for (const item of (list.blobs || [])) {
      const u = await store.get(item.key, { type: 'json' });
      if (!u || !u.ts || u.ts < cutoff) continue;
      sums.calls++;
      sums.total_input_tokens += u.input_tokens || 0;
      sums.cache_read_tokens += u.cache_read_input_tokens || 0;
      sums.cache_creation_tokens += u.cache_creation_input_tokens || 0;
      sums.output_tokens += u.output_tokens || 0;
    }
  } catch (e) { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) }; }

  const saved_usd = sums.cache_read_tokens * SAVINGS_PER_CACHE_TOKEN;
  const total_cost_input_only = sums.total_input_tokens * RATE_INPUT;
  const total_cost_with_cache = (sums.total_input_tokens - sums.cache_read_tokens) * RATE_INPUT
                                + sums.cache_read_tokens * RATE_CACHE_READ;
  const cache_hit_rate = sums.total_input_tokens > 0
    ? sums.cache_read_tokens / sums.total_input_tokens
    : 0;

  return { statusCode: 200, headers, body: JSON.stringify({
    ok: true,
    window_days: 30,
    calls: sums.calls,
    total_input_tokens: sums.total_input_tokens,
    cache_read_tokens: sums.cache_read_tokens,
    cache_hit_rate_pct: Math.round(cache_hit_rate * 10000) / 100,
    saved_usd: Math.round(saved_usd * 10000) / 10000,
    total_cost_with_cache_usd: Math.round(total_cost_with_cache * 10000) / 10000,
    would_have_cost_usd: Math.round(total_cost_input_only * 10000) / 10000,
    note: 'rates: input=$3/M, cache_read=$0.30/M (sonnet-4-5/4-6)'
  })};
};
