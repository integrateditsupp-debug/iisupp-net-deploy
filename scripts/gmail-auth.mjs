// gmail-auth.mjs — ONE-TIME Gmail OAuth for the outreach identity ahmad.wasee@iisupp.net.
// Loopback OAuth flow for a Google "Desktop app" client. Run locally, sign in AS ahmad.wasee@iisupp.net,
// grant the scopes, and this writes a refresh token to data/secrets/gmail-tokens.json (gitignored).
// NOTHING here sends mail; it only establishes the local credential the draft/send client needs.
//
// PREREQ (see docs/AXIS-CC-V2-P4-GMAIL.md): a Google Cloud project with the Gmail API enabled and an
// OAuth "Desktop app" client, saved as data/secrets/gmail-oauth-client.json = {client_id, client_secret}.
// Run: node scripts/gmail-auth.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'secrets');
const CLIENT_FILE = path.join(SECRETS, 'gmail-oauth-client.json');
const TOKENS_FILE = path.join(SECRETS, 'gmail-tokens.json');
// compose = create drafts + send; modify = read (P5 reply monitor). Least privilege for the whole motion.
const SCOPES = 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify';

if (!fs.existsSync(CLIENT_FILE)) {
  console.error(`Missing ${CLIENT_FILE}. Create a Google Cloud OAuth "Desktop app" client and save it as`);
  console.error(`  data/secrets/gmail-oauth-client.json = { "client_id": "...", "client_secret": "..." }`);
  console.error(`See docs/AXIS-CC-V2-P4-GMAIL.md for the click-through.`);
  process.exit(1);
}
const { client_id, client_secret } = JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8'));
const PORT = 53682;
const redirect_uri = `http://127.0.0.1:${PORT}`;
const state = crypto.randomBytes(16).toString('hex');
const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id, redirect_uri, response_type: 'code', scope: SCOPES, access_type: 'offline', prompt: 'consent', state,
});

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect_uri);
  const code = u.searchParams.get('code');
  if (!code) { res.writeHead(400).end('no code'); return; }
  if (u.searchParams.get('state') !== state) { res.writeHead(400).end('state mismatch'); return; }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id, client_secret, redirect_uri, grant_type: 'authorization_code' }),
    });
    const j = await r.json();
    if (!j.refresh_token) throw new Error('no refresh_token returned: ' + JSON.stringify(j).slice(0, 200));
    fs.mkdirSync(SECRETS, { recursive: true });
    fs.writeFileSync(TOKENS_FILE, JSON.stringify({ refresh_token: j.refresh_token, access_token: j.access_token, expiry: Date.now() + (j.expires_in || 3600) * 1000 }));
    res.writeHead(200, { 'content-type': 'text/plain' }).end('Gmail authorized for ahmad.wasee@iisupp.net. Tokens saved locally. You can close this tab.');
    console.log(`\n✅ Tokens written to ${TOKENS_FILE} (gitignored). Draft/send client is now configured.`);
  } catch (e) {
    res.writeHead(500).end('error: ' + e.message); console.error(e.message);
  } finally { setTimeout(() => server.close(() => process.exit(0)), 500); }
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('One-time Gmail OAuth for ahmad.wasee@iisupp.net');
  console.log('1) Open this URL, sign in AS ahmad.wasee@iisupp.net, and grant access:\n');
  console.log('   ' + authUrl + '\n');
  console.log(`2) Google will redirect to ${redirect_uri} and this script captures the code automatically.`);
});
