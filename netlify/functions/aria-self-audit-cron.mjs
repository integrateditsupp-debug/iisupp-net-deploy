// aria-self-audit-cron — fires the nightly self-audit (Ahmad 2026-06-01).
//
// A Netlify function can't be BOTH an HTTP endpoint and a scheduled function, so this
// thin cron just calls the HTTP aria-self-audit. Runs at 03:30 UTC — right after
// aria-learning-promote (03:00) rebuilds the retrieval index, so the audit grades
// against fresh data. Cost: $0 (deterministic, no LLM).

import { beat } from './_heartbeat.mjs';
const ARIA_BASE = process.env.URL || 'https://iisupp.net';

const handler = async () => {
  try {
    const r = await fetch(`${ARIA_BASE}/.netlify/functions/aria-self-audit?days=3`);
    const payload = await r.json().catch(() => ({}));
    console.log('[aria-self-audit-cron]', JSON.stringify({ status: r.status, successRate: payload.successRate, requeued: payload.requeued, indexed: payload.indexed }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, status: r.status, payload }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message || e) }) };
  }
};

// Nightly at 03:30 UTC (after promote at 03:00). (Ahmad 2026-06-01) Use config.schedule —
// the legacy schedule() wrapper is not registered by Netlify on this site.
export default async () => {
  await beat('aria-self-audit-cron');
  await handler();
  return new Response('ok', { headers: { 'content-type': 'text/plain' } });
};
export const config = { schedule: '30 3 * * *' };
