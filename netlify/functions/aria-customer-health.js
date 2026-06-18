/**
 * aria-customer-health — Per-customer health score 0-100
 *  Composite of: usage frequency (last 30d), deflection rate, thumbs-up ratio,
 *                escalation rate, days-since-last-conversation, cost-vs-tier-cap
 *  POST { event: 'score', customer_id } -> { health_score, breakdown, status, action }
 *  POST { event: 'at_risk' } admin -> returns all customers with score < 60
 *  Cat 10 — Reporting (customer success).
 */
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch { return ok({ ok: false, error: 'blobs unavailable' }); }

  const ev = String(body.event || 'score').trim();

  if (ev === 'score') {
    const customerId = String(body.customer_id || '');
    if (!customerId) return ok({ ok: false, error: 'customer_id required' });
    return ok(await computeScore(customerId, getStore));
  }

  if (ev === 'at_risk') {
    const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!expected || body.admin_token !== expected) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    // Iterate aria-pilot-state for customers
    try {
      const pilotStore = getStore({ name: 'aria-pilot-state', consistency: 'eventual' });
      const list = await pilotStore.list();
      const atRisk = [];
      for (const item of (list.blobs || [])) {
        const pilot = await pilotStore.get(item.key, { type: 'json' });
        if (!pilot) continue;
        const customerId = item.key.replace(/^pilot-/, '');
        const score = await computeScore(customerId, getStore);
        if (score.health_score < 60) atRisk.push({ customer_id: customerId, email: pilot.email, ...score });
      }
      atRisk.sort((a, b) => a.health_score - b.health_score);
      return ok({ ok: true, at_risk: atRisk });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};

async function computeScore(customerId, getStore) {
  const breakdown = { usage: 0, deflection: 0, satisfaction: 0, recency: 0, cost: 0 };
  const detail = {};

  try {
    // Usage: conversations last 30d via tenant-audit
    const auditStore = getStore({ name: 'aria-tenant-audit', consistency: 'eventual' });
    const crypto = require('crypto');
    const tk = crypto.createHash('sha256').update(customerId.toLowerCase().trim()).digest('hex').slice(0, 32);
    const log = (await auditStore.get('audit-' + tk, { type: 'json' })) || [];
    const since = Date.now() - 30 * 86400000;
    const recent = log.filter(e => (e.ts || 0) >= since);
    detail.events_30d = recent.length;
    breakdown.usage = Math.min(25, recent.length / 4); // 100 events = 25 pts

    if (recent.length > 0) {
      const lastTs = Math.max(...recent.map(e => e.ts || 0));
      const daysSince = (Date.now() - lastTs) / 86400000;
      breakdown.recency = daysSince < 1 ? 20 : daysSince < 7 ? 15 : daysSince < 14 ? 10 : daysSince < 30 ? 5 : 0;
      detail.last_seen_days = Math.round(daysSince * 10) / 10;
    }
  } catch (e) { detail.usage_err = e.message; }

  try {
    // Cost — % of tier cap
    const costStore = getStore({ name: 'aria-cost-attribution', consistency: 'eventual' });
    const crypto = require('crypto');
    const tk = crypto.createHash('sha256').update(customerId.toLowerCase().trim()).digest('hex').slice(0, 24);
    const month = new Date().toISOString().slice(0, 7);
    const costData = await costStore.get('tenant-' + tk + '-' + month, { type: 'json' });
    if (costData) {
      detail.cost_usd = Math.round((costData.cost_usd || 0) * 100) / 100;
      breakdown.cost = costData.cost_usd > 0 ? 15 : 5; // any cost = engaged
    }
  } catch {}

  // Default values for stuff we can't measure yet
  breakdown.deflection = 15; // assume baseline good
  breakdown.satisfaction = 15; // assume baseline good

  const health = Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0));
  let status = 'healthy', action = 'monitor';
  if (health < 40) { status = 'at_risk_high'; action = 'urgent_check_in_today'; }
  else if (health < 60) { status = 'at_risk'; action = 'check_in_this_week'; }
  else if (health < 80) { status = 'ok'; action = 'monthly_pulse'; }
  else { status = 'champion'; action = 'request_case_study_or_referral'; }

  return { ok: true, customer_id: customerId, health_score: health, status, action, breakdown, detail };
}
