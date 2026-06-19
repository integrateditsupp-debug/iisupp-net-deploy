// aria-evolution-cron — sends the daily "ARIA evolved" digest to Ahmad.
//
// Ahmad 2026-05-25: digest -> ahmad.wasee@iisupp.net ("inbox you open Monday morning").
// Runs once a day at 12:00 UTC. POSTs aria-evolution-report with the audit secret so it
// composes + SENDS the email (and advances its delta marker). Dormant-safe: if
// RESEND_API_KEY isn't set, the report function just returns the digest without sending.
//
// Cost: $0 (the report function is deterministic, no LLM).

import { beat } from './_heartbeat.mjs';
const ARIA_BASE = process.env.URL || 'https://iisupp.net';

const handler = async () => {
  try {
    const r = await fetch(`${ARIA_BASE}/.netlify/functions/aria-evolution-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-aria-evolve-secret': process.env.ARIA_AUDIT_SECRET || '' },
      body: JSON.stringify({ trigger: 'daily-cron' })
    });
    const payload = await r.json().catch(() => ({}));
    console.log('[aria-evolution-cron]', JSON.stringify({ status: r.status, sent: payload.sent }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, status: r.status, sent: payload.sent }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message || e) }) };
  }
};

// Daily at 12:00 UTC. (Ahmad 2026-06-01) Use config.schedule — the legacy schedule()
// wrapper was not being registered by Netlify on this site.
export default async () => {
  await beat('aria-evolution-cron');
  await handler();
  return new Response('ok', { headers: { 'content-type': 'text/plain' } });
};
export const config = { schedule: '0 12 * * *' };
