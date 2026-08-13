// R-series verification harness — boots the real shell headless, drives the REAL pipeline
// (fake SR/TTS + stubbed endpoints), asserts gates, and captures state screenshots.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = process.cwd();
const OUT = process.argv[2] || '.';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const results = []; const R = (name, ok, note = '') => { results.push({ name, ok, note }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (note ? ' — ' + note : '')); };

const SNAP = {
  ok: true, version: { v: 1 }, source: 'test-harness',
  snapshots: {
    overview: { data: { kpis: { pipeline_value: 0, awaiting_approval: 3, messages_waiting: 2, followups_due: 1, meetings_week: 0, mrr: 0 }, needs_you_now: [] } },
    inbox: { data: { rows: [
      { id: 'm1', classification: 'reply_to_outreach', actioned: false, subject: 'Re: managed IT quote', snippet: 'question about scope', received_at: Date.now() - 36e5, unread: true },
      { id: 'm2', classification: 'new_inbound_request', actioned: false, subject: 'Need support', snippet: 'new request', received_at: Date.now() - 72e5, unread: true },
      { id: 'm3', classification: 'newsletter', actioned: false, subject: 'weekly digest', snippet: '', received_at: Date.now() - 96e5 } ], counts: { replies: 1, new_requests: 1, snoozed: 0, handled: 0 } } },
    approvals: { data: { rows: [{ id: 'a1', status: 'pending' }, { id: 'a2', status: 'pending' }, { id: 'a3', status: 'pending' }] } },
    fleet: { data: { agents: [{ agent: 'ops', status: 'ok' }, { agent: 'scout', status: 'ok' }] } },
  },
};

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u.startsWith('/api/axis/snapshot')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(SNAP)); }
  if (u === '/.netlify/functions/axis-director') {
    let b = ''; req.on('data', c => b += c);
    return req.on('end', () => setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: 'Fleet green. 3 approvals wait. Nothing else needs you.', routedAgent: null, intent: null })); }, 700));
  }
  const rel = decodeURIComponent(u).replace(/^\/+/, '') || 'axis.html';
  try { const p = path.join(ROOT, rel); const data = fs.readFileSync(p);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => srv.listen(8766, r));

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });

async function newPage({ authed, reduced = false, keepSession } = {}) {
  const page = keepSession || await browser.newPage();
  if (!keepSession) {
    await page.setViewport({ width: 1440, height: 900 });
    page.errors = [];
    page.on('pageerror', e => page.errors.push(String(e.message)));
    page.on('console', m => { if (m.type() === 'error' && !/net::|404|Failed to load resource/i.test(m.text())) page.errors.push('console: ' + m.text()); });
    page.requests = [];
    page.on('request', r => page.requests.push(r.url()));
    await page.evaluateOnNewDocument((authed) => {
      // fake Web Speech so the REAL state machine runs headless
      window.SpeechRecognition = class {
        start() { window.__sr = this; setTimeout(() => this.onstart && this.onstart(), 60); }
        stop() { const s = this; setTimeout(() => s.onend && s.onend(), 40); }
      };
      const fakeSynth = { _q: [], getVoices: () => [], cancel() { this._q = []; },
        speak(u) { setTimeout(() => u.onend && u.onend(), 900); }, onvoiceschanged: null };
      try { Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true }); } catch {}
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
      if (authed) localStorage.setItem('aperture_jwt', 'test.jwt.token'); else localStorage.removeItem('aperture_jwt');
    }, !!authed);
  }
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto('http://127.0.0.1:8766/axis.html', { waitUntil: 'networkidle2', timeout: 30000 });
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
const axState = (page) => page.evaluate(() => document.documentElement.dataset.axisState);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══ PASS A — logged out (R4 public mode + R1 orb) ═══
{
  const page = await newPage({ authed: false });
  await sleep(700);
  const pub = await page.evaluate(() => ({
    panel: !!document.getElementById('axisPublic'),
    orbs: document.querySelectorAll('[data-orb-live] svg').length,
    fabHidden: getComputedStyle(document.getElementById('axisFab')).display, // fab lives in #app (display:none pre-auth)
  }));
  R('A1 public panel present pre-auth', pub.panel);
  R('A2 orbs mounted (login panel)', pub.orbs >= 1, pub.orbs + ' svg');
  await shot(page, 'r4-public-login.png');
  // chip ask → canned/status answer, voiced, zero private data
  await page.click('[data-pub-q="status"]');
  await sleep(400);
  const ans = await page.evaluate(() => document.getElementById('axisPubLog').textContent);
  const leak = /\b(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b|cc\/|AHMAD-|\.cmd|refs\/heads|Lead-\d|reply_to_outreach|\$\s?\d/i.test(ans);
  R('A3 public answer rendered', ans.length > 20, JSON.stringify(ans.slice(0, 60)));
  R('A4 public answer has ZERO leak-class content', !leak);
  R('A5 public answer carries sign-in CTA', /sign in/i.test(ans));
  const speakState = await axState(page);
  R('A6 spoke (state speaking|idle after TTS)', ['speaking', 'idle'].includes(speakState), speakState);
  // network: only same-origin assets + status.json + fonts
  const extra = page.requests.filter(u => !/127\.0\.0\.1:8766|fonts\.g/.test(u));
  R('A7 no unexpected pre-auth requests', extra.length === 0, extra.join(',') || 'none');
  R('A8 no page errors (public)', page.errors.length === 0, page.errors.join(' | ') || 'clean');
  await shot(page, 'r4-public-answer.png');
  await page.close();
}

// ═══ PASS B — authed (R1 states, R2 dock, R3 orbit counts line, badge law) ═══
// R3 note (2026-08-12): the director strip above the globe is gone — its counts line is
// #axisOrbStatus on the orbit, and its input's job is done by the orbit bar (#axisQuick).
{
  const page = await newPage({ authed: true });
  await sleep(1600); // fetchSnapshots + auto-open at 600ms
  const b = await page.evaluate(() => ({
    dockOpen: !document.getElementById('axisDock').hidden,
    strip: !!document.querySelector('.axis-strip'),
    orbStatus: (document.getElementById('axisOrbStatus') || {}).textContent,
    stateWord: document.getElementById('axisStateWord').textContent,
    redBadge: (document.querySelector('.badge-red') || {}).textContent,
    neutralBadge: (document.querySelector('.badge-neutral') || {}).textContent,
    orbCount: document.querySelectorAll('[data-orb-live] svg').length,
  }));
  R('B1 auto-open on authed load', b.dockOpen);
  R('B2 the old command strip must NOT render', !b.strip);
  R('B3 orbit honest counts line', /3 approvals waiting · 2 client replies waiting · 1 follow-up due/.test(b.orbStatus || ''), JSON.stringify(b.orbStatus));
  R('B4 badge law: red inbox badge = 2', b.redBadge === '2', String(b.redBadge));
  R('B5 badge law: approvals neutral = 3', b.neutralBadge === '3', String(b.neutralBadge));
  R('B6 orbs live', b.orbCount >= 1, b.orbCount + ' svg');
  await shot(page, 'r2-dock-autopen-idle.png');

  // R1 state: listening via REAL mic toggle (fake SR)
  await page.click('#axisMic'); await sleep(200);
  R('B7 state listening (mic)', (await axState(page)) === 'listening');
  await shot(page, 'r1-state-listening.png');
  await page.click('#axisMic'); await sleep(200); // stop → idle

  // R3→R2: orbit bar routes through the dock pipeline; thinking then speaking
  await page.type('#axisQuick', 'status'); await page.keyboard.press('Enter');
  await sleep(250);
  const thinking = await axState(page);
  const dots = await page.evaluate(() => !!document.querySelector('.axis-thinking'));
  R('B8 state thinking during director call', thinking === 'thinking', thinking);
  R('B9 thinking shimmer dots visible', dots);
  await shot(page, 'r1-state-thinking.png');
  await sleep(900); // director replies (700ms) → speak begins
  const speaking = await axState(page);
  R('B10 state speaking on reply', speaking === 'speaking', speaking);
  const replyStyle = await page.evaluate(() => { const m = [...document.querySelectorAll('.axis-msg.axis')].pop(); const cs = getComputedStyle(m); return { borderLeft: cs.borderLeftWidth, text: m.textContent.slice(0, 40) }; });
  R('B11 reply = memo style (2px gold left rule)', replyStyle.borderLeft === '2px', JSON.stringify(replyStyle));
  await shot(page, 'r1-state-speaking.png');
  await sleep(1200); // TTS onend at 900ms → idle
  R('B12 state back to idle after speech', (await axState(page)) === 'idle', await axState(page));

  // R2: Esc closes + session dismiss respected on reload
  await page.keyboard.press('Escape'); await sleep(200);
  R('B13 Esc closes dock', await page.evaluate(() => document.getElementById('axisDock').hidden));
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(1400);
  R('B14 dismissed: no auto-open after close (same session)', await page.evaluate(() => document.getElementById('axisDock').hidden));
  await shot(page, 'r1-orb-fab-closed.png');
  R('B15 no page errors (authed)', page.errors.length === 0, page.errors.join(' | ') || 'clean');

  // light theme
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await sleep(300); await shot(page, 'r5-light-theme.png');
  await page.close();
}

// ═══ PASS C — zero-badge case + reduced motion + mobile ═══
{
  SNAP.snapshots.inbox.data.rows = [];
  SNAP.snapshots.approvals.data.rows = [];
  SNAP.snapshots.overview.data.kpis = { pipeline_value: 0, awaiting_approval: 0, messages_waiting: 0, followups_due: 0, meetings_week: 0, mrr: 0 };
  const page = await newPage({ authed: true, reduced: true });
  await sleep(1500);
  const c = await page.evaluate(() => ({
    badgeEls: document.querySelectorAll('.badge-red, .badge-neutral').length,
    orbStatus: (document.getElementById('axisOrbStatus') || {}).textContent,
    coreAnim: getComputedStyle(document.querySelector('.axis-fab .orb-core')).animationName,
    spinAnim: getComputedStyle(document.querySelector('.axis-fab .orb-spin')).animationName,
    pulseOpacity: getComputedStyle(document.querySelector('.axis-fab .orb-pulse')).opacity,
  }));
  R('C1 badge law zero: NO badge elements', c.badgeEls === 0, c.badgeEls + ' badges');
  R('C2 orbit all-quiet line', /All quiet/.test(c.orbStatus || ''), JSON.stringify(c.orbStatus));
  R('C3 reduced-motion: orb static', c.coreAnim === 'none' && c.spinAnim === 'none', c.coreAnim + '/' + c.spinAnim);
  R('C4 reduced-motion: pulse hidden', c.pulseOpacity === '0', c.pulseOpacity);
  await shot(page, 'r5-reduced-motion.png');
  await page.setViewport({ width: 390, height: 844 });
  await sleep(400); await shot(page, 'r5-mobile-390.png');
  const mob = await page.evaluate(() => document.querySelector('.axis-orbit').getBoundingClientRect().width <= 390);
  R('C5 orbit fits 390px', mob);
  await page.close();
}

await browser.close(); srv.close();
const fails = results.filter(r => !r.ok);
console.log('\n' + (fails.length ? 'RED — ' + fails.length + ' failing gate(s)' : 'ALL GATES GREEN — ' + results.length + ' checks'));
process.exit(fails.length ? 1 : 0);
