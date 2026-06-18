/**
 * aria-teams-install - Teams install webhook receiver.
 *
 * Logs installation metadata to the tenant audit function when available and
 * alerts Ahmad through Resend without making any irreversible commitments.
 */
'use strict';

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  const tenantId = String(body.tenant_id || body.tenantId || body.team_id || body.teamId || 'unknown').toLowerCase();
  const actor = String(body.installed_by || body.user_id || body.userId || 'teams-install-webhook');
  const at = new Date().toISOString();
  const audit = {
    event: 'log',
    tenant_id: tenantId,
    action: 'app.installed',
    actor,
    outcome: 'received',
    params: {
      source: 'microsoft-teams',
      team_id: body.team_id || body.teamId || '',
      service_url: body.serviceUrl || '',
      received_at: at
    }
  };

  const auditResult = await writeTenantAudit(audit);
  await alertInstall({ tenantId, actor, at, auditResult }).catch((error) => {
    console.warn('[aria-teams-install] alert failed:', error.message);
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: true, installed: true, tenant_id: tenantId, audit: auditResult.ok ? 'logged' : 'queued' })
  };
};

async function writeTenantAudit(audit) {
  try {
    const tenantAudit = require('./aria-tenant-audit');
    if (tenantAudit && typeof tenantAudit.handler === 'function') {
      const result = await tenantAudit.handler({ httpMethod: 'POST', body: JSON.stringify(audit), headers: {} });
      return { ok: result.statusCode >= 200 && result.statusCode < 300, mode: 'local', statusCode: result.statusCode };
    }
  } catch (_error) {
    // The audit function may ship separately; install webhook still ACKs safely.
  }
  console.log('[aria-teams-install] audit fallback', JSON.stringify(audit));
  return { ok: false, mode: 'console' };
}

async function alertInstall({ tenantId, actor, at, auditResult }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const to = process.env.SALES_NOTIFY_EMAIL || 'integrateditsupp@gmail.com';
  const from = process.env.RESEND_FROM || 'Integrated IT Support <noreply@iisupp.net>';
  const subject = '[ARIA Teams] App install received';
  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#172033">',
    '<h2>ARIA Teams install received</h2>',
    '<p>A Microsoft Teams install webhook reached ARIA.</p>',
    '<ul>',
    '<li><strong>Tenant:</strong> ' + esc(tenantId) + '</li>',
    '<li><strong>Actor:</strong> ' + esc(actor) + '</li>',
    '<li><strong>Received:</strong> ' + esc(at) + '</li>',
    '<li><strong>Audit:</strong> ' + esc(auditResult.mode || 'unknown') + '</li>',
    '</ul>',
    '<p>Next safe step: verify the tenant and decide whether to begin onboarding.</p>',
    '</div>'
  ].join('');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  return response.ok;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
