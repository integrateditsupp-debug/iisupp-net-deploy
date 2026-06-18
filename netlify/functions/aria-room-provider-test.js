'use strict';

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

  const action = String(body.action || 'status').toLowerCase();
  const status = providerStatus();

  if (action === 'mock_contract') {
    const consent = normalizeConsent(body.consent || body);
    const failures = validateConsent(consent);
    return json(200, {
      ok: failures.length === 0,
      action,
      status,
      failures,
      mock_room: failures.length ? null : buildMockRoom(consent),
      safe_mode: 'Mock only. No Whereby/Daily room created and no recording started.'
    });
  }

  if (action === 'probe') {
    if (body.confirm_probe !== 'CREATE_AND_DELETE_TEST_ROOM') {
      return json(400, {
        ok: false,
        error: 'Probe requires confirm_probe=CREATE_AND_DELETE_TEST_ROOM',
        status,
        safe_mode: 'Blocked to prevent accidental external room creation.'
      });
    }
    if (!status.whereby_configured && !status.daily_configured) {
      return json(412, {
        ok: false,
        error: 'No provider API key configured',
        status,
        next_action: 'Add WHEREBY_API_KEY or DAILY_API_KEY, then rerun the explicit probe.'
      });
    }
    return json(200, {
      ok: true,
      action,
      status,
      result: 'Provider key detected. Run aria-room-provider create_room/delete_room against a disposable test tenant after CEO approval.',
      safe_mode: 'This test endpoint validates configuration only; it does not create external rooms.'
    });
  }

  return json(200, {
    ok: true,
    action: 'status',
    status,
    supported_actions: ['status', 'mock_contract', 'probe'],
    safe_mode: 'No room creation performed.'
  });
};

function providerStatus() {
  return {
    whereby_configured: Boolean(process.env.WHEREBY_API_KEY),
    daily_configured: Boolean(process.env.DAILY_API_KEY),
    preferred_provider: process.env.ARIA_ROOM_PROVIDER || (process.env.WHEREBY_API_KEY ? 'whereby' : process.env.DAILY_API_KEY ? 'daily' : 'stub'),
    consent_required: true,
    recording_requires_explicit_consent: true,
    remote_control_requires_explicit_consent: true
  };
}

function normalizeConsent(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    email: String(source.email || '').trim().toLowerCase(),
    tenant: String(source.tenant || source.company || '').trim(),
    screen_share_allowed: source.screen_share_allowed === true || source.screen_share_allowed === 'yes',
    recording_allowed: source.recording_allowed === true || source.recording_allowed === 'yes',
    remote_control_allowed: source.remote_control_allowed === true || source.remote_control_allowed === 'yes',
    notes: String(source.notes || '').trim()
  };
}

function validateConsent(consent) {
  const failures = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(consent.email)) failures.push('valid customer email required');
  if (!consent.tenant) failures.push('tenant/company required');
  if (!consent.screen_share_allowed) failures.push('screen-share consent required');
  if (consent.recording_allowed && !/record|recording/i.test(consent.notes)) {
    failures.push('recording consent requires explicit note');
  }
  if (consent.remote_control_allowed && !/control|remote/i.test(consent.notes)) {
    failures.push('remote-control consent requires explicit note');
  }
  return failures;
}

function buildMockRoom(consent) {
  const id = `mock-${Date.now().toString(36)}`;
  return {
    id,
    provider: 'mock',
    tenant: consent.tenant,
    join_url: `https://iisupp.net/mock-room/${id}`,
    expires_in_minutes: 45,
    recording_allowed: consent.recording_allowed,
    remote_control_allowed: consent.remote_control_allowed,
    deletion_required: true
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
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}
