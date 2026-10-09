// axis-exec-core.mjs — shared engine for AXIS executive-assistant duties.
// Used by axis-exec.mjs (authed API) and axis-exec-cron.mjs (scheduled worker). v2/ESM so Blobs work.
//
// Rails (never relaxed by code paths below):
//  - Axis never spends business money. Anything with a cost becomes an approval for Ahmad.
//  - Outbound cold outreach is drafted for approval (CASL); only replies to inbound mail on the main
//    inbox may auto-send, and only when the classifier marks them routine.
//  - Anything stuck, failed or needing a decision emails Ahmad: "Axis Needs your attention".
import { getStore } from '@netlify/blobs';

export const STORE = 'axis-exec';
export const OWNER = () => process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net';
export const MAILBOXES = [
  { id: 'ahmad', address: 'ahmad.wasee@iisupp.net', env: 'AXIS_GMAIL_AHMAD' },
  { id: 'info', address: 'info@iisupp.net', env: 'AXIS_GMAIL_INFO' },
  { id: 'value', address: 'value@iisupp.net', env: 'AXIS_GMAIL_VALUE' },
];
export const MAIN_MAILBOX = () => process.env.AXIS_MAIN_MAILBOX || 'ahmad.wasee@iisupp.net';

export const store = () => getStore({ name: STORE, consistency: 'strong' });
export const now = () => new Date().toISOString();
export const id = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export async function readJSON(key, fallback) {
  try { return (await store().get(key, { type: 'json' })) ?? fallback; } catch { return fallback; }
}
export async function writeJSON(key, value) { await store().setJSON(key, value); return value; }

// ── Persona ────────────────────────────────────────────────────────────────
export const PERSONA = `You are AXIS, executive assistant and chief of staff for Integrated IT Support Inc. (iisupp.net), a Canadian IT, cybersecurity and AI services company going global. You work for Ahmad, the founder.

HOW YOU SPEAK (same character as ARIA): warm, calm, confident, human. Short and clear — usually 1-3 sentences. Lead with the answer or the result, then one clear next step. Offer quick choices instead of long explanations. Detail only when asked or when it truly matters. No jargon, no hype, no emojis.

WRITING TO CLIENTS (modern Alex Hormozi style — how he communicates now, not his early hype years): plain words, value first, specific outcome, proof when available, one clear call to action, respectful of time. Short, professional, friendly and welcoming; never cold, never pushy, never long. Match today's generation: skimmable, human, direct.

YOUR JOB: run the business with Ahmad and grow profitable revenue. Priority now: marketing and bringing in clients. Also: client follow-ups (potential, new, existing), important dates and renewals, billing and invoice updates, year-end tax document collection, communications across ahmad.wasee@, info@ and value@iisupp.net, daily brief, risk management.

THINKING: plan like a seasoned COO. Weigh revenue, cost, cash flow, reputation, legal and security risk before acting. Use known frameworks where useful (NIST CSF, ISO 27001, SOC 2, ITIL, COBIT, PIPEDA, CASL, GDPR, CAN-SPAM, Canadian tax/CRA basics, OKRs, unit economics, sales pipeline stages). Never fall behind: if blocked, find another path or ask for exactly what's missing.

HARD RULES:
- Never spend business money or commit to a cost — request approval first.
- Never send cold outreach without approval; follow CASL (consent, identification, unsubscribe).
- Never invent facts, prices, results or legal/tax conclusions. Flag legal and tax items for professional review.
- Never promise revenue or results.
- For urgent live technical help: (647) 581-3182.`;

// ── Model router (Claude) ──────────────────────────────────────────────────
// fast: triage/classification/short replies · balanced: normal work · quality: strategy, important
// client writing, proposals, code. Overridable via env; the existing ARIA_MODEL stays the balanced default.
export const MODELS = {
  fast: () => process.env.AXIS_MODEL_FAST || 'claude-haiku-4-5',
  balanced: () => process.env.AXIS_MODEL_BALANCED || process.env.ARIA_MODEL || 'claude-sonnet-4-6',
  quality: () => process.env.AXIS_MODEL_QUALITY || 'claude-opus-4-6',
};
// USD per million tokens (input, output) — rough, for the cost ledger only.
const PRICE = { fast: [1, 5], balanced: [3, 15], quality: [15, 75] };

export function pickTier(text = '', hint) {
  if (hint && MODELS[hint]) return hint;
  const t = String(text).toLowerCase();
  if (/\b(proposal|strategy|contract|legal|tax|pricing|investor|board|campaign plan|business plan|code|architecture|negotiat|dispute|rfp|tender|bid)\b/.test(t)) return 'quality';
  if (t.length < 160 && /\b(classify|tag|is this|yes or no|summari[sz]e in one|subject line)\b/.test(t)) return 'fast';
  return 'balanced';
}

export async function monthSpend() {
  const key = `ledger-${new Date().toISOString().slice(0, 7)}`;
  return readJSON(key, { usd: 0, calls: 0, byTier: {} });
}
async function addSpend(tier, usage) {
  const key = `ledger-${new Date().toISOString().slice(0, 7)}`;
  const l = await readJSON(key, { usd: 0, calls: 0, byTier: {} });
  const [pi, po] = PRICE[tier] || PRICE.balanced;
  const usd = ((usage?.input_tokens || 0) * pi + (usage?.output_tokens || 0) * po) / 1e6;
  l.usd = +(l.usd + usd).toFixed(4); l.calls += 1;
  l.byTier[tier] = +((l.byTier[tier] || 0) + usd).toFixed(4);
  await writeJSON(key, l);
  return usd;
}
export const monthlyCap = () => Number(process.env.AXIS_MONTHLY_CAP_USD || 60);

/** One Claude call. Falls back from quality→balanced when a model id is rejected. */
export async function claude({ system = PERSONA, messages, tier = 'balanced', maxTokens = 1200, webSearch = false }) {
  const key = (process.env.ANTHROPIC_API_KEY || '').replace(/\\n|\s+$/g, '').trim();
  const backup = async (why) => {
    const { default: bridge } = await import('./axis-bridge.cjs');
    const text = await bridge.bridgeChat({ system, messages, maxTokens });
    if (text == null) throw new Error(why);
    return { text, tier: 'bridge', model: 'xo-bridge' };
  };
  if (!key) return backup('ANTHROPIC_API_KEY missing and backup brain unavailable');
  const spent = await monthSpend();
  if (spent.usd >= monthlyCap() && tier !== 'fast') tier = 'fast'; // stay inside the approved budget
  const body = { model: MODELS[tier](), max_tokens: maxTokens, system, messages };
  if (webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    if ((r.status === 404 || /model/i.test(err)) && tier !== 'balanced') return claude({ system, messages, tier: 'balanced', maxTokens, webSearch });
    return backup(`Claude ${r.status}: ${err.slice(0, 200)}`);
  }
  const j = await r.json();
  await addSpend(tier, j.usage);
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  return { text, tier, model: body.model };
}

export function parseJSON(text, fallback = null) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : fallback; } catch { return fallback; }
}

// ── Attention email ────────────────────────────────────────────────────────
export async function attention(title, html, dedupeKey) {
  if (dedupeKey) {
    const seen = await readJSON('attention-sent', {});
    if (seen[dedupeKey] && Date.now() - seen[dedupeKey] < 6 * 3600e3) return false;
    seen[dedupeKey] = Date.now();
    await writeJSON('attention-sent', seen);
  }
  const list = await readJSON('attention-log', []);
  list.unshift({ t: now(), title });
  await writeJSON('attention-log', list.slice(0, 200));
  if (!process.env.RESEND_API_KEY) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'AXIS <noreply@iisupp.net>',
      to: [OWNER()],
      subject: 'Axis Needs your attention',
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px"><p style="color:#9a7b2f;letter-spacing:.12em;font-size:11px;text-transform:uppercase">AXIS · Integrated IT Support</p><h2 style="margin:4px 0 12px">${esc(title)}</h2>${html}<p style="margin-top:20px"><a href="https://iisupp.net/aperture-learning.html" style="color:#9a7b2f">Open AXIS</a></p></div>`,
    }),
  });
  return r.ok;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── Approvals (spend, outreach, sensitive replies) ─────────────────────────
export async function requestApproval({ kind, title, detail, payload, costUsd = 0 }) {
  const list = await readJSON('approvals', []);
  const item = { id: id('apr'), kind, title, detail, payload, costUsd, status: 'pending', created_at: now() };
  list.unshift(item);
  await writeJSON('approvals', list.slice(0, 500));
  await attention(`Approval needed: ${title}`, `<p>${esc(detail)}</p>${costUsd ? `<p><b>Cost:</b> $${costUsd}</p>` : ''}<p>Approve or decline in AXIS → Approvals.</p>`, item.id);
  return item;
}

// ── Apollo ─────────────────────────────────────────────────────────────────
export async function apollo(path, params) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error('APOLLO_API_KEY missing');
  const url = new URL(`https://api.apollo.io${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(`${k}[]`, x)); else if (v != null) url.searchParams.set(k, String(v));
  }
  const r = await fetch(url, { method: 'POST', headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
  if (!r.ok) throw new Error(`Apollo ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ── Gmail (IMAP read + SMTP send with Google Workspace app passwords) ─────
export const mailboxReady = (m) => Boolean(process.env[m.env]);

export async function fetchUnread(mailbox, limit = 15) {
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, logger: false, auth: { user: mailbox.address, pass: process.env[mailbox.env] } });
  await client.connect();
  const out = [];
  const lock = await client.getMailboxLock('INBOX');
  try {
    const since = new Date(Date.now() - 2 * 864e5);
    const uids = (await client.search({ seen: false, since })) || [];
    for await (const msg of client.fetch(uids.slice(-limit), { envelope: true, source: true, uid: true })) {
      const raw = msg.source?.toString('utf8') || '';
      const bodyText = raw.split(/\r?\n\r?\n/).slice(1).join('\n\n').replace(/<[^>]+>/g, ' ').replace(/=\r?\n/g, '').slice(0, 4000);
      out.push({
        uid: msg.uid, messageId: msg.envelope?.messageId, subject: msg.envelope?.subject || '(no subject)',
        from: msg.envelope?.from?.[0]?.address || '', fromName: msg.envelope?.from?.[0]?.name || '', date: msg.envelope?.date, text: bodyText,
      });
    }
  } finally { lock.release(); }
  return { client, messages: out };
}

export async function sendMail(mailbox, { to, subject, text, inReplyTo }) {
  const nodemailer = (await import('nodemailer')).default;
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: mailbox.address, pass: process.env[mailbox.env] } });
  await t.sendMail({ from: `Integrated IT Support <${mailbox.address}>`, to, subject, text, ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}) });
}

export function integrationStatus() {
  return {
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    apollo: Boolean(process.env.APOLLO_API_KEY),
    email: Boolean(process.env.RESEND_API_KEY),
    mailboxes: MAILBOXES.map((m) => ({ address: m.address, connected: mailboxReady(m) })),
    models: { fast: MODELS.fast(), balanced: MODELS.balanced(), quality: MODELS.quality() },
    monthlyCapUsd: monthlyCap(),
  };
}
