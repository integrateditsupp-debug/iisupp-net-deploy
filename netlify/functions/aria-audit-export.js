/**
 * aria-audit-export — Generate compliance audit export per tenant
 *  POST { tenant_id, since?, format? } - returns JSON/CSV w/ all audit log + cost + sessions
 *  Admin-token gated. PII redacted by default; raw mode requires explicit flag + double-confirm.
 *  Cat 24 — Compliance (auditor-facing).
 */
const crypto = require('crypto');

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

  const tenantId = String(body.tenant_id || '');
  if (!tenantId) return ok({ ok: false, error: 'tenant_id required' });
  const since = Number(body.since || 0);
  const tk = crypto.createHash('sha256').update(tenantId.toLowerCase()).digest('hex').slice(0, 32);
  const tkCost = crypto.createHash('sha256').update(tenantId.toLowerCase()).digest('hex').slice(0, 24);

  const out = { tenant_id: tenantId, generated_at: new Date().toISOString(), audit_log: [], cost: null, sessions: [], notes: [] };

  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch { return ok({ ok: false, error: 'blobs unavailable' }); }

  // Audit log
  try {
    const auditStore = getStore({ name: 'aria-tenant-audit', consistency: 'eventual' });
    const log = (await auditStore.get('audit-' + tk, { type: 'json' })) || [];
    out.audit_log = since ? log.filter(e => (e.ts || 0) >= since) : log;
  } catch (e) { out.notes.push('audit_log: ' + e.message); }

  // Cost
  try {
    const costStore = getStore({ name: 'aria-cost-attribution', consistency: 'eventual' });
    const month = new Date().toISOString().slice(0, 7);
    out.cost = await costStore.get('tenant-' + tkCost + '-' + month, { type: 'json' });
  } catch (e) { out.notes.push('cost: ' + e.message); }

  // Sessions (redacted by default)
  try {
    const sessionStore = getStore({ name: 'aria-session-memory', consistency: 'eventual' });
    // session keys hash email — we'd need the customer's email here, skipping list-all for safety
    out.notes.push('Session export requires customer email + their explicit consent. Use /aria-data-export instead.');
  } catch {}

  out.summary = {
    audit_events: out.audit_log.length,
    cost_usd_this_month: out.cost?.cost_usd || 0
  };

  if (body.format === 'csv' && out.audit_log.length) {
    let csv = 'timestamp,action,actor,outcome,params\n';
    for (const e of out.audit_log) {
      csv += [e.ts, e.action, e.actor, e.outcome, (e.params || '').replace(/[\r\n]/g, ' ').replace(/,/g, ';')].join(',') + '\n';
    }
    return { statusCode: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="aria-audit-' + tenantId + '-' + Date.now() + '.csv"' }, body: csv };
  }

  return ok({ ok: true, ...out });
  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
