/**
 * aria-abuse-report — Public endpoint for reporting abuse/spam/security issues.
 *  POST { kind, source_url, description, contact? } -> stored in aria-abuse-log blob
 *  Auto-creates a ticket in aria-leads with [ABUSE] prefix for founder review.
 *  Rate-limited by IP (10/hour) to prevent flooding.
 *  Cat 11 — Trust & safety.
 */
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const kind = String(body.kind || '').slice(0, 64);
  const sourceUrl = String(body.source_url || '').slice(0, 512);
  const description = String(body.description || '').slice(0, 4000);
  const contact = String(body.contact || '').slice(0, 256);

  if (!kind || !description) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'kind and description required' }) };
  }

  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '0.0.0.0').slice(0, 64);
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: 'blobs unavailable' }) }; }

  // Rate-limit
  try {
    const rlStore = getStore({ name: 'aria-rl-abuse' });
    const key = 'rl-' + ipHash;
    const existing = (await rlStore.get(key, { type: 'json' })) || { count: 0, hour_start: Date.now() };
    if (Date.now() - existing.hour_start > 3600000) { existing.count = 0; existing.hour_start = Date.now(); }
    existing.count++;
    await rlStore.setJSON(key, existing);
    if (existing.count > 10) {
      return { statusCode: 429, headers, body: JSON.stringify({ ok: false, error: 'rate limit: 10 per hour' }) };
    }
  } catch {}

  const id = 'abuse-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  const report = {
    id, kind, source_url: sourceUrl, description, contact,
    ip_hash: ipHash, ts: Date.now(), user_agent: (event.headers['user-agent'] || '').slice(0, 256)
  };

  try {
    const store = getStore({ name: 'aria-abuse-log' });
    await store.setJSON(id, report);

    // Mirror into leads for founder review
    const leads = getStore({ name: 'aria-leads' });
    await leads.setJSON(id, {
      ...report,
      email: contact || 'anonymous',
      message: '[ABUSE] ' + kind + ' — ' + description.slice(0, 500),
      received_at: new Date().toISOString(),
      tag: 'abuse-report'
    });
  } catch (e) { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) }; }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, report_id: id }) };
};
