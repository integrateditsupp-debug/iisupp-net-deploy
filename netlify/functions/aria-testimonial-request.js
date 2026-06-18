/**
 * aria-testimonial-request — Triggers testimonial collection when NPS >= 9
 *  POST { customer_email, nps_score } - if score >= 9, schedules testimonial request email
 *  POST { event:'submit', email, testimonial, permission_to_publish, attribution }
 *  Cat 14 + Cat 5 — marketing + account.
 */
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  let store;
  try { ({ getStore } = require('@netlify/blobs')); store = require('@netlify/blobs').getStore({ name: 'aria-testimonials', consistency: 'strong' }); }
  catch { return ok({ ok: false, error: 'blobs unavailable' }); }

  // Submit response
  if (body.event === 'submit') {
    const email = String(body.email || '').toLowerCase();
    const t = String(body.testimonial || '').slice(0, 2000);
    if (!email || !t) return ok({ ok: false, error: 'email + testimonial required' });
    try {
      await store.setJSON('t-' + Date.now() + '-' + email, {
        email,
        testimonial: t,
        attribution: String(body.attribution || 'anonymous').slice(0, 100),
        permission_to_publish: !!body.permission_to_publish,
        received_at: Date.now()
      });
      // Notify Ahmad
      if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
            to: [process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net'],
            subject: '[IIS] New testimonial from ' + email,
            html: '<p><strong>From:</strong> ' + email + '<br><strong>Permission to publish:</strong> ' + (body.permission_to_publish ? 'YES' : 'NO') + '<br><strong>Attribution:</strong> ' + (body.attribution || 'anonymous') + '</p><blockquote style="border-left:3px solid #d4af37;padding-left:12px;color:#444">' + t + '</blockquote>'
          })
        });
      }
      return ok({ ok: true, recorded: true });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  // Trigger from NPS
  const score = Number(body.nps_score || -1);
  if (score < 9) return ok({ ok: true, action: 'no_action', reason: 'nps_below_threshold' });
  const email = String(body.customer_email || '').toLowerCase();
  if (!email) return ok({ ok: false, error: 'customer_email required' });

  // Dedup: only send once per email per quarter
  const recently = 'sent-' + email;
  try {
    const prior = await store.get(recently, { type: 'json' });
    if (prior && (Date.now() - prior.sent_at) < 90 * 86400000) {
      return ok({ ok: true, action: 'skipped', reason: 'sent_within_90d' });
    }
  } catch {}

  if (process.env.RESEND_API_KEY) {
    const base = process.env.SITE_BASE_URL || 'https://iisupp.net';
    const html = '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#111;line-height:1.6;padding:20px">' +
      '<p>Hi,</p>' +
      '<p>You gave us a 9 or 10 on NPS — thank you. Genuinely.</p>' +
      '<p>Small ask: would you write 2-3 sentences about your experience with ARIA?</p>' +
      '<p>I would like to share it (with your permission) — anonymous or named, your call.</p>' +
      '<p><a href="mailto:ahmad.wasee@iisupp.net?subject=Testimonial%20for%20IIS&body=Testimonial%3A%20%0A%0AAttribution%3A%20(your%20name%20%2F%20title%20%2F%20anonymous%20%2F%20your%20role%20or%20%27anonymous%27)%0A%0APermission%20to%20publish%3A%20YES%20%2F%20NO" style="display:inline-block;padding:12px 24px;background:#d4af37;color:#000;text-decoration:none;border-radius:6px;font-weight:600">Send my testimonial</a></p>' +
      '<p style="font-size:13px;color:#666">Or just reply to this email. Either works.</p>' +
      '<p>— Ahmad</p></div>';
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Ahmad at IIS <ahmad.wasee@iisupp.net>',
          to: [email],
          subject: 'Tiny ask + a big thank you',
          html
        })
      });
      await store.setJSON(recently, { sent_at: Date.now() });
      return ok({ ok: true, action: 'sent' });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }
  return ok({ ok: false, error: 'RESEND_API_KEY missing' });
  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
