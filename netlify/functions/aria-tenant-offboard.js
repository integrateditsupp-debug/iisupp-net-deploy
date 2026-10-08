/**
 * aria-tenant-offboard — handler invoked from aria-stripe-pilot-events when sub.deleted fires
 *  OR called manually via admin token.
 *  Marks tenant as offboarded, schedules data deletion at retention window (default 90d).
 *  Cat 11 — Compliance (SOC 2 P6.1 data subject rights + retention).
 */
const crypto = require('crypto');
const { requireAdminToken, adminGateResponse } = require('./lib/admin-gate.cjs');
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  // Fail-closed, constant-time (audit §7: `body.internal_token === undefined` used to pass when the env was unset).
  const gate = requireAdminToken(event, { envNames: ['INTERNAL_WEBHOOK_SECRET', 'ARIA_ADMIN_TOKEN', 'APERTURE_ADMIN_PASSWORD', 'ADMIN_PASSWORD'], body });
  if (!gate.ok) return adminGateResponse(gate, headers);
  const internal = gate.via === 'INTERNAL_WEBHOOK_SECRET';

  const tenantId = String(body.tenant_id || body.customer_id || body.email || '');
  if (!tenantId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tenant_id required' }) };
  const retentionDays = Math.max(7, Math.min(2555, parseInt(body.retention_days || 90, 10)));

  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: 'blobs unavailable' }) }; }

  const record = {
    tenant_id: tenantId,
    tenant_hash: crypto.createHash('sha256').update(tenantId.toLowerCase()).digest('hex').slice(0, 32),
    offboarded_at: new Date().toISOString(),
    scheduled_delete_at: new Date(Date.now() + retentionDays * 86400000).toISOString(),
    scheduled_delete_ts: Date.now() + retentionDays * 86400000,
    retention_days: retentionDays,
    reason: body.reason || 'subscription_cancelled',
    initiator: internal ? 'system' : 'admin'
  };

  try {
    const store = getStore({ name: 'aria-tenant-offboarded' });
    await store.setJSON('off-' + record.tenant_hash, record);

    // Mark pilot state inactive
    try {
      const pilot = getStore({ name: 'aria-pilot-state' });
      const existing = await pilot.get('pilot-' + tenantId, { type: 'json' });
      if (existing) {
        existing.offboarded = true;
        existing.offboarded_at = record.offboarded_at;
        await pilot.setJSON('pilot-' + tenantId, existing);
      }
    } catch {}
  } catch (e) { return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) }; }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...record }) };
};
