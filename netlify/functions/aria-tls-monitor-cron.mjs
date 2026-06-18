/**
 * aria-tls-monitor-cron — Daily TLS cert expiration probe for iisupp.net.
 *  Fetches the cert via TLS handshake on port 443 and surfaces:
 *    - days_to_expire
 *    - issuer
 *    - SAN list
 *  Writes snapshot to `aria-tls-snapshots` blob (date-keyed, 30-day retention).
 *  Alerts founder digest if cert <14d.
 *  Cat 11 — Security / cert hygiene.
 *  Schedule: daily 03:00 UTC.
 */
import tls from 'node:tls';
import { getStore } from '@netlify/blobs';

export const config = { schedule: '0 3 * * *' };

const HOSTS = [
  'iisupp.net',
  'www.iisupp.net'
];

export default async () => {
  const results = [];
  for (const host of HOSTS) {
    try {
      const cert = await probe(host);
      results.push({ host, ...cert });
    } catch (e) {
      results.push({ host, error: e.message });
    }
  }

  const snapshot = {
    checked_at: new Date().toISOString(),
    results
  };

  try {
    const store = getStore({ name: 'aria-tls-snapshots' });
    const today = new Date().toISOString().slice(0, 10);
    await store.setJSON('tls-' + today, snapshot);

    // 30-day retention
    const list = await store.list();
    const cutoff = Date.now() - 30 * 86400000;
    for (const b of (list.blobs || [])) {
      const day = b.key.replace('tls-', '');
      if (new Date(day).getTime() < cutoff) await store.delete(b.key);
    }

    // Flag if any cert <14d
    const flagged = results.filter(r => r.days_to_expire != null && r.days_to_expire < 14);
    if (flagged.length > 0) {
      const alertStore = getStore({ name: 'aria-alerts' });
      await alertStore.setJSON('tls-warn-' + today, {
        ts: Date.now(),
        kind: 'tls_expiring_soon',
        details: flagged
      });
    }
  } catch (e) { console.error('aria-tls-monitor blob:', e.message); }

  return new Response(JSON.stringify(snapshot), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

function probe(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert || !cert.valid_to) return reject(new Error('no cert'));
      const expires = new Date(cert.valid_to);
      const days = Math.floor((expires.getTime() - Date.now()) / 86400000);
      resolve({
        valid_from: cert.valid_from,
        valid_to: cert.valid_to,
        days_to_expire: days,
        issuer: cert.issuer?.O || 'unknown',
        subject_alt_name: cert.subjectaltname || null
      });
    });
    socket.on('error', reject);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
  });
}
