/**
 * aria-tenant-audit — Per-tenant audit log + scoped action policy
 *
 *  POST { event: 'log', tenant_id, action, actor, outcome, params? }
 *    -> appends audit entry to tenant's log
 *  POST { event: 'list', tenant_id, since? }
 *    -> returns recent entries
 *  POST { event: 'policy_get', tenant_id }
 *    -> returns allow-list of actions ARIA can perform autonomously vs needing approval
 *  POST { event: 'policy_set', tenant_id, allowed_auto, requires_approval }
 *    -> ADMIN-only: updates tenant policy
 *
 *  Uses Netlify Blobs (durable). Each tenant has separate audit + policy blobs.
 *  Cat 12 — Enterprise + multi-tenant.
 */
const crypto = require('crypto');
const { redact } = require('./_pii-redact');

let _blobs = null;
let _memAudit = {};
let _memPolicy = {};

async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-tenant-audit', consistency: 'strong' });
  } catch { _blobs = false; }
  return _blobs;
}

const DEFAULT_POLICY = {
  allowed_auto: ['kb.lookup', 'm365.read.list_users', 'm365.read.check_license', 'm365.read.list_groups'],
  requires_approval: [
    'm365.password.reset', 'm365.license.assign', 'm365.license.remove',
    'm365.group.add_member', 'm365.group.remove_member',
    'm365.user.disable', 'm365.user.enable',
    'kb.add_entry', 'kb.remove_entry', 'notify.tenant_users'
  ],
  trust_age_days: 0
};

function tenantKey(id) {
  return crypto.createHash('sha256').update(String(id || '').toLowerCase().trim()).digest('hex').slice(0, 32);
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || '').trim();
  const tenantId = String(body.tenant_id || '').toLowerCase().trim();
  if (!tenantId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tenant_id required' }) };

  const tk = tenantKey(tenantId);
  const store = await getStore();

  if (ev === 'log') {
    const entry = {
      ts: Date.now(),
      tenant_id: tenantId,
      action: String(body.action || ''),
      actor: String(body.actor || 'ARIA'),
      outcome: String(body.outcome || 'unknown'),
      params: redact(JSON.stringify(body.params || {})).slice(0, 1000)
    };
    let log = store ? (await store.get('audit-' + tk, { type: 'json' }) || []) : (_memAudit[tk] || []);
    log.push(entry);
    log = log.slice(-500); // cap last 500 events per tenant
    if (store) await store.setJSON('audit-' + tk, log);
    else _memAudit[tk] = log;
    return ok({ ok: true, logged: true, count: log.length });
  }

  if (ev === 'list') {
    const since = Number(body.since || 0);
    const log = store ? (await store.get('audit-' + tk, { type: 'json' }) || []) : (_memAudit[tk] || []);
    const filtered = since > 0 ? log.filter(e => e.ts >= since) : log;
    return ok({ ok: true, tenant_id: tenantId, count: filtered.length, entries: filtered.slice(-100) });
  }

  if (ev === 'policy_get') {
    let pol = store ? await store.get('policy-' + tk, { type: 'json' }) : _memPolicy[tk];
    if (!pol) pol = { ...DEFAULT_POLICY };
    return ok({ ok: true, tenant_id: tenantId, policy: pol });
  }

  if (ev === 'policy_set') {
    // Admin guard: require admin_token matching env
    const adminToken = process.env.APERTURE_ADMIN_PASSWORD;
    if (!adminToken || body.admin_token !== adminToken) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    const pol = {
      allowed_auto: Array.isArray(body.allowed_auto) ? body.allowed_auto : DEFAULT_POLICY.allowed_auto,
      requires_approval: Array.isArray(body.requires_approval) ? body.requires_approval : DEFAULT_POLICY.requires_approval,
      trust_age_days: Number(body.trust_age_days || 0),
      updated_at: Date.now()
    };
    if (store) await store.setJSON('policy-' + tk, pol);
    else _memPolicy[tk] = pol;
    return ok({ ok: true, tenant_id: tenantId, policy: pol });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
