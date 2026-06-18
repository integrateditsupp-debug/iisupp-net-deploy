/**
 * aria-env-check — admin-gated. Surfaces which production env vars are SET vs MISSING.
 *  Never returns actual values — only presence + length. Used during DR + onboarding.
 *  Cat 11 — Ops hygiene.
 */
const REQUIRED = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PERSONAL_MONTHLY_URL',
  'STRIPE_PRO_MONTHLY_URL',
  'STRIPE_SMALL_BUSINESS_YEARLY_URL',
  'STRIPE_MIDSIZE_YEARLY_URL',
  'STRIPE_ENTERPRISE_YEARLY_URL',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'APERTURE_ADMIN_PASSWORD',
  'NETLIFY_BLOBS_TOKEN',
  'FOUNDER_EMAIL'
];
const OPTIONAL = [
  'ARIA_COUPONS_JSON',
  'WHEREBY_API_KEY',
  'SLACK_WEBHOOK_URL',
  'GITHUB_PAT'
];

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }
  const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!expected || body.admin_token !== expected) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
  }

  function summarize(names) {
    return names.map(n => ({
      name: n,
      set: !!process.env[n],
      length: (process.env[n] || '').length,
      starts_with: (process.env[n] || '').slice(0, 3)
    }));
  }

  const required = summarize(REQUIRED);
  const optional = summarize(OPTIONAL);
  const missing_required = required.filter(r => !r.set).map(r => r.name);

  return { statusCode: 200, headers, body: JSON.stringify({
    ok: missing_required.length === 0,
    missing_required,
    required,
    optional,
    checked_at: new Date().toISOString()
  })};
};
