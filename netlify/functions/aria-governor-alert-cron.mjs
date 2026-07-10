// aria-governor-alert-cron — the back-to-back cap-breach alerter (Ahmad, 2026-05-25:
// "beyond [the cap] I need to get an alert in my email back to back 3 mins gaps about
//  increasing limit approval").
//
// Runs every 3 minutes. Does NOTHING unless aria-llm-governor has flagged the monthly
// LLM cap as breached AND Ahmad has not yet acknowledged / raised the limit. While in
// that state, it emails Ahmad once every ~3 minutes until he acknowledges (POST
// action:"ack" or "raise-cap" to aria-llm-governor) or the month rolls over.
//
// Cost: $0 (deterministic; only sends mail when actually breached). Dormant-safe: no
// RESEND_API_KEY -> it just no-ops.

import { getStore } from '@netlify/blobs';

<<<<<<< HEAD
import { beat } from './_heartbeat.mjs';
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
const STORE = 'aria-llm-governor';
const ALERT_KEY = 'cap-alert.json';
const LEDGER_KEY = 'ledger.json';
const MIN_GAP_MS = 165000; // ~2.75 min, so a 3-min cron always re-fires

async function sendCapAlert(spend, limit, count) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'dormant' };
  const from = process.env.RESEND_FROM || 'ARIA <onboarding@resend.dev>';
  const to = process.env.ARIA_LLM_ALERT_TO || process.env.EVOLUTION_REPORT_TO || process.env.SALES_NOTIFY_EMAIL || 'integrateditsupp@gmail.com';
  const text = `ARIA has hit its monthly LLM spend cap and is REFUSING all further LLM calls.\n\n`
    + `Spend this month: $${(spend || 0).toFixed(2)} of $${(limit || 0).toFixed(2)} cap.\n`
    + `This is alert #${count} — you will keep getting one every ~3 minutes until you act.\n\n`
    + `To stop these and re-enable LLM use, in Aperture either ACKNOWLEDGE the alert or APPROVE a higher limit\n`
    + `(POST {action:"raise-cap", newCapUsd:<n>} to aria-llm-governor). The override resets to your plan cap next month.`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: '🔴 ARIA LLM cap reached — approve a higher limit (recurring every 3 min)', text })
    });
    return { sent: r.ok, status: r.status };
  } catch (e) { return { sent: false, reason: e?.message || String(e) }; }
}

const handler = async () => {
  try {
    const store = getStore({ name: STORE, consistency: 'strong' });
    let alert; try { alert = await store.get(ALERT_KEY, { type: 'json' }); } catch { alert = null; }
    if (!alert || !alert.breached || alert.acknowledged) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: false, reason: 'not breached / acknowledged' }) };
    }
    const now = Date.now();
    if (alert.lastAlert && (now - alert.lastAlert) < MIN_GAP_MS) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: false, reason: 'within gap' }) };
    }
    let ledger; try { ledger = await store.get(LEDGER_KEY, { type: 'json' }); } catch { ledger = {}; }
    const base = parseFloat(process.env.ARIA_LLM_MONTHLY_CAP_USD || '10');
    const limit = Math.max(Number.isFinite(base) ? base : 10, (ledger && ledger.capOverrideUsd) || 0);
    const count = (alert.alertCount || 0) + 1;
    const res = await sendCapAlert(ledger && ledger.spendUsd, limit, count);
    try { await store.set(ALERT_KEY, JSON.stringify({ ...alert, lastAlert: now, alertCount: count }), { contentType: 'application/json' }); } catch (_) {}
    return { statusCode: 200, body: JSON.stringify({ ok: true, alertCount: count, email: res }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message || e) }) };
  }
};

// Every 3 minutes. (Ahmad 2026-06-01) Use config.schedule — the legacy schedule()
// wrapper was not registered by Netlify here.
export default async () => {
<<<<<<< HEAD
  await beat('aria-governor-alert-cron');
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
  await handler();
  return new Response('ok', { headers: { 'content-type': 'text/plain' } });
};
export const config = { schedule: '*/3 * * * *' };
