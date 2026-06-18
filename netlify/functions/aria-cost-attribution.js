/**
 * aria-cost-attribution — Per-tenant LLM cost rollup
 *  POST { event:'log', tenant_id, tokens_in, tokens_out, model }
 *    -> increments tenant + global counters
 *  POST { event:'tenant_summary', tenant_id, month? }
 *    -> { tenant cost, % of plan budget, top models, projected end-of-month }
 *  POST { event:'leaderboard', month? }  (admin only)
 *    -> top 10 tenants by spend
 *
 *  Backed by Netlify Blobs (separate from aria-cost-tracker global counter).
 *  Cat 25 — Cost + budget (per-tenant).
 */
const crypto = require('crypto');

const PRICES = {
  'claude-opus-4-7':           { in: 15,   out: 75 },
  'claude-opus-4-6':           { in: 15,   out: 75 },
  'claude-sonnet-4-6':         { in: 3,    out: 15 },
  'claude-haiku-4-5':          { in: 1,    out: 5 },
  'claude-haiku-4-5-20251001': { in: 1,    out: 5 }
};

let _blobs = null;
async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-cost-attribution', consistency: 'strong' });
  } catch { _blobs = false; }
  return _blobs;
}

function tenantKey(t) {
  return crypto.createHash('sha256').update(String(t || '').toLowerCase().trim()).digest('hex').slice(0, 24);
}
function monthKey(d) { return (d || new Date()).toISOString().slice(0, 7); }
function r4(n) { return Math.round(n * 10000) / 10000; }

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || 'log').trim();
  const store = await getStore();
  const month = monthKey();

  if (ev === 'log') {
    const tid = String(body.tenant_id || '');
    if (!tid) return ok({ ok: false, error: 'tenant_id required' });
    const tk = tenantKey(tid);
    const model = String(body.model || 'claude-sonnet-4-6').toLowerCase();
    const tin = Number(body.tokens_in || 0);
    const tout = Number(body.tokens_out || 0);
    const px = PRICES[model] || PRICES['claude-sonnet-4-6'];
    const cost = (tin / 1e6) * px.in + (tout / 1e6) * px.out;

    const key = 'tenant-' + tk + '-' + month;
    let state = (store ? await store.get(key, { type: 'json' }) : null) || { tokens_in: 0, tokens_out: 0, cost_usd: 0, by_model: {}, call_count: 0 };
    state.tokens_in += tin;
    state.tokens_out += tout;
    state.cost_usd += cost;
    state.call_count += 1;
    state.by_model[model] = state.by_model[model] || { tokens_in: 0, tokens_out: 0, cost_usd: 0 };
    state.by_model[model].tokens_in += tin;
    state.by_model[model].tokens_out += tout;
    state.by_model[model].cost_usd += cost;
    state.last_logged_at = Date.now();

    if (store) await store.setJSON(key, state);

    // Tenant index for leaderboard
    if (store) {
      const idx = (await store.get('tenant-index-' + month, { type: 'json' })) || {};
      idx[tk] = { tenant_id_hash: tk, cost_usd: state.cost_usd, last: Date.now() };
      await store.setJSON('tenant-index-' + month, idx);
    }

    return ok({ ok: true, logged_cost_usd: r4(cost), tenant_total_usd: r4(state.cost_usd), durable: !!store });
  }

  if (ev === 'tenant_summary') {
    const tid = String(body.tenant_id || '');
    if (!tid) return ok({ ok: false, error: 'tenant_id required' });
    const tk = tenantKey(tid);
    const m = String(body.month || month);
    const state = (store ? await store.get('tenant-' + tk + '-' + m, { type: 'json' }) : null) || { tokens_in: 0, tokens_out: 0, cost_usd: 0, by_model: {}, call_count: 0 };
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const projected = state.cost_usd * (daysInMonth / Math.max(1, dayOfMonth));
    return ok({
      ok: true,
      tenant_id: tid,
      month: m,
      cost_usd: r4(state.cost_usd),
      projected_end_of_month_usd: r4(projected),
      tokens_in: state.tokens_in,
      tokens_out: state.tokens_out,
      call_count: state.call_count,
      top_models: Object.entries(state.by_model || {})
        .sort((a, b) => b[1].cost_usd - a[1].cost_usd)
        .slice(0, 3)
        .map(([model, v]) => ({ model, cost_usd: r4(v.cost_usd) }))
    });
  }

  if (ev === 'leaderboard') {
    const adminToken = body.admin_token || '';
    const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!expected || adminToken !== expected) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    const m = String(body.month || month);
    const idx = (store ? await store.get('tenant-index-' + m, { type: 'json' }) : null) || {};
    const top = Object.values(idx).sort((a, b) => b.cost_usd - a.cost_usd).slice(0, 10).map(t => ({
      tenant_hash: t.tenant_id_hash,
      cost_usd: r4(t.cost_usd),
      last_seen: t.last
    }));
    return ok({ ok: true, month: m, top_tenants: top });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
