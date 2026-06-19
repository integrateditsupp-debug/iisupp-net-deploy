// aria-lead-radar-cron — daily validation ping of the Lead Radar HTTP endpoint (Ahmad 2026-05-29).
//
// The live value is the always-fresh HTTP endpoint/page in aria-lead-radar.mjs. A Netlify
// function cannot be BOTH an HTTP endpoint and a scheduled function, so this thin cron just
// fetches the endpoint once a day to confirm the CanadaBuys feed still parses and to surface
// breakage in logs. Cost: $0 (deterministic, no LLM).

import { beat } from './_heartbeat.mjs';
const ARIA_BASE = process.env.URL || 'https://iisupp.net';

const handler = async () => {
  try {
    const r = await fetch(`${ARIA_BASE}/.netlify/functions/aria-lead-radar`, {
      headers: { 'user-agent': 'IIS-LeadRadar-Cron/1.0' },
    });
    const payload = await r.json().catch(() => ({}));
    console.log('[aria-lead-radar-cron]', JSON.stringify({ status: r.status, count: payload.count, hot: payload.hot, scanned: payload.scanned, error: payload.error || null }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, status: r.status, count: payload.count }) };
  } catch (e) {
    console.error('[aria-lead-radar-cron]', e && e.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String((e && e.message) || e) }) };
  }
};

// Once a day at 06:00 UTC. (Ahmad 2026-06-01) Use config.schedule — the legacy
// schedule() wrapper was not registered by Netlify here.
export default async () => {
  await beat('aria-lead-radar-cron');
  await handler();
  return new Response('ok', { headers: { 'content-type': 'text/plain' } });
};
export const config = { schedule: '0 6 * * *' };
