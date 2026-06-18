/**
 * aria-retention-sweep-cron — daily 04 UTC. Reads aria-tenant-offboarded.
 *  Any tenant past scheduled_delete_at: actually purges audit logs + pilot state + cached blobs.
 *  Logs the deletion event for SOC 2 evidence.
 *  Cat 11 — Compliance retention.
 */
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { beat } from './_heartbeat.mjs';

export const config = { schedule: '0 4 * * *' };

const STORES_TO_PURGE = [
  'aria-tenant-audit',
  'aria-tenant-state',
  'aria-pilot-state',
  'aria-welcome-ab-log'
];

export default async () => {
  await beat('aria-retention-sweep-cron');
  const now = Date.now();
  const purged = [];
  const errors = [];

  try {
    const offStore = getStore({ name: 'aria-tenant-offboarded' });
    const list = await offStore.list();
    for (const item of (list.blobs || [])) {
      const rec = await offStore.get(item.key, { type: 'json' });
      if (!rec || !rec.scheduled_delete_ts) continue;
      if (rec.scheduled_delete_ts > now) continue;
      // Past retention — purge
      const th = rec.tenant_hash || crypto.createHash('sha256').update((rec.tenant_id || '').toLowerCase()).digest('hex').slice(0, 32);
      const tenantId = rec.tenant_id || '';
      let purgedCount = 0;
      for (const storeName of STORES_TO_PURGE) {
        try {
          const s = getStore({ name: storeName });
          // Try common key patterns
          for (const key of ['audit-' + th, th, 'pilot-' + tenantId, tenantId]) {
            const exists = await s.get(key);
            if (exists != null) { await s.delete(key); purgedCount++; }
          }
        } catch (e) { errors.push(storeName + ':' + e.message); }
      }
      // Record evidence
      try {
        const ev = getStore({ name: 'aria-deletion-log' });
        await ev.setJSON('del-' + th + '-' + now, {
          ts: now, tenant_hash: th, retention_days: rec.retention_days, keys_purged: purgedCount, ran_at: new Date().toISOString()
        });
      } catch {}
      // Remove the offboarded marker
      await offStore.delete(item.key);
      purged.push({ tenant_hash: th, keys_purged: purgedCount });
    }
  } catch (e) { errors.push('top-level:' + e.message); }

  return new Response(JSON.stringify({ ok: true, purged, errors }), { status: 200, headers: { 'Content-Type': 'application/json' }});
};
