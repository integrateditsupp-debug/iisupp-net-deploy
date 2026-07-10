/**
 * aria-uptime-probe — Scheduled probe of critical endpoints, writes results to Netlify Blobs
 *  Triggered by Netlify scheduled function (every 5 min).
 *  Probes: homepage, /aria, key API endpoints. Tracks last-90-day uptime.
 *
 *  Read results via /.netlify/functions/aria-analytics-dashboard event=uptime
 *
 *  Cat 7 — Performance + uptime.
 */
<<<<<<< HEAD
import { beat } from './_heartbeat.mjs';
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
const ENDPOINTS = [
  { name: 'site',          url: 'https://iisupp.net/',                                              must_return: 200, contain: 'IIS' },
  { name: 'aria',          url: 'https://iisupp.net/aria',                                          must_return: 200, contain: 'ARIA' },
  { name: 'plans',         url: 'https://iisupp.net/plans',                                         must_return: 200 },
  { name: 'status',        url: 'https://iisupp.net/status',                                        must_return: 200 },
  { name: 'health-fn',     url: 'https://iisupp.net/.netlify/functions/health',                     must_return: 200 },
  { name: 'aria-chat-fn',  url: 'https://iisupp.net/.netlify/functions/aria-chat',                  must_return: 405, method: 'GET' }, // expect 405 because POST-only
];

export default async () => {
<<<<<<< HEAD
  await beat('aria-uptime-probe');
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
  const ts = Date.now();
  const results = [];

  for (const ep of ENDPOINTS) {
    const started = Date.now();
    let ok = false, status = 0, ms = 0, err = null, bodySample = '';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(ep.url, { method: ep.method || 'GET', signal: ctrl.signal });
      clearTimeout(t);
      status = r.status;
      ms = Date.now() - started;
      ok = status === ep.must_return;
      if (ok && ep.contain) {
        bodySample = (await r.text()).slice(0, 500);
        if (!bodySample.toLowerCase().includes(ep.contain.toLowerCase())) {
          ok = false;
          err = 'body missing "' + ep.contain + '"';
        }
      }
    } catch (e) {
      err = e.message || 'fetch failed';
      ms = Date.now() - started;
    }
    results.push({ name: ep.name, url: ep.url, ok, status, ms, err, ts });
  }

  const overall = results.every(r => r.ok) ? 'operational' :
                  results.some(r => r.ok)  ? 'degraded' : 'down';

  // Persist
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: 'aria-uptime', consistency: 'eventual' });
    // Today's entry
    const dayKey = new Date(ts).toISOString().slice(0, 10);
    const todayBlob = (await store.get('day-' + dayKey, { type: 'json' })) || { checks: [], up: 0, down: 0 };
    todayBlob.checks.push({ ts, overall, results });
    todayBlob.checks = todayBlob.checks.slice(-300); // cap
    if (overall === 'operational') todayBlob.up++; else todayBlob.down++;
    await store.setJSON('day-' + dayKey, todayBlob);
    // Latest snapshot
    await store.setJSON('latest', { ts, overall, results });
  } catch (e) {
    console.warn('[uptime-probe] blob persist failed:', e.message);
  }

  // Alert if site is DOWN
  if (overall === 'down' && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
          to: [process.env.UPTIME_ALERT_TO || 'ahmad.wasee@iisupp.net'],
          subject: '[ARIA uptime] SITE DOWN — ' + new Date(ts).toISOString(),
          html: '<h2 style="color:#dc2626">All probes failing.</h2><pre>' + JSON.stringify(results, null, 2) + '</pre>'
        })
      });
    } catch (e) { /* silent */ }
  }

  return new Response(JSON.stringify({ ok: true, overall, results }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { schedule: '*/5 * * * *' };
