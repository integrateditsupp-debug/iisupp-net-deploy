/**
 * aria-signup-health-cron — Daily 14 UTC scan: any tenant that signed up but never activated within 48h?
 *  Reads aria-pilot-state, finds tenants where started_at > 48h ago AND activated == false.
 *  Sends Ahmad an "intervention needed" email per stale tenant.
 *  Cat 15 — Lifecycle activation.
 */
<<<<<<< HEAD
import { beat } from './_heartbeat.mjs';
const STALE_THRESHOLD_HOURS = 48;

export default async () => {
  await beat('aria-signup-health-cron');
=======
const STALE_THRESHOLD_HOURS = 48;

export default async () => {
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
  const out = { ran_at: new Date().toISOString(), checked: 0, stale: [], notified: 0 };
  let store;
  try { ({ getStore } = await import('@netlify/blobs')); store = (await import('@netlify/blobs')).getStore({ name: 'aria-pilot-state', consistency: 'eventual' }); }
  catch { return new Response(JSON.stringify({ ...out, error: 'blobs unavailable' }), { headers: { 'Content-Type': 'application/json' } }); }

  const cutoff = Date.now() - STALE_THRESHOLD_HOURS * 3600 * 1000;
  try {
    const list = await store.list();
    for (const item of (list.blobs || [])) {
      out.checked++;
      const pilot = await store.get(item.key, { type: 'json' });
      if (!pilot) continue;
      if ((pilot.started_at || 0) > cutoff) continue; // too fresh
      if (pilot.activated) continue;
      if (pilot.intervention_sent) continue;
      out.stale.push({ email: pilot.email, started: new Date(pilot.started_at).toISOString() });

      if (process.env.RESEND_API_KEY) {
        const html = '<p>Tenant <strong>' + pilot.email + '</strong> signed up ' + Math.round((Date.now() - pilot.started_at) / 3600000) + 'h ago but has not activated (no first invoice paid yet).</p><p>Suggested action: personal check-in email within 24h.</p>';
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
              to: [process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net'],
              subject: '[IIS] Stale signup intervention needed: ' + pilot.email,
              html
            })
          });
          pilot.intervention_sent = true;
          pilot.intervention_sent_at = Date.now();
          await store.setJSON(item.key, pilot);
          out.notified++;
        } catch {}
      }
    }
  } catch (e) { out.list_err = e.message; }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
};
export const config = { schedule: '0 14 * * *' };
