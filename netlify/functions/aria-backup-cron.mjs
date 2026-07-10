/**
 * aria-backup-cron — Weekly backup of Netlify Blobs to a secondary backup-blob store
 *  Runs Sundays 02 UTC. Snapshots: aria-leads, aria-feedback, aria-tenant-audit,
 *  aria-cost-tracker, aria-session-memory, aria-write-gate, aria-pilot-state,
 *  aria-cross-device, aria-uptime, aria-analytics, aria-kb-gap-stubs.
 *  
 *  Backup blob keyed by YYYY-MM-DD per source store. 12-week retention; older auto-deleted.
 *  Cat 13 — Failure modes + DR.
 */
<<<<<<< HEAD
import { beat } from './_heartbeat.mjs';
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
const SOURCE_STORES = [
  'aria-leads', 'aria-feedback', 'aria-tenant-audit', 'aria-cost-tracker',
  'aria-session-memory', 'aria-write-gate', 'aria-pilot-state',
  'aria-cross-device', 'aria-uptime', 'aria-analytics', 'aria-kb-gap-stubs',
  'aria-cost-attribution', 'aria-white-label', 'aria-translations', 'aria-winback-state'
];
const RETENTION_WEEKS = 12;

export default async () => {
<<<<<<< HEAD
  await beat('aria-backup-cron');
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
  const out = { ran_at: new Date().toISOString(), backups: {}, errors: [], purged: 0 };
  let getStore;
  try {
    ({ getStore } = await import('@netlify/blobs'));
  } catch (e) {
    out.error = 'blobs unavailable';
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
  }

  const backupStore = getStore({ name: 'aria-backup-store', consistency: 'strong' });
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - RETENTION_WEEKS * 7 * 86400000).toISOString().slice(0, 10);

  for (const storeName of SOURCE_STORES) {
    try {
      const src = getStore({ name: storeName, consistency: 'eventual' });
      const list = await src.list();
      const snapshot = { snapshotted_at: Date.now(), source: storeName, count: 0, data: {} };
      for (const item of (list.blobs || []).slice(0, 500)) {
        try {
          const val = await src.get(item.key, { type: 'json' });
          if (val !== null && val !== undefined) {
            snapshot.data[item.key] = val;
            snapshot.count++;
          }
        } catch {}
      }
      const backupKey = 'snapshot-' + storeName + '-' + today;
      await backupStore.setJSON(backupKey, snapshot);
      out.backups[storeName] = snapshot.count;
    } catch (e) {
      out.errors.push({ store: storeName, err: e.message });
    }
  }

  // Purge backups older than retention
  try {
    const all = await backupStore.list();
    for (const item of (all.blobs || [])) {
      const match = item.key.match(/snapshot-.+-(\d{4}-\d{2}-\d{2})$/);
      if (match && match[1] < weekAgo) {
        try { await backupStore.delete(item.key); out.purged++; } catch {}
      }
    }
  } catch {}

  // Notify Ahmad
  if (process.env.RESEND_API_KEY) {
    try {
      const total = Object.values(out.backups).reduce((a, b) => a + b, 0);
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
          to: [process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net'],
          subject: '[IIS] Weekly backup: ' + total + ' entries across ' + Object.keys(out.backups).length + ' stores',
          html: '<pre>' + JSON.stringify(out, null, 2) + '</pre>'
        })
      });
    } catch {}
  }

  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
};
export const config = { schedule: '0 2 * * 0' }; // Sundays 02 UTC
