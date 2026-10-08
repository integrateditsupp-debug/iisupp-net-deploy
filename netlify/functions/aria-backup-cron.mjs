/**
 * aria-backup-cron — Weekly backup of Netlify Blobs to a secondary backup-blob store
 *  Runs Sundays 02 UTC. Snapshots: aria-leads, aria-feedback, aria-tenant-audit,
 *  aria-cost-tracker, aria-session-memory, aria-write-gate, aria-pilot-state,
 *  aria-cross-device, aria-uptime, aria-analytics, aria-kb-gap-stubs.
 *  
 *  Backup blob keyed by YYYY-MM-DD per source store. 12-week retention; older auto-deleted.
 *  Cat 13 — Failure modes + DR.
 *
 *  2026-10-08 (audit top-10 #10): a person who exercised their right to erasure must not resurface in
 *  the next snapshot. lib/user-data.mjs writes a tombstone per purge (aria-deletion-log store); every key
 *  that matches a tombstone (purged key list, hashed-email key, sanitized-email key) is skipped here and
 *  counted in `skipped_tombstoned`. Notification goes through lib/notify.mjs (honest result in the log).
 */
import { beat } from './_heartbeat.mjs';
import { loadTombstones, isTombstonedKey } from './lib/user-data.mjs';
import { sendEmail } from './lib/notify.mjs';
import contacts from './lib/contacts.cjs';
const SOURCE_STORES = [
  'aria-leads', 'aria-feedback', 'aria-tenant-audit', 'aria-cost-tracker',
  'aria-session-memory', 'aria-write-gate', 'aria-pilot-state',
  'aria-cross-device', 'aria-uptime', 'aria-analytics', 'aria-kb-gap-stubs',
  'aria-cost-attribution', 'aria-white-label', 'aria-translations', 'aria-winback-state'
];
const RETENTION_WEEKS = 12;

export default async () => {
  await beat('aria-backup-cron');
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

  // Erasure tombstones — keys belonging to purged people are never re-snapshotted.
  const tombstones = await loadTombstones({ getStore });
  out.tombstones = tombstones.length;
  out.skipped_tombstoned = 0;

  for (const storeName of SOURCE_STORES) {
    try {
      const src = getStore({ name: storeName, consistency: 'eventual' });
      const list = await src.list();
      const snapshot = { snapshotted_at: Date.now(), source: storeName, count: 0, data: {} };
      for (const item of (list.blobs || []).slice(0, 500)) {
        if (isTombstonedKey(item.key, tombstones, storeName)) { out.skipped_tombstoned++; continue; }
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

  // Notify Ahmad (honest: the log says whether the digest actually went out)
  try {
    const total = Object.values(out.backups).reduce((a, b) => a + b, 0);
    const r = await sendEmail({
      to: process.env.FOUNDER_EMAIL || contacts.OWNER_EMAIL,
      from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
      subject: '[IIS] Weekly backup: ' + total + ' entries across ' + Object.keys(out.backups).length + ' stores',
      html: '<pre>' + JSON.stringify(out, null, 2).replace(/</g, '&lt;') + '</pre>',
      tag: 'backup-digest'
    });
    out.digest_email = r.ok ? 'sent' : (r.dormant ? 'dormant' : 'failed');
  } catch (e) { out.digest_email = 'failed'; }

  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
};
export const config = { schedule: '0 2 * * 0' }; // Sundays 02 UTC
