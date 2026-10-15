// tests/axis-tasks-console.test.mjs — RUN-AX3 (2026-10-15): the Live task view, headless, against the REAL endpoint.
//
// Boots the real console (axis.html → assets/axis-app.js → assets/axis-tasks.js) in Chromium against a local
// static server. /api/axis/tasks is the REAL netlify/functions/axis-tasks.mjs handler running in this process on
// an in-memory Blobs store (tests/lib/axis-memory-store.mjs) with a real Aperture JWT — so a click in the page
// writes the same store, audit and overlay the director's tools write. Everything else under /api is stubbed.
//
// Proves: the Overview panel renders the endpoint's rows and counts; a Done click POSTs (via:"console") and the
// row updates from the server's answer; the full screen is reachable from Priorities and its filters work; a
// chat action that changed the list refreshes it at once; 1440 and 390 widths, dark and light, never scroll
// sideways and throw 0 page errors.
//
// OPT-IN BY ENVIRONMENT, like ARIA Sentinel/tests/lib/renderer-harness.mjs: Playwright and a Chromium binary are
// not dependencies. Where either is absent the suite says so and skips — never a silent green, never a red for
// a missing browser. Screenshots are written only when AXIS_SHOTS_DIR is set.
// Run: node tests/axis-tasks-console.test.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createMemoryBlobs, envelope } from './lib/axis-memory-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function findChromium() {
  for (const c of [process.env.PLAYWRIGHT_CHROMIUM, process.env.CHROMIUM_PATH]) if (c && fs.existsSync(c)) return c;
  for (const r of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(process.env.HOME || '', '.cache', 'ms-playwright')].filter(Boolean)) {
    let entries = [];
    try { entries = fs.readdirSync(r); } catch { continue; }
    for (const e of entries.filter((x) => /^chromium-\d+$/.test(x)).sort().reverse())
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(r, e, rel);
        if (fs.existsSync(p)) return p;
      }
  }
  return null;
}
const PLAYWRIGHT = [process.env.PLAYWRIGHT_MODULE, '/opt/npm-tools/node_modules/playwright/index.mjs', path.join(ROOT, 'node_modules', 'playwright', 'index.mjs')].filter(Boolean).find((p) => fs.existsSync(p)) || null;
const CHROMIUM = findChromium();

if (!PLAYWRIGHT || !CHROMIUM) {
  console.log(`[axis-tasks-console] SKIPPED — ${!PLAYWRIGHT ? 'Playwright is not installed here (set PLAYWRIGHT_MODULE)' : 'no Chromium binary (set PLAYWRIGHT_CHROMIUM)'}; the endpoint and the model are covered by axis-tasks-endpoint / axis-tasks-model.`);
} else {
  await run();
}

async function run() {
  const SHOTS = process.env.AXIS_SHOTS_DIR || null;
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const prevSecret = process.env.APERTURE_JWT_SECRET;
  process.env.APERTURE_JWT_SECRET = 'axis-tasks-console-secret';
  const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: 'ahmad', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }));
  const TOKEN = `${h}.${p}.${b64u(crypto.createHmac('sha256', process.env.APERTURE_JWT_SECRET).update(`${h}.${p}`).digest())}`;

  const T = require(path.join(ROOT, 'netlify/functions/lib/axis-tasks.cjs'));
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString();
  const snaps = {
    overview: envelope('overview', { kpis: { pipeline_value: 68000, mrr: 1200 }, needs_you_now: [], ceo_critical: [
      { ref: '#1', n: 1, section: 'open', what: 'Answer the HEC IT-RFP question (bid intent, closes soon)', who: "the agency's desk", deadline: day(-2), category: 'deadline-14d', one_click: null, status: 'OVERDUE', overdue: true, closed: false, cleared: false },
      { ref: '#5', n: 5, section: 'open', what: 'Fix the Apollo payment method (card declined)', who: 'enrichment, outbound', deadline: null, category: 'payment', one_click: 'Apollo billing page', status: 'open', overdue: false, closed: false, cleared: false },
    ] }),
    followups: envelope('followups', { overdue: [{ id: 7, business_id: 1, company: 'Acme Dental', due_at: Date.now() - 3 * 86400000, status: 'scheduled' }], due_today: [], upcoming: [], auto_cancelled: [] }),
    inbox: envelope('inbox', { rows: [{ id: 41, thread_id: 't41', classification: 'reply_to_outreach', subject: 'Re: network audit quote', from_email: 'it@bay.example', received_at: day(-1), actioned: false, snippet: 'Can you send the audit plan?' }], counts: {} }),
    approvals: envelope('approvals', { pending: 1, rows: [{ id: 99, channel: 'email', kind: 'initial', subject: 'Intro to Lead-007', status: 'pending', created_at: Date.now() - 86400000 }] }),
    fleet: envelope('fleet', { agents: [] }),
  };
  const mem = createMemoryBlobs();
  mem.put('axis-exec', 'todos', [
    { id: 'todo-whereby', title: 'Sign the Whereby cancel', priority: 'high', needsYou: true, note: 'your signature', done: false, created_at: day(-3) },
    { id: 'todo-news', title: 'Draft Q4 newsletter', priority: 'normal', needsYou: false, done: false, created_at: day(-2) },
  ]);
  mem.put('axis-exec', 'approvals', [{ id: 'apr-domain', kind: 'spend', title: 'Buy domain iisupport.ca', detail: 'registrar', costUsd: 12, status: 'pending', created_at: day(-1) }]);
  mem.put('axis-exec', 'tasks', []); mem.put('axis-exec', 'followups', []); mem.put('axis-exec', 'workspace', []); mem.put('axis-exec', 'local-jobs', []);
  for (const [k, v] of Object.entries(snaps)) mem.put('axis-snapshots', k, v);
  T._setGetStore(mem.getStore);
  const endpoint = (await import(path.join(ROOT, 'netlify/functions/axis-tasks.mjs'))).default;

  const calls = [];
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (u.pathname === '/api/axis/tasks') {
      calls.push({ method: req.method, path: u.pathname + u.search, body: raw ? JSON.parse(raw) : null });
      const r = await endpoint(new Request('http://x' + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? raw : undefined }));
      return send(r.status, await r.text());
    }
    if (u.pathname === '/api/axis/snapshot') {
      const version = { v: 1, tick: new Date().toISOString(), modules: Object.fromEntries(Object.keys(snaps).map((m) => [m, 1])) };
      return send(200, u.searchParams.get('module') === 'all' ? { ok: true, authed: true, version, snapshots: snaps, source: 'worker' } : { ok: true, authed: true, version, source: 'worker' });
    }
    if (u.pathname === '/api/axis/situation') { const L = await T.listTasks({ getStore: mem.getStore }); return send(200, L.situation); }
    if (u.pathname === '/.netlify/functions/axis-director') {
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ method: 'POST', path: u.pathname, body });
      // The real director's task path is covered end to end in axis-director-tools; here the reply shape the
      // console receives after a chat action that changed the list.
      if (body.task) {
        const r = await endpoint(new Request('http://x/api/axis/tasks', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'complete', id: 'todo:todo-news', via: body.via || 'chat' }) }));
        const j = await r.json();
        return send(200, { text: j.receipt, receipts: [j.receipt], tasksChanged: true, routedAgent: null, intent: null, needsApproval: false, brainTier: 'anthropic-tools' });
      }
      return send(200, { text: 'Heard you.', routedAgent: null, intent: null });
    }
    if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/.netlify/functions/')) return send(200, { ok: false, reason: 'stubbed in axis-tasks-console' });
    const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/axis.html' : u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'not found', 'text/plain');
    send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = await import(PLAYWRIGHT);
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let checks = 0;
  const ok = () => { checks++; };

  try {
    for (const theme of ['dark', 'light']) {
      for (const width of [1440, 390]) {
        mem.put('axis-exec', 'todos', [
          { id: 'todo-whereby', title: 'Sign the Whereby cancel', priority: 'high', needsYou: true, note: 'your signature', done: false, created_at: day(-3) },
          { id: 'todo-news', title: 'Draft Q4 newsletter', priority: 'normal', needsYou: false, done: false, created_at: day(-2) },
        ]);
        mem.put('axis-task-audit', 'log', []); mem.put('axis-task-overlay', 'rows', {});
        calls.length = 0;
        const tag = `${width}-${theme}`;
        const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 950 }, colorScheme: theme, deviceScaleFactor: 1 });
        await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
        await ctx.addInitScript(([tok, th]) => {
          try { localStorage.setItem('aperture_jwt', tok); localStorage.setItem('axis_theme', th); sessionStorage.setItem('axisBriefed', '1'); localStorage.setItem('axis-voice-on', '0'); } catch {}
          try { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); } catch {}
        }, [TOKEN, theme]);
        const page = await ctx.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
        page.on('dialog', (d) => d.accept());
        await page.goto(base + '/axis.html');
        await page.evaluate((th) => { document.documentElement.setAttribute('data-theme', th); }, theme);

        // 1. The Overview panel renders the endpoint's rows and counts.
        await page.waitForSelector('#axisTasksPanel .tk-row');
        const L = await T.listTasks({ getStore: mem.getStore });
        const panel = await page.evaluate(() => {
          const p = document.getElementById('axisTasksPanel');
          return { head: p.querySelector('.screen-head').innerText.replace(/\s+/g, ' '), ids: [...p.querySelectorAll('.tk-row')].map((r) => r.dataset.taskId), text: p.innerText };
        });
        assert.match(panel.head, /Live task view/, `${tag}: the panel is titled`);
        assert.ok(panel.head.includes(`${L.counts.open} open · ${L.counts.needsMe} need you · ${L.counts.axis} AXIS handling`), `${tag}: the panel header carries the endpoint's counts (${panel.head})`);
        assert.ok(panel.ids.length >= 4 && panel.ids.length <= 6, `${tag}: the top rows render (${panel.ids.length})`);
        assert.equal(panel.ids[0], L.items.find((i) => i.status === 'open' && i.needsMe).id, `${tag}: the first row is the endpoint's top needs-you row`);
        assert.ok(await page.$('#content .screen-head >> text=Today — needs you') !== null || /Today — needs you/.test(await page.innerText('#content')), `${tag}: "Today — needs you" survives (Rule 15)`);
        assert.ok(/Needs You Now/.test(await page.innerText('#content')), `${tag}: "Needs You Now" survives (Rule 15)`);
        ok();
        if (SHOTS) await page.locator('#axisTasksPanel').screenshot({ path: path.join(SHOTS, `overview-panel-${tag}.png`) });

        // 2. Phone and desktop: nothing scrolls sideways.
        const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - window.innerWidth, content: (() => { const c = document.getElementById('content'); return c ? c.scrollWidth - c.clientWidth : 0; })() }));
        assert.ok(overflow.doc <= 1 && overflow.content <= 1, `${tag}: no horizontal scroll on the Overview (${JSON.stringify(overflow)})`);
        ok();

        // 3. A Done click on a to-do POSTs via:"console" and the row updates from the server's answer.
        const whereby = '#axisTasksPanel .tk-row[data-task-id="todo:todo-whereby"]';
        await page.locator(whereby).scrollIntoViewIfNeeded();
        await page.click(`${whereby} button[data-act="complete"]`);
        await page.waitForFunction(() => !document.querySelector('#axisTasksPanel .tk-row[data-task-id="todo:todo-whereby"]'));  // optimistic
        await page.waitForFunction(() => /✔ Done: Sign the Whereby cancel/.test((document.getElementById('toast') || {}).innerText || ''));  // server receipt
        const post = calls.find((c) => c.method === 'POST' && c.body && c.body.action === 'complete');
        assert.ok(post, `${tag}: the click POSTed to /api/axis/tasks`);
        assert.equal(post.body.id, 'todo:todo-whereby');
        assert.equal(post.body.via, 'console', `${tag}: a console click is via "console"`);
        const todos = mem.read('axis-exec', 'todos');
        assert.equal(todos.find((t) => t.id === 'todo-whereby').done, true, `${tag}: the store says done`);
        const audit = mem.read('axis-task-audit', 'log');
        assert.ok(audit.some((e) => e.action === 'complete' && e.id === 'todo:todo-whereby' && e.via === 'console' && e.actor === 'ahmad'), `${tag}: the audit has the click`);
        ok();

        // 4. The full screen, from Priorities; its filters work and the finished row is under Done / archived.
        await page.evaluate(() => { const b = [...document.querySelectorAll('#nav .nav-item')].find((x) => /Priorities/.test(x.innerText)); b.click(); });
        await page.waitForSelector('button[data-act="open-tasks"]');
        await page.click('button[data-act="open-tasks"]');
        await page.waitForSelector('#axisTasksScreen #tkList .tk-row');
        await page.click('#tkFilters button[data-filter="done"]');
        await page.waitForSelector('#tkList .tk-row[data-task-id="todo:todo-whereby"][data-status="done"]');
        const doneRow = await page.innerText('#tkList .tk-row[data-task-id="todo:todo-whereby"]');
        assert.match(doneRow, /Reopen/, `${tag}: a done row offers Reopen`);
        assert.match(doneRow, /last: complete by you via console/, `${tag}: the row shows its audit`);
        await page.click('#tkFilters button[data-filter="open"]');
        const openIds = await page.$$eval('#tkList .tk-row', (rows) => rows.map((r) => r.dataset.taskId));
        assert.ok(openIds.includes('ledger:#1') && openIds.includes('approval:apr-domain') && openIds.includes('board-approval:99'), `${tag}: every source is on the full list (${openIds.join(', ')})`);
        const screenOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(screenOverflow <= 1, `${tag}: no horizontal scroll on the Live task view (${screenOverflow})`);
        ok();
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `task-screen-${tag}.png`), fullPage: true });

        // 5. A chat action that changed the list refreshes it at once (no 30 s wait).
        const before = calls.filter((c) => c.method === 'GET').length;
        await page.evaluate(() => { const i = document.getElementById('axisInput'); i.value = 'mark the newsletter done'; });
        await page.evaluate(() => { document.getElementById('axisSend').click(); });
        await page.waitForFunction(() => /✔ Done: Draft Q4 newsletter/.test((document.getElementById('axisLog') || {}).innerText || ''));
        const director = calls.find((c) => c.path === '/.netlify/functions/axis-director' && c.body && c.body.task);
        assert.ok(director && director.body.task === 'action', `${tag}: the task ask went to the director's task path (task:"action")`);
        await new Promise((r) => setTimeout(r, 600));
        assert.ok(calls.filter((c) => c.method === 'GET').length > before, `${tag}: the list was re-read right after the chat receipt`);
        await page.waitForSelector('#tkList .tk-row[data-task-id="todo:todo-news"]', { state: 'detached' }).catch(() => {});
        ok();

        assert.deepEqual(errors, [], `${tag}: 0 page errors`);
        ok();
        await ctx.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
    T._setGetStore(null);
    if (prevSecret === undefined) delete process.env.APERTURE_JWT_SECRET; else process.env.APERTURE_JWT_SECRET = prevSecret;
  }
  console.log(`[axis-tasks-console] ${checks} checks passed (1440 + 390 · dark + light · real endpoint)${SHOTS ? ' · screenshots in ' + SHOTS : ''}`);
}
