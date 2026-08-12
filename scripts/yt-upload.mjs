#!/usr/bin/env node
// yt-upload.mjs — publishes an APPROVED staged video to @AIHelpdesk-IIS.
//
// Publishing is an external send, so it is a hard stop under Ahmad's standing rules: nothing here
// runs on its own. A video is only eligible once its meta.json says status "approved", and the
// default privacy is "private" so even a published upload is not public until Ahmad flips it.
//
//   node scripts/yt-upload.mjs --list        # what is staged, and what is approved
//   node scripts/yt-upload.mjs --approve <slug>
//   node scripts/yt-upload.mjs --slug <slug> # upload one approved video
//   node scripts/yt-upload.mjs --all         # upload every approved video (quota-capped)
//   ... --public                             # publish as public instead of private
//
// QUOTA: the YouTube Data API allows 10,000 units/day and an upload costs ~1,600 — six per day,
// hard ceiling, before any quota increase is granted. This refuses to start the seventh rather than
// failing halfway through it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGED = path.join(ROOT, 'content', 'youtube', 'staged');
const TOKENS = path.join(ROOT, 'data', 'secrets', 'youtube-tokens.json');
const CLIENT = path.join(ROOT, 'data', 'secrets', 'gmail-oauth-client.json');
const LOG = path.join(ROOT, 'content', 'youtube', 'published.json');
const DAILY_CAP = 6;                    // 10,000 quota units / ~1,600 per upload

const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] ?? true) : d; };

const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const staged = () => (fs.existsSync(STAGED) ? fs.readdirSync(STAGED) : [])
  .map((s) => ({ slug: s, dir: path.join(STAGED, s), meta: readJSON(path.join(STAGED, s, 'meta.json')) }))
  .filter((v) => v.meta);

// ── list ─────────────────────────────────────────────────────────────────────
if (args.includes('--list') || !args.length) {
  const all = staged();
  const pub = readJSON(LOG, { published: [] }).published;
  const today = new Date().toISOString().slice(0, 10);
  const usedToday = pub.filter((p) => (p.at || '').slice(0, 10) === today).length;
  console.log(`\n  STAGED VIDEOS  (${all.length})   published today: ${usedToday}/${DAILY_CAP}\n`);
  for (const v of all) {
    const mark = v.meta.status === 'approved' ? 'APPROVED' : v.meta.status === 'published' ? 'published' : 'awaiting';
    console.log(`  [${mark.padEnd(9)}] ${v.meta.kind.padEnd(5)} ${String(v.meta.duration_s).padStart(3)}s  ${v.meta.title}`);
    console.log(`              ${v.slug}`);
  }
  if (!all.length) console.log('  (none — run: node scripts/yt-factory.mjs --count 3)');
  console.log('\n  approve:  node scripts/yt-upload.mjs --approve <slug>');
  console.log('  publish:  node scripts/yt-upload.mjs --all\n');
  process.exit(0);
}

// ── approve ──────────────────────────────────────────────────────────────────
const approveSlug = flag('approve');
if (approveSlug && approveSlug !== true) {
  const p = path.join(STAGED, approveSlug, 'meta.json');
  const m = readJSON(p);
  if (!m) { console.error('[yt-upload] no such staged video:', approveSlug); process.exit(1); }
  m.status = 'approved'; m.approved_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(m, null, 2));
  console.log('[yt-upload] approved:', m.title);
  process.exit(0);
}

// ── auth ─────────────────────────────────────────────────────────────────────
async function accessToken() {
  const t = readJSON(TOKENS);
  if (!t || !t.refresh_token) {
    console.error('\n[yt-upload] not authorised yet.');
    console.error('  YouTube requires a one-time browser consent from the account that owns the channel.');
    console.error('  Run:  node scripts/yt-auth.mjs\n');
    process.exit(1);
  }
  if (t.access_token && t.expires_at && Date.now() < t.expires_at - 60000) return t.access_token;
  const raw = readJSON(CLIENT); const cfg = raw.installed || raw.web || raw;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.client_id, client_secret: cfg.client_secret,
      refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) { console.error('[yt-upload] token refresh failed:', JSON.stringify(j).slice(0, 200)); process.exit(1); }
  fs.writeFileSync(TOKENS, JSON.stringify({ ...t, access_token: j.access_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 }, null, 2));
  return j.access_token;
}

// ── upload (resumable) ───────────────────────────────────────────────────────
async function upload(v, token, isPublic) {
  const meta = v.meta;
  const body = {
    snippet: { title: meta.title, description: meta.description || '', tags: meta.tags || [], categoryId: '28' },
    status: { privacyStatus: isPublic ? 'public' : 'private', selfDeclaredMadeForKids: false },
  };
  const videoPath = path.join(v.dir, 'video.mp4');
  const size = fs.statSync(videoPath).size;

  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(size), 'x-upload-content-type': 'video/mp4' },
    body: JSON.stringify(body),
  });
  if (!init.ok) throw new Error('init ' + init.status + ' ' + (await init.text()).slice(0, 300));
  const location = init.headers.get('location');
  if (!location) throw new Error('no resumable upload URL returned');

  const put = await fetch(location, { method: 'PUT',
    headers: { 'content-type': 'video/mp4', 'content-length': String(size) },
    body: fs.readFileSync(videoPath), duplex: 'half' });
  if (!put.ok) throw new Error('upload ' + put.status + ' ' + (await put.text()).slice(0, 300));
  const res = await put.json();

  // Thumbnail is a separate call and a separate ~50 units. A failure here must not lose the video.
  const thumb = path.join(v.dir, 'thumbnail.png');
  if (res.id && fs.existsSync(thumb)) {
    try {
      await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${res.id}`, {
        method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'image/png' },
        body: fs.readFileSync(thumb), duplex: 'half' });
    } catch (e) { console.warn('    thumbnail failed (video is up):', e.message.slice(0, 90)); }
  }
  return res;
}

// ── main ─────────────────────────────────────────────────────────────────────
const isPublic = args.includes('--public');
const one = flag('slug');
let queue = staged().filter((v) => v.meta.status === 'approved');
if (one && one !== true) queue = queue.filter((v) => v.slug === one);
if (!queue.length) {
  console.error('[yt-upload] nothing approved to publish.');
  console.error('  Review with --list, then: node scripts/yt-upload.mjs --approve <slug>');
  process.exit(1);
}

const log = readJSON(LOG, { published: [] });
const today = new Date().toISOString().slice(0, 10);
const usedToday = log.published.filter((p) => (p.at || '').slice(0, 10) === today).length;
const room = DAILY_CAP - usedToday;
if (room <= 0) { console.error(`[yt-upload] daily quota reached (${DAILY_CAP} uploads). Try tomorrow.`); process.exit(1); }
if (queue.length > room) { console.log(`[yt-upload] quota allows ${room} more today — uploading the first ${room}.`); queue = queue.slice(0, room); }

const token = await accessToken();
for (const v of queue) {
  process.stdout.write(`  uploading "${v.meta.title}" … `);
  try {
    const res = await upload(v, token, isPublic);
    const url = 'https://youtu.be/' + res.id;
    console.log('done → ' + url + (isPublic ? '' : '  (PRIVATE — flip it in Studio when you are happy)'));
    v.meta.status = 'published'; v.meta.video_id = res.id; v.meta.url = url; v.meta.published_at = new Date().toISOString();
    fs.writeFileSync(path.join(v.dir, 'meta.json'), JSON.stringify(v.meta, null, 2));
    log.published.push({ slug: v.slug, id: res.id, url, at: new Date().toISOString() });
    fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
  } catch (e) {
    console.log('FAILED: ' + e.message.slice(0, 200));
  }
}
