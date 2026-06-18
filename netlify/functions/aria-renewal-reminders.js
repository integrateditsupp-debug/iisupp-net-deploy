/**
 * aria-renewal-reminders — Cat 22 proactive event-driven.
 *  POST { event: 'scan', dry_run?: true } -> finds active subs renewing within
 *  7d/3d/1d and sends one reminder per milestone.
 *
 *  Use case: trigger via a daily scheduled task. Industry benchmark: pre-renewal
 *  email reduces involuntary churn 10-20%.
 *
 *  Dedup: stamps Stripe customer metadata { renewal_reminder_NNd_sent_at } so
 *  each customer gets at most one reminder per milestone per cycle.
 */
const Stripe = require('stripe');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const dry = !!body.dry_run;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }) };
  const stripe = Stripe(stripeKey);

  const now = Math.floor(Date.now() / 1000);
  const windows = [
    { days: 7, key: 'renewal_reminder_7d_sent_at',  label: '7 days' },
    { days: 3, key: 'renewal_reminder_3d_sent_at',  label: '3 days' },
    { days: 1, key: 'renewal_reminder_1d_sent_at',  label: '1 day' }
  ];

  const sent = [];
  const skipped = [];

  try {
    let starting_after = undefined;
    do {
      const page = await stripe.subscriptions.list({ status: 'active', limit: 100, ...(starting_after ? { starting_after } : {}) });
      for (const sub of page.data) {
        const renewAt = sub.current_period_end;
        if (!renewAt) continue;
        const days_remaining = Math.round((renewAt - now) / 86400);
        for (const w of windows) {
          if (days_remaining !== w.days) continue;
          const customer = await stripe.customers.retrieve(sub.customer);
          if (!customer || !customer.email) { skipped.push({ sub: sub.id, reason: 'no email' }); continue; }
          // Dedup: check metadata for last-sent marker — must be older than 14 days
          const lastSent = customer.metadata && customer.metadata[w.key];
          if (lastSent) {
            const ageDays = (Date.now() - new Date(lastSent).getTime()) / 86400000;
            if (ageDays < 14) { skipped.push({ sub: sub.id, reason: 'already sent ' + w.label + ' reminder' }); continue; }
          }
          // Compute amount
          const item = sub.items.data[0];
          const amt = ((item && item.price && item.price.unit_amount) || 0) / 100;
          const currency = ((item && item.price && item.price.currency) || 'usd').toUpperCase();
          const renewDate = new Date(renewAt * 1000).toDateString();
          const firstName = (customer.name || customer.email.split('@')[0]).split(' ')[0];

          const subject = 'Your ARIA subscription renews in ' + w.label;
          const html = `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,sans-serif;color:#222;line-height:1.6;padding:24px;background:#fff"><div style="border-top:3px solid #c5a059;padding-top:18px"><h2 style="margin:0 0 14px;color:#0b1f3a;font-family:Cinzel,serif">Renewal heads-up</h2><p style="margin:0 0 14px">Hi ${esc(firstName)},</p><p style="margin:0 0 14px">Your ARIA subscription will auto-renew on <strong>${esc(renewDate)}</strong> for <strong>$${amt.toFixed(2)} ${esc(currency)}</strong>.</p><p style="margin:0 0 14px">No action needed — service continues uninterrupted. If you want to upgrade, downgrade, or update your card, just reply to this email or use the billing portal.</p><table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px"><tr><td style="padding:6px 0;color:#999;width:120px">Renews</td><td style="padding:6px 0"><strong>${esc(renewDate)}</strong></td></tr><tr><td style="padding:6px 0;color:#999">Amount</td><td style="padding:6px 0"><strong>$${amt.toFixed(2)} ${esc(currency)}</strong></td></tr></table><p style="margin:14px 0 0;color:#666;font-size:12px;border-top:1px solid #eee;padding-top:12px">Integrated IT Support · ahmad.wasee@iisupp.net · (647) 581-3182</p></div></div>`;

          if (dry) {
            sent.push({ to: customer.email, days: w.days, dry: true });
          } else {
            await sendResend(customer.email, subject, html);
            await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, [w.key]: new Date().toISOString() } });
            sent.push({ to: customer.email, days: w.days });
          }
        }
      }
      starting_after = page.has_more ? page.data[page.data.length - 1].id : null;
    } while (starting_after);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, scanned_at: new Date().toISOString(), sent_count: sent.length, sent, skipped_count: skipped.length, dry_run: dry }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
async function sendResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Integrated IT Support <noreply@iisupp.net>';
  if (!key) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, html }) });
    if (r.ok) return true;
    if (r.status === 403) { await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Integrated IT Support <onboarding@resend.dev>', to: [to], subject, html }) }); return true; }
    return false;
  } catch { return false; }
}
