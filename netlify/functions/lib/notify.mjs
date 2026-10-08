// lib/notify.mjs — the ONE honest notification helper for IIS / ARIA Netlify functions.
//
// Rule 14: a result is `ok:true` only when the provider confirmed delivery (Resend returned an id,
// SMTP returned a messageId, Twilio returned a sid). Unconfigured channels report `ok:false` and
// `dormant:true`; failures carry the error. Nothing here ever pretends.
//
// Lifted from the two copies the 2026-10-08 audit rated best: stripe-webhook.js sendResend()
// (checks r.ok && j.id, verifies the onboarding@resend.dev fallback) and aria-sms.js (Twilio block).
// SMTP (Gmail app password via nodemailer) is only a fallback and only when SMTP_* env is present.
//
// Usage (ESM):   import { sendEmail, sendSms, notify } from './lib/notify.mjs';
// Usage (CJS):   const { notify } = await import('./lib/notify.mjs');   // pattern: aria-admin-auth.js
//
// Env:
//   RESEND_API_KEY, RESEND_FROM            — primary email (RESEND_FROM must be a verified-domain sender)
//   SMTP_APP_PASSWORD, SMTP_SENDER, SMTP_AUTH_USER, SMTP_HOST, SMTP_PORT — optional SMTP fallback
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER — SMS (dormant until all three are set)
//
// Every notify() call appends ONE record to the `notify-log` Blobs store (key `${YYYY-MM-DD}/${id}`)
// holding hashed identities + per-channel status only — never a message body, never a raw address.

import crypto from 'node:crypto';

const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_ONBOARDING_FROM = 'Integrated IT Support <onboarding@resend.dev>';
const DEFAULT_FROM = 'Integrated IT Support <noreply@iisupp.net>';
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const SMS_MAX = 1600;

// ---------------------------------------------------------------- small pure helpers

/** sha256 hex, first 16 chars, of the lower-cased trimmed value. Safe to log and to key stores by. */
export function hashIdentity(value) {
  return crypto.createHash('sha256').update(String(value == null ? '' : value).toLowerCase().trim()).digest('hex').slice(0, 16);
}

/** Escape a user-supplied string before interpolating it into email HTML. */
export function sanitizeEmailHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Resend requires "email@example.com" or "Name <email@example.com>". Anything else 422s. */
export function sanitizeFrom(s) {
  s = String(s || '').trim();
  if (/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s)) return s;
  if (/^[^<>]+<\s*[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+\s*>$/.test(s)) return s;
  const m = s.match(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/);
  if (m) {
    const email = m[0];
    const name = s.replace(m[0], '').replace(/[<>]/g, '').trim() || 'Integrated IT Support';
    return name + ' <' + email + '>';
  }
  return DEFAULT_FROM;
}

function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to];
  return list.map((x) => String(x || '').trim()).filter((x) => EMAIL_RE.test(x));
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------- email

function normalizeAttachments(opts) {
  const out = [];
  const list = Array.isArray(opts.attachments) ? opts.attachments : [];
  for (const a of list) {
    if (!a || !a.filename || a.content == null) continue;
    const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), a.encoding || 'utf8');
    if (buf.length > 5 * 1024 * 1024) continue; // 5 MB cap per attachment
    out.push({ filename: String(a.filename).slice(0, 120), content: buf, contentType: a.contentType || a.content_type || 'application/octet-stream' });
  }
  if (opts.icalEvent && opts.icalEvent.content) {
    out.push({ filename: opts.icalEvent.filename || 'invite.ics', content: Buffer.from(String(opts.icalEvent.content), 'utf8'), contentType: 'text/calendar; method=' + (opts.icalEvent.method || 'REQUEST') });
  }
  return out;
}

/**
 * sendEmail({ to, subject, html, text, replyTo, bcc, tag, from, attachments?, icalEvent? })
 *   → { ok, id, provider, error, attempts }
 * provider ∈ 'resend' | 'resend-onboarding' | 'smtp' | null.
 * ok is true ONLY when the provider returned a message id.
 */
export async function sendEmail(opts = {}) {
  const to = normalizeRecipients(opts.to);
  const subject = String(opts.subject || '').slice(0, 300);
  const html = opts.html ? String(opts.html) : '';
  const text = opts.text ? String(opts.text) : (html ? htmlToText(html) : '');
  const attempts = [];
  if (!to.length) return { ok: false, id: null, provider: null, error: 'invalid-recipient', attempts };
  if (!subject) return { ok: false, id: null, provider: null, error: 'subject-required', attempts };
  if (!html && !text) return { ok: false, id: null, provider: null, error: 'body-required', attempts };

  const bcc = normalizeRecipients(opts.bcc || []);
  const replyTo = opts.replyTo && EMAIL_RE.test(String(opts.replyTo).trim()) ? String(opts.replyTo).trim() : undefined;
  const attachments = normalizeAttachments(opts);
  const fetchFn = opts.fetch || globalThis.fetch;

  // ---- PATH 1: Resend (primary)
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const rawFrom = opts.from || process.env.RESEND_FROM || DEFAULT_FROM;
    const from = sanitizeFrom(rawFrom);
    if (from !== rawFrom) console.warn('[notify] RESEND_FROM had an invalid format; sanitized to', from);
    const payload = { from, to, subject };
    if (html) payload.html = html;
    if (text) payload.text = text;
    if (bcc.length) payload.bcc = bcc;
    if (replyTo) payload.reply_to = replyTo;
    if (attachments.length) payload.attachments = attachments.map((a) => ({ filename: a.filename, content: a.content.toString('base64'), content_type: a.contentType }));
    if (opts.tag) payload.tags = [{ name: 'tag', value: String(opts.tag).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) }];

    const send = (fromAddr) => fetchFn(RESEND_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, from: fromAddr }),
    });
    try {
      const r = await send(from);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j && j.id) {
        return { ok: true, id: String(j.id), provider: 'resend', error: null, attempts };
      }
      attempts.push('resend:' + r.status + ':' + JSON.stringify(j).slice(0, 160));
      console.warn('[notify] resend failed', r.status, JSON.stringify(j).slice(0, 200));
      // Domain-not-verified fallback. Resend delivers onboarding@resend.dev mail ONLY to the account owner,
      // so this is an ops-only safety net. We still demand an id before calling it delivered.
      const domainErr = r.status === 403 || JSON.stringify(j).toLowerCase().includes('not verified');
      if (domainErr) {
        try {
          const r2 = await send(RESEND_ONBOARDING_FROM);
          const j2 = await r2.json().catch(() => ({}));
          if (r2.ok && j2 && j2.id) {
            console.warn('[notify] delivered via onboarding@resend.dev fallback — verify RESEND_FROM domain at resend.com/domains');
            return { ok: true, id: String(j2.id), provider: 'resend-onboarding', error: null, attempts, note: 'onboarding-fallback: delivers only to the Resend account owner' };
          }
          attempts.push('resend-onboarding:' + r2.status + ':' + JSON.stringify(j2).slice(0, 160));
        } catch (e2) {
          attempts.push('resend-onboarding:exception:' + (e2 && e2.message));
        }
      }
    } catch (e) {
      attempts.push('resend:exception:' + (e && e.message));
      console.warn('[notify] resend exception', e && e.message);
    }
  } else {
    attempts.push('resend:not-configured');
  }

  // ---- PATH 2: SMTP fallback — only when SMTP_* env is present.
  const smtpPass = process.env.SMTP_APP_PASSWORD;
  if (smtpPass) {
    const senderEmail = process.env.SMTP_SENDER || 'integrateditsupp@iisupp.net';
    const authUser = process.env.SMTP_AUTH_USER || senderEmail;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const configs = [
      { host, port, secure: port === 465 },
      { host, port: 587, secure: false, requireTLS: true },
    ];
    let nodemailer = null;
    try { nodemailer = (await import('nodemailer')).default || (await import('nodemailer')); }
    catch (e) { attempts.push('smtp:nodemailer-unavailable'); }
    if (nodemailer) {
      for (const cfg of configs) {
        try {
          const transporter = nodemailer.createTransport({ ...cfg, auth: { user: authUser, pass: smtpPass.replace(/\s+/g, '') } });
          const info = await transporter.sendMail({
            from: `"Integrated IT Support" <${senderEmail}>`,
            to: to.join(', '),
            bcc: bcc.length ? bcc.join(', ') : undefined,
            replyTo,
            subject,
            html: html || undefined,
            text: text || undefined,
            attachments: attachments.length ? attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) : undefined,
            icalEvent: opts.icalEvent && opts.icalEvent.content ? { filename: opts.icalEvent.filename || 'invite.ics', method: opts.icalEvent.method || 'REQUEST', content: String(opts.icalEvent.content) } : undefined,
          });
          if (info && info.messageId) {
            return { ok: true, id: String(info.messageId), provider: 'smtp', error: null, attempts };
          }
          attempts.push('smtp:' + cfg.port + ':no-message-id');
        } catch (e) {
          attempts.push('smtp:' + cfg.port + ':' + (e && e.message));
        }
      }
    }
  } else {
    attempts.push('smtp:not-configured');
  }

  const allDormant = attempts.every((a) => /not-configured/.test(a));
  return {
    ok: false,
    id: null,
    provider: null,
    dormant: allDormant,
    error: allDormant ? 'no-email-provider-configured' : 'all-email-paths-failed',
    attempts,
  };
}

// ---------------------------------------------------------------- sms

/**
 * sendSms({ to, body, tag }) → { ok, sid, dormant, error, provider }
 * Dormant (ok:false, dormant:true) until TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER are set.
 */
export async function sendSms(opts = {}) {
  const to = String(opts.to || '').trim();
  const body = String(opts.body || '').trim();
  if (!to || !/^\+?[0-9()\-\s.]{7,20}$/.test(to)) return { ok: false, sid: null, dormant: false, provider: 'twilio', error: 'invalid-recipient' };
  if (!body) return { ok: false, sid: null, dormant: false, provider: 'twilio', error: 'body-required' };

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !tok || !from) {
    console.log('[notify] sms DORMANT (Twilio env not set)', { to_hash: hashIdentity(to), tag: opts.tag || null });
    return { ok: false, sid: null, dormant: true, provider: 'twilio', error: 'twilio-not-configured' };
  }
  const fetchFn = opts.fetch || globalThis.fetch;
  try {
    const params = new URLSearchParams();
    params.set('To', to);
    params.set('From', from);
    params.set('Body', body.slice(0, SMS_MAX));
    const auth = Buffer.from(sid + ':' + tok).toString('base64');
    const r = await fetchFn('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + auth, 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data || !data.sid) {
      console.error('[notify] twilio error', r.status, data && (data.message || data.code));
      return { ok: false, sid: null, dormant: false, provider: 'twilio', error: 'twilio-' + r.status + ':' + ((data && data.message) || 'no-sid') };
    }
    return { ok: true, sid: String(data.sid), dormant: false, provider: 'twilio', error: null };
  } catch (e) {
    console.error('[notify] twilio exception', e && e.message);
    return { ok: false, sid: null, dormant: false, provider: 'twilio', error: 'twilio-exception:' + (e && e.message) };
  }
}

// ---------------------------------------------------------------- notify (fan-out + log)

let _logStoreFactory = null;
/** Test seam: supply a function returning a store-like { setJSON } object. */
export function _setLogStoreFactory(fn) { _logStoreFactory = fn; }

async function getLogStore() {
  if (_logStoreFactory) { try { return await _logStoreFactory(); } catch { return null; } }
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore({ name: 'notify-log', consistency: 'strong' });
  } catch (e) {
    return null;
  }
}

/**
 * notify({ recipients:[{email, phone, name, role}], subject, text, html, sms, tag, tenant })
 *   → { ok, delivered, failed, dormant, results:[...], log:{ key|null, error|null } }
 * `ok` is true when at least one channel confirmed. `sms` (string) is sent to each recipient's phone.
 * The notify-log record stores hashed identities + status only.
 */
export async function notify(opts = {}) {
  const recipients = Array.isArray(opts.recipients) ? opts.recipients : [];
  const results = [];
  let delivered = 0, failed = 0, dormant = 0;

  for (const rcpt of recipients) {
    const r = rcpt || {};
    const entry = {
      name: r.name ? String(r.name).slice(0, 80) : null,
      role: r.role ? String(r.role).slice(0, 40) : null,
      email_hash: r.email ? hashIdentity(r.email) : null,
      phone_hash: r.phone ? hashIdentity(r.phone) : null,
      email: null,
      sms: null,
    };
    if (r.email && (opts.html || opts.text)) {
      entry.email = await sendEmail({ to: r.email, subject: opts.subject, html: opts.html, text: opts.text, replyTo: opts.replyTo, bcc: opts.bcc, tag: opts.tag, fetch: opts.fetch });
      if (entry.email.ok) delivered++; else if (entry.email.dormant) dormant++; else failed++;
    }
    if (r.phone && opts.sms) {
      entry.sms = await sendSms({ to: r.phone, body: opts.sms, tag: opts.tag, fetch: opts.fetch });
      if (entry.sms.ok) delivered++; else if (entry.sms.dormant) dormant++; else failed++;
    }
    results.push(entry);
  }

  const log = { key: null, error: null };
  const record = {
    ts: Date.now(),
    tag: opts.tag ? String(opts.tag).slice(0, 64) : null,
    tenant: opts.tenant ? hashIdentity(opts.tenant) : null,
    ok: delivered > 0,
    delivered, failed, dormant,
    recipients: results.map((x) => ({
      role: x.role,
      email_hash: x.email_hash,
      phone_hash: x.phone_hash,
      email_status: x.email ? (x.email.ok ? 'sent' : (x.email.dormant ? 'dormant' : 'failed')) : null,
      email_provider: x.email ? x.email.provider : null,
      email_id: x.email ? x.email.id : null,
      email_error: x.email ? x.email.error : null,
      sms_status: x.sms ? (x.sms.ok ? 'sent' : (x.sms.dormant ? 'dormant' : 'failed')) : null,
      sms_sid: x.sms ? x.sms.sid : null,
      sms_error: x.sms ? x.sms.error : null,
    })),
  };
  try {
    const store = await getLogStore();
    if (store) {
      const date = new Date(record.ts).toISOString().slice(0, 10);
      const id = crypto.randomBytes(8).toString('hex');
      log.key = `${date}/${id}`;
      await store.setJSON(log.key, record);
    } else {
      log.error = 'notify-log store unavailable';
    }
  } catch (e) {
    log.error = 'notify-log write failed: ' + (e && e.message);
    log.key = null;
  }
  if (!record.ok) console.warn('[notify] nothing delivered', JSON.stringify({ tag: record.tag, delivered, failed, dormant, log }));

  return { ok: record.ok, delivered, failed, dormant, results, log };
}

export default { sendEmail, sendSms, notify, sanitizeEmailHtml, sanitizeFrom, hashIdentity };
