/**
 * aria-kb-freshness — admin-gated. Scores KB entries by recency + verification staleness.
 *  Reads kb files + their last-modified timestamps.
 *  Returns oldest 25 + verification stalest 25 → backlog for KB-agent next pickup.
 *  Cat 11 — KB quality.
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

  const items = [];
  try {
    const store = getStore({ name: 'aria-kb', consistency: 'eventual' });
    const list = await store.list();
    for (const it of (list.blobs || [])) {
      const k = await store.get(it.key, { type: 'json' });
      if (!k) continue;
      items.push({
        slug: it.key,
        title: k.title || k.id,
        last_updated: k.updated_at || k.created_at || 0,
        last_verified: k.verified_at || 0,
        verification_score: k.verification_score || null
      });
    }
  } catch (e) { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) }; }

  const now = Date.now();
  const enrich = i => ({ ...i,
    age_days: Math.round((now - i.last_updated) / 86400000),
    verify_age_days: i.last_verified ? Math.round((now - i.last_verified) / 86400000) : null
  });
  const enriched = items.map(enrich);

  const oldest = [...enriched].sort((a, b) => a.last_updated - b.last_updated).slice(0, 25);
  const stalest_verify = enriched.filter(i => i.last_verified > 0)
    .sort((a, b) => a.last_verified - b.last_verified).slice(0, 25);

  return { statusCode: 200, headers, body: JSON.stringify({
    ok: true,
    total_kb_entries: items.length,
    oldest_25: oldest,
    stalest_verify_25: stalest_verify,
    generated_at: new Date().toISOString()
  })};
};
