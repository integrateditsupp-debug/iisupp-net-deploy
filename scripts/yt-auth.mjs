#!/usr/bin/env node
// yt-auth.mjs — one-time YouTube authorisation for @AIHelpdesk-IIS.
//
// THIS IS THE ONE STEP THAT CANNOT BE AUTOMATED. Uploading to a YouTube channel requires an OAuth
// grant from the Google account that owns it — a human clicking "Allow". No service account, API
// key, or stored credential substitutes for it; that is Google's design, not a gap in the tooling.
//
// Everything else is automated: this starts a local listener, prints one URL, and captures the
// authorisation code from the redirect itself. Ahmad clicks and approves; nothing to copy or paste.
//
// NOTE ON THE OLD FLOW: this used to use the out-of-band code-paste redirect
// (urn:ietf:wg:oauth:2.0:oob). Google shut that down in 2022 — it now returns invalid_request. The
// loopback redirect below is the supported replacement for desktop/installed clients.
//
// Run:  node scripts/yt-auth.mjs
// Tokens land in data/secrets/youtube-tokens.json (gitignored) and refresh themselves after that.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'data', 'secrets', 'gmail-oauth-client.json');
const TOKENS = path.join(ROOT, 'data', 'secrets', 'youtube-tokens.json');
const PORT = Number(process.env.YT_AUTH_PORT || 8722);
const REDIRECT = `http://localhost:${PORT}`;

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

if (!fs.existsSync(CLIENT)) {
  console.error('[yt-auth] missing', CLIENT);
  console.error('  Create an OAuth client (type: Desktop app) at https://console.cloud.google.com/apis/credentials');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(CLIENT, 'utf8'));
const cfg = raw.installed || raw.web || raw;
if (!cfg.client_id || !cfg.client_secret) { console.error('[yt-auth] client_id/client_secret missing'); process.exit(1); }

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: cfg.client_id, redirect_uri: REDIRECT, response_type: 'code',
  scope: SCOPES, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
}).toString();

const PAGE = (title, msg, ok) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#07070a;color:#ececee;
font-family:Inter,Segoe UI,system-ui,sans-serif}.c{text-align:center;max-width:520px;padding:40px}
h1{font-size:26px;color:${ok ? '#d2a94e' : '#fb7185'};margin-bottom:14px}p{color:#9b9fa8;line-height:1.5}</style>
<div class="c"><h1>${title}</h1><p>${msg}</p></div>`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get('code');
  const err = u.searchParams.get('error');
  if (!code && !err) { res.writeHead(204).end(); return; }

  if (err) {
    res.writeHead(200, { 'content-type': 'text/html' })
       .end(PAGE('Authorisation declined', `Google reported: ${err}. Nothing was changed. Re-run the command to try again.`, false));
    console.error('\n[yt-auth] declined:', err);
    server.close(); process.exit(1);
  }

  const body = new URLSearchParams({
    code, client_id: cfg.client_id, client_secret: cfg.client_secret,
    redirect_uri: REDIRECT, grant_type: 'authorization_code',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();

  if (!r.ok || !j.refresh_token) {
    res.writeHead(200, { 'content-type': 'text/html' })
       .end(PAGE('Could not complete', 'The token exchange failed. Details are in the terminal.', false));
    console.error('\n[yt-auth] token exchange failed:', JSON.stringify(j).slice(0, 300));
    server.close(); process.exit(1);
  }

  fs.mkdirSync(path.dirname(TOKENS), { recursive: true });
  fs.writeFileSync(TOKENS, JSON.stringify({
    refresh_token: j.refresh_token, access_token: j.access_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000,
    scope: j.scope, obtained_at: new Date().toISOString(),
  }, null, 2));

  res.writeHead(200, { 'content-type': 'text/html' })
     .end(PAGE('AXIS is authorised', 'You can close this tab. Uploads to @AIHelpdesk-IIS can now run.', true));
  console.log('\n[yt-auth] authorised. Scopes:', j.scope);
  console.log('[yt-auth] tokens → data/secrets/youtube-tokens.json');
  server.close();
  setTimeout(() => process.exit(0), 250);
});

server.on('error', (e) => {
  console.error(`[yt-auth] cannot listen on ${PORT}: ${e.message}`);
  console.error('  Set a different port:  YT_AUTH_PORT=8733 node scripts/yt-auth.mjs');
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('\n  OPEN THIS IN THE BROWSER SIGNED IN AS THE @AIHelpdesk-IIS OWNER:\n');
  console.log('  ' + authUrl + '\n');
  console.log('  Approve, and this finishes on its own. Nothing to copy back.');
  console.log('  If Google says the YouTube Data API is not enabled, enable it once here:');
  console.log('  https://console.cloud.google.com/apis/library/youtube.googleapis.com\n');
  console.log('  (waiting for the redirect …)');
});
