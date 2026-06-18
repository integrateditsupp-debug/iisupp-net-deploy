/**
 * aria-ab-test — Lightweight A/B test attribution
 *  POST { event:'expose', test_id, variant, visitor_id } - logs exposure
 *  POST { event:'convert', test_id, visitor_id, conversion_type } - logs conversion
 *  POST { event:'results', test_id, admin_token } - returns conversion rate per variant
 *  Visitor_id = client-side UUID stored in localStorage (no PII).
 *  Cat 14 — Marketing optimization.
 */
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  let store;
  try { ({ getStore } = require('@netlify/blobs')); store = require('@netlify/blobs').getStore({ name: 'aria-ab-tests', consistency: 'eventual' }); }
  catch { return ok({ ok: false, error: 'blobs unavailable' }); }

  const ev = String(body.event || '').trim();
  const testId = String(body.test_id || '').slice(0, 60);
  const visitorId = String(body.visitor_id || '').slice(0, 40);

  if (ev === 'expose') {
    if (!testId || !visitorId) return ok({ ok: false, error: 'test_id + visitor_id required' });
    const variant = String(body.variant || 'A');
    const key = 'expose-' + testId + '-' + visitorId;
    try {
      const existing = await store.get(key, { type: 'json' });
      if (existing) return ok({ ok: true, already_exposed: true, variant: existing.variant });
      await store.setJSON(key, { variant, ts: Date.now() });
      return ok({ ok: true, exposed: true, variant });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  if (ev === 'convert') {
    if (!testId || !visitorId) return ok({ ok: false, error: 'test_id + visitor_id required' });
    const ctype = String(body.conversion_type || 'primary');
    try {
      const expose = await store.get('expose-' + testId + '-' + visitorId, { type: 'json' });
      if (!expose) return ok({ ok: false, error: 'no exposure record' });
      await store.setJSON('convert-' + testId + '-' + visitorId + '-' + ctype, {
        variant: expose.variant, conversion_type: ctype, ts: Date.now()
      });
      return ok({ ok: true, recorded: true, variant: expose.variant });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  if (ev === 'results') {
    const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!expected || body.admin_token !== expected) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    try {
      const list = await store.list();
      const exposures = {}, conversions = {};
      for (const item of (list.blobs || [])) {
        if (item.key.startsWith('expose-' + testId + '-')) {
          const e = await store.get(item.key, { type: 'json' });
          if (e) {
            exposures[e.variant] = (exposures[e.variant] || 0) + 1;
          }
        } else if (item.key.startsWith('convert-' + testId + '-')) {
          const c = await store.get(item.key, { type: 'json' });
          if (c) {
            const k = c.variant + ':' + c.conversion_type;
            conversions[k] = (conversions[k] || 0) + 1;
          }
        }
      }
      // Compute conv rate per variant
      const results = {};
      for (const variant of Object.keys(exposures)) {
        results[variant] = {
          exposures: exposures[variant],
          conversions: Object.entries(conversions).filter(([k]) => k.startsWith(variant + ':')).reduce((a, [k, v]) => { a[k.split(':')[1]] = v; return a; }, {}),
          conv_rate_pct: 0
        };
        const primary = results[variant].conversions.primary || 0;
        results[variant].conv_rate_pct = exposures[variant] > 0 ? Math.round((primary / exposures[variant]) * 1000) / 10 : 0;
      }
      return ok({ ok: true, test_id: testId, results });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
