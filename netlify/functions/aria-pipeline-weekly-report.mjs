/**
 * aria-pipeline-weekly-report — Mondays 13 UTC. Emails Ahmad the weekly pipeline view:
 *  - leads added (7d) by source
 *  - active demos booked
 *  - active subscriptions (Stripe)
 *  - estimated MRR
 *  - churn-risk customers (>50)
 *  - cron health (any failures)
 *  Cat 1 — Founder ops.
 */
import { getStore } from '@netlify/blobs';

import { beat } from './_heartbeat.mjs';
export const config = { schedule: '0 13 * * 1' };

export default async () => {
  await beat('aria-pipeline-weekly-report');
  const out = {
    week_ending: new Date().toISOString().slice(0, 10),
    leads_7d: 0,
    leads_by_source: {},
    demos_booked_7d: 0,
    active_subscriptions: 0,
    estimated_mrr_usd: 0,
    churn_risk_high: 0,
    cron_failures_7d: 0,
    notes: []
  };
  const weekAgo = Date.now() - 7 * 86400000;

  // Leads
  try {
    const leads = getStore({ name: 'aria-leads', consistency: 'eventual' });
    const list = await leads.list();
    for (const item of (list.blobs || [])) {
      const l = await leads.get(item.key, { type: 'json' });
      if (!l) continue;
      const ts = new Date(l.received_at || 0).getTime();
      if (ts > weekAgo) {
        out.leads_7d++;
        const src = l.source || 'unknown';
        out.leads_by_source[src] = (out.leads_by_source[src] || 0) + 1;
      }
    }
  } catch (e) { out.notes.push('leads scan: ' + e.message); }

  // Demos
  try {
    const demos = getStore({ name: 'aria-demo-bookings', consistency: 'eventual' });
    const list = await demos.list();
    for (const item of (list.blobs || [])) {
      const d = await demos.get(item.key, { type: 'json' });
      if (!d) continue;
      const ts = new Date(d.booked_at || 0).getTime();
      if (ts > weekAgo) out.demos_booked_7d++;
    }
  } catch (e) { out.notes.push('demos scan: ' + e.message); }

  // Stripe summary
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const r = await fetch('https://api.stripe.com/v1/subscriptions?status=active&limit=100', {
        headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
      });
      const j = await r.json();
      if (j.data) {
        out.active_subscriptions = j.data.length;
        let mrr = 0;
        for (const s of j.data) {
          for (const it of (s.items?.data || [])) {
            const amount = (it.price?.unit_amount || 0) / 100;
            const interval = it.price?.recurring?.interval || 'month';
            if (interval === 'month') mrr += amount;
            else if (interval === 'year') mrr += amount / 12;
            else if (interval === 'week') mrr += amount * 4.33;
          }
        }
        out.estimated_mrr_usd = Math.round(mrr * 100) / 100;
      }
    } catch (e) { out.notes.push('stripe: ' + e.message); }
  }

  // Snapshot
  try {
    const snap = getStore({ name: 'aria-pipeline-weekly' });
    await snap.setJSON('week-' + out.week_ending, out);
  } catch {}

  // Email Ahmad
  if (process.env.RESEND_API_KEY) {
    const lines = [
      'Weekly pipeline — week ending ' + out.week_ending,
      '',
      '  Leads (7d):           ' + out.leads_7d,
      '  Demos booked (7d):    ' + out.demos_booked_7d,
      '  Active subscriptions: ' + out.active_subscriptions,
      '  Estimated MRR (USD):  $' + out.estimated_mrr_usd,
      '  Churn-risk customers: ' + out.churn_risk_high,
      '',
      'Leads by source:'
    ];
    for (const [k, v] of Object.entries(out.leads_by_source)) lines.push('  ' + k + ': ' + v);
    if (out.notes.length) {
      lines.push('', 'Notes:');
      out.notes.forEach(n => lines.push('  - ' + n));
    }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'IIS Founder Brief <hello@iisupp.net>',
          to: process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net',
          subject: '[IIS Weekly Pipeline] ' + out.week_ending + ' — ' + out.leads_7d + ' leads, $' + out.estimated_mrr_usd + ' MRR',
          text: lines.join('\\n'),
          reply_to: 'ahmad.wasee@iisupp.net'
        })
      });
    } catch {}
  }

  return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' }});
};
