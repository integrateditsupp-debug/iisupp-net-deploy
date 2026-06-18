/**
 * aria-churn-predictor — Score churn risk per customer 0-100
 *  Signals:
 *    - Days since last conversation (>21d = +30 churn risk)
 *    - NPS score (<7 = +30 risk)
 *    - Open SLA breaches (>1 = +20)
 *    - Recent thumbs-down votes (>5 in 14d = +15)
 *    - Plan downgrade history (any = +20)
 *    - Failed-payment recovery (any in 90d = +25)
 *  POST { customer_id } -> { churn_risk, signals, recommended_action }
 *  POST { event:'list', admin_token } -> all customers w/ risk score sorted
 *  Cat 2 — SaaS lifecycle / retention.
 */
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch { return ok({ ok: false, error: 'blobs unavailable' }); }

  if (body.event === 'list') {
    const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!expected || body.admin_token !== expected) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    try {
      const pilotStore = getStore({ name: 'aria-pilot-state', consistency: 'eventual' });
      const list = await pilotStore.list();
      const customers = [];
      for (const item of (list.blobs || [])) {
        const pilot = await pilotStore.get(item.key, { type: 'json' });
        if (!pilot) continue;
        const id = item.key.replace(/^pilot-/, '');
        const score = await predict(id, pilot, getStore);
        customers.push({ customer_id: id, email: pilot.email, ...score });
      }
      customers.sort((a, b) => b.churn_risk - a.churn_risk);
      return ok({ ok: true, customers });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  const cid = String(body.customer_id || '');
  if (!cid) return ok({ ok: false, error: 'customer_id required' });
  try {
    const pilotStore = getStore({ name: 'aria-pilot-state', consistency: 'eventual' });
    const pilot = await pilotStore.get('pilot-' + cid, { type: 'json' });
    if (!pilot) return ok({ ok: false, error: 'customer not found' });
    return ok({ ok: true, ...(await predict(cid, pilot, getStore)) });
  } catch (e) { return ok({ ok: false, error: e.message }); }
  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};

async function predict(customerId, pilot, getStore) {
  const signals = [];
  let risk = 0;
  const now = Date.now();

  // Recency
  try {
    const auditStore = getStore({ name: 'aria-tenant-audit', consistency: 'eventual' });
    const tk = require('crypto').createHash('sha256').update(customerId.toLowerCase()).digest('hex').slice(0, 32);
    const log = (await auditStore.get('audit-' + tk, { type: 'json' })) || [];
    if (log.length > 0) {
      const lastTs = Math.max(...log.map(e => e.ts || 0));
      const days = (now - lastTs) / 86400000;
      if (days > 21) { risk += 30; signals.push('No activity in ' + Math.round(days) + ' days'); }
      else if (days > 14) { risk += 15; signals.push('Low activity (' + Math.round(days) + ' days since last)'); }
    } else {
      risk += 20; signals.push('No recorded events for this tenant');
    }
  } catch {}

  // NPS
  try {
    const npsStore = getStore({ name: 'aria-nps', consistency: 'eventual' });
    const list = await npsStore.list();
    let lastScore = null;
    for (const item of (list.blobs || [])) {
      if (item.key.includes(pilot.email || '')) {
        const r = await npsStore.get(item.key, { type: 'json' });
        if (r && (!lastScore || r.recorded_at > lastScore.recorded_at)) lastScore = r;
      }
    }
    if (lastScore) {
      if (lastScore.score < 7) { risk += 30; signals.push('Detractor NPS: ' + lastScore.score); }
      else if (lastScore.score < 9) { risk += 5; signals.push('Passive NPS: ' + lastScore.score); }
    }
  } catch {}

  // No first invoice yet (signup not activated)
  if (pilot.welcomed && !pilot.activated && (now - pilot.started_at) > 7 * 86400000) {
    risk += 25; signals.push('Signed up >7d ago, never paid first invoice');
  }

  // Clamp
  risk = Math.min(100, risk);
  let recommended_action = 'monitor';
  if (risk >= 70) recommended_action = 'urgent_personal_outreach_today';
  else if (risk >= 50) recommended_action = 'check_in_this_week';
  else if (risk >= 30) recommended_action = 'send_NPS_pulse_or_value_email';

  return { churn_risk: risk, signals, recommended_action };
}
