/**
 * aria-white-label — Tenant theming/branding for embedded ARIA widget
 *  GET  /?tenant_id=acme.com  -> returns theme CSS + JSON (logo URL, accent, brand name)
 *  POST { event:'set', tenant_id, theme, admin_token } -> upsert tenant theme
 *  POST { event:'list', admin_token } -> list all themed tenants (admin only)
 *
 *  Theme shape:
 *    { brand_name, logo_url, accent_color, support_email, support_phone, hide_iis_badge }
 *
 *  Cat 19 — Embedded white-label.
 */
const crypto = require('crypto');

let _blobs = null;
async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-white-label', consistency: 'eventual' });
  } catch { _blobs = false; }
  return _blobs;
}

const DEFAULT_THEME = {
  brand_name: 'ARIA',
  logo_url: 'https://iisupp.net/assets/aria-logo.svg',
  accent_color: '#c5a059',
  support_email: 'support@iisupp.net',
  support_phone: '+1-647-581-3182',
  hide_iis_badge: false
};

function tenantKey(t) {
  return crypto.createHash('sha256').update(String(t || '').toLowerCase().trim()).digest('hex').slice(0, 24);
}

function isAdmin(token) {
  const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  return expected && token === expected;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  // GET: serve theme as CSS or JSON depending on Accept header
  if (event.httpMethod === 'GET') {
    const tenantId = (event.queryStringParameters || {}).tenant_id || '';
    const fmt = (event.queryStringParameters || {}).format || 'json';
    if (!tenantId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'tenant_id required' }) };
    }
    const store = await getStore();
    const t = (store ? await store.get('tenant-' + tenantKey(tenantId), { type: 'json' }) : null) || DEFAULT_THEME;

    if (fmt === 'css') {
      const css =
        ':root{' +
        '--aria-accent:' + sanitizeCss(t.accent_color) + ';' +
        '--aria-brand-name:"' + sanitizeCss(t.brand_name) + '";' +
        '}' +
        '.aria-logo{background-image:url(' + sanitizeCss(t.logo_url) + ');background-size:contain;background-repeat:no-repeat}' +
        (t.hide_iis_badge ? '.iis-powered-by{display:none !important}' : '');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
        body: css
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, tenant_id: tenantId, theme: t }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET or POST only' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  if (body.event === 'set') {
    if (!isAdmin(body.admin_token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    const tenantId = String(body.tenant_id || '');
    if (!tenantId) return ok({ ok: false, error: 'tenant_id required' });
    const t = body.theme || {};
    const merged = Object.assign({}, DEFAULT_THEME, {
      brand_name: String(t.brand_name || DEFAULT_THEME.brand_name).slice(0, 60),
      logo_url: String(t.logo_url || DEFAULT_THEME.logo_url).slice(0, 500),
      accent_color: validHexOrDefault(t.accent_color, DEFAULT_THEME.accent_color),
      support_email: String(t.support_email || DEFAULT_THEME.support_email).slice(0, 120),
      support_phone: String(t.support_phone || DEFAULT_THEME.support_phone).slice(0, 30),
      hide_iis_badge: !!t.hide_iis_badge,
      updated_at: Date.now()
    });
    const store = await getStore();
    if (store) await store.setJSON('tenant-' + tenantKey(tenantId), merged);
    return ok({ ok: true, tenant_id: tenantId, theme: merged, durable: !!store });
  }

  if (body.event === 'list') {
    if (!isAdmin(body.admin_token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    const store = await getStore();
    if (!store) return ok({ ok: true, count: 0, tenants: [], note: 'no blobs' });
    const list = await store.list();
    const items = [];
    for (const item of (list.blobs || []).slice(0, 100)) {
      try {
        const t = await store.get(item.key, { type: 'json' });
        items.push({ key: item.key, brand_name: t.brand_name, updated_at: t.updated_at });
      } catch {}
    }
    return ok({ ok: true, count: items.length, tenants: items });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};

function sanitizeCss(s) {
  return String(s || '').replace(/[<>"'\\;{}()]/g, '').slice(0, 200);
}
function validHexOrDefault(c, d) {
  if (/^#[0-9a-f]{3,8}$/i.test(String(c))) return c;
  return d;
}
