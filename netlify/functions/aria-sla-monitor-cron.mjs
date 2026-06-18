/**
 * aria-sla-monitor-cron — Every 30 min, check open tickets vs tier SLA
 *  Tiers: Enterprise <30min, Mid-size <1h, SMB <4h, Personal NBD
 *  Reads aria-tenant-audit for open issues w/o resolution; if past SLA → alert Ahmad
 *  Cat 13 — Failure modes (SLA compliance).
 */
const SLA = {
  enterprise: 30,
  midsize: 60,
  smb: 240,
  personal: 1440 // 24h
};

export default async () => {
  const out = { ran_at: new Date().toISOString(), tickets_checked: 0, breached: [], alerts_sent: 0 };
  let store;
  try { ({ getStore } = await import('@netlify/blobs')); store = (await import('@netlify/blobs')).getStore({ name: 'aria-tenant-audit', consistency: 'eventual' }); }
  catch { return new Response(JSON.stringify({ ...out, error: 'blobs unavailable' }), { headers: { 'Content-Type': 'application/json' } }); }

  const now = Date.now();
  try {
    const all = await store.list();
    for (const item of (all.blobs || [])) {
      if (!item.key.startsWith('audit-')) continue;
      const log = await store.get(item.key, { type: 'json' });
      if (!Array.isArray(log)) continue;
      // Group by ticket open events; pair w/ subsequent resolve/escalation
      const opens = log.filter(e => /open|created|warm_handoff/i.test(e.action || ''));
      const resolves = log.filter(e => /resolv|closed|escalated/i.test(e.outcome || '') || /resolved|closed/i.test(e.action || ''));
      for (const o of opens) {
        out.tickets_checked++;
        const ts = o.ts || 0;
        if (resolves.some(r => Math.abs((r.ts || 0) - ts) < 86400000)) continue; // resolved
        const ageMin = (now - ts) / 60000;
        // We don't know tenant tier from audit log alone; use SMB default
        if (ageMin > SLA.smb) {
          out.breached.push({ tenant_hash: item.key.replace(/^audit-/, ''), action: o.action, age_min: Math.round(ageMin) });
        }
      }
    }
  } catch (e) { out.list_err = e.message; }

  if (out.breached.length > 0 && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
          to: [process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net'],
          subject: '[IIS SLA] ' + out.breached.length + ' tickets past SLA',
          html: '<p>SLA breach detected on ' + out.breached.length + ' tickets:</p><pre>' + JSON.stringify(out.breached, null, 2) + '</pre>'
        })
      });
      out.alerts_sent = 1;
    } catch {}
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
};
export const config = { schedule: '*/30 * * * *' };
