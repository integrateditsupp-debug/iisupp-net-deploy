/**
 * aria-llm-cost-cap — admin-gated config + check. Sets monthly $ cap per tenant.
 *  GET via POST { check: true, tenant_id, monthly_usage_usd } -> { allowed, cap, used }
 *  Used by aria-chat as gatekeeper before each LLM call.
 *  Cat 11 — Margin protection.
 */
const DEFAULT_CAPS_BY_TIER = {
  personal: 30,
  pro: 80,
  small_business: 800,
  mid_size: 1600,
  enterprise: 3200
};

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: 'blobs unavailable' }) }; }

  // Set cap (admin)
  if (body.event === 'set') {
    const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!expected || body.admin_token !== expected) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    const tid = String(body.tenant_id || '');
    const cap = Math.max(0, Math.min(50000, parseFloat(body.monthly_cap_usd) || 0));
    if (!tid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tenant_id required' }) };
    try {
      const store = getStore({ name: 'aria-llm-caps' });
      await store.setJSON('cap-' + tid, { tenant_id: tid, monthly_cap_usd: cap, set_at: new Date().toISOString() });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, tenant_id: tid, monthly_cap_usd: cap }) };
    } catch (e) { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) }; }
  }

  // Check whether a tenant is under cap (internal token)
  if (body.check) {
    const tid = String(body.tenant_id || '');
    const tier = (body.tier || 'personal').toLowerCase();
    const usage = Math.max(0, parseFloat(body.monthly_usage_usd) || 0);
    if (!tid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tenant_id required' }) };

    let cap = DEFAULT_CAPS_BY_TIER[tier] ?? 30;
    try {
      const store = getStore({ name: 'aria-llm-caps', consistency: 'eventual' });
      const explicit = await store.get('cap-' + tid, { type: 'json' });
      if (explicit && typeof explicit.monthly_cap_usd === 'number') cap = explicit.monthly_cap_usd;
    } catch {}

    const allowed = usage < cap;
    const remaining_pct = Math.max(0, ((cap - usage) / cap) * 100);
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, allowed, cap_usd: cap, used_usd: usage,
      remaining_usd: Math.max(0, cap - usage),
      remaining_pct: Math.round(remaining_pct * 10) / 10,
      warn_threshold_hit: remaining_pct < 20
    })};
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
};
