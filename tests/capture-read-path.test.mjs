#!/usr/bin/env node
// capture-read-path.test.mjs — RUN-CU 2026-10-09 (small-tasks close-out, task 2).
// The three capture endpoints (aria-lead-capture, aria-health-lead, aria-contact-back) persisted every record
// to Blobs and answered `405 POST only` to any attempt to read it back — the outbound/reply lanes wrote into
// a channel nobody could read from. Each now has a GET read path through lib/capture-read.cjs. This suite
// proves, against an in-memory Blobs store (nothing leaves the process, no network, no real store):
//   - GET is admin-only and fail-closed: 503 when no token is configured, 401 without/with the wrong one,
//     a token in the query string is refused, and the admin data carries no CORS wildcard;
//   - the shape: { ok:true, count, items:[...] } newest first, capped at 200, `limit` only lowers the cap;
//   - `?since=<iso>` filters, and an unparseable `since` is a 400 rather than "everything";
//   - each endpoint reads ONLY its own prefix of the shared `aria-leads` store;
//   - Blobs unavailable → 503, never an empty 200 (real-or-empty, Rule 14);
//   - the POST path is untouched: OPTIONS still 204, PUT still 405, POST without a body still 400.
//   node tests/capture-read-path.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['ARIA_ADMIN_TOKEN', 'SENTINEL_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET', 'RESEND_API_KEY', 'RESEND_FROM', 'SMTP_APP_PASSWORD']) delete process.env[k];
global.fetch = async (url) => { throw new Error('unexpected network call in test: ' + String(url)); };

// ---- in-memory Blobs (same shape as the real store: list({prefix}) → {blobs:[{key}]}, get(key,{type:'json'}))
const stores = new Map();
let blobsDown = false;
function memStore(name) {
  if (blobsDown) throw new Error('blobs down');
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
      async list(o) { const p = o && o.prefix; return { blobs: [...m.keys()].filter((key) => !p || key.startsWith(p)).map((key) => ({ key })) }; },
      _m: m,
    });
  }
  return stores.get(name);
}
const CR = require_('../netlify/functions/lib/capture-read.cjs');
CR._setStoreFactory((name) => memStore(name));

const leadFn = require_('../netlify/functions/aria-lead-capture.js');
const healthFn = (await import('../netlify/functions/aria-health-lead.mjs')).default;
const contactFn = (await import('../netlify/functions/aria-contact-back.mjs')).default;

const TOKEN = 'capture-read-test-token-0123456789';
const T0 = Date.parse('2026-09-01T00:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

// seed: 5 leads, 3 health leads, 4 bookings — timestamps deliberately out of key order
const leads = memStore('aria-leads');
for (let i = 0; i < 5; i++) await leads.setJSON(`lead/${T0 + i * 86400000}_hash${i}`, { at: iso(T0 + i * 86400000), name: `Lead ${i}`, email: `lead${i}@example.com`, source: '/aria' });
for (let i = 0; i < 3; i++) await leads.setJSON(`health/${T0 + i * 3600000}_health${i}_example_com.json`, { createdAt: T0 + i * 3600000, name: `Health ${i}`, email: `health${i}@example.com`, score: 40 + i });
const bookings = memStore('aria-bookings');
for (let i = 0; i < 4; i++) await bookings.setJSON(`${T0 + i * 7200000}_hash${i}.json`, { createdAt: T0 + i * 7200000, date: '2026-10-2' + i, time: '10:00', user: { email: `book${i}@example.com` } });

// ---- request builders for both handler shapes
const legacyGet = (query = {}, headers = {}) => ({ httpMethod: 'GET', headers: { host: 'iisupp.net', 'x-nf-client-connection-ip': '203.0.113.7', ...headers }, queryStringParameters: query, body: '' });
const legacy = (method, body, headers = {}) => ({ httpMethod: method, headers: { host: 'iisupp.net', 'content-type': 'application/json', ...headers }, body: body == null ? '' : JSON.stringify(body), queryStringParameters: {} });
const fetchGet = (fn, query = {}, headers = {}) => fn(new Request('https://iisupp.net/.netlify/functions/x?' + new URLSearchParams(query), { method: 'GET', headers: { 'x-nf-client-connection-ip': '203.0.113.8', ...headers } }));
const fetchReq = (fn, method, body, headers = {}) => fn(new Request('https://iisupp.net/.netlify/functions/x', { method, headers: { 'content-type': 'application/json', ...headers }, body: body == null ? undefined : JSON.stringify(body) }));
const read = async (r) => { if (r instanceof Response) return { status: r.status, json: await r.json().catch(() => null), headers: Object.fromEntries(r.headers.entries()) }; let j = null; try { j = JSON.parse(r.body); } catch {} return { status: r.statusCode, json: j, headers: r.headers || {} }; };

console.log('[capture-read] fail-closed gate');
{
  const r0 = await read(await leadFn.handler(legacyGet({}, { 'x-admin-token': TOKEN })));
  ok('no admin token configured → 503 not-configured (never fail-open)', r0.status === 503 && r0.json.ok === false && r0.json.error === 'not-configured');
  process.env.ARIA_ADMIN_TOKEN = TOKEN;
  const r1 = await read(await leadFn.handler(legacyGet()));
  ok('no token on the request → 401', r1.status === 401 && r1.json.error === 'unauthorized');
  const r2 = await read(await leadFn.handler(legacyGet({}, { 'x-admin-token': 'wrong-token-of-similar-length-00' })));
  ok('wrong token → 401', r2.status === 401);
  const r3 = await read(await leadFn.handler(legacyGet({ admin_token: TOKEN, token: TOKEN })));
  ok('token in the query string is refused (tokens never go in access logs)', r3.status === 401);
  const r4 = await read(await leadFn.handler(legacyGet({}, { 'x-admin-token': TOKEN })));
  ok('correct header token → 200 ok:true', r4.status === 200 && r4.json.ok === true && r4.json.via === 'ARIA_ADMIN_TOKEN');
  ok('admin data carries no CORS wildcard and is not cacheable', !('Access-Control-Allow-Origin' in r4.headers) && r4.headers['Cache-Control'] === 'no-store');
  const r5 = await read(await fetchGet(healthFn, {}, { authorization: 'Bearer ' + TOKEN }));
  ok('Fetch-style handler accepts a Bearer token → 200', r5.status === 200 && r5.json.ok === true);
  const r6 = await read(await fetchGet(contactFn));
  ok('Fetch-style handler without a token → 401', r6.status === 401);
}

console.log('[capture-read] shape — newest first, own prefix only');
{
  const r = await read(await leadFn.handler(legacyGet({}, { 'x-admin-token': TOKEN })));
  ok('aria-lead-capture GET returns the 5 lead/ records and none of the health/ ones', r.json.count === 5 && r.json.items.length === 5 && r.json.items.every((i) => i.key.startsWith('lead/')));
  ok('newest first', r.json.items[0].name === 'Lead 4' && r.json.items[4].name === 'Lead 0' && r.json.newest_first === true);
  ok('each item carries its key, an ISO `at`, and the stored record', r.json.items[0].key === `lead/${T0 + 4 * 86400000}_hash4` && r.json.items[0].at === iso(T0 + 4 * 86400000) && r.json.items[0].email === 'lead4@example.com');
  ok('store + prefix are named in the response, cap not hit', r.json.store === 'aria-leads' && r.json.prefix === 'lead/' && r.json.capped === false);
  const h = await read(await fetchGet(healthFn, {}, { 'x-admin-token': TOKEN }));
  ok('aria-health-lead GET returns only the 3 health/ records, newest first', h.json.count === 3 && h.json.items.every((i) => i.key.startsWith('health/')) && h.json.items[0].name === 'Health 2');
  const c = await read(await fetchGet(contactFn, {}, { 'x-admin-token': TOKEN }));
  ok('aria-contact-back GET returns the 4 bookings, newest first', c.json.count === 4 && c.json.store === 'aria-bookings' && c.json.items[0].user.email === 'book3@example.com');
}

console.log('[capture-read] since + limit');
{
  const since = iso(T0 + 2 * 86400000);
  const r = await read(await leadFn.handler(legacyGet({ since }, { 'x-admin-token': TOKEN })));
  ok('?since=<iso> keeps records at or after it (3 of 5)', r.json.count === 3 && r.json.items.every((i) => Date.parse(i.at) >= Date.parse(since)) && r.json.since === since);
  const ms = await read(await leadFn.handler(legacyGet({ since: String(T0 + 4 * 86400000) }, { 'x-admin-token': TOKEN })));
  ok('?since=<epoch ms> works too (1 of 5)', ms.json.count === 1 && ms.json.items[0].name === 'Lead 4');
  const bad = await read(await leadFn.handler(legacyGet({ since: 'last tuesday' }, { 'x-admin-token': TOKEN })));
  ok('unparseable since → 400 bad_since, not "everything"', bad.status === 400 && bad.json.error === 'bad_since');
  const lim = await read(await leadFn.handler(legacyGet({ limit: '2' }, { 'x-admin-token': TOKEN })));
  ok('?limit=2 lowers the cap and says so (capped:true)', lim.json.count === 2 && lim.json.capped === true && lim.json.items[0].name === 'Lead 4');
  const big = await read(await leadFn.handler(legacyGet({ limit: '99999' }, { 'x-admin-token': TOKEN })));
  ok('?limit above 200 cannot raise the cap', big.json.count === 5 && CR.parseLimit('99999') === 200 && CR.MAX_ITEMS === 200);
}

console.log('[capture-read] the 200 cap');
{
  const bulk = memStore('aria-bookings');
  for (let i = 0; i < 260; i++) await bulk.setJSON(`${T0 + 10 * 86400000 + i * 1000}_bulk${i}.json`, { createdAt: T0 + 10 * 86400000 + i * 1000, user: { email: `bulk${i}@example.com` } });
  const r = await read(await fetchGet(contactFn, {}, { 'x-admin-token': TOKEN }));
  ok('264 bookings → 200 returned, capped:true, newest first', r.json.count === 200 && r.json.capped === true && r.json.items[0].user.email === 'bulk259@example.com' && r.json.scanned === 264);
}

console.log('[capture-read] Blobs unavailable is a 503, never an empty 200');
{
  blobsDown = true;
  const r = await read(await leadFn.handler(legacyGet({}, { 'x-admin-token': TOKEN })));
  ok('store cannot be opened → 503 blobs_unavailable', r.status === 503 && r.json.ok === false && r.json.error === 'blobs_unavailable');
  blobsDown = false;
}

console.log('[capture-read] POST path untouched');
{
  const o = await leadFn.handler(legacy('OPTIONS', null));
  ok('aria-lead-capture OPTIONS still 204 with the public CORS headers', o.statusCode === 204 && o.headers['Access-Control-Allow-Origin'] === '*' && o.headers['Access-Control-Allow-Methods'] === 'POST, OPTIONS');
  const p = await read(await leadFn.handler(legacy('PUT', {})));
  ok('aria-lead-capture PUT still 405 POST only', p.status === 405 && p.json.error === 'POST only');
  const e = await read(await leadFn.handler(legacy('POST', {})));
  ok('aria-lead-capture POST without name+email still 400', e.status === 400 && /name \+ email required/.test(e.json.error));
  const hp = await read(await fetchReq(healthFn, 'PUT', {}));
  ok('aria-health-lead PUT still 405 POST only', hp.status === 405 && hp.json.error === 'POST only');
  const he = await read(await fetchReq(healthFn, 'POST', { name: 'x' }));
  ok('aria-health-lead POST without a valid email still 400', he.status === 400 && /valid email required/.test(he.json.error));
  const cp = await read(await fetchReq(contactFn, 'PUT', {}));
  ok('aria-contact-back PUT still 405 POST only', cp.status === 405 && cp.json.error === 'POST only');
  const ce = await read(await fetchReq(contactFn, 'POST', {}));
  ok('aria-contact-back POST without date+time still 400', ce.status === 400 && /date \+ time required/.test(ce.json.error));
  const co = await fetchReq(contactFn, 'OPTIONS', null);
  ok('aria-contact-back OPTIONS still 204', co.status === 204 && co.headers.get('Access-Control-Allow-Origin') === '*');
}

console.log('[capture-read] helpers');
{
  ok('timestampOf prefers numeric createdAt, then ISO at, then the key', CR.timestampOf('x', { createdAt: 5 }) === 5 && CR.timestampOf('x', { at: '2026-01-01T00:00:00Z' }) === Date.parse('2026-01-01T00:00:00Z') && CR.timestampOf('lead/1700000000000_abc', {}) === 1700000000000 && CR.timestampOf('nope', {}) === 0);
  ok('parseSince: empty → null, ISO → ms, junk → NaN', CR.parseSince('') === null && CR.parseSince('2026-10-01T00:00:00Z') === Date.parse('2026-10-01T00:00:00Z') && Number.isNaN(CR.parseSince('junk')));
}

console.log(`capture-read-path: ${pass} checks passed`);
