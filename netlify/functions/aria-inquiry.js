/**
 * aria-inquiry — receives Lifetime License / Ownership Acquisition / Enterprise
 * lead-capture form submissions from /aria plans view. Sends a notification
 * email to sales and a courtesy auto-reply to the lead via Resend.
 *
 * NEVER charges, NEVER calls Stripe. Lead capture only.
 */

const KIND_ALLOWED = new Set(['lifetime_license', 'ownership_acquisition', 'enterprise_lead']);
const SUPPORT_PHONE = '(647) 581-3182';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return j(405, { error: 'POST required' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return j(400, { error: 'Invalid JSON' }); }

  const kind = KIND_ALLOWED.has(body.kind) ? body.kind : 'enterprise_lead';
  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 320);
  const company = String(body.company || '').trim().slice(0, 200);
  const phone = String(body.phone || '').trim().slice(0, 60);
  const notes = String(body.notes || '').trim().slice(0, 4000);
  const plan = String(body.plan || '').trim().slice(0, 200);
  const planPrice = String(body.planPrice || '').trim().slice(0, 60);
  const source = String(body.source || '').trim().slice(0, 600);

  if (!name) return j(400, { error: 'name is required', field: 'name' });
  if (!email) return j(400, { error: 'email is required', field: 'email' });
  if (!isValidEmail(email)) return j(400, { error: 'Please enter a valid email address.', field: 'email' });

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM || 'ARIA Sales <noreply@iisupport.net>';
  const salesTo = process.env.SALES_NOTIFY_EMAIL || 'integrateditsupp@gmail.com';

  if (!apiKey) {
    console.error('[aria-inquiry] RESEND_API_KEY missing');
    return j(500, { error: `Could not submit. Please call ${SUPPORT_PHONE}.` });
  }

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || event.headers['x-forwarded-for'] || '';
  const ua = event.headers['user-agent'] || '';
  const ts = new Date().toISOString();

  const kindLabel =
    kind === 'lifetime_license' ? 'Lifetime License Inquiry — $1,200,000' :
    kind === 'ownership_acquisition' ? 'Ownership Acquisition Request' :
    'Enterprise Inquiry';
  const subject = `ARIA ${kindLabel} — ${name}`;

  try {
    const salesHtml = renderSalesHtml({ kind, kindLabel, name, email, company, phone, notes, plan, planPrice, source, ip, ua, ts });
    const replyHtml = renderReplyHtml({ kindLabel, name });

    // Notify sales (await so we can surface a real failure to the user)
    const r1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [salesTo],
        reply_to: email,
        subject,
        html: salesHtml,
      }),
    });
    if (!r1.ok) {
      console.error('[aria-inquiry] sales email failed:', r1.status);
      return j(500, { error: `Could not submit. Please call ${SUPPORT_PHONE}.` });
    }

    // Courtesy auto-reply (non-blocking — sales notification already succeeded)
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `We received your ${kindLabel} — Integrated IT Support`,
        html: replyHtml,
      }),
    }).catch(e => console.error('[aria-inquiry] reply email error:', e && e.message));

    return j(200, { ok: true });
  } catch (err) {
    console.error('[aria-inquiry] error:', err && err.message);
    return j(500, { error: `Could not submit. Please call ${SUPPORT_PHONE}.` });
  }
};

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:8px 12px;color:#aaa;font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-bottom:1px solid #1a1a1a;width:160px;vertical-align:top;">${esc(label)}</td><td style="padding:8px 12px;color:#f5f5f0;font-size:14px;border-bottom:1px solid #1a1a1a;">${esc(value).replace(/\n/g,'<br>')}</td></tr>`;
}

function renderSalesHtml(d) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#000;color:#f5f5f0;padding:40px;margin:0;">
    <div style="max-width:640px;margin:0 auto;border:1px solid #c5a059;border-radius:12px;padding:28px 30px;background:#0a0a0a;">
      <h1 style="color:#c5a059;font-family:'Times New Roman',serif;font-size:28px;margin:0 0 6px;">ARIA — ${esc(d.kindLabel)}</h1>
      <p style="font-size:13px;color:#888;margin:0 0 20px;letter-spacing:.08em;text-transform:uppercase;">New lead · ${esc(d.ts)}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
        ${row('Name', d.name)}
        ${row('Email', d.email)}
        ${row('Company', d.company)}
        ${row('Phone', d.phone)}
        ${row('Plan', d.plan)}
        ${row('Plan Price', d.planPrice ? '$' + d.planPrice : '')}
        ${row('Notes', d.notes)}
        ${row('Kind', d.kind)}
        ${row('Source', d.source)}
        ${row('IP', d.ip)}
        ${row('User Agent', d.ua)}
      </table>
      <p style="font-size:12px;color:#888;margin-top:24px;border-top:1px solid #333;padding-top:14px;">
        Reply directly to this email to reach the lead — Reply-To is set to ${esc(d.email)}.<br>
        Integrated IT Support Inc. · iisupport.net · ${esc(SUPPORT_PHONE)}
      </p>
    </div></body></html>`;
}

function renderReplyHtml(d) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#000;color:#f5f5f0;padding:40px;margin:0;">
    <div style="max-width:600px;margin:0 auto;border:1px solid #c5a059;border-radius:12px;padding:32px;background:#0a0a0a;">
      <h1 style="color:#c5a059;font-family:'Times New Roman',serif;font-size:32px;margin:0 0 16px;">Thank you, ${esc(d.name.split(/\s+/)[0] || '')}.</h1>
      <p style="font-size:15px;line-height:1.6;color:#f5f5f0;">We received your <strong>${esc(d.kindLabel)}</strong>.</p>
      <p style="font-size:15px;line-height:1.6;color:#f5f5f0;">A senior member of our team will respond within <strong>one business day</strong> with next steps and any qualifying questions.</p>
      <h2 style="color:#c5a059;font-size:16px;margin-top:28px;letter-spacing:.05em;">Need to reach us sooner?</h2>
      <p style="font-size:14px;line-height:1.7;color:#f5f5f0;">📞 <a href="tel:6475813182" style="color:#c5a059;text-decoration:none;">${esc(SUPPORT_PHONE)}</a><br>
      ✉️ <a href="mailto:integrateditsupp@gmail.com" style="color:#c5a059;text-decoration:none;">integrateditsupp@gmail.com</a></p>
      <p style="font-size:12px;color:#888;margin-top:32px;border-top:1px solid #333;padding-top:16px;">
        Integrated IT Support Inc. · iisupport.net · ${esc(SUPPORT_PHONE)}<br>
        ARIA — Premium AI Browsing Companion.
      </p>
    </div></body></html>`;
}

function j(s, b) {
  return { statusCode: s, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) };
}
