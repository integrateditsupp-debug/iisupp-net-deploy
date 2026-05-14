// aria-session — create a new ARIA session + ticket
// POST /.netlify/functions/aria-session
// Body: { firstName, lastName, email, phone, company?, license? }
// Returns: { sessionId, ticket, ok: true }
//
// Storage: Netlify Blobs
//   - companies/<slug>/counter.json   { count: N }
//   - sessions/<sid>/meta.json        { user, ticket, status, ts }
//   - sessions/<sid>/events.jsonl     append-only event log

const { getStore } = require('@netlify/blobs');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  // Validate required fields
  const { firstName, lastName, email, phone, company, license } = body;
  if (!firstName || !lastName) return resp(400, cors, { error: 'firstName and lastName required' });
  if (!email || !EMAIL_RE.test(email)) return resp(400, cors, { error: 'valid email required' });
  if (!phone) return resp(400, cors, { error: 'phone required' });

  // Determine company slug for per-company ticket counter
  // Priority: explicit company, then license, then email-domain, then _personal
  const companySlug = slugify(company || license || domainOf(email) || '_personal');

  // Atomic increment via Netlify Blobs CAS
  let sessions, companies;
  try {
    sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });
    companies = getStore({ name: 'aria-companies', consistency: 'strong' });
  } catch (e) {
    return resp(500, cors, { error: 'storage unavailable', detail: e.message });
  }

  let ticketNumber;
  try {
    // Read + increment counter (best-effort optimistic — under load, race possible.
    // For now this is fine; production would use Netlify Blobs metadata CAS or DB.)
    const counterKey = `${companySlug}/counter.json`;
    const existing = await companies.get(counterKey, { type: 'json' });
    const cur = (existing && typeof existing.count === 'number') ? existing.count : 0;
    ticketNumber = cur + 1;
    await companies.setJSON(counterKey, { count: ticketNumber, updated: Date.now() });
  } catch (e) {
    return resp(500, cors, { error: 'counter failed', detail: e.message });
  }

  const ticket = `ARIA-${String(ticketNumber).padStart(8, '0')}`;
  const sessionId = makeSessionId();
  const now = Date.now();

  const meta = {
    sessionId,
    ticket,
    companySlug,
    user: { firstName, lastName, email, phone, company: company || null, license: license || null },
    status: 'active',
    startedAt: now,
    endedAt: null,
    classification: { tier: null, difficulty: null }, // computed live
    summary: null
  };

  const startEvent = { type: 'session_start', ts: now, ticket, user: meta.user };

  try {
    await sessions.setJSON(`${sessionId}/meta.json`, meta);
    await sessions.set(`${sessionId}/events.jsonl`, JSON.stringify(startEvent) + '\n');
  } catch (e) {
    return resp(500, cors, { error: 'session write failed', detail: e.message });
  }

  return resp(200, cors, { ok: true, sessionId, ticket, companySlug });
};

function resp(status, cors, obj) {
  return { statusCode: status, headers: cors, body: JSON.stringify(obj) };
}

function slugify(s) {
  return String(s || '_personal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || '_personal';
}

function domainOf(email) {
  const m = String(email || '').match(/@([a-z0-9.-]+)$/i);
  return m ? m[1] : null;
}

function makeSessionId() {
  return 'sess_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
