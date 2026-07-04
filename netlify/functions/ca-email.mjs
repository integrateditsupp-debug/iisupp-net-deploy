import {
  CONTENT_ASSURANCE_STORE,
  DISCLAIMER_COPY,
  buildPdfBuffer,
  buildZipBundle,
  getScopedStore,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  sanitizeEmail
} from './lib/content-assurance.mjs';

export default async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'POST only' });

  const body = parseJsonBody(event);
  if (!body) return jsonResponse(400, { error: 'Invalid JSON.' });

  const sessionId = String(body.sessionId || '').trim();
  const token = String(body.token || '').trim();
  const to = sanitizeEmail(body.to);
  if (!sessionId || !token || !to) return jsonResponse(400, { error: 'sessionId, token, and valid recipient email are required.' });
  if (!process.env.RESEND_API_KEY) return jsonResponse(500, { error: 'Email provider is not configured in this environment.' });

  const store = getScopedStore(CONTENT_ASSURANCE_STORE);
  const session = await store.get('session-' + sessionId, { type: 'json' });
  if (!session || !session.unlocked || session.deliveryToken !== token) {
    return jsonResponse(403, { error: 'Delivery token is invalid or expired.' });
  }

  const pdf = await buildPdfBuffer(session);
  const zip = await buildZipBundle(session);
  const subject = `Content Assurance bundle · ${session.sourceMeta?.fileName || sessionId}`;
  const html = buildEmailHtml(session);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Integrated IT Support <noreply@iisupp.net>',
      to: [to],
      subject,
      html,
      attachments: [
        {
          filename: `content-assurance-${sessionId}.pdf`,
          content: pdf.toString('base64')
        },
        {
          filename: `content-assurance-${sessionId}.zip`,
          content: zip.toString('base64')
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return jsonResponse(500, { error: 'Email send failed.', detail: detail.slice(0, 240) });
  }

  session.deliveryAudit = Array.isArray(session.deliveryAudit) ? session.deliveryAudit : [];
  session.deliveryAudit.push({ at: new Date().toISOString(), email: to, via: 'email' });
  await store.setJSON('session-' + sessionId, session);

  return jsonResponse(200, { ok: true, sent: true, to });
};

function buildEmailHtml(session) {
  return `
    <div style="max-width:640px;margin:0 auto;font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.6">
      <h1 style="font-family:Cinzel,Georgia,serif;font-size:26px;color:#9c7322;margin-bottom:8px">Content Assurance bundle</h1>
      <p style="margin-top:0">Your report bundle is attached as a PDF and ZIP archive.</p>
      <p><strong>File reviewed:</strong> ${escapeHtml(session.sourceMeta?.fileName || 'submitted content')}</p>
      <p><strong>Goal:</strong> ${escapeHtml(session.goal)}</p>
      <p><strong>Executive summary:</strong> ${escapeHtml(session.report.summary.executiveSummary)}</p>
      <p style="font-size:13px;color:#4b5563">${escapeHtml(DISCLAIMER_COPY.global)}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
