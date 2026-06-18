'use strict';

const REQUIRED_BUSINESS_FIELDS = [
  'legal_name',
  'registered_address',
  'country',
  'website',
  'business_email',
  'phone',
  'duns'
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'POST required' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const action = String(body.action || 'check').toLowerCase();
  const company = normalizeCompany(body.company || body);

  if (action === 'reply_check') {
    return json(200, {
      ok: true,
      action,
      result: classifyPartnerReply(body.provider, body.message_text || body.reply || ''),
      safe_mode: 'No messages sent, no partner portal action taken.'
    });
  }

  const readiness = evaluateReadiness(company);

  if (action === 'draft_submission') {
    return json(200, {
      ok: true,
      action,
      readiness,
      drafts: buildPartnerDrafts(company, readiness),
      final_action_required: readiness.ready
        ? 'Ahmad must review and click Submit in each partner portal.'
        : 'Collect missing fields before any partner portal submission.',
      safe_mode: 'Draft only. This function does not submit, certify, create accounts, or accept terms.'
    });
  }

  return json(200, {
    ok: true,
    action: 'check',
    readiness,
    next_actions: readiness.ready
      ? ['Review Microsoft Cloud Partner draft', 'Review AWS Partner draft', 'CEO final submit only after portal review']
      : readiness.missing.map(field => `Provide confirmed ${field}`),
    safe_mode: 'No submission or external account creation performed.'
  });
};

function normalizeCompany(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const get = (...names) => {
    for (const name of names) {
      const value = source[name];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  };
  return {
    legal_name: get('legal_name', 'legalName', 'company_name', 'companyName') || 'Integrated IT Support Inc.',
    registered_address: get('registered_address', 'registeredAddress', 'address'),
    country: get('country') || 'Canada',
    website: normalizeWebsite(get('website', 'domain') || 'https://iisupp.net'),
    business_email: get('business_email', 'email'),
    phone: get('phone'),
    duns: get('duns', 'duns_number', 'dunsNumber').replace(/[^\d]/g, ''),
    owner_name: get('owner_name', 'ownerName') || 'Ahmad Wasee',
    support_email: get('support_email', 'supportEmail') || get('business_email', 'email')
  };
}

function evaluateReadiness(company) {
  const missing = REQUIRED_BUSINESS_FIELDS.filter(field => !company[field]);
  if (company.duns && company.duns.length !== 9) missing.push('valid 9 digit duns');
  const uniqueMissing = Array.from(new Set(missing));
  return {
    ready: uniqueMissing.length === 0,
    score: Math.max(0, Math.round(((REQUIRED_BUSINESS_FIELDS.length - uniqueMissing.length) / REQUIRED_BUSINESS_FIELDS.length) * 100)),
    missing: uniqueMissing,
    hard_blockers: uniqueMissing.includes('duns') || uniqueMissing.includes('valid 9 digit duns')
      ? ['D-U-N-S must be confirmed before Microsoft or AWS partner submissions.']
      : [],
    ceo_gate: 'Ahmad must perform final portal Submit/Accept/Certify actions.'
  };
}

function buildPartnerDrafts(company, readiness) {
  const common = {
    legal_business_name: company.legal_name,
    registered_address: company.registered_address,
    country: company.country,
    website: company.website,
    primary_contact: company.owner_name,
    primary_email: company.business_email,
    support_email: company.support_email,
    phone: company.phone,
    duns: company.duns,
    submit_ready: readiness.ready,
    do_not_submit_reason: readiness.ready ? '' : readiness.missing.join(', ')
  };
  return {
    microsoft_cloud_partner: {
      ...common,
      partner_motion: 'Cloud productivity, managed IT support, ARIA AI helpdesk assistant',
      customer_segments: ['SMB', 'professional services', 'regulated small business'],
      compliance_notes: ['Security.txt published', 'Vulnerability disclosure route staged', 'CEO final attestation required']
    },
    aws_partner_network: {
      ...common,
      partner_motion: 'AI support automation, managed cloud operations, small-business helpdesk modernization',
      offerings: ['ARIA AI assistant', 'Managed IT support', 'Cloud readiness and support automation'],
      compliance_notes: ['No claims of certification until AWS approval is received', 'CEO final terms acceptance required']
    }
  };
}

function classifyPartnerReply(provider, text) {
  const normalized = String(text || '').toLowerCase();
  const tags = [];
  if (/\bd[- ]?u[- ]?n[- ]?s\b|\bduns\b/.test(normalized)) tags.push('needs_duns');
  if (/approved|accepted|welcome to|congratulations/.test(normalized)) tags.push('approved_or_next_step');
  if (/reject|denied|not eligible|unable to approve/.test(normalized)) tags.push('rejected_or_ineligible');
  if (/verify|verification|confirm|additional information|documents/.test(normalized)) tags.push('verification_needed');
  if (/terms|agreement|accept|sign|certify/.test(normalized)) tags.push('ceo_final_action');
  if (!tags.length) tags.push('manual_review');

  const next = [];
  if (tags.includes('needs_duns')) next.push('Add confirmed D-U-N-S before proceeding.');
  if (tags.includes('verification_needed')) next.push('Prepare requested documentation; Ahmad must approve before upload.');
  if (tags.includes('ceo_final_action')) next.push('Escalate to Ahmad for final Accept/Sign/Certify action.');
  if (tags.includes('approved_or_next_step')) next.push('Record approval and stage partner profile updates.');
  if (tags.includes('rejected_or_ineligible')) next.push('Do not resubmit until rejection reason is reviewed.');
  if (tags.includes('manual_review')) next.push('Manual review required; no automated action recommended.');

  return {
    provider: provider || 'unknown',
    tags,
    next_actions: next,
    ceo_action_required: tags.includes('ceo_final_action') || tags.includes('approved_or_next_step') || tags.includes('verification_needed')
  };
}

function normalizeWebsite(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
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
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}
