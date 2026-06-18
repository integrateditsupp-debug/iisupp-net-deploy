/**
 * aria-welcome-ab-report — Admin-gated report on welcome email A/B test performance.
 *  POST { admin_token } -> { variant_A: { sent, opened?, activated, conv_rate }, variant_B: {...} }
 *  Cross-references aria-welcome-ab-log with aria-pilot-state (welcomed→activated).
 *  Cat 2 — Activation analytics.
 */
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

  try {
    const abLog = getStore({ name: 'aria-welcome-ab-log', consistency: 'eventual' });
    const pilot = getStore({ name: 'aria-pilot-state', consistency: 'eventual' });

    const list = await abLog.list();
    const stats = { A: { sent: 0, activated: 0 }, B: { sent: 0, activated: 0 } };

    for (const item of (list.blobs || [])) {
      const rec = await abLog.get(item.key, { type: 'json' });
      if (!rec || !rec.variant) continue;
      stats[rec.variant].sent++;
      try {
        const p = await pilot.get('pilot-' + rec.customer_id, { type: 'json' });
        if (p?.activated) stats[rec.variant].activated++;
      } catch {}
    }

    function calc(s) {
      const r = s.sent === 0 ? 0 : (s.activated / s.sent);
      return { sent: s.sent, activated: s.activated, conv_rate: Math.round(r * 10000) / 100 };
    }

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      variant_A: { name: 'value_first', ...calc(stats.A) },
      variant_B: { name: 'social_proof_first', ...calc(stats.B) },
      winner: stats.A.activated > stats.B.activated ? 'A' : (stats.B.activated > stats.A.activated ? 'B' : 'tie'),
      sample_size: stats.A.sent + stats.B.sent,
      generated_at: new Date().toISOString()
    })};
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
