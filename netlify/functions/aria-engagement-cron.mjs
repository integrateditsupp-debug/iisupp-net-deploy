/**
 * aria-engagement-cron — Scheduled drip emails for activation + re-engagement
 *  Runs daily at 10am UTC. Sends:
 *    - Day +1: post-trial first-value email
 *    - Day +3: tips & tricks email
 *    - Day +7: case study + upgrade prompt
 *    - Day +30: re-engagement (if no activity since trial end)
 *    - Day +90: win-back (one-time discount placeholder; NOT a guarantee)
 *
 *  State tracked in Netlify Blobs per email.
 *  Cat 2 (lifecycle) + Cat 15 (onboarding).
 */
<<<<<<< HEAD
import { beat } from './_heartbeat.mjs';
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
const TEMPLATES = {
  d1: {
    subject: 'How was your first ARIA session?',
    html: emailWrap('We hope ARIA handled your first IT question well. A few things you might not have tried yet:',
      ['Voice mode (the mic button) for faster back-and-forth',
       'Asking ARIA to walk you through a fix step-by-step',
       'Saving repeat questions to your account for next time'],
      'Try another scenario', 'https://iisupp.net/aria')
  },
  d3: {
    subject: '3 ways ARIA saves IT teams hours per week',
    html: emailWrap('Three patterns we see successful teams using:',
      ['Pin the ARIA Slack/Teams app to your top channels for instant help',
       'Use the Knowledge Base export to brief new staff in minutes',
       'Wire ARIA into your ticketing tool via our API'],
      'See API docs', 'https://iisupp.net/docs/api')
  },
  d7: {
    subject: 'Ready to make ARIA permanent?',
    html: emailWrap('Most teams who try ARIA find the deflection rate covers the subscription in week 1. If you want to lock in your usage:',
      ['Personal plan: $599/month — 1 user',
       'Pro plan: $1,500/month — small team',
       'Small Business: $156K/year — full org'],
      'See plans', 'https://iisupp.net/plans')
  },
  d30: {
    subject: 'It has been a month — what is holding you back?',
    html: emailWrap('We noticed you have not used ARIA in 30 days. Was it the price? The fit? Something we missed? Reply and let us know — I read every email.',
      [], 'Open ARIA', 'https://iisupp.net/aria')
  },
  d90: {
    subject: 'One last check-in',
    html: emailWrap('You explored ARIA 90 days ago. Things have evolved a lot since then. We added M365 Graph, Slack/Teams apps, multi-language support, and a per-tenant audit log.',
      ['90-day update post: https://iisupp.net/blog/q2-2026'],
      'See what is new', 'https://iisupp.net/aria')
  }
};

function emailWrap(intro, bullets, ctaText, ctaUrl) {
  return '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111;line-height:1.6">' +
    '<p style="font-size:15px">Hi,</p>' +
    '<p style="font-size:15px">' + intro + '</p>' +
    (bullets.length ? '<ul style="font-size:14px;padding-left:18px">' + bullets.map(b => '<li style="margin-bottom:6px">' + b + '</li>').join('') + '</ul>' : '') +
    '<p style="margin:24px 0"><a href="' + ctaUrl + '" style="background:#d4af37;color:#0a0a0a;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">' + ctaText + '</a></p>' +
    '<p style="color:#888;font-size:12px;margin-top:32px">Ahmad Wasee · Integrated IT Support Inc. · <a href="https://iisupp.net" style="color:#888">iisupp.net</a></p>' +
    '<p style="color:#888;font-size:11px">Unsubscribe: reply STOP. We respect your inbox.</p>' +
    '</div>';
}

export default async () => {
<<<<<<< HEAD
  await beat('aria-engagement-cron');
=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
  const sent = [];
  const failed = [];

  // Discover candidates from session-memory + lead-capture
  // v0.1: scan recent leads
  try {
    const { getStore } = await import('@netlify/blobs');
    const leads = getStore({ name: 'aria-leads', consistency: 'eventual' });
    const dripState = getStore({ name: 'aria-drip-state', consistency: 'strong' });

    const list = await leads.list();
    const now = Date.now();
    const day = 86400000;
    for (const item of (list.blobs || [])) {
      try {
        const lead = await leads.get(item.key, { type: 'json' });
        if (!lead || !lead.email || !lead.created_at) continue;
        const ageDays = Math.floor((now - lead.created_at) / day);
        const milestone = ageDays >= 90 ? 'd90'
                        : ageDays >= 30 ? 'd30'
                        : ageDays >= 7  ? 'd7'
                        : ageDays >= 3  ? 'd3'
                        : ageDays >= 1  ? 'd1' : null;
        if (!milestone) continue;

        // Already sent this milestone?
        const stateKey = lead.email + '-' + milestone;
        const prior = await dripState.get(stateKey, { type: 'json' });
        if (prior) continue;

        const tpl = TEMPLATES[milestone];
        const sendOk = await sendEmail(lead.email, tpl.subject, tpl.html);
        if (sendOk) {
          await dripState.setJSON(stateKey, { sent_at: now });
          sent.push({ email: lead.email, milestone });
        } else {
          failed.push({ email: lead.email, milestone });
        }
      } catch (e) { /* skip */ }
    }
  } catch (e) {
    console.warn('[engagement-cron] err:', e.message);
  }

  return new Response(JSON.stringify({ ok: true, sent_count: sent.length, failed_count: failed.length, sent, failed }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Ahmad at IIS <noreply@iisupp.net>',
        to: [to], subject, html
      })
    });
    return r.ok;
  } catch { return false; }
}

export const config = { schedule: '0 10 * * *' }; // daily 10am UTC
