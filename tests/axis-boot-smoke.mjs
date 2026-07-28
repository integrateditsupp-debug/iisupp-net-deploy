// tests/axis-boot-smoke.mjs — boots the REAL AXIS console in headless Chrome against the REAL snapshot
// computed from data/axis-sales.db, visits all 15 tabs, and fails on any console error, page error, or
// tab that renders empty. There is no bundler in this project, so a bad import or a screen that throws
// only shows up at runtime — a green unit suite proves nothing about whether the console actually loads.
//
// The DB is opened READ-ONLY. Nothing here sends, writes, or seeds.
// Usage: node tests/axis-boot-smoke.mjs [--shots]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../scripts/lib/axis-db.mjs';
import { computeSnapshots } from '../scripts/lib/axis-snapshots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.join(ROOT, 'data', 'boot-shots');
const TABS = ['overview', 'inbox', 'pipeline', 'crm', 'prospects', 'outreach', 'approvals', 'followups',
  'documents', 'analytics', 'products', 'fleet', 'axis-agent-director', 'reports', 'settings'];

let pass = 0, fail = 0;
const t = (n, c, extra) => { if (c) pass++; else { fail++; console.error('  FAIL', n, extra ? '\n      ' + extra : ''); } };

// ── real snapshots, read-only ────────────────────────────────────────────────────────────────────
const db = openDb();
const snaps = computeSnapshots(db);
db.close();
const version = { v: 1, tick: new Date().toISOString(), modules: Object.fromEntries(Object.keys(snaps).map(m => [m, 1])) };
const envelopes = Object.fromEntries(Object.entries(snaps).map(([m, d]) => [m, { module: m, version: 1, generatedAt: version.tick, data: d }]));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };

  // Stubbed auth: the console only needs a token string to leave the login screen.
  if (u.pathname === '/.netlify/functions/aperture-auth') return send(200, JSON.stringify({ ok: true, token: 'boot-smoke-token' }));
  // Stubbed director brain — never call the real one, it burns the API key.
  if (u.pathname === '/.netlify/functions/axis-director') return send(200, JSON.stringify({ text: 'Boot smoke. Nothing to report.', routedAgent: null, intent: null }));
  // Intents are recorded, never executed.
  if (u.pathname === '/api/axis/intent') { intents.push(u.pathname); return send(200, JSON.stringify({ ok: true, queued: false, id: 'smoke' })); }
  if (u.pathname === '/api/axis/snapshot') {
    const m = u.searchParams.get('module');
    if (!m) return send(200, JSON.stringify({ ok: true, authed: true, version, source: 'worker' }));
    if (m === 'all') return send(200, JSON.stringify({ ok: true, authed: true, version, snapshots: envelopes, source: 'worker' }));
    return send(200, JSON.stringify(Object.assign({ ok: true, authed: true }, envelopes[m] || { module: m, data: {}, empty: true })));
  }
  let f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/axis.html' : u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'not found', 'text/plain');
  send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
});
const intents = [];

const port = await new Promise(r => server.listen(0, () => r(server.address().port)));
const base = `http://127.0.0.1:${port}`;

const puppeteer = (await import('puppeteer-core')).default;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('no Chrome/Edge found'); process.exit(1); }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 300)));
page.on('requestfailed', r => { const u = r.url(); if (!/favicon/.test(u)) errors.push('requestfailed: ' + u.replace(base, '') + ' ' + (r.failure()?.errorText || '')); });

await page.goto(base + '/axis.html', { waitUntil: 'networkidle0' });
t('page loads with no module/import errors', errors.length === 0, errors.join('\n      '));

// Sign in through the real login path (stubbed endpoint) so showApp() runs exactly as in production.
await page.type('#email', 'smoke@iisupp.net');
await page.type('#pass', 'smoke');
await page.click('#loginBtn');
await page.waitForFunction(() => document.getElementById('app') && document.getElementById('app').style.display === 'grid', { timeout: 10000 });
await page.waitForFunction(() => document.querySelectorAll('#nav .nav-item').length > 0, { timeout: 10000 });

const navCount = await page.$$eval('#nav .nav-item', n => n.length);
t('all 15 nav tabs rendered', navCount === 15, 'got ' + navCount);

if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

for (let i = 0; i < TABS.length; i++) {
  const id = TABS[i];
  errors.length = 0;
  await page.evaluate((idx) => document.querySelectorAll('#nav .nav-item')[idx].click(), i);
  await new Promise(r => setTimeout(r, 350));
  const info = await page.evaluate(() => {
    const c = document.getElementById('content');
    return { text: (c.innerText || '').trim().length, nodes: c.querySelectorAll('*').length,
      raw: /^\s*\{[\s\S]*\}\s*$/.test((c.innerText || '').trim().slice(0, 200)) };
  });
  t(`tab ${i + 1}/15 "${id}" renders without errors`, errors.length === 0, errors.join('\n      '));
  t(`tab "${id}" renders real content`, info.nodes > 5 && info.text > 0, JSON.stringify(info));
  if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, `${String(i + 1).padStart(2, '0')}-${id}.png`) });
}

// ── the composer: it must open OVER the current screen and change nothing about routing ──────────
errors.length = 0;
await page.evaluate(() => document.querySelectorAll('#nav .nav-item')[1].click()); // Action Inbox
await new Promise(r => setTimeout(r, 300));
const opened = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#content .row')].find(r => /reply|new request/i.test(r.innerText));
  if (!row) return { noRow: true };
  row.click();
  return { ok: true };
});
if (!opened.noRow) {
  await new Promise(r => setTimeout(r, 300));
  const before = await page.evaluate(() => document.querySelector('#nav .nav-item[aria-current="true"] .nav-label')?.textContent);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /draft ai reply/i.test(x.textContent)); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 400));
  const after = await page.evaluate(() => ({
    tab: document.querySelector('#nav .nav-item[aria-current="true"] .nav-label')?.textContent,
    composerOpen: !!document.querySelector('.axis-composer, [class*="composer"]'),
    textareaHasBody: !!document.querySelector('textarea') && document.querySelector('textarea').value.length > 40,
  }));
  t('Draft AI Reply opens a composer', after.composerOpen, JSON.stringify(after));
  t('Draft AI Reply causes ZERO navigation', before === after.tab, `${before} -> ${after.tab}`);
  t('composer is pre-filled with the worker draft', after.textareaHasBody, JSON.stringify(after));
  t('composer opened without errors', errors.length === 0, errors.join('\n      '));
}

await browser.close();
server.close();
console.log(`[axis-boot-smoke] ${pass} passed, ${fail} failed${SHOTS ? ` · screenshots in ${path.relative(ROOT, SHOT_DIR)}` : ''}`);
process.exit(fail ? 1 : 0);
