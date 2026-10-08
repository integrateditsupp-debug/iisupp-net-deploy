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
 *
 *  2026-10-08 (audit top-10 #9b):
 *   - this HTTP function was listed as a daily cron but had no schedule → it never ran. The schedule now
 *     lives in aria-renewal-reminders-cron.mjs (export const config = { schedule: '0 14 * * *' }), which
 *     imports `runScan` below. The cron-health monitor keeps its 'aria-renewal-reminders' heartbeat name.
 *   - the HTTP path (a mass-mail trigger that also listed customer emails) now requires an admin /
 *     internal token (lib/admin-gate.cjs; fail-closed) or an Aperture JWT.
 *   - mail goes through lib/notify.mjs; the Stripe "sent" stamp is written ONLY when the provider
 *     confirmed delivery, and failures are reported in `failed`.
 */
const Stripe = require('stripe');
const { bearerFromEvent } = require('./_verify-bearer.cjs');
const { requireAdminToken, adminGateResponse } = require('./lib/admin-gate.cjs');
const { corsHeaders } = require('./lib/cors.cjs');
const { OWNER_EMAIL, SUPPORT_PHONE } = require('./lib/contacts.cjs');

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  if (!bearerFromEvent(event)) {
    const gate = requireAdminToken(event, { envNames: ['INTERNAL_WEBHOOK_SECRET', 'ARIA_ADMIN_TOKEN', 'APERTURE_ADMIN_PASSWORD', 'ADMIN_PASSWORD'], body });
    if (!gate.ok) return adminGateResponse(gate, headers);
  }

  const out = await runScan({ dry: !!body.dry_run });
  return { statusCode: out.ok ? 200 : (out.error_code === 'not_configured' ? 503 : 500), headers, body: JSON.stringify(out) };
};

/**
 * The scan itself (no HTTP concerns). Used by the handler above and by aria-renewal-reminders-cron.mjs.
 * @returns {{ok, scanned_at, sent_count, sent, skipped_count, failed, dry_run}}
 */
async function runScan({ dry = false } = {}) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { ok: false, error: 'STRIPE_SECRET_KEY not configured', error_code: 'not_configured' };
  const stripe = Stripe(stripeKey);

  const now = Math.floor(Date.now() / 1000);
  const windows = [
    { days: 7, key: 'renewal_reminder_7d_sent_at',  label: '7 days' },
    { days: 3, key: 'renewal_reminder_3d_sent_at',  label: '3 days' },
    { days: 1, key: 'renewal_reminder_1d_sent_at',  label: '1 day' }
  ];

  const sent = [];
  const skipped = [];
  const failed = [];

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
          const html = `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,sans-serif;color:#222;line-height:1.6;padding:24px;background:#fff"><div style="border-top:3px solid #c5a059;padding-top:18px"><h2 style="margin:0 0 14px;color:#0b1f3a;font-family:Cinzel,serif">Renewal heads-up</h2><p style="margin:0 0 14px">Hi ${esc(firstName)},</p><p style="margin:0 0 14px">Your ARIA subscription will auto-renew on <strong>${esc(renewDate)}</strong> for <strong>$${amt.toFixed(2)} ${esc(currency)}</strong>.</p><p style="margin:0 0 14px">No action needed — service continues uninterrupted. If you want to upgrade, downgrade, or update your card, just reply to this email or use the billing portal.</p><table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px"><tr><td style="padding:6px 0;color:#999;width:120px">Renews</td><td style="padding:6px 0"><strong>${esc(renewDate)}</strong></td></tr><tr><td style="padding:6px 0;color:#999">Amount</td><td style="padding:6px 0"><strong>$${amt.toFixed(2)} ${esc(currency)}</strong></td></tr></table><p style="margin:14px 0 0;color:#666;font-size:12px;border-top:1px solid #eee;padding-top:12px">Integrated IT Support · ${esc(OWNER_EMAIL)} · ${esc(SUPPORT_PHONE)}</p></div></div>`;

          if (dry) {
            sent.push({ to: customer.email, days: w.days, dry: true });
          } else {
            const r = await sendResend(customer.email, subject, html);
            if (r.ok) {
              await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, [w.key]: new Date().toISOString() } });
              sent.push({ to: customer.email, days: w.days, provider: r.provider });
            } else {
              failed.push({ to: customer.email, days: w.days, error: r.error });
            }
          }
        }
      }
      starting_after = page.has_more ? page.data[page.data.length - 1].id : null;
    } while (starting_after);

    if (failed.length) console.error('[aria-renewal-reminders] reminders NOT delivered:', failed.length);
    return { ok: true, scanned_at: new Date().toISOString(), sent_count: sent.length, sent, skipped_count: skipped.length, failed_count: failed.length, failed, dry_run: dry };
  } catch (e) {
    console.error('[aria-renewal-reminders] scan error:', e.message);
    return { ok: false, error: 'renewal scan failed', error_code: 'scan_failed', sent_count: sent.length, sent, failed_count: failed.length, failed };
  }
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// Shared honest sender — ok only when Resend/SMTP confirmed (lib/notify.mjs).
async function sendResend(to, subject, html) {
  try {
    const { sendEmail } = await import('./lib/notify.mjs');
    return await sendEmail({ to, subject, html, tag: 'renewal-reminder' });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

exports.runScan = runScan;
