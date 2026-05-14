// aria-learning-cron — scheduled function that fires the learning loop autonomously
//
// Runs every 6 hours. Each fire = 10 cycles. ~40 bits/day. ~14,000 bits/year.
// Storage: ~3.5 MB/year in aria-learning-sessions blob. Well within free tier.
//
// Per Ahmad 2026-05-14 PM: "make ARIA into a way that it learns on its own without me
// thinking for it on how it can learn."
//
// NEVER calls an LLM directly. Cost: $0. The loop only hits the existing
// aria-research function (which is itself $0 — curated lookup + free vendor fetch).
//
// Schedule: every 6 hours starting at 02:00 UTC (low-traffic window)

import { schedule } from '@netlify/functions';

const ARIA_BASE = process.env.URL || 'https://iisupp.net';

const handler = async () => {
  const start = Date.now();
  let payload;
  try {
    const r = await fetch(`${ARIA_BASE}/.netlify/functions/aria-learning-loop?cycles=10`);
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
// Every 6 hours: 0 */6 * * *
export default schedule('0 */6 * * *', handler);
