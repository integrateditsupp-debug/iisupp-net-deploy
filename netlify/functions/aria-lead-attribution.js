/**
 * aria-lead-attribution — wraps lead capture. Records UTM + referrer + landing page.
 *  POST { email, name, message, utm_source, utm_medium, utm_campaign, referrer, landing_url }
 *  Stores in aria-leads with full attribution metadata for revenue intelligence.
 *  Cat 1 — Revenue intelligence.
 */
const crypto = require('crypto');
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.email || '').toLowerCase().trim().slice(0, 200);
  if (!email || !email.includes('@')) return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid email required' }) };

  const id = 'lead-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  const lead = {
    id,
    email,
    name: String(body.name || '').slice(0, 100),
    message: String(body.message || '').slice(0, 2000),
    received_at: new Date().toISOString(),
    received_ts: Date.now(),
    attribution: {
      utm_source: String(body.utm_source || '').slice(0, 64),
      utm_medium: String(body.utm_medium || '').slice(0, 64),
      utm_campaign: String(body.utm_campaign || '').slice(0, 128),
      utm_content: String(body.utm_content || '').slice(0, 128),
      utm_term: String(body.utm_term || '').slice(0, 128),
      referrer: String(body.referrer || '').slice(0, 512),
      landing_url: String(body.landing_url || '').slice(0, 512),
      first_seen: body.first_seen || new Date().toISOString()
    },
    source: derive_source(body),
    ip_hash: crypto.createHash('sha256').update(event.headers['x-nf-client-connection-ip'] || '').digest('hex').slice(0, 16)
  };

  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'aria-leads' });
    await store.setJSON(id, lead);

    // Aggregate counter by source
    const agg = getStore({ name: 'aria-lead-source-counts' });
    const dayKey = new Date().toISOString().slice(0, 10);
    const sourceKey = lead.source || 'unknown';
    const counter = (await agg.get('count-' + dayKey + '-' + sourceKey, { type: 'json' })) || { count: 0 };
    counter.count++;
    counter.source = sourceKey;
    counter.day = dayKey;
    await agg.setJSON('count-' + dayKey + '-' + sourceKey, counter);
  } catch (e) { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) }; }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, lead_id: id }) };
};

function derive_source(b) {
  const utm = (b.utm_source || '').toLowerCase();
  if (utm) return utm;
  const ref = (b.referrer || '').toLowerCase();
  if (ref.includes('linkedin')) return 'linkedin';
  if (ref.includes('google')) return 'google';
  if (ref.includes('bing')) return 'bing';
  if (ref.includes('twitter') || ref.includes('x.com')) return 'twitter';
  if (ref.includes('github')) return 'github';
  if (ref) return 'referral';
  return 'direct';
}
