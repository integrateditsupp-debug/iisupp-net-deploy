// aria-session — V2 ESM function (auto-wires Netlify Blobs)
// POST /.netlify/functions/aria-session

import { getStore } from '@netlify/blobs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp(405, cors, { error: 'POST only' });

  let body;
  try { body = await request.json(); }
  catch { return jsonResp(400, cors, { error: 'invalid JSON' }); }

  const { firstName, lastName, email, phone, company, license } = body;
  if (!firstName || !lastName) return jsonResp(400, cors, { error: 'firstName and lastName required' });
  if (!email || !EMAIL_RE.test(email)) return jsonResp(400, cors, { error: 'valid email required' });
  if (!phone) return jsonResp(400, cors, { error: 'phone required' });

  const companySlug = slugify(company || license || domainOf(email) || '_personal');

  let sessions, companies;
  try {
    sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });
    companies = getStore({ name: 'aria-companies', consistency: 'strong' });
  } catch (e) {
    return jsonResp(500, cors, { error: 'storage unavailable', detail: e.message });
  }

  let ticketNumber;
  try {
    const counterKey = `${companySlug}/counter.json`;
    const existing = await companies.get(counterKey, { type: 'json' });
    const cur = (existing && typeof existing.count === 'number') ? existing.count : 0;
    ticketNumber = cur + 1;
    await companies.setJSON(counterKey, { count: ticketNumber, updated: Date.now() });
  } catch (e) {
    return jsonResp(500, cors, { error: 'counter failed', detail: e.message });
  }

  const ticket = `ARIA-${String(ticketNumber).padStart(8, '0')}`;
  const sessionId = makeSessionId();
  const now = Date.now();

  const meta = {
    sessionId, ticket, companySlug,
    user: { firstName, lastName, email, phone, company: company || null, license: license || null },
    status: 'active',
    startedAt: now,
    endedAt: null,
    classification: { tier: null, difficulty: null },
    summary: null
  };

  const startEvent = { type: 'session_start', ts: now, ticket, user: meta.user };

  try {
    await sessions.setJSON(`${sessionId}/meta.json`, meta);
    await sessions.set(`${sessionId}/events.jsonl`, JSON.stringify(startEvent) + '\n');
  } catch (e) {
    return jsonResp(500, cors, { error: 'session write failed', detail: e.message });
  }

  return jsonResp(200, cors, { ok: true, sessionId, ticket, companySlug });
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
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
