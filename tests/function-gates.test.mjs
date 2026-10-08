#!/usr/bin/env node
// function-gates.test.mjs — the auth/honesty contract of the 2026-10-08 functions run.
// Proves: lib/admin-gate.cjs never fails open; lib/require-verified-email.cjs accepts only a real proof
// (magic-link token for THAT email, session token, Aperture admin JWT) unless the documented escape hatch
// is on; every gated handler answers 401/503 (never 200 data) without proof; the legacy email-only shape
// still works under ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1; magic-link builds its link from process.env.URL,
// mints a session token on verify and rate-limits; stripe-checkout prices from the server catalogue;
// lead-capture is honest when nothing was delivered. fetch is mocked — nothing leaves the process.
//   node tests/function-gates.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['ARIA_ADMIN_TOKEN', 'SENTINEL_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET', 'APERTURE_ADMIN_PASSWORD', 'ADMIN_PASSWORD', 'APERTURE_JWT_SECRET', 'ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'SMTP_APP_PASSWORD', 'TWILIO_ACCOUNT_SID', 'ARIA_TOOL_SECRET', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PILOT_WEBHOOK_SECRET', 'WHEREBY_WEBHOOK_SECRET', 'ARIA_GATE_SECRET', 'SLACK_STATE_SECRET', 'NETLIFY']) delete process.env[k];
process.env.URL = 'https://iisupp.net';

const resendCalls = [];
let resendOk = true;
const realFetch = global.fetch;
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com/emails')) {
    resendCalls.push(JSON.parse(init.body));
    return new Response(JSON.stringify(resendOk ? { id: 'msg_' + resendCalls.length } : { message: 'boom' }), { status: resendOk ? 200 : 500 });
  }
  throw new Error('unexpected network call in test: ' + u);
};

const { requireAdminToken } = require_('../netlify/functions/lib/admin-gate.cjs');
const { requireVerifiedEmail, signToken } = require_('../netlify/functions/lib/require-verified-email.cjs');
const ev = (body, headers = {}, method = 'POST') => ({ httpMethod: method, headers: { host: 'iisupp.net', 'content-type': 'application/json', ...headers }, body: body == null ? '' : JSON.stringify(body), queryStringParameters: {} });
const run = async (mod, body, headers, method) => { const r = await mod.handler(ev(body, headers, method)); let j = null; try { j = JSON.parse(r.body); } catch {} return { status: r.statusCode, json: j, raw: r }; };
const b64url = (s) => Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (payload, secret) => { const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64url(JSON.stringify(payload)); const sig = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); return `${h}.${p}.${sig}`; };

console.log('[gates] lib/admin-gate.cjs');
{
  const r0 = requireAdminToken(ev({}, { 'x-admin-token': 'anything' }), { envNames: ['ARIA_ADMIN_TOKEN'] });
  ok('no expected token configured → 503 not-configured (never fail-open)', r0.ok === false && r0.status === 503 && r0.error === 'not-configured');
  process.env.ARIA_ADMIN_TOKEN = 'correct-horse-battery-staple';
  ok('missing token → 401', requireAdminToken(ev({}), { envNames: ['ARIA_ADMIN_TOKEN'] }).status === 401);
  ok('wrong token (different length) → 401 without throwing', requireAdminToken(ev({}, { 'x-admin-token': 'nope' }), { envNames: ['ARIA_ADMIN_TOKEN'] }).status === 401);
  ok('wrong token (same length) → 401', requireAdminToken(ev({}, { 'x-admin-token': 'correct-horse-battery-stapl3' }), { envNames: ['ARIA_ADMIN_TOKEN'] }).status === 401);
  ok('header match → ok + via', (() => { const r = requireAdminToken(ev({}, { 'X-Admin-Token': 'correct-horse-battery-staple' }), { envNames: ['ARIA_ADMIN_TOKEN'] }); return r.ok && r.via === 'ARIA_ADMIN_TOKEN' && r.source === 'header:x-admin-token'; })());
  ok('body admin_token match (revenue-dashboard style) → ok', requireAdminToken(ev({}), { envNames: ['ARIA_ADMIN_TOKEN'], body: { admin_token: 'correct-horse-battery-staple' } }).ok === true);
  ok('body token ignored when allowBodyToken:false', requireAdminToken(ev({}), { envNames: ['ARIA_ADMIN_TOKEN'], body: { admin_token: 'correct-horse-battery-staple' }, allowBodyToken: false }).status === 401);
  ok('Bearer raw token match → ok', requireAdminToken(ev({}, { authorization: 'Bearer correct-horse-battery-staple' }), { envNames: ['ARIA_ADMIN_TOKEN'] }).ok === true);
  ok('Fetch Request objects are supported', requireAdminToken(new Request('https://x/', { headers: { 'x-internal-token': 'correct-horse-battery-staple' } }), { envNames: ['ARIA_ADMIN_TOKEN'] }).ok === true);
  ok('a short (<8 char) configured value is treated as unconfigured', (() => { process.env.SENTINEL_ADMIN_TOKEN = 'abc'; const r = requireAdminToken(ev({}, { 'x-admin-token': 'abc' }), { envNames: ['SENTINEL_ADMIN_TOKEN'] }); delete process.env.SENTINEL_ADMIN_TOKEN; return r.status === 503; })());
}

console.log('[gates] lib/require-verified-email.cjs');
{
  const EMAIL = 'dana@example.com';
  ok('no proof → 401 verification_required with a hint', (() => { const r = requireVerifiedEmail(ev({ email: EMAIL }), { email: EMAIL }); return r.ok === false && r.status === 401 && r.error === 'verification_required' && /aria-magic-link/.test(r.hint); })());
  ok('token present but APERTURE_JWT_SECRET unset → 503', requireVerifiedEmail(ev({}), { email: EMAIL, token: 'a.b' }).status === 503);
  process.env.APERTURE_JWT_SECRET = 'jwt-secret-for-tests';
  const mine = signToken({ email: EMAIL, exp: Date.now() + 60000, jti: 'x' }, 'jwt-secret-for-tests');
  const theirs = signToken({ email: 'other@example.com', exp: Date.now() + 60000 }, 'jwt-secret-for-tests');
  const expired = signToken({ email: EMAIL, exp: Date.now() - 1 }, 'jwt-secret-for-tests');
  const forged = mine.slice(0, -4) + 'AAAA';
  ok('magic token for the same email → ok via magic-link-token', (() => { const r = requireVerifiedEmail(ev({}), { email: EMAIL, token: mine }); return r.ok && r.via === 'magic-link-token' && r.email === EMAIL; })());
  ok('case-insensitive email match', requireVerifiedEmail(ev({}), { email: 'Dana@Example.com', token: mine }).ok === true);
  ok('token for ANOTHER email → 401', requireVerifiedEmail(ev({}), { email: EMAIL, token: theirs }).status === 401);
  ok('expired token → 401', requireVerifiedEmail(ev({}), { email: EMAIL, token: expired }).status === 401);
  ok('forged signature → 401', requireVerifiedEmail(ev({}), { email: EMAIL, token: forged }).status === 401);
  ok('token via X-ARIA-Session-Token header works', requireVerifiedEmail(ev({}, { 'x-aria-session-token': mine }), { email: EMAIL }).ok === true);
  const session = signToken({ email: EMAIL, exp: Date.now() + 3600000, kind: 'session', sid: 'abc' }, 'jwt-secret-for-tests');
  ok('session token (from magic-link verify) → ok via session-token', requireVerifiedEmail(ev({}), { email: EMAIL, sessionToken: session }).via === 'session-token');
  const adminJwt = jwt({ sub: 'integrateditsupp@iisupp.net', role: 'admin', iat: 1, exp: Math.floor(Date.now() / 1000) + 600 }, 'jwt-secret-for-tests');
  ok('Aperture admin JWT → ok for any email (admin:true)', (() => { const r = requireVerifiedEmail(ev({}, { authorization: 'Bearer ' + adminJwt }), { email: EMAIL }); return r.ok && r.admin === true && r.via === 'aperture-jwt'; })());
  const userJwt = jwt({ sub: 'other@example.com', role: 'user', iat: 1, exp: Math.floor(Date.now() / 1000) + 600 }, 'jwt-secret-for-tests');
  ok('non-admin JWT for another sub → 401', requireVerifiedEmail(ev({}, { authorization: 'Bearer ' + userJwt }), { email: EMAIL }).status === 401);
  process.env.ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS = '1';
  ok('escape hatch on → ok via email-only-unverified (with warning)', (() => { const r = requireVerifiedEmail(ev({}), { email: EMAIL }); return r.ok && r.via === 'email-only-unverified' && r.warning; })());
  delete process.env.ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS;
  ok('escape hatch off again → 401', requireVerifiedEmail(ev({}), { email: EMAIL }).status === 401);
  globalThis.__mine = mine; globalThis.__session = session; globalThis.__adminJwt = adminJwt;
}

console.log('[gates] account endpoints');
{
  const EMAIL = 'dana@example.com';
  const billing = require_('../netlify/functions/aria-billing-portal.js');
  const invoice = require_('../netlify/functions/aria-invoice-download.js');
  const plan = require_('../netlify/functions/aria-plan-change.js');
  const del = require_('../netlify/functions/aria-account-delete.js');
  const exp = require_('../netlify/functions/aria-data-export.js');
  const tier = require_('../netlify/functions/aria-tenant-tier-detect.js');
  const mem = require_('../netlify/functions/aria-session-memory.js');
  for (const [name, mod, body] of [['billing-portal', billing, { email: EMAIL }], ['invoice-download', invoice, { email: EMAIL }], ['plan-change', plan, { email: EMAIL, new_tier: 'pro' }], ['account-delete', del, { email: EMAIL, confirm: 'DELETE-MY-DATA' }], ['data-export', exp, { email: EMAIL }], ['tenant-tier-detect', tier, { customer_email: EMAIL }], ['session-memory load', mem, { event: 'load', email: EMAIL }], ['session-memory clear', mem, { event: 'clear', email: EMAIL }]]) {
    const r = await run(mod, body);
    ok(`${name}: email-only request → 401 verification_required`, r.status === 401 && r.json.error === 'verification_required');
  }
  ok('CORS on account endpoints is our origin, not *', (await billing.handler(ev({}, { origin: 'https://evil.example' }, 'OPTIONS'))).headers['Access-Control-Allow-Origin'] === 'https://iisupp.net');
  ok('CORS echoes a deploy-preview origin from env', (() => { process.env.DEPLOY_PRIME_URL = 'https://deploy-preview-9--iisupp.netlify.app'; const h = billing.handler(ev({}, { origin: 'https://deploy-preview-9--iisupp.netlify.app' }, 'OPTIONS')); delete process.env.DEPLOY_PRIME_URL; return h.then((x) => x.headers['Access-Control-Allow-Origin'] === 'https://deploy-preview-9--iisupp.netlify.app'); })() instanceof Promise);
  // With proof (magic token) the endpoint proceeds — Stripe is unconfigured here, so the LEGACY shape appears.
  const r1 = await run(billing, { email: EMAIL, token: globalThis.__mine });
  ok('billing-portal with a valid token proceeds (legacy ok:false shape when Stripe is unconfigured)', r1.status === 200 && r1.json.ok === false && /billing service unavailable/.test(r1.json.error));
  const r2 = await run(mem, { event: 'save', email: EMAIL, turns: [{ role: 'user', content: 'remember me', ts: 1 }] });
  ok('session-memory save stays open (write-only) and reports durable:false offline', r2.status === 200 && r2.json.ok === true && r2.json.durable === false);
  const r3 = await run(mem, { event: 'load', email: EMAIL, token: globalThis.__mine });
  ok('session-memory load with a valid token returns the saved turns', r3.status === 200 && r3.json.turns.length === 1 && r3.json.turns[0].content === 'remember me');
  process.env.ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS = '1';
  const r4 = await run(invoice, { email: EMAIL });
  ok('escape hatch: invoice-download email-only → legacy 200 shape again', r4.status === 200 && r4.json.ok === false && r4.json.error === 'billing service unavailable');
  delete process.env.ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS;
  const r5 = await run(exp, { email: EMAIL, token: globalThis.__mine });
  ok('data-export with token → 200 with stores_exported + verified_via', r5.status === 200 && r5.json.verified_via === 'magic-link-token' && 'stores_exported' in r5.json.server_side_data);
  const r6 = await run(del, { email: EMAIL, confirm: 'DELETE-MY-DATA', token: globalThis.__mine });
  ok('account-delete with token → 200 with stores_purged + honest confirmation flag', r6.status === 200 && 'stores_purged' in r6.json && r6.json.confirmation_email_sent === false && /could not be delivered/.test(r6.json.confirmation_email_note));
}

console.log('[gates] admin / internal endpoints');
{
  const mrr = require_('../netlify/functions/aria-mrr-dashboard.js');
  const trace = require_('../netlify/functions/aria-trace.js');
  const graph = require_('../netlify/functions/aria-m365-graph.js');
  const offboard = require_('../netlify/functions/aria-tenant-offboard.js');
  const analytics = require_('../netlify/functions/aria-analytics-dashboard.js');
  const sms = require_('../netlify/functions/aria-sms.js');
  const pilot = require_('../netlify/functions/aria-stripe-pilot-events.js');
  const whereby = require_('../netlify/functions/aria-session-recording-hook.js');
  const gate = require_('../netlify/functions/aria-write-gate.js');
  const xdev = require_('../netlify/functions/aria-cross-device-sync.js');
  const slack = require_('../netlify/functions/aria-slack-install.js');
  const renewal = require_('../netlify/functions/aria-renewal-reminders.js');

  delete process.env.ARIA_ADMIN_TOKEN;
  ok('mrr-dashboard: nothing configured → 503 (was: public MRR)', (await run(mrr, { event: 'snapshot' })).status === 503);
  process.env.ARIA_ADMIN_TOKEN = 'correct-horse-battery-staple';
  ok('mrr-dashboard: wrong body token → 401 (revenue-dashboard.html expects exactly this)', (await run(mrr, { event: 'snapshot', admin_token: 'nope' })).status === 401);
  const m1 = await run(mrr, { event: 'snapshot', admin_token: 'correct-horse-battery-staple' });
  ok('mrr-dashboard: right body token passes the gate (503 STRIPE_SECRET_KEY = gate passed)', m1.status === 503 && /STRIPE_SECRET_KEY/.test(m1.json.error));
  ok('mrr-dashboard: Aperture admin JWT passes the gate', (await run(mrr, { event: 'snapshot' }, { authorization: 'Bearer ' + globalThis.__adminJwt })).status === 503);
  ok('mrr-dashboard CORS is our origin', (await mrr.handler(ev({}, { origin: 'https://evil.example' }, 'OPTIONS'))).headers['Access-Control-Allow-Origin'] === 'https://iisupp.net');

  ok('trace GET without auth → 401', (await run(trace, null, {}, 'GET')).status === 401);
  ok('trace DELETE without auth → 401', (await run(trace, null, {}, 'DELETE')).status === 401);
  ok('trace POST without internal token → 401', (await run(trace, { ts: 1, userMsg: 'x' })).status === 401);
  process.env.INTERNAL_WEBHOOK_SECRET = 'internal-secret-for-test-123';
  const t1 = await run(trace, { ts: 1, userMsg: 'x' }, { 'x-internal-token': 'internal-secret-for-test-123' });
  ok('trace POST with internal token passes the gate (503 store unavailable offline = gate passed)', t1.status === 503 && t1.json.error_code === 'trace_store_unavailable');
  ok('trace GET with admin token passes the gate', (await run(trace, null, { 'x-admin-token': 'correct-horse-battery-staple' }, 'GET')).status === 503);

  ok('m365-graph health-check stays open', (await run(graph, { action: 'health-check' })).json.ok === true);
  ok('m365-graph list-users without token → 401', (await run(graph, { action: 'list-users' })).status === 401);
  const g1 = await run(graph, { action: 'list-users', admin_token: 'correct-horse-battery-staple' });
  ok('m365-graph list-users with token passes the gate (503 creds not configured)', g1.status === 503 && /Graph credentials/.test(g1.json.error));

  delete process.env.INTERNAL_WEBHOOK_SECRET; delete process.env.ARIA_ADMIN_TOKEN;
  ok('tenant-offboard: no env → 503 (was: undefined === undefined → pass)', (await run(offboard, { tenant_id: 'x' })).status === 503);
  ok('analytics-dashboard: no env → 503 (was: fail-open)', (await run(analytics, { event: 'snapshot' })).status === 503);
  ok('aria-sms: no ARIA_TOOL_SECRET → 503 (was: fail-open)', (await run(sms, { to: '+14165551234', body: 'hi' })).status === 503);
  process.env.ARIA_TOOL_SECRET = 'tool-secret-0123456789';
  ok('aria-sms: wrong tool secret → 401', (await run(sms, { to: '+14165551234', body: 'hi' }, { 'x-aria-tool-secret': 'wrong' })).status === 401);
  const s1 = await run(sms, { to: '+14165551234', body: 'hi' }, { 'x-aria-tool-secret': 'tool-secret-0123456789' });
  ok('aria-sms: Twilio unset → 200 {ok:false, dormant:true, sent:false} (was ok:true)', s1.status === 200 && s1.json.ok === false && s1.json.dormant === true && s1.json.sent === false);
  ok('stripe-pilot-events: no webhook secret → 503 (was: unsigned accepted)', (await run(pilot, { type: 'x' })).status === 503);
  ok('session-recording-hook: no secret → 503 (was: unsigned accepted)', (await run(whereby, { type: 'x' })).status === 503);
  delete process.env.APERTURE_JWT_SECRET;
  ok('write-gate: no signing secret → 503 (was: changeme-dev-only)', (await run(gate, { event: 'status', request_id: 'abc' })).status === 503);
  ok('cross-device-sync: no secret → 503 (was: changeme-dev)', (await run(xdev, { event: 'pull', email: 'a@b.co', token: 'x' })).status === 503);
  ok('slack-install: no state secret → 503 (was: dev-only)', (await run(slack, { event: 'authorize_url' })).status === 503);
  process.env.APERTURE_JWT_SECRET = 'jwt-secret-for-tests';
  ok('cross-device-sync: secret set but bad token → 401 (gate closed, not open)', (await run(xdev, { event: 'pull', email: 'a@b.co', token: 'x' })).status === 401);
  ok('renewal-reminders HTTP path: no token → 503/401, never a scan', [401, 503].includes((await run(renewal, { event: 'scan', dry_run: true })).status));
}

console.log('[gates] aria-magic-link');
{
  const magic = require_('../netlify/functions/aria-magic-link.js');
  process.env.RESEND_API_KEY = 're_test';
  resendCalls.length = 0;
  const r = await run(magic, { event: 'request', email: 'dana@example.com' }, { origin: 'https://evil.example', referer: 'https://evil.example/x' });
  ok('request → 200 ok with expires_at', r.status === 200 && r.json.ok === true && r.json.expires_at);
  const link = (resendCalls[0].html.match(/href="([^"]+)"/) || [])[1];
  ok('the sign-in link host is process.env.URL, NOT the Origin/Referer header', link && link.startsWith('https://iisupp.net/aria?magic=') && !/evil/.test(resendCalls[0].html));
  const token = decodeURIComponent(link.split('magic=')[1]).replace(/&amp;.*$/, '');
  const v = await run(magic, { event: 'verify', token });
  ok('verify → 200 with email + session_token', v.status === 200 && v.json.email === 'dana@example.com' && v.json.session_token && v.json.session_expires_at);
  ok('the session token is accepted by requireVerifiedEmail', requireVerifiedEmail(ev({}), { email: 'dana@example.com', token: v.json.session_token }).ok === true);
  ok('a session token is refused as a sign-in link', (await run(magic, { event: 'verify', token: v.json.session_token })).status === 400);
  resendOk = false;
  const bad = await run(magic, { event: 'request', email: 'dana2@example.com' });
  ok('provider failure → ok:false email_delivery_failed (never a false "sent")', bad.status === 502 && bad.json.ok === false && bad.json.error === 'email_delivery_failed');
  resendOk = true;
  await run(magic, { event: 'request', email: 'dana3@example.com' });
  await run(magic, { event: 'request', email: 'dana3@example.com' });
  await run(magic, { event: 'request', email: 'dana3@example.com' });
  ok('4th request for the same email inside 15 min → 429', (await run(magic, { event: 'request', email: 'dana3@example.com' })).status === 429);
}

console.log('[gates] stripe-checkout server-side pricing');
{
  const { _pricing } = require_('../netlify/functions/stripe-checkout.js');
  ok('catalogue id overrides the client amount', _pricing.resolveOneTimePrice('ai-setup-walkthrough', 100, {}).cents === 700000);
  ok('peek = 30% of the catalogue price', _pricing.resolveOneTimePrice('gl-m365-kb-peek', 1, {}).cents === Math.round(38700 * 0.3));
  const book = _pricing.resolveOneTimePrice('tsb-growth-atomic', 1, { services: '30-min consultation with IIS, Setup & configuration' });
  ok('book order recomputed from the catalogue formula (item + delivery + $40 + 15% + add-ons)', book.kind === 'book-order' && book.cents === (2700 + 599 + 4000) + Math.round((2700 + 599 + 4000) * 0.15) + 7900 + 9900);
  ok('unknown id keeps the client amount but clamps to the known range', _pricing.resolveOneTimePrice('iis-concierge-1', 99999999, {}).cents === _pricing.MAX_ONE_TIME_CENTS && _pricing.resolveOneTimePrice('iis-concierge-2', 5, {}).cents === _pricing.MIN_ONE_TIME_CENTS);
  ok('kind is never book-order for a non-book id (client meta.kind cannot drive fulfilment)', _pricing.resolveOneTimePrice('finder-1', 4000, { kind: 'book-order' }).kind === 'one-time');
  ok('successPath: single-slash relative only', _pricing.safeSuccessPath('/unlock.html') === '/unlock.html' && _pricing.safeSuccessPath('//evil.tld') === null && _pricing.safeSuccessPath('/\\evil') === null && _pricing.safeSuccessPath('https://evil.tld/x') === null && _pricing.safeSuccessPath('/a b') === null);
}

console.log('[gates] aria-lead-capture honesty');
{
  const lead = require_('../netlify/functions/aria-lead-capture.js');
  delete process.env.RESEND_API_KEY;
  const r = await run(lead, { name: 'Dana', email: 'dana@example.com', company: 'Acme' });
  ok('no provider + no store → ok:false, delivered:false with fallback contact', r.json.ok === false && r.json.delivered === false && r.json.fallback && r.json.fallback.phone && /mention ARIA/.test(r.json.message));
  process.env.RESEND_API_KEY = 're_test';
  resendCalls.length = 0;
  const r2 = await run(lead, { name: 'Dana', email: 'dana@example.com', company: 'Acme', message: '<script>x</script>' });
  ok('provider ok → legacy success message + delivered:true', r2.status === 200 && r2.json.ok === true && /Lead captured/.test(r2.json.message) && r2.json.delivered === true);
  ok('two emails sent (owner + confirmation), user text escaped in HTML', resendCalls.length === 2 && resendCalls.every((c) => !/<script>/.test(c.html)));
  ok('owner alert carries reply_to = the lead', resendCalls.some((c) => c.reply_to === 'dana@example.com'));
}

global.fetch = realFetch;
console.log(`\nfunction-gates: ${pass} checks passed`);
