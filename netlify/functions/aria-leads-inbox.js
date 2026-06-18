/**
 * aria-leads-inbox — Admin-token gated unified leads list
 *  POST { event:'list', admin_token, source?, limit? }
 *    -> returns leads from the aria-leads Blobs store, sorted newest-first
 *  POST { event:'mark', admin_token, lead_id, status } (status: contacted, replied, qualified, closed, lost)
 *    -> updates a lead's status
 *
 *  Backs the /leads-admin.html UI.
 *  Cat 10 — Reporting / leads.
 */
let _blobs = null;
async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-leads', consistency: 'eventual' });
  } catch { _blobs = false; }
  return _blobs;
}

function isAdmin(token) {
  const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  return expected && token === expected;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  if (!isAdmin(body.admin_token)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
  }

  const ev = String(body.event || 'list').trim();
  const store = await getStore();
  if (!store) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, leads: [], count: 0, note: 'Netlify Blobs not available — leads not yet persisted' }) };
  }

  if (ev === 'list') {
    const filterSource = body.source ? String(body.source).toLowerCase() : null;
    const limit = Math.min(Number(body.limit || 100), 500);
    try {
      const list = await store.list();
      const items = [];
      for (const item of (list.blobs || []).slice(0, 1000)) {
        try {
          const lead = await store.get(item.key, { type: 'json' });
          if (!lead) continue;
          if (filterSource && (lead.source || '').toLowerCase() !== filterSource) continue;
          items.push({
            id: item.key,
            received_at: lead.received_at || lead.created_at || 0,
            name: lead.name || '',
            email: lead.email || '',
            company: lead.company || '',
            phone: lead.phone || '',
            message: lead.message || '',
            source: lead.source || 'unknown',
            vertical: lead.vertical || null,
            last_intent: lead.last_intent || null,
            status: lead.status || 'new'
          });
        } catch {}
      }
      items.sort((a, b) => (b.received_at || 0) - (a.received_at || 0));
      return ok({ ok: true, count: items.length, leads: items.slice(0, limit) });
    } catch (e) {
      return ok({ ok: false, error: e.message });
    }
  }

  if (ev === 'mark') {
    const id = String(body.lead_id || '');
    const status = String(body.status || '');
    if (!id || !status) return ok({ ok: false, error: 'lead_id + status required' });
    try {
      const lead = await store.get(id, { type: 'json' });
      if (!lead) return ok({ ok: false, error: 'lead not found' });
      lead.status = status;
      lead.status_at = Date.now();
      await store.setJSON(id, lead);
      return ok({ ok: true, lead_id: id, new_status: status });
    } catch (e) {
      return ok({ ok: false, error: e.message });
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
