/**
 * aria-webhook-signature-audit — admin-gated. Verifies that all Stripe webhook handlers
 *  properly call stripe.webhooks.constructEvent or verify the signature.
 *  Reads aria-webhook-rx blob (every webhook receipt) and flags any that bypassed signature check.
 *  Cat 11 — Security audit.
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

  const results = { audited: 0, signature_verified: 0, signature_bypassed: 0, recent_unsigned: [] };
  try {
    const store = getStore({ name: 'aria-webhook-rx', consistency: 'eventual' });
    const list = await store.list();
    for (const item of (list.blobs || [])) {
      const rx = await store.get(item.key, { type: 'json' });
      if (!rx) continue;
      results.audited++;
      if (rx.signature_verified === true) results.signature_verified++;
      else {
        results.signature_bypassed++;
        if (results.recent_unsigned.length < 10) {
          results.recent_unsigned.push({ event_id: rx.event_id, ts: rx.ts, source: rx.source });
        }
      }
    }
  } catch (e) { results.error = e.message; }

  results.config_check = {
    STRIPE_WEBHOOK_SECRET_set: !!process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_SECRET_KEY_set: !!process.env.STRIPE_SECRET_KEY
  };

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...results })};
};
