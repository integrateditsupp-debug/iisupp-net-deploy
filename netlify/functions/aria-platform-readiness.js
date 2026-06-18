'use strict';

const SECRET_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SLACK_CLIENT_ID',
  'SLACK_CLIENT_SECRET',
  'SLACK_BOT_TOKEN',
  'WHEREBY_API_KEY',
  'DAILY_API_KEY',
  'RESEND_API_KEY',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'MS_TENANT_ID',
  'MS_CLIENT_ID',
  'MS_CLIENT_SECRET',
  'NETLIFY_AUTH_TOKEN'
];

const CATEGORIES = [
  {
    id: 'ai_core',
    label: 'ARIA AI core',
    env: ['ANTHROPIC_API_KEY'],
    final: 'No CEO click needed after key is configured.'
  },
  {
    id: 'billing',
    label: 'Billing and checkout',
    env: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    final: 'CEO/customer still performs final Pay, Subscribe, or plan confirmation.'
  },
  {
    id: 'slack',
    label: 'Slack marketplace/install',
    env: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
    optionalEnv: ['SLACK_BOT_TOKEN'],
    final: 'Ahmad must approve app submission/install and any workspace authorization.'
  },
  {
    id: 'live_support',
    label: 'Live remote support',
    env: [],
    anyOfEnv: ['WHEREBY_API_KEY', 'DAILY_API_KEY'],
    final: 'Ahmad must approve provider account/key setup and any real external test room.'
  },
  {
    id: 'email',
    label: 'Email delivery',
    env: [],
    anyOfEnv: ['RESEND_API_KEY', 'GMAIL_APP_PASSWORD'],
    optionalEnv: ['GMAIL_USER'],
    final: 'No bulk sending; Ahmad still approves every external send.'
  },
  {
    id: 'm365',
    label: 'Microsoft 365 Graph',
    env: ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET'],
    final: 'Privileged writes remain behind the ARIA write gate and CEO approval.'
  }
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { ok: false, error: 'GET or POST required' });
  }

  let body = {};
  if (event.httpMethod === 'POST') {
    try {
      body = JSON.parse(event.body || '{}');
    } catch (err) {
      return json(400, { ok: false, error: 'Invalid JSON' });
    }
  }

  const known = normalizeKnown(body.known || body);
  const envReport = summarizeEnv();
  const categories = CATEGORIES.map(category => evaluateCategory(category, envReport));
  const operationalGates = evaluateOperationalGates(known);
  const allItems = [
    ...categories.flatMap(category => category.items),
    ...operationalGates.items
  ];
  const done = allItems.filter(item => item.ready).length;
  const score = allItems.length ? Math.round((done / allItems.length) * 100) : 0;

  return json(200, {
    ok: true,
    generated_at: new Date().toISOString(),
    score,
    summary: {
      ready_items: done,
      total_items: allItems.length,
      blocked_items: allItems.length - done,
      coding_surface: 'complete',
      final_action_mode: 'CEO/platform gates only'
    },
    categories,
    operational_gates: operationalGates,
    missing_env: categories.flatMap(category => category.missing_env.map(key => ({ category: category.id, key }))),
    next_ceo_actions: [
      ...operationalGates.items.filter(item => !item.ready).map(item => item.ceo_action),
      ...categories.filter(category => !category.ready).map(category => category.final_action)
    ].filter(Boolean),
    safe_mode: 'Reports configured/missing booleans only. Secret values are never returned and no external action is performed.'
  });
};

function summarizeEnv() {
  return Object.fromEntries(SECRET_ENV_KEYS.map(key => [key, Boolean(process.env[key])]));
}

function normalizeKnown(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const bool = (...names) => names.some(name => source[name] === true || source[name] === 'yes' || source[name] === 'true');
  const string = (...names) => {
    for (const name of names) {
      if (source[name] !== undefined && source[name] !== null && String(source[name]).trim()) {
        return String(source[name]).trim();
      }
    }
    return '';
  };
  return {
    duns: string('duns', 'duns_number', 'dunsNumber').replace(/[^\d]/g, ''),
    legal_profile_confirmed: bool('legal_profile_confirmed', 'legalProfileConfirmed'),
    microsoft_partner_reviewed: bool('microsoft_partner_reviewed', 'microsoftPartnerReviewed'),
    aws_partner_reviewed: bool('aws_partner_reviewed', 'awsPartnerReviewed'),
    whereby_or_daily_account_ready: bool('whereby_or_daily_account_ready', 'providerAccountReady'),
    slack_app_approval_ready: bool('slack_app_approval_ready', 'slackAppApprovalReady'),
    admin_tokens_ready: bool('admin_tokens_ready', 'adminTokensReady'),
    production_publish_approved: bool('production_publish_approved', 'productionPublishApproved')
  };
}

function evaluateCategory(category, envReport) {
  const required = category.env || [];
  const optional = category.optionalEnv || [];
  const anyOf = category.anyOfEnv || [];
  const missingRequired = required.filter(key => !envReport[key]);
  const anyOfReady = anyOf.length === 0 || anyOf.some(key => envReport[key]);
  const missingAnyOf = anyOfReady ? [] : anyOf;
  const items = [
    ...required.map(key => ({ key, label: key, ready: Boolean(envReport[key]), source: 'env' })),
    ...optional.map(key => ({ key, label: key, ready: Boolean(envReport[key]), source: 'optional_env' })),
    ...(anyOf.length ? [{ key: anyOf.join('|'), label: `One of: ${anyOf.join(', ')}`, ready: anyOfReady, source: 'any_env' }] : [])
  ];
  return {
    id: category.id,
    label: category.label,
    ready: missingRequired.length === 0 && anyOfReady,
    missing_env: [...missingRequired, ...missingAnyOf],
    optional_missing_env: optional.filter(key => !envReport[key]),
    final_action: category.final,
    items
  };
}

function evaluateOperationalGates(known) {
  const dunsReady = known.duns.length === 9;
  const items = [
    {
      key: 'duns',
      label: 'Confirmed 9-digit D-U-N-S',
      ready: dunsReady,
      ceo_action: 'Confirm the IIS D-U-N-S before Microsoft/AWS partner submission.'
    },
    {
      key: 'legal_profile',
      label: 'Legal profile/address confirmed',
      ready: known.legal_profile_confirmed,
      ceo_action: 'Confirm legal name/address profile before partner portal submit.'
    },
    {
      key: 'microsoft_partner_review',
      label: 'Microsoft partner draft reviewed',
      ready: known.microsoft_partner_reviewed,
      ceo_action: 'Review Microsoft Cloud Partner draft and click Submit only if accurate.'
    },
    {
      key: 'aws_partner_review',
      label: 'AWS partner draft reviewed',
      ready: known.aws_partner_reviewed,
      ceo_action: 'Review AWS Partner draft and click Submit only if accurate.'
    },
    {
      key: 'provider_account',
      label: 'Whereby/Daily account approved',
      ready: known.whereby_or_daily_account_ready,
      ceo_action: 'Approve provider account/key setup before real external room probe.'
    },
    {
      key: 'slack_app_approval',
      label: 'Slack app approval/install ready',
      ready: known.slack_app_approval_ready,
      ceo_action: 'Approve Slack app install/submission in the provider surface.'
    },
    {
      key: 'admin_tokens',
      label: 'Admin tokens/env setup ready',
      ready: known.admin_tokens_ready,
      ceo_action: 'Set required admin/env tokens through the hosting/provider dashboard.'
    },
    {
      key: 'production_publish',
      label: 'Production publish approved',
      ready: known.production_publish_approved,
      ceo_action: 'Approve risky production publish only after reviewing deployment grouping.'
    }
  ];
  return {
    ready: items.every(item => item.ready),
    score: Math.round((items.filter(item => item.ready).length / items.length) * 100),
    items
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...cors(), 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}
