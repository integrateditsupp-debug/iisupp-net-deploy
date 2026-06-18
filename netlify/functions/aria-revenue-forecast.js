/**
 * aria-revenue-forecast — 90-day revenue projection model
 *  POST { admin_token } -> projects current MRR forward using:
 *    - current active subs
 *    - lead pipeline (P1/P2/P3 from aria-leads + auto-triage)
 *    - historical pilot-to-paid conversion (placeholder until data exists)
 *    - typical churn rate (placeholder 5% monthly until real data)
 *  Output: 30 / 60 / 90 day MRR scenarios (low / mid / high)
 *  Cat 10 — Reporting.
 */
const PILOT_CONVERSION_PCT = { P1: 30, P2: 15, P3: 5 }; // placeholder until data
const TYPICAL_CHURN_MONTHLY = 0.05; // 5% until we have real data
const AVG_PLAN_VALUE_USD = 1500; // Pro plan as anchor

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

  let currentMrr = 0;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const r = await fetch('https://api.stripe.com/v1/subscriptions?status=active&limit=100', {
        headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
      });
      const j = await r.json();
      let cents = 0;
      for (const sub of (j.data || [])) {
        const item = sub.items?.data?.[0];
        if (!item) continue;
        const amount = item.price?.unit_amount || 0;
        const interval = item.price?.recurring?.interval || 'month';
        const intervalCount = item.price?.recurring?.interval_count || 1;
        if (interval === 'month') cents += amount / intervalCount;
        else if (interval === 'year') cents += amount / (12 * intervalCount);
      }
      currentMrr = cents / 100;
    } catch (e) { /* skip */ }
  }

  // Pipeline from leads
  const pipeline = { P1: 0, P2: 0, P3: 0 };
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'aria-leads', consistency: 'eventual' });
    const list = await store.list();
    for (const item of (list.blobs || []).slice(0, 500)) {
      const lead = await store.get(item.key, { type: 'json' });
      if (!lead) continue;
      const p = lead.priority || 'P3';
      if (pipeline[p] !== undefined) pipeline[p]++;
    }
  } catch {}

  // Projection
  const expectedNewMrr = (
    pipeline.P1 * (PILOT_CONVERSION_PCT.P1 / 100) +
    pipeline.P2 * (PILOT_CONVERSION_PCT.P2 / 100) +
    pipeline.P3 * (PILOT_CONVERSION_PCT.P3 / 100)
  ) * AVG_PLAN_VALUE_USD;

  function project(months) {
    const churnLoss = currentMrr * (1 - Math.pow(1 - TYPICAL_CHURN_MONTHLY, months));
    const gain = expectedNewMrr * (months / 3); // ramp linearly over the period
    const mid = Math.max(0, currentMrr - churnLoss + gain);
    return { low: Math.round(mid * 0.6), mid: Math.round(mid), high: Math.round(mid * 1.5) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      generated_at: new Date().toISOString(),
      current_mrr_usd: Math.round(currentMrr * 100) / 100,
      pipeline,
      expected_new_mrr_per_quarter_usd: Math.round(expectedNewMrr),
      projections: {
        '30_days': project(1),
        '60_days': project(2),
        '90_days': project(3)
      },
      assumptions: {
        pilot_conversion_pct: PILOT_CONVERSION_PCT,
        typical_churn_monthly: TYPICAL_CHURN_MONTHLY,
        avg_plan_value_usd: AVG_PLAN_VALUE_USD
      },
      note: 'Projections use placeholder conversion + churn rates until real data accumulates. Update assumptions once 10+ pilots have run.'
    })
  };
};
