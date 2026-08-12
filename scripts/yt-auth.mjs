#!/usr/bin/env node
// yt-auth.mjs — one-time YouTube authorisation for @AIHelpdesk-IIS.
//
// THIS IS THE ONE STEP ONLY AHMAD CAN DO. Uploading to a YouTube channel requires an OAuth grant
// from the Google account that owns it — a human clicking "Allow" in a browser. There is no service
// account, API key or automation that substitutes for it, by Google's design. Everything else in
// the pipeline runs unattended; this does not.
//
// Run:  node scripts/yt-auth.mjs
// It prints a URL, you approve, you paste the code back. Tokens are written to
// data/secrets/youtube-tokens.json (gitignored, same place the Gmail tokens live) and refresh
// themselves from then on.
//
// Reuses the existing Google OAuth client in data/secrets/gmail-oauth-client.json — same Cloud
// project, so there is no new project to create. It does require YouTube Data API v3 to be enabled
// on that project; if it is not, Google says so plainly on the consent screen and the fix is one
// toggle in the Cloud console (link printed below).

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'data', 'secrets', 'gmail-oauth-client.json');
const TOKENS = path.join(ROOT, 'data', 'secrets', 'youtube-tokens.json');

// upload = publish videos; readonly = read back channel state for the Priorities report.
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload',
                'https://www.googleapis.com/auth/youtube.readonly'].join(' ');
// Out-of-band code paste. Keeps this a terminal-only flow with no local web server to run.
const REDIRECT = 'urn:ietf:wg:oauth:2.0:oob';

if (!fs.existsSync(CLIENT)) {
  console.error('[yt-auth] missing', CLIENT);
  console.error('  Create an OAuth client (Desktop app) at https://console.cloud.google.com/apis/credentials');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(CLIENT, 'utf8'));
const cfg = raw.installed || raw.web || raw;
if (!cfg.client_id || !cfg.client_secret) { console.error('[yt-auth] client_id/client_secret not found in', CLIENT); process.exit(1); }

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: cfg.client_id, redirect_uri: REDIRECT, response_type: 'code',
  scope: SCOPES, access_type: 'offline', prompt: 'consent',
}).toString();

console.log('\n  AUTHORISE AI HELPDESK TO UPLOAD\n');
console.log('  1. Open this URL, signed in as the account that owns @AIHelpdesk-IIS:\n');
console.log('     ' + authUrl + '\n');
console.log('  2. Approve. Google shows you a code.');
console.log('  3. Paste it below.\n');
console.log('  If Google says the YouTube Data API is not enabled, enable it once here:');
console.log('     https://console.cloud.google.com/apis/library/youtube.googleapis.com\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('  code: ', async (code) => {
  rl.close();
  const body = new URLSearchParams({
    code: String(code).trim(), client_id: cfg.client_id, client_secret: cfg.client_secret,
    redirect_uri: REDIRECT, grant_type: 'authorization_code',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) {
    console.error('\n[yt-auth] failed:', JSON.stringify(j).slice(0, 300));
    if (j.error === 'invalid_grant') console.error('  (codes are single-use and expire in minutes — re-run and paste a fresh one)');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(TOKENS), { recursive: true });
  fs.writeFileSync(TOKENS, JSON.stringify({
    refresh_token: j.refresh_token, access_token: j.access_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000, scope: j.scope, obtained_at: new Date().toISOString(),
  }, null, 2));
  console.log('\n[yt-auth] authorised. Tokens saved to data/secrets/youtube-tokens.json');
  console.log('  Next: node scripts/yt-upload.mjs --list      (see what is staged)');
  console.log('        node scripts/yt-upload.mjs --all       (publish the approved batch)');
});
