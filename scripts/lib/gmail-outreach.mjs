// gmail-outreach.mjs — Gmail API client for the ONE outreach identity (ahmad.wasee@iisupp.net).
// WORKER-OWNED, LOCAL ONLY. Raw Gmail REST over fetch (no googleapis dep). OAuth tokens + client secret
// are read ONLY from data/secrets/ (gitignored, /data/* 404'd, never Netlify env/Blobs/git).
//
// SAFETY: createDraft() only drafts. sendDraft() sends a specific already-approved draft — it is invoked
// ONLY by the outbound queue after Ahmad's per-item approval and a passing railsCheck(). Nothing here
// auto-sends, and with no tokens present every call throws a clear setup error (fail-closed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTREACH_IDENTITY } from './axis-constants.mjs';

const SECRETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'secrets');
const TOKENS_FILE = path.join(SECRETS_DIR, 'gmail-tokens.json');       // { refresh_token, access_token?, expiry? }
const CLIENT_FILE = path.join(SECRETS_DIR, 'gmail-oauth-client.json'); // { client_id, client_secret }
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

export function isConfigured() { return fs.existsSync(TOKENS_FILE) && fs.existsSync(CLIENT_FILE); }
function requireConfigured() {
  if (!isConfigured()) {
    throw new Error('Gmail OAuth not configured. One-time setup: (1) Google Cloud project → enable Gmail API; ' +
      '(2) create an OAuth *Desktop app* client; (3) run `node scripts/gmail-auth.mjs` and sign in AS ' +
      'ahmad.wasee@iisupp.net; tokens are written to data/secrets/gmail-tokens.json (gitignored). Until then, draft-only.');
  }
}

async function accessToken() {
  requireConfigured();
  const { client_id, client_secret } = JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8'));
  const toks = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  if (toks.access_token && toks.expiry && Date.now() < toks.expiry - 60000) return toks.access_token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id, client_secret, refresh_token: toks.refresh_token, grant_type: 'refresh_token' }),
  });
  if (!r.ok) throw new Error('token refresh failed: ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  toks.access_token = j.access_token; toks.expiry = Date.now() + (j.expires_in || 3600) * 1000;
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(toks));
  return j.access_token;
}

const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Build a raw RFC822 message with the single outreach identity. This IS what a draft/send would contain —
// previewRfc822() returns it verbatim so a human can review the exact bytes without any API call.
export function buildRfc822({ to, subject, body, headers = {} }) {
  const h = [
    `From: ${OUTREACH_IDENTITY.from_name} <${OUTREACH_IDENTITY.from_email}>`,
    `Reply-To: ${OUTREACH_IDENTITY.reply_to}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    ...(headers['List-Unsubscribe'] ? [`List-Unsubscribe: ${headers['List-Unsubscribe']}`, 'List-Unsubscribe-Post: List-Unsubscribe=One-Click'] : []),
  ];
  return h.join('\r\n') + '\r\n\r\n' + body;
}
export function previewRfc822(msg) { return buildRfc822(msg); }

// Create a DRAFT (no send). Returns { draftId }. Requires OAuth.
export async function createDraft(msg) {
  const token = await accessToken();
  const raw = b64url(buildRfc822(msg));
  const r = await fetch(`${GMAIL}/drafts`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!r.ok) throw new Error('createDraft failed: ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return { draftId: j.id, messageId: j.message?.id, threadId: j.message?.threadId };
}

// ── Read side (P5 Sentry reply monitor). Read-only; requires OAuth (gmail.modify scope). ──
export async function listInbound(afterEpochSec) {
  const token = await accessToken();
  const q = encodeURIComponent(`in:inbox ${afterEpochSec ? `after:${afterEpochSec}` : 'newer_than:2d'}`);
  const r = await fetch(`${GMAIL}/messages?q=${q}&maxResults=50`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('listInbound failed: ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return (j.messages || []).map(m => m.id);
}
export async function getMessageParsed(id) {
  const token = await accessToken();
  const r = await fetch(`${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=References&metadataHeaders=List-Unsubscribe&metadataHeaders=Auto-Submitted&metadataHeaders=Precedence&metadataHeaders=Content-Type`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('getMessage failed: ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const headers = {};
  for (const h of (j.payload?.headers || [])) headers[h.name] = h.value;
  return {
    gmail_message_id: j.id, thread_id: j.threadId, from: headers.From, subject: headers.Subject,
    snippet: j.snippet, headers, received_at: Number(j.internalDate) || Date.now(),
  };
}

// Send an already-approved draft (draft-then-send so replies thread). Called ONLY by the outbound queue
// after per-item approval + passing rails. Never call this speculatively.
export async function sendDraft(draftId) {
  const token = await accessToken();
  const r = await fetch(`${GMAIL}/drafts/send`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id: draftId }),
  });
  if (!r.ok) throw new Error('sendDraft failed: ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return { messageId: j.id, threadId: j.threadId };
}
