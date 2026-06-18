/**
 * aria-cron-health-monitor — daily 02 UTC. Reads aria-cron-heartbeats and detects stale crons.
 *  Each cron should call ?heartbeat=<name> on run (lightweight wrapper).
 *  This checks: any heartbeat older than expected interval → alert.
 *  Cat 11 — Observability.
 */
import { getStore } from '@netlify/blobs';

export const config = { schedule: '0 2 * * *' };

// Expected max age per cron (hours)
const EXPECTED_MAX_AGE_HOURS = {
  'aria-uptime-probe': 0.25,             // 15min
  'aria-sla-monitor-cron': 1,
  'aria-learning-cron': 5,
  'aria-evolution-cron': 7,
  'aria-reverify-cron': 7,
  'aria-self-eval-cron': 7,
  'aria-self-audit-cron': 13,
  'aria-tls-monitor-cron': 25,
  'aria-gap-detector-cron': 25,
  'senior-director-digest-cron': 25,
  'aria-lead-radar-cron': 25,
  'aria-governor-alert-cron': 25,
  'aria-renewal-reminders': 25,
  'aria-engagement-cron': 25,
  'aria-winback-cron': 25,
  'aria-founder-digest': 25,
  'aria-signup-health-cron': 25,
  'aria-backup-cron': 7 * 24 + 1,
  'aria-pipeline-weekly-report': 7 * 24 + 1
};

export default async () => {
  const out = { checked_at: new Date().toISOString(), stale_crons: [], healthy: [] };
  try {
    const store = getStore({ name: 'aria-cron-heartbeats', consistency: 'eventual' });
    const list = await store.list();
    const seen = new Set();
    for (const item of (list.blobs || [])) {
      const hb = await store.get(item.key, { type: 'json' });
      if (!hb || !hb.cron_name) continue;
      seen.add(hb.cron_name);
      const ageHours = (Date.now() - (hb.last_run || 0)) / 3600000;
      const expected = EXPECTED_MAX_AGE_HOURS[hb.cron_name] || 25;
      if (ageHours > expected * 1.5) {
        out.stale_crons.push({ cron: hb.cron_name, last_run_hours_ago: Math.round(ageHours), expected_max: expected });
      } else {
        out.healthy.push({ cron: hb.cron_name, last_run_hours_ago: Math.round(ageHours * 10) / 10 });
      }
    }

    // Crons we expect but never heartbeated
    for (const expected of Object.keys(EXPECTED_MAX_AGE_HOURS)) {
      if (!seen.has(expected)) {
        out.stale_crons.push({ cron: expected, last_run_hours_ago: 'never', expected_max: EXPECTED_MAX_AGE_HOURS[expected] });
      }
    }
  } catch (e) { out.error = e.message; }

  // Alert via founder email if stale
  if (out.stale_crons.length > 0 && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'IIS Alert <hello@iisupp.net>',
          to: process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net',
          subject: '[IIS] ' + out.stale_crons.length + ' cron(s) appear stale',
          text: 'Stale crons detected:\\n\\n' + out.stale_crons.map(c => '  - ' + c.cron + ' (last: ' + c.last_run_hours_ago + 'h ago, expected max: ' + c.expected_max + 'h)').join('\\n')
        })
      });
    } catch {}
  }

  return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' }});
};
