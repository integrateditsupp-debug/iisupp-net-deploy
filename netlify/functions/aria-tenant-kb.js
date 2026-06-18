/**
 * aria-tenant-kb — Per-tenant knowledge base scaffold (Cat 12 multi-tenant).
 *  POST { event: 'submit', tenant_email, kb_content, kb_title?, contact_name? }
 *  -> Logs the KB content + emails Ahmad for manual ingestion review.
 *
 *  v0.1: ingestion is human-in-the-loop (no auto-merge into KB index).
 *  v0.2: per-tenant isolation in the live classifier (route to tenant's KB
 *        based on email match).
 *
 *  Required for $156K SMB plan + above where customers want THEIR docs
 *  feeding ARIA.
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const tenant = String(body.tenant_email || '').trim().toLowerCase();
  const kbContent = String(body.kb_content || '').trim();
  const kbTitle = String(body.kb_title || 'Untitled KB').trim().slice(0, 120);
  const contactName = String(body.contact_name || '').trim().slice(0, 80);

  if (!tenant || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenant)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tenant_email required' }) };
  }
  if (!kbContent || kbContent.length < 50) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'kb_content must be at least 50 chars' }) };
  }
  if (kbContent.length > 200000) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: 'kb_content too large (max 200KB; use multiple submits)' }) };
  }

  const at = new Date().toISOString();
  const tenantSlug = tenant.split('@')[1].replace(/[^a-z0-9]/g, '-');
  const id = 'tkb-' + tenantSlug + '-' + Date.now().toString(36);

  // Log everything to Netlify logs (Ahmad pulls from here for review)
  console.log('[aria-tenant-kb] SUBMIT', JSON.stringify({ id, at, tenant, kbTitle, contactName, length: kbContent.length }));
  // Print the content separately so it's easy to copy
  console.log('[aria-tenant-kb] BODY ' + id + ':\n' + kbContent.slice(0, 50000));

  // Email Ahmad with the full content for manual ingestion
  const ahmad = process.env.SALES_NOTIFY_EMAIL || 'integrateditsupp@gmail.com';
  const subject = '[Tenant KB ' + id + '] ' + tenant + ' submitted "' + kbTitle + '"';
  const html = `<div style="max-width:680px;margin:0 auto;font-family:-apple-system,sans-serif;color:#222;line-height:1.6;padding:24px;background:#fff"><div style="border-top:3px solid #c5a059;padding-top:18px"><h2 style="margin:0 0 14px;color:#0b1f3a;font-family:Cinzel,serif">Tenant KB submission</h2><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:6px 0;color:#999;width:120px">Tenant</td><td><strong>${esc(tenant)}</strong></td></tr><tr><td style="padding:6px 0;color:#999">Submission ID</td><td><code>${esc(id)}</code></td></tr><tr><td style="padding:6px 0;color:#999">Contact</td><td>${esc(contactName) || '<em>not provided</em>'}</td></tr><tr><td style="padding:6px 0;color:#999">KB Title</td><td><strong>${esc(kbTitle)}</strong></td></tr><tr><td style="padding:6px 0;color:#999">Length</td><td>${kbContent.length} chars</td></tr></table><h3 style="margin:18px 0 6px;color:#0b1f3a">KB Content</h3><pre style="background:#f5f4ef;border-left:3px solid #c5a059;padding:14px 18px;border-radius:6px;white-space:pre-wrap;word-break:break-word;font-family:'JetBrains Mono',Menlo,monospace;font-size:12.5px;max-height:700px;overflow:auto">${esc(kbContent.slice(0, 50000))}${kbContent.length > 50000 ? '\\n\\n[truncated for email — full ' + kbContent.length + ' chars in Netlify logs]' : ''}</pre><p style="margin:18px 0 0;color:#666;font-size:12px;border-top:1px solid #eee;padding-top:12px">Next: review for quality, format as ARIA KB seed, append to assets/kb-index.json under tenant section ${esc(tenantSlug)}.</p></div></div>`;
  await sendResend(ahmad, subject, html).catch(e => console.warn('[aria-tenant-kb] mail err:', e.message));

  // Confirmation to tenant
  await sendResend(tenant, 'KB received — under review',
    `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,sans-serif;color:#222;line-height:1.6;padding:24px;background:#fff"><div style="border-top:3px solid #c5a059;padding-top:18px"><p>Hi${contactName ? ' ' + esc(contactName.split(' ')[0]) : ''},</p><p>We received your knowledge base submission for ARIA. Ahmad will review it for formatting and add it to your tenant's ARIA KB within 1-2 business days.</p><p><strong>Submission ID:</strong> ${esc(id)}</p><p>Once added, your team's ARIA will automatically reference your internal docs when answering questions tagged to your tenant.</p><p style="margin-top:18px;font-size:12px;color:#999">Integrated IT Support &middot; ahmad.wasee@iisupp.net</p></div></div>`
  ).catch(e => console.warn('[aria-tenant-kb] tenant mail err:', e.message));

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, submission_id: id, message: 'KB submitted. Ahmad will review and integrate within 1-2 business days.' }) };
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
