// aria-learning-cron — scheduled function that fires the learning loop autonomously
//
// Runs every 15 minutes ("continuous" on serverless, Ahmad 2026-05-25). Each fire = 4
// cycles -> ~96 ticks/day -> ~384 exchanges/day. Storage well within free tier.
//
// Per Ahmad 2026-05-14 PM: "make ARIA into a way that it learns on its own without me
// thinking for it on how it can learn." 2026-05-25: tightened from 6h to 15m so the
// loop feels continuous and the live spider-web stays alive.
//
// NEVER calls an LLM directly. Cost: $0. The loop only hits the existing
// aria-research function (which is itself $0 — curated lookup + free vendor fetch).
// Any LLM-grade reasoning must instead route through aria-llm-governor (capped at
// ARIA_LLM_MONTHLY_CAP_USD, one-shot, SLA-gated).
//
// Schedule: every 15 minutes.

import { schedule } from '@netlify/functions';

const ARIA_BASE = process.env.URL || 'https://iisupp.net';

const handler = async () => {
  const start = Date.now();
  let payload;
  try {
    const r = await fetch(`${ARIA_BASE}/.netlify/functions/aria-learning-loop?cycles=4`);
    payload = await r.json();
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(e && e.message || e) })
    };
  }
  const elapsed = Date.now() - start;
  // Print to function logs so Aperture can pick it up
  console.log('[aria-learning-cron] cycle complete', JSON.stringify({ elapsedMs: elapsed, ...payload }));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, elapsedMs: elapsed, payload })
  };
};

// Cron format: minute hour day month dow
// Every 15 minutes: */15 * * * *
export default schedule('*/15 * * * *', handler);
