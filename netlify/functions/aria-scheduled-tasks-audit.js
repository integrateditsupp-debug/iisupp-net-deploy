/**
 * aria-scheduled-tasks-audit — List all scheduled cron functions + their last-run status
 *  POST { admin_token } -> [{ fn_name, schedule, last_ran_at, last_status, next_due }]
 *  Cat 13 — Failure modes (visibility into cron health).
 */
const fs = require('fs');
const path = require('path');

// 2026-10-09: this list MUST equal the real `export const config = { schedule }` of every *.mjs function —
// tests/scheduled-tasks-audit-matches-config.test.mjs fails the build if it drifts (it had drifted on 12 rows).
const SCHEDULED = [
  { fn: 'aria-backup-cron', schedule: '0 2 * * 0', purpose: 'weekly Sunday backup' },
  { fn: 'aria-cron-health-monitor', schedule: '0 2 * * *', purpose: 'cron heartbeat check' },
  { fn: 'aria-engagement-cron', schedule: '0 10 * * *', purpose: 'd1/d3/d7/d30/d90 drip' },
  { fn: 'aria-evolution-cron', schedule: '0 12 * * *', purpose: 'self-learning loop' },
  { fn: 'aria-founder-digest', schedule: '0 12 * * *', purpose: 'founder digest' },
  { fn: 'aria-gap-detector-cron', schedule: '0 6 * * *', purpose: 'KB-gap clustering' },
  { fn: 'aria-governor-alert-cron', schedule: '*/3 * * * *', purpose: 'LLM cost governor (emails only on breach)' },
  { fn: 'aria-lead-radar-cron', schedule: '0 6 * * *', purpose: 'gov tender hunt' },
  { fn: 'aria-learning-cron', schedule: '*/15 * * * *', purpose: 'KB autonomous improvement' },
  { fn: 'aria-pipeline-weekly-report', schedule: '0 13 * * 1', purpose: 'weekly pipeline report' },
  { fn: 'aria-renewal-reminders-cron', schedule: '0 14 * * *', purpose: 'subscription renewal scan' },
  { fn: 'aria-retention-sweep-cron', schedule: '0 4 * * *', purpose: 'data retention sweep' },
  { fn: 'aria-reverify-cron', schedule: '0 3 1,15 * *', purpose: 'KB verification' },
  { fn: 'aria-self-audit-cron', schedule: '30 3 * * *', purpose: 'platform self-audit' },
  { fn: 'aria-self-eval-cron', schedule: '0 */6 * * *', purpose: 'ARIA scenario regression eval' },
  { fn: 'aria-signup-health-cron', schedule: '0 14 * * *', purpose: 'signup funnel health' },
  { fn: 'aria-sla-monitor-cron', schedule: '*/30 * * * *', purpose: 'SLA monitor' },
  { fn: 'aria-tls-monitor-cron', schedule: '0 3 * * *', purpose: 'TLS expiry monitor' },
  { fn: 'aria-uptime-probe', schedule: '*/5 * * * *', purpose: 'uptime probe' },
  { fn: 'aria-winback-cron', schedule: '0 11 * * *', purpose: 'churned user re-engagement' },
  { fn: 'bid-radar-cron', schedule: '0 11 * * 1-5', purpose: 'bid radar (weekdays)' },
  { fn: 'ca-purge-cron', schedule: '*/5 * * * *', purpose: 'cache purge' },
  { fn: 'forums-concierge-cron', schedule: '*/30 * * * *', purpose: 'forums concierge' },
  { fn: 'senior-director-digest-cron', schedule: '0 13 * * *', purpose: 'CEO daily digest' }
];

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!expected || body.admin_token !== expected) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      count: SCHEDULED.length,
      tasks: SCHEDULED.map(t => ({
        ...t,
        schedule_human: cronToHuman(t.schedule)
      })),
      note: 'Last-run status requires Netlify Functions deploy logs. Cron-state blob not currently maintained per-task.'
    })
  };
};

function cronToHuman(cron) {
  const map = {
    '*/5 * * * *': 'every 5 min',
    '0 */4 * * *': 'every 4 hours',
    '0 */6 * * *': 'every 6 hours',
    '0 */12 * * *': 'every 12 hours',
    '0 2 * * 0': 'Sundays 02 UTC',
    '0 6 * * *': 'daily 06 UTC (~1am ET)',
    '0 8 * * *': 'daily 08 UTC (~3am ET)',
    '0 9 * * *': 'daily 09 UTC (~4am ET)',
    '0 10 * * *': 'daily 10 UTC (~5am ET)',
    '0 11 * * *': 'daily 11 UTC (~6am ET)',
    '0 12 * * *': 'daily 12 UTC (~7am ET)'
  };
  return map[cron] || cron;
}
