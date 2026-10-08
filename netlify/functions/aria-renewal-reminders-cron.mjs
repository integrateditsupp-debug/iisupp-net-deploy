// aria-renewal-reminders-cron — the daily schedule for aria-renewal-reminders.js (2026-10-08, audit #9b).
//
// aria-renewal-reminders.js is an HTTP `exports.handler` with no `config.schedule`, so the renewal scan the
// cron-health monitor and scheduled-tasks audit both list as "daily" never actually ran. A Netlify function
// cannot be both an HTTP endpoint and a scheduled function, so — same pattern as aria-lead-radar-cron.mjs —
// this thin wrapper carries the schedule and calls the exported `runScan()` directly (no HTTP round trip,
// no token needed). It beats the SAME heartbeat name ('aria-renewal-reminders') the monitor already expects.
//
// Schedule: 14:00 UTC daily (09:00/10:00 Toronto) — a customer reads a renewal heads-up in the morning.

import { beat } from './_heartbeat.mjs';
import * as renewal from './aria-renewal-reminders.js';

export default async () => {
  await beat('aria-renewal-reminders');
  const runScan = renewal.runScan || (renewal.default && renewal.default.runScan);
  try {
    const out = await runScan({ dry: false });
    console.log('[aria-renewal-reminders-cron]', JSON.stringify({ ok: out.ok, sent: out.sent_count, skipped: out.skipped_count, failed: out.failed_count, error: out.error || null }));
    return new Response(JSON.stringify(out), { status: out.ok ? 200 : 500, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    console.error('[aria-renewal-reminders-cron]', e && e.message);
    return new Response(JSON.stringify({ ok: false, error: 'renewal cron failed' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
};

export const config = { schedule: '0 14 * * *' };
