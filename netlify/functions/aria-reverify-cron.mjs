// aria-reverify-cron — fires the every-2-weeks KB freshness cross-check (Ahmad 2026-05-25).
//
// Netlify cron has no native "every 14 days", so this runs on the 1st and 15th of each
// month (~2-week cadence) and POSTs aria-reverify with the audit secret to re-check the
// bit-KB against the freshness horizon and re-queue stale topics for the agents to
// research again. Cost: $0 (deterministic, no LLM).

<<<<<<< HEAD
import { beat } from './_heartbeat.mjs';
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
const ARIA_BASE = process.env.URL || 'https://iisupp.net';

const handler = async () => {
  try {
    const r = await fetch(`${ARIA_BASE}/.netlify/functions/aria-reverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-aria-reverify-secret': process.env.ARIA_AUDIT_SECRET || '' },
      body: JSON.stringify({ trigger: 'biweekly-cron' })
    });
    const payload = await r.json().catch(() => ({}));
    console.log('[aria-reverify-cron]', JSON.stringify({ status: r.status, scanned: payload.scanned, stale: payload.stale, requeued: payload.requeued }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...payload }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message || e) }) };
  }
};

// 1st and 15th of every month at 03:00 UTC (~every 2 weeks). (Ahmad 2026-06-01) Use
// config.schedule — the legacy schedule() wrapper was not registered by Netlify here.
export default async () => {
<<<<<<< HEAD
  await beat('aria-reverify-cron');
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
  await handler();
  return new Response('ok', { headers: { 'content-type': 'text/plain' } });
};
export const config = { schedule: '0 3 1,15 * *' };
