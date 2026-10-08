#!/usr/bin/env node
// notify-lib.test.mjs — Rule 14 contract for netlify/functions/lib/notify.mjs.
// Proves that dormant (unconfigured) and failed provider paths NEVER report ok:true, that a confirmed
// provider id is the ONLY way to get ok:true, and that the notify-log record carries hashes + status
// only (no addresses, no bodies). fetch is mocked — nothing leaves the process.
//   node tests/notify-lib.test.mjs
import assert from 'node:assert/strict';

let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

// Clean slate: no providers configured.
for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'SMTP_APP_PASSWORD', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']) delete process.env[k];

const calls = [];
const realFetch = global.fetch;
let resendMode = 'ok'; // 'ok' | 'fail' | 'domain-then-ok' | 'domain-then-fail' | 'throw'
let twilioMode = 'ok';
global.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  const u = String(url);
  if (u.startsWith('https://api.resend.com/emails')) {
    const body = JSON.parse(init.body);
    if (resendMode === 'throw') throw new Error('socket hang up');
    if (resendMode === 'fail') return new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 });
    if (resendMode === 'domain-then-ok' || resendMode === 'domain-then-fail') {
      if (!/onboarding@resend\.dev/.test(body.from)) return new Response(JSON.stringify({ statusCode: 403, message: 'The iisupp.net domain is not verified' }), { status: 403 });
      if (resendMode === 'domain-then-fail') return new Response(JSON.stringify({ message: 'nope' }), { status: 422 });
      return new Response(JSON.stringify({ id: 'onb_123' }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'msg_abc' }), { status: 200 });
  }
  if (u.startsWith('https://api.twilio.com/')) {
    if (twilioMode === 'fail') return new Response(JSON.stringify({ code: 21211, message: 'Invalid To number' }), { status: 400 });
    if (twilioMode === 'no-sid') return new Response(JSON.stringify({}), { status: 200 });
    return new Response(JSON.stringify({ sid: 'SM123' }), { status: 201 });
  }
  throw new Error('unexpected network call in test: ' + u);
};

const notifyLib = await import('../netlify/functions/lib/notify.mjs');
const { sendEmail, sendSms, notify, hashIdentity, sanitizeEmailHtml, sanitizeFrom, _setLogStoreFactory } = notifyLib;

// In-memory notify-log store so the test proves what gets written.
const logWrites = [];
_setLogStoreFactory(() => ({ async setJSON(k, v) { logWrites.push({ k, v }); } }));

console.log('[notify] pure helpers');
ok('hashIdentity is 16 hex chars and case/space-insensitive', /^[0-9a-f]{16}$/.test(hashIdentity('A@B.com')) && hashIdentity(' a@b.com ') === hashIdentity('A@B.COM'));
ok('sanitizeEmailHtml escapes & < > " \'', sanitizeEmailHtml(`<b>"x" & 'y'</b>`) === '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
ok('sanitizeFrom keeps a valid "Name <addr>"', sanitizeFrom('ARIA <noreply@iisupp.net>') === 'ARIA <noreply@iisupp.net>');
ok('sanitizeFrom repairs a bare-name-with-email string', /<noreply@iisupp\.net>$/.test(sanitizeFrom('ARIA noreply@iisupp.net')));

console.log('[notify] dormant paths never report ok');
{
  const r = await sendEmail({ to: 'user@example.com', subject: 'hi', html: '<p>x</p>' });
  ok('no provider → ok:false', r.ok === false);
  ok('no provider → dormant:true + error named', r.dormant === true && r.error === 'no-email-provider-configured');
  ok('no provider → no network call', calls.length === 0);
  const s = await sendSms({ to: '+14165551234', body: 'hello' });
  ok('twilio unset → ok:false, dormant:true', s.ok === false && s.dormant === true && s.sid === null);
  ok('twilio unset → no network call', calls.length === 0);
}

console.log('[notify] failed provider never reports ok');
{
  process.env.RESEND_API_KEY = 're_test';
  resendMode = 'fail';
  const r = await sendEmail({ to: 'user@example.com', subject: 'hi', html: '<p>x</p>' });
  ok('resend 401 → ok:false, provider null, id null', r.ok === false && r.provider === null && r.id === null);
  ok('resend 401 → error says all paths failed (not dormant)', r.error === 'all-email-paths-failed' && r.dormant === false);
  ok('resend 401 → attempts recorded', Array.isArray(r.attempts) && r.attempts.some((a) => a.startsWith('resend:401')));
  resendMode = 'throw';
  const r2 = await sendEmail({ to: 'user@example.com', subject: 'hi', text: 'plain' });
  ok('resend exception → ok:false', r2.ok === false && /exception/.test(r2.attempts.join('|')));
  resendMode = 'domain-then-fail';
  const r3 = await sendEmail({ to: 'user@example.com', subject: 'hi', html: '<p>x</p>' });
  ok('domain-not-verified + failed onboarding fallback → ok:false (fallback response is CHECKED)', r3.ok === false && r3.attempts.some((a) => a.startsWith('resend-onboarding:422')));
}

console.log('[notify] confirmed provider id is the only ok:true');
{
  resendMode = 'ok';
  calls.length = 0;
  const r = await sendEmail({ to: 'user@example.com', subject: 'hi', html: '<p>x</p>', replyTo: 'ahmad@iisupp.net', bcc: ['ops@iisupp.net'], tag: 'test tag' });
  ok('resend 200 + id → ok:true provider resend', r.ok === true && r.provider === 'resend' && r.id === 'msg_abc');
  const sent = JSON.parse(calls[0].init.body);
  ok('payload carries to/subject/html/text/reply_to/bcc/tags', sent.to[0] === 'user@example.com' && sent.subject === 'hi' && sent.html && sent.text === 'x' && sent.reply_to === 'ahmad@iisupp.net' && sent.bcc[0] === 'ops@iisupp.net' && sent.tags[0].value === 'test_tag');
  ok('auth header carries the key', calls[0].init.headers.Authorization === 'Bearer re_test');
  resendMode = 'domain-then-ok';
  const r2 = await sendEmail({ to: 'user@example.com', subject: 'hi', html: '<p>x</p>' });
  ok('onboarding fallback with id → ok:true provider resend-onboarding (and says so)', r2.ok === true && r2.provider === 'resend-onboarding' && /account owner/.test(r2.note));
  const bad = await sendEmail({ to: 'not-an-email', subject: 'hi', html: 'x' });
  ok('invalid recipient → ok:false invalid-recipient', bad.ok === false && bad.error === 'invalid-recipient');
}

console.log('[notify] sms');
{
  process.env.TWILIO_ACCOUNT_SID = 'AC123'; process.env.TWILIO_AUTH_TOKEN = 'tok'; process.env.TWILIO_PHONE_NUMBER = '+16475813182';
  twilioMode = 'fail';
  const s = await sendSms({ to: '+14165551234', body: 'hello' });
  ok('twilio 400 → ok:false, error carries code', s.ok === false && s.dormant === false && /twilio-400/.test(s.error));
  twilioMode = 'no-sid';
  const s2 = await sendSms({ to: '+14165551234', body: 'hello' });
  ok('twilio 200 without sid → ok:false (no sid, no delivery claim)', s2.ok === false);
  twilioMode = 'ok';
  calls.length = 0;
  const s3 = await sendSms({ to: '+14165551234', body: 'x'.repeat(2000) });
  ok('twilio sid → ok:true', s3.ok === true && s3.sid === 'SM123');
  const form = new URLSearchParams(calls[0].init.body);
  ok('body capped at 1600 chars, From/To set', form.get('Body').length === 1600 && form.get('From') === '+16475813182' && form.get('To') === '+14165551234');
}

console.log('[notify] fan-out + log record');
{
  resendMode = 'ok'; twilioMode = 'ok'; logWrites.length = 0;
  const r = await notify({
    recipients: [
      { email: 'alice@example.com', phone: '+14165550000', name: 'Alice', role: 'tech-poc' },
      { email: 'bob@example.com', role: 'admin' },
    ],
    subject: 'Device alert', html: '<p>secret body text</p>', sms: 'Device alert for your fleet', tag: 'device-alert', tenant: 'acme.example',
  });
  ok('notify ok when at least one confirmed; counts delivered', r.ok === true && r.delivered === 3 && r.failed === 0);
  ok('per-recipient results carry email/sms results', r.results[0].email.ok && r.results[0].sms.ok && r.results[1].email.ok && r.results[1].sms === null);
  ok('log written under YYYY-MM-DD/<id>', logWrites.length === 1 && /^\d{4}-\d{2}-\d{2}\/[0-9a-f]{16}$/.test(logWrites[0].k) && r.log.key === logWrites[0].k);
  const rec = JSON.stringify(logWrites[0].v);
  ok('log stores hashes + status only — no address, no phone, no body', !/alice@|bob@|\+1416|secret body|Device alert/.test(rec) && logWrites[0].v.recipients[0].email_hash === hashIdentity('alice@example.com'));
  ok('log tenant is hashed', logWrites[0].v.tenant === hashIdentity('acme.example'));

  delete process.env.RESEND_API_KEY; delete process.env.TWILIO_ACCOUNT_SID;
  logWrites.length = 0;
  const d = await notify({ recipients: [{ email: 'alice@example.com', phone: '+14165550000' }], subject: 's', text: 't', sms: 'm', tag: 'x' });
  ok('all channels dormant → ok:false with dormant count (never a false success)', d.ok === false && d.delivered === 0 && d.dormant === 2);
  ok('dormant run is still logged with status dormant', logWrites.length === 1 && logWrites[0].v.recipients[0].email_status === 'dormant' && logWrites[0].v.recipients[0].sms_status === 'dormant');
}

global.fetch = realFetch;
console.log(`\nnotify-lib: ${pass} checks passed`);
