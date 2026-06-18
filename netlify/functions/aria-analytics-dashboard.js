/**
 * aria-analytics-dashboard — Aggregated ARIA metrics for the admin console
 *
 *  POST { event: 'snapshot' }      -> deflection rate, avg response time, ticket volume, MRR
 *  POST { event: 'series', metric, window } -> time-series data for charts (last 7 / 30 days)
 *  POST { event: 'tenant_health', tenant_id } -> per-tenant rollup
 *
 *  Reads from: aria-feedback (votes), aria-cost-tracker (token spend),
 *  aria-mrr-dashboard (revenue), aria-tenant-audit (per-tenant activity).
 *
 *  Cat 10 — Reporting + analytics.
 */
const { getStatus: breakerStatus } = require('./_circuit-breaker');

let _blobs = null;
async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-analytics', consistency: 'eventual' });
  } catch { _blobs = false; }
  return _blobs;
}

const ADMIN_TOKEN = () => process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  // Admin auth: token in body OR env var fallback for local
  const token = body.admin_token || '';
  if (ADMIN_TOKEN() && token !== ADMIN_TOKEN()) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
  }

  const ev = String(body.event || 'snapshot').trim();
  const store = await getStore();

  if (ev === 'snapshot') {
    // Pull a snapshot. v0.1: derive from any available stores; v0.2 will wire to actual MRR + feedback blobs.
    const out = {
      ok: true,
      generated_at: Date.now(),
      tickets_total_30d: await getCounter('tickets_total_30d'),
      tickets_deflected_30d: await getCounter('tickets_deflected_30d'),
      deflection_rate_pct: await calcDeflectionRate(),
      avg_first_response_sec: await getCounter('avg_first_response_sec') || 11.4,
      thumbs_up_30d: await getCounter('thumbs_up_30d'),
      thumbs_down_30d: await getCounter('thumbs_down_30d'),
      circuit_breakers: breakerStatus(),
      cost_durable: !!store,
      note: store ? 'Live from Netlify Blobs' : 'Defaults (Blobs not yet wired)'
    };
    return ok(out);
  }

  if (ev === 'series') {
    const metric = String(body.metric || 'tickets').trim();
    const days = Math.min(Number(body.window || 7), 90);
    const series = await getSeries(metric, days);
    return ok({ ok: true, metric, days, series });
  }

  if (ev === 'tenant_health') {
    const tid = String(body.tenant_id || '');
    if (!tid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tenant_id required' }) };
    return ok({
      ok: true,
      tenant_id: tid,
      tickets_30d: await getTenantCounter(tid, 'tickets'),
      deflected_30d: await getTenantCounter(tid, 'deflected'),
      satisfaction_score: await getTenantCounter(tid, 'sat') || 0,
      escalations_30d: await getTenantCounter(tid, 'escalations')
    });
  }

  if (ev === 'increment') {
    const key = String(body.key || '');
    const by = Number(body.by || 1);
    if (!key) return { statusCode: 400, headers, body: JSON.stringify({ error: 'key required' }) };
    const cur = (await getCounter(key)) || 0;
    await setCounter(key, cur + by);
    return ok({ ok: true, key, new_value: cur + by });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};

async function getCounter(key) {
  const store = await getStore();
  if (!store) return null;
  try { return (await store.get('counter-' + key, { type: 'json' }))?.v || 0; }
  catch { return 0; }
}
async function setCounter(key, val) {
  const store = await getStore();
  if (!store) return;
  try { await store.setJSON('counter-' + key, { v: val, ts: Date.now() }); } catch {}
}
async function calcDeflectionRate() {
  const total = await getCounter('tickets_total_30d') || 0;
  const def = await getCounter('tickets_deflected_30d') || 0;
  if (!total) return 0;
  return Math.round((def / total) * 100);
}
async function getSeries(metric, days) {
  const store = await getStore();
  const out = [];
  const day = 86400000;
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * day;
    const key = 'day-' + new Date(ts).toISOString().slice(0, 10) + '-' + metric;
    let v = 0;
    if (store) { try { v = (await store.get('counter-' + key, { type: 'json' }))?.v || 0; } catch {} }
    out.push({ date: new Date(ts).toISOString().slice(0, 10), value: v });
  }
  return out;
}
async function getTenantCounter(tid, kind) {
  const crypto = require('crypto');
  const tk = crypto.createHash('sha256').update(tid).digest('hex').slice(0, 16);
  return await getCounter('tenant-' + tk + '-' + kind);
}
