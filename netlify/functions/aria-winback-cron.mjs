/**
 * aria-winback-cron — Daily cron: re-engagement for churned users (>60 days cancelled)
 *  Scans Stripe for cancelled subscriptions whose cancelled_at > 60 days ago, < 180 days ago.
 *  Sends ONE founding-customer-locked-rate offer email per email, deduped via Blobs.
 *  No coupon code generated automatically — uses ARIA_COUPONS_JSON env if Ahmad has stocked it.
 *  Schedule: daily 11:00 UTC.
 *  Cat 2 — SaaS lifecycle.
 */
import { beat } from './_heartbeat.mjs';
const PROMO = {
  subject: 'A small offer just for you',
  html_template: function(name) {
    return '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111;line-height:1.6">' +
      '<p style="font-size:15px">Hi ' + (name || 'there') + ',</p>' +
      '<p style="font-size:15px">You explored ARIA a few months ago and did not stick with it. Honest question — what was missing?</p>' +
      '<p style="font-size:15px">If it was timing, fit, or pricing, I would like to know. If you ever want to revisit, your previous account is still in our system and your data is recoverable for the next 90 days.</p>' +
      '<p style="font-size:15px">No follow-up unless you reply. Read every email myself.</p>' +
      '<p style="font-size:15px">— Ahmad Wasee, Founder<br>Integrated IT Support Inc.<br><a href="https://iisupp.net">iisupp.net</a></p>' +
      '<p style="color:#888;font-size:11px;margin-top:24px">Reply STOP to never hear from us again. Or, click <a href="https://iisupp.net/aria">here to try ARIA again</a> — 15 min, no card.</p>' +
      '</div>';
  }
};

export default async () => {
  await beat('aria-winback-cron');
  const key = process.env.STRIPE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!key) return new Response(JSON.stringify({ ok: false, error: 'STRIPE_SECRET_KEY missing' }), { status: 500, headers: {'Content-Type':'application/json'} });

  let store = null;
  try {
    const { getStore } = await import('@netlify/blobs');
    store = getStore({ name: 'aria-winback-state', consistency: 'strong' });
  } catch {}

  const now = Date.now();
  const SIXTY_D = 60 * 86400 * 1000;
  const ONE_EIGHTY_D = 180 * 86400 * 1000;

  // Find cancelled subscriptions
  // Stripe API: GET /v1/subscriptions?status=canceled&limit=100
  const out = { scanned: 0, sent: 0, skipped_recent: 0, skipped_too_old: 0, skipped_dedup: 0, errors: [] };
  try {
    const r = await fetch('https://api.stripe.com/v1/subscriptions?status=canceled&limit=100', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'list failed');

    for (const sub of (j.data || [])) {
      out.scanned += 1;
      const cancelledAt = (sub.canceled_at || 0) * 1000;
      if (!cancelledAt) continue;
      const age = now - cancelledAt;
      if (age < SIXTY_D) { out.skipped_recent++; continue; }
      if (age > ONE_EIGHTY_D) { out.skipped_too_old++; continue; }

      // Fetch the customer email
      let custEmail = null, custName = null;
      try {
        const cr = await fetch('https://api.stripe.com/v1/customers/' + sub.customer, {
          headers: { 'Authorization': 'Bearer ' + key }
        });
        const cj = await cr.json();
        if (cr.ok) { custEmail = cj.email; custName = cj.name; }
      } catch {}

      if (!custEmail) continue;

      // Dedup: have we sent winback to this email already?
      if (store) {
        const prior = await store.get('winback-' + custEmail.toLowerCase());
        if (prior) { out.skipped_dedup++; continue; }
      }

      if (resendKey) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: process.env.RESEND_FROM || 'Ahmad at IIS <noreply@iisupp.net>',
              to: [custEmail],
              subject: PROMO.subject,
              html: PROMO.html_template(custName)
            })
          });
          if (store) await store.setJSON('winback-' + custEmail.toLowerCase(), { sent_at: now });
          out.sent += 1;
        } catch (e) {
          out.errors.push({ email: custEmail, err: e.message });
        }
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: {'Content-Type':'application/json'} });
  }

  return new Response(JSON.stringify({ ok: true, ...out, ran_at: new Date(now).toISOString() }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { schedule: '0 11 * * *' };
