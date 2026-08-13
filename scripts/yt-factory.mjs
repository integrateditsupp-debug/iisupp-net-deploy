#!/usr/bin/env node
// yt-factory.mjs — turns an ARIA KB topic into a finished, watchable video.
//
// Ahmad, 2026-08-11: educational tech-support content for @AIHelpdesk-IIS, "not lecturing", with a
// hook, that pulls the viewer to the next video. Built entirely from tools already on the machine,
// so a batch costs $0:
//   script    — the local `claude` CLI on the Max plan (API key scrubbed from the child env)
//   voice     — Microsoft neural TTS via edge-tts (free, no key, no quota)
//   slides    — headless Chrome rendering brand-styled HTML to PNG
//   render    — ffmpeg, one moving segment per spoken beat
//   thumbnail — the same Chrome path, 1280x720
//
// Ahmad, 2026-08-12 (v2, after reviewing the first four): the SAPI voice was robotic, the frames
// were static text with nothing to look at, and the cover said the KB title rather than the hook.
// Fixed here: neural voice, per-beat audio so slides change exactly on the sentence, slow camera
// move on every frame, a screen-style card so there is something on screen, and the cover now
// carries the same hook line as the thumbnail.
//
// NOTHING IS PUBLISHED HERE. Output lands in content/youtube/staged/<slug>/ for approval. Uploading
// is an external send and stays a hard stop — see scripts/yt-upload.mjs for that half.
//
// Usage:
//   node scripts/yt-factory.mjs --count 3            # 3 long-form from unused KB topics
//   node scripts/yt-factory.mjs --count 5 --short    # 5 shorts (vertical, ~40s)
//   node scripts/yt-factory.mjs --topic "printer"    # a specific topic
//   node scripts/yt-factory.mjs --topic "wi-fi" --redo   # rebuild one already in the ledger

import { spawn, execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not new URL().pathname — this repo lives under "ARIA — Real-Time AI Assistant",
// so the raw pathname arrives percent-encoded ("%20", "%E2%80%94") and every fs call misses.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGED = path.join(ROOT, 'content', 'youtube', 'staged');
const LEDGER = path.join(ROOT, 'content', 'youtube', 'made.json');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// The API key is removed from Ahmad's machine, but a parent process started before that still holds
// a stale copy and would silently bill the metered account. Scrub unconditionally.
const PLAN_ENV = (() => { const e = { ...process.env }; delete e.ANTHROPIC_API_KEY; delete e.ANTHROPIC_AUTH_TOKEN; return e; })();

const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] || true) : d; };
const SHORT = args.includes('--short');
const REDO = args.includes('--redo');
const COUNT = Number(flag('count', 1)) || 1;
const TOPIC_Q = flag('topic', null);

const sh = (cmd, a, opts = {}) => new Promise((res, rej) =>
  execFile(cmd, a, { maxBuffer: 64 * 1024 * 1024, ...opts }, (e, so, se) => (e ? rej(new Error(se || e.message)) : res(so))));

// ── 1. Script, on the Max plan ───────────────────────────────────────────────
const SYSTEM_LONG = `You write YouTube scripts for "AI Helpdesk" — a real IT company showing people how to fix their own tech.
HARD RULES:
- Open with a HOOK in the first 5 seconds: the pain, as the viewer feels it. Never "in this video we will".
- Never lecture. Talk like a competent friend fixing it on their machine.
- Short sentences. Second person. No filler, no "let's dive in", no sign-off pleasantries.
- Give the real fix, in order, most-likely-cause first.
- End by naming the NEXT specific problem this person probably has, so they want the next video.
- 60-90 seconds spoken. Plain text only: no markdown, no headers, no stage directions, no emoji.
Return ONLY the spoken script.`;

const SYSTEM_SHORT = `You write 40-second YouTube Shorts for "AI Helpdesk" — a real IT company.
HARD RULES:
- First 3 words are the hook. Punchy. The problem, not the topic.
- ONE fix only. The single highest-hit-rate thing. No alternatives, no caveats.
- Very short sentences. Second person. Spoken, not written.
- Last line makes them want the full video.
- 90-110 words TOTAL. Plain text only: no markdown, no emoji, no stage directions.
Return ONLY the spoken script.`;

function askPlan(system, prompt, timeoutMs = 120000) {
  return new Promise((resolve) => {
    let out = '', settled = false;
    const child = spawn('claude', ['--print'], { shell: process.platform === 'win32', env: PLAN_ENV });
    const t = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} resolve(''); } }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => { if (!settled) { settled = true; clearTimeout(t); resolve(''); } });
    child.on('close', () => { if (!settled) { settled = true; clearTimeout(t); resolve(out.trim()); } });
    try { child.stdin.write(system + '\n\n' + prompt); child.stdin.end(); } catch { }
  });
}

// A script the model failed to produce properly must never reach a render.
const BROKEN = /\b(got cut off|all i received|could you (share|clarify|resend)|what would you like me to)\b/i;
const scriptOk = (s) => s && s.length > 220 && !BROKEN.test(s) && !/^\s*(hi|hello|sure)\b/i.test(s);

// ── 2. Voice — Microsoft neural TTS (edge-tts), free and keyless ─────────────
// The Windows SAPI voices installed on this machine (Zira/David Desktop, 2013-era concatenative)
// are the reason the first four videos sounded robotic. edge-tts reaches the same neural voices
// Edge Read Aloud uses: no key, no quota, no per-character cost.
const VOICE = process.env.YT_VOICE || 'en-US-AndrewMultilingualNeural';
const RATE = process.env.YT_VOICE_RATE || '-4%';   // a touch under default: reads calm, not rushed

// pip put edge_tts on whichever interpreter ran the install, which is not necessarily the `python`
// first on PATH. Probe candidates once and fail loudly — silently dropping back to SAPI would ship
// the exact robotic voice this rewrite exists to remove.
const PYTHON = (() => {
  const candidates = [process.env.YT_PYTHON,
    'C:/Users/' + (process.env.USERNAME || '') + '/AppData/Local/Python/pythoncore-3.14-64/python.exe',
    'python', 'py'].filter(Boolean);
  for (const c of candidates) {
    try { execFileSync(c, ['-c', 'import edge_tts'], { stdio: 'ignore' }); return c; } catch {}
  }
  console.error('\n[yt-factory] no Python with edge-tts found. Install it once:');
  console.error('   pip install edge-tts');
  console.error('   (or set YT_PYTHON to the interpreter that has it)\n');
  process.exit(1);
})();

const durationOf = async (f) =>
  parseFloat(String(await sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])).trim()) || 0;

// One clip per spoken beat. Measuring each clip is what lets a slide change exactly when its
// sentence is spoken, instead of dividing the runtime evenly and drifting out of sync.
const GAP = 0.34;
async function speakBeats(lines, dir) {
  const clips = [];
  const gap = path.join(dir, 'gap.wav');
  await sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(GAP), gap]);

  for (let i = 0; i < lines.length; i++) {
    const mp3 = path.join(dir, `beat-${i}.mp3`);
    const wav = path.join(dir, `beat-${i}.wav`);
    await sh(PYTHON, ['-m', 'edge_tts', '--voice', VOICE, '--rate', RATE, '--text', lines[i], '--write-media', mp3]);
    await sh('ffmpeg', ['-y', '-i', mp3, '-ar', '44100', '-ac', '1', wav]);
    fs.unlinkSync(mp3);
    clips.push({ wav, dur: (await durationOf(wav)) + GAP });
  }

  const list = clips.map((c) => `file '${c.wav.replace(/\\/g, '/')}'\nfile '${gap.replace(/\\/g, '/')}'`).join('\n') + '\n';
  const listFile = path.join(dir, 'audio.txt');
  fs.writeFileSync(listFile, list, 'utf8');
  const out = path.join(dir, 'voice.wav');
  await sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', out]);
  for (const c of clips) { try { fs.unlinkSync(c.wav); } catch {} }
  try { fs.unlinkSync(gap); fs.unlinkSync(listFile); } catch {}
  return { total: await durationOf(out), beats: clips.map((c) => c.dur) };
}

// ── 3. Slides + thumbnail (headless Chrome → PNG) ────────────────────────────
const BRAND = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:__W__px;height:__H__px;background:#07070a;color:#f2f2f4;
    font-family:Inter,'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative}
  .bg{position:absolute;inset:0;background:
    radial-gradient(120% 90% at 12% 0%, rgba(210,169,78,.22), transparent 62%),
    radial-gradient(80% 70% at 100% 100%, rgba(210,169,78,.12), transparent 60%)}
  .grid{position:absolute;inset:0;opacity:.16;
    background-image:linear-gradient(rgba(210,169,78,.30) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(210,169,78,.30) 1px,transparent 1px);
    background-size:64px 64px;-webkit-mask-image:radial-gradient(circle at 50% 45%,#000 30%,transparent 78%)}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;padding:__PAD__px}
  .kicker{font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:.30em;text-transform:uppercase;
    color:#d2a94e;font-size:__KICK__px;margin-bottom:26px;display:flex;align-items:center;gap:14px}
  .kicker i{width:10px;height:10px;border-radius:50%;background:#d2a94e;font-style:normal}
  h1{font-size:__H1__px;line-height:1.03;font-weight:800;letter-spacing:-.028em}
  h1 em{font-style:normal;color:#f0c96a}
  .sub{margin-top:30px;font-size:__SUB__px;color:#c9cbd2;font-weight:500;letter-spacing:.01em}
  .rule{width:110px;height:5px;background:#d2a94e;border-radius:3px;margin:30px 0}
  /* A screen-style card, so a frame is something to look at rather than text on a gradient. */
  .card{background:rgba(255,255,255,.045);border:1px solid rgba(210,169,78,.28);border-radius:20px;
    box-shadow:0 40px 90px rgba(0,0,0,.55);overflow:hidden}
  .card .bar{height:__BAR__px;display:flex;align-items:center;gap:12px;padding:0 26px;
    background:rgba(255,255,255,.05);border-bottom:1px solid rgba(210,169,78,.20)}
  .card .bar u{width:13px;height:13px;border-radius:50%;background:rgba(255,255,255,.26);text-decoration:none}
  .card .bar u.g{background:#d2a94e}
  .card .bar span{margin-left:14px;font-family:'JetBrains Mono',monospace;font-size:__BR__px;
    letter-spacing:.16em;text-transform:uppercase;color:rgba(242,242,244,.55)}
  .card .body{padding:__CPAD__px;font-size:__P__px;line-height:1.32;font-weight:600;color:#f2f2f4}
  .step{display:inline-flex;align-self:flex-start;align-items:center;gap:14px;margin-bottom:26px;
    background:#d2a94e;color:#140d02;font-weight:800;font-size:__KICK__px;letter-spacing:.16em;
    padding:10px 20px;border-radius:8px;text-transform:uppercase;font-family:'JetBrains Mono',monospace}
  .rail{position:absolute;left:__PAD__px;right:__PAD__px;bottom:__PAD__px;display:flex;gap:8px}
  .rail b{flex:1;height:5px;border-radius:3px;background:rgba(242,242,244,.16)}
  .rail b.on{background:#d2a94e}
  .brand{position:absolute;left:__PAD__px;bottom:__BRB__px;font-family:'JetBrains Mono',monospace;
    font-size:__BR__px;letter-spacing:.20em;color:rgba(242,242,244,.50);text-transform:uppercase}
  .cta{position:absolute;right:__PAD__px;bottom:__BRB__px;font-family:'JetBrains Mono',monospace;
    font-size:__BR__px;letter-spacing:.16em;color:rgba(210,169,78,.75);text-transform:uppercase}`;

function css(w, h, short) {
  return BRAND
    .replace(/__W__/g, w).replace(/__H__/g, h)
    .replace(/__PAD__/g, short ? 74 : 108)
    .replace(/__KICK__/g, short ? 26 : 22)
    .replace(/__H1__/g, short ? 104 : 92)
    .replace(/__SUB__/g, short ? 44 : 36)
    .replace(/__P__/g, short ? 60 : 50)
    .replace(/__CPAD__/g, short ? 50 : 56)
    .replace(/__BAR__/g, short ? 62 : 56)
    .replace(/__BR__/g, short ? 22 : 18)
    .replace(/__BRB__/g, short ? 108 : 142);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rail = (n, i) => `<div class="rail">${Array.from({ length: n }, (_, k) => `<b class="${k <= i ? 'on' : ''}"></b>`).join('')}</div>`;

// Cover: the hook, word for word the same line as the thumbnail, at a size that reads on a phone.
function coverHTML({ hook, promise, w, h, short, n }) {
  const words = String(hook).split(/\s+/);
  const head = esc(words.slice(0, Math.max(1, words.length - 2)).join(' '));
  const tail = esc(words.slice(Math.max(1, words.length - 2)).join(' '));
  return `<!doctype html><meta charset="utf-8"><style>${css(w, h, short)}</style>
  <div class="bg"></div><div class="grid"></div><div class="wrap">
    <div class="kicker"><i></i>AI Helpdesk</div>
    <h1>${head} <em>${tail}</em></h1>
    <div class="rule"></div>
    <div class="sub">${esc(promise)}</div>
  </div>
  ${rail(n, 0)}
  <div class="brand">Integrated IT Support</div><div class="cta">iisupp.net</div>`;
}

function stepHTML({ i, text, w, h, short, n, label }) {
  return `<!doctype html><meta charset="utf-8"><style>${css(w, h, short)}</style>
  <div class="bg"></div><div class="grid"></div><div class="wrap">
    <div class="step">Step ${i}</div>
    <div class="card">
      <div class="bar"><u></u><u></u><u class="g"></u><span>${esc(label)}</span></div>
      <div class="body">${esc(text)}</div>
    </div>
  </div>
  ${rail(n, i)}
  <div class="brand">AI Helpdesk</div><div class="cta">iisupp.net</div>`;
}

function outroHTML({ w, h, short, n }) {
  return `<!doctype html><meta charset="utf-8"><style>${css(w, h, short)}</style>
  <div class="bg"></div><div class="grid"></div><div class="wrap">
    <div class="kicker"><i></i>AI Helpdesk</div>
    <h1>Still <em>broken?</em></h1>
    <div class="rule"></div>
    <div class="sub">We fix this for businesses in Toronto — iisupp.net<br>Subscribe for the next fix.</div>
  </div>
  ${rail(n, n - 1)}
  <div class="brand">Integrated IT Support</div><div class="cta">iisupp.net</div>`;
}

let shotN = 0;
async function shot(html, outPng, w, h) {
  const tmp = path.join(os.tmpdir(), `ytf-${process.pid}-${++shotN}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const prof = path.join(os.tmpdir(), `ytf-prof-${process.pid}`);
  await sh(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-prefers-reduced-motion', `--window-size=${w},${h}`, `--user-data-dir=${prof}`,
    `--screenshot=${outPng}`, 'file:///' + tmp.replace(/\\/g, '/')]);
  fs.unlinkSync(tmp);
}

// Split the spoken script into beats. One idea per slide, never a wall of text — and shorter than
// v1 used, because each beat is now also a TTS unit and a long one puts too much text on screen.
function beats(script, max, cap) {
  const sents = String(script).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [script];
  const out = []; let buf = '';
  for (const s of sents) {
    if ((buf + ' ' + s).trim().length > cap && buf) { out.push(buf.trim()); buf = s; } else buf += ' ' + s;
    if (out.length >= max - 1) { break; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.slice(0, max);
}

// ── 4. Render — one moving segment per beat ──────────────────────────────────
// A still frame held for eight seconds reads as dead air. Every segment gets a slow push in or
// pull out; the direction alternates so the cut between frames is visible without being busy.
async function segment(png, outMp4, dur, w, h, idx) {
  const frames = Math.max(2, Math.round(dur * 30));
  const zoom = idx % 2 === 0
    ? `min(1.0+0.00085*on,1.075)`
    : `max(1.075-0.00085*on,1.0)`;
  const vf = [
    `scale=${w * 2}:${h * 2}`,
    `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=30`,
    `fade=t=in:st=0:d=0.30`,
    `fade=t=out:st=${Math.max(0, dur - 0.30).toFixed(2)}:d=0.30`,
  ].join(',');
  await sh('ffmpeg', ['-y', '-loop', '1', '-framerate', '30', '-i', png, '-vf', vf, '-t', dur.toFixed(3),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', outMp4]);
}

async function render(dir, parts, hook, promise, durs, short) {
  const W = short ? 1080 : 1920, H = short ? 1920 : 1080;
  const n = parts.length + 1;                     // beats + outro; beat 0 is spoken over the cover
  const OUTRO = 2.4;
  const label = short ? 'ai helpdesk · fix' : 'ai helpdesk · the fix';

  const segs = [];
  for (let i = 0; i < parts.length; i++) {
    const png = path.join(dir, `f-${i}.png`);
    await shot(i === 0
      ? coverHTML({ hook, promise, w: W, h: H, short, n })
      : stepHTML({ i, text: parts[i], w: W, h: H, short, n, label }), png, W, H);
    const mp4 = path.join(dir, `s-${i}.mp4`);
    await segment(png, mp4, durs[i], W, H, i);
    segs.push(mp4); fs.unlinkSync(png);
  }
  const opng = path.join(dir, 'f-out.png');
  await shot(outroHTML({ w: W, h: H, short, n }), opng, W, H);
  const omp4 = path.join(dir, 's-out.mp4');
  await segment(opng, omp4, OUTRO, W, H, parts.length);
  segs.push(omp4); fs.unlinkSync(opng);

  const listFile = path.join(dir, 'segs.txt');
  fs.writeFileSync(listFile, segs.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n') + '\n', 'utf8');
  const out = path.join(dir, 'video.mp4');
  // No -shortest: the outro plays past the end of the narration on purpose.
  await sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-i', path.join(dir, 'voice.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  for (const s of segs) { try { fs.unlinkSync(s); } catch {} }
  try { fs.unlinkSync(listFile); } catch {}
  return out;
}

// ── 5. Topic selection ───────────────────────────────────────────────────────
function loadLedger() { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { made: [] }; } }
function saveLedger(l) { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2)); }

function pickTopics(n) {
  const kb = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'aria-kb-chunks.json'), 'utf8'));
  const all = (kb.chunks || kb).filter((c) => c && c.title && String(c.content || '').length > 400);
  const done = new Set(loadLedger().made.map((m) => m.kb_slug));
  let pool = REDO ? all : all.filter((c) => !done.has(c.slug));
  if (TOPIC_Q) pool = pool.filter((c) => new RegExp(TOPIC_Q, 'i').test(c.title + ' ' + c.slug));
  return pool.slice(0, n);
}

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// ── main ─────────────────────────────────────────────────────────────────────
const topics = pickTopics(COUNT);
if (!topics.length) { console.error('[yt-factory] no unused KB topics matched'); process.exit(1); }
console.log(`[yt-factory] building ${topics.length} ${SHORT ? 'short' : 'long-form'} video(s) · voice ${VOICE}`);

const ledger = loadLedger();
for (const t of topics) {
  const slug = slugify((SHORT ? 'short-' : '') + t.title);
  const dir = path.join(STAGED, slug);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n[yt-factory] ${t.title}`);

  process.stdout.write('  script … ');
  const script = await askPlan(SHORT ? SYSTEM_SHORT : SYSTEM_LONG,
    `Topic: ${t.title}\n\nSource material:\n${String(t.content).slice(0, 1800)}\n\nWrite the script.`);
  if (!scriptOk(script)) { console.log('FAILED (unusable script) — skipped'); continue; }
  fs.writeFileSync(path.join(dir, 'script.txt'), script, 'utf8');
  console.log(`ok (${script.length} chars)`);

  // Metadata is written BEFORE the render now: the cover frame shows the same hook line as the
  // thumbnail, so the click and the first second of the video agree with each other.
  process.stdout.write('  title/hook … ');
  const meta = await askPlan(
    `You write YouTube metadata for a real IT company's channel. Return STRICT JSON only, no prose, no code fence:
{"title":"<=60 chars, a real search phrase a frustrated person would type, no clickbait lies, no emoji",
 "thumb":"3-4 WORDS MAX for the thumbnail and cover frame, the pain not the topic, no punctuation",
 "promise":"<=8 words, what the viewer walks away able to do",
 "description":"2-3 short lines, plain, ends with one line inviting subscribe",
 "tags":["8-12 lowercase search tags"]}`,
    `Video topic: ${t.title}\n\nScript:\n${script.slice(0, 900)}`);
  let m = {};
  try { m = JSON.parse(String(meta).replace(/^```(json)?|```$/gm, '').trim()); } catch { m = {}; }
  const hook = String(m.thumb || t.title).replace(/^"|"$/g, '').split(/\s+/).slice(0, 4).join(' ');
  const promise = String(m.promise || 'The fix, in order, in under two minutes.').replace(/^"|"$/g, '');
  console.log(`ok ("${hook}")`);

  process.stdout.write('  voice  … ');
  const parts = beats(script, SHORT ? 5 : 8, SHORT ? 110 : 130);
  const { total: dur, beats: durs } = await speakBeats(parts, dir);
  console.log(`ok (${dur.toFixed(1)}s, ${parts.length} beats, neural)`);

  process.stdout.write('  render … ');
  await render(dir, parts, hook, promise, durs, SHORT);
  console.log('ok');

  process.stdout.write('  thumbnail … ');
  // Thumbnails live or die on mobile, where the card is ~250px wide. Four words maximum, filling
  // the frame edge to edge, one word in gold, on a scrim dark enough to hold contrast at any size.
  const tw = hook.toUpperCase().split(/\s+/);
  const size = tw.length <= 2 ? 190 : tw.length === 3 ? 158 : 126;
  const thumbHTML = `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1280px;height:720px;background:#05050a;font-family:Inter,'Segoe UI',system-ui,sans-serif;
      color:#fff;position:relative;overflow:hidden}
    .bg{position:absolute;inset:0;background:
      radial-gradient(130% 110% at -5% 50%, rgba(210,169,78,.26) 0%, transparent 52%),
      radial-gradient(70% 100% at 112% 50%, rgba(6,14,44,.90) 0%, transparent 68%),
      radial-gradient(55% 55% at 50% 110%, rgba(210,169,78,.07), transparent 70%)}
    .grid{position:absolute;inset:0;opacity:.18;
      background-image:linear-gradient(rgba(210,169,78,.4) 1px,transparent 1px),
                       linear-gradient(90deg,rgba(210,169,78,.4) 1px,transparent 1px);
      background-size:72px 72px;-webkit-mask-image:radial-gradient(circle at 35% 50%,#000 20%,transparent 72%)}
    .scrim{position:absolute;left:0;top:0;bottom:0;width:800px;
      background:linear-gradient(90deg,rgba(0,0,0,.80) 0%,rgba(0,0,0,.60) 55%,transparent 100%)}
    .bar{position:absolute;left:0;top:0;bottom:0;width:18px;
      background:linear-gradient(180deg,#f0c96a 0%,#d2a94e 100%)}
    .left{position:absolute;left:18px;top:0;width:730px;height:100%;
      display:flex;flex-direction:column;justify-content:center;padding:48px 44px 48px 78px}
    .kicker{font-size:23px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;
      color:#d2a94e;margin-bottom:16px;opacity:.88}
    h1{font-size:${size}px;line-height:.87;font-weight:900;letter-spacing:-.044em;
      text-transform:uppercase;text-shadow:0 4px 0 rgba(0,0,0,.95),0 12px 40px rgba(0,0,0,.85)}
    h1 em{font-style:normal;color:#f0c96a}
    .fix{margin-top:32px;display:inline-flex;align-self:flex-start;align-items:center;gap:12px;
      background:#d2a94e;color:#0a0602;font-weight:900;font-size:30px;letter-spacing:.04em;
      padding:13px 26px;border-radius:10px;text-transform:uppercase;box-shadow:0 8px 40px rgba(210,169,78,.52)}
    .right{position:absolute;right:0;top:0;width:550px;height:100%;
      display:flex;align-items:center;justify-content:center}
    .brand{position:absolute;left:78px;bottom:24px;font-family:'JetBrains Mono',monospace;font-size:19px;
      letter-spacing:.18em;color:rgba(255,255,255,.40);text-transform:uppercase}
  </style>
  <div class="bg"></div><div class="grid"></div><div class="scrim"></div><div class="bar"></div>
  <div class="left">
    <div class="kicker">AI Helpdesk</div>
    <h1>${esc(tw.slice(0, -1).join(' '))} <em>${esc(tw.slice(-1)[0] || '')}</em></h1>
    <div class="fix">&#x2713;&nbsp;Fixed in ${Math.max(1, Math.round(dur / 60))} min</div>
  </div>
  <div class="right">
    <svg width="450" height="450" viewBox="0 0 450 450" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="65" y="85" width="320" height="210" rx="18" stroke="#d2a94e" stroke-width="3" fill="rgba(210,169,78,0.05)"/>
      <rect x="95" y="116" width="126" height="12" rx="6" fill="rgba(210,169,78,0.65)"/>
      <rect x="95" y="140" width="260" height="9" rx="4" fill="rgba(255,255,255,0.18)"/>
      <rect x="95" y="161" width="198" height="9" rx="4" fill="rgba(255,255,255,0.12)"/>
      <rect x="95" y="182" width="232" height="9" rx="4" fill="rgba(255,255,255,0.18)"/>
      <rect x="95" y="203" width="164" height="9" rx="4" fill="rgba(255,255,255,0.12)"/>
      <circle cx="326" cy="270" r="52" fill="#d2a94e" opacity="0.96"/>
      <polyline points="300,270 318,289 354,251" stroke="#05050a" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="205" y="295" width="40" height="50" rx="6" fill="rgba(210,169,78,0.22)" stroke="#d2a94e" stroke-width="2.5"/>
      <rect x="161" y="343" width="128" height="16" rx="8" fill="rgba(210,169,78,0.38)" stroke="#d2a94e" stroke-width="2.5"/>
      <circle cx="112" cy="70" r="7" fill="#d2a94e" opacity="0.58"/>
      <circle cx="138" cy="56" r="4.5" fill="#d2a94e" opacity="0.32"/>
      <circle cx="350" cy="384" r="6" fill="#d2a94e" opacity="0.40"/>
      <circle cx="374" cy="397" r="4" fill="#d2a94e" opacity="0.22"/>
    </svg>
  </div>
  <div class="brand">AI Helpdesk · IIS</div>`;
  await shot(thumbHTML, path.join(dir, 'thumbnail.png'), 1280, 720);
  console.log('ok');

  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    slug, kb_slug: t.slug, kind: SHORT ? 'short' : 'long',
    title: (m.title || t.title).toString().slice(0, 95),
    hook, promise,
    description: (m.description || '').toString().slice(0, 4500),
    tags: Array.isArray(m.tags) ? m.tags.slice(0, 12) : [],
    duration_s: Math.round(dur), voice: VOICE, source: 'aria-kb', cost: 0,
    status: 'staged-awaiting-approval', created_at: new Date().toISOString(),
  }, null, 2));

  ledger.made = ledger.made.filter((x) => x.slug !== slug);
  ledger.made.push({ slug, kb_slug: t.slug, kind: SHORT ? 'short' : 'long', at: new Date().toISOString() });
  saveLedger(ledger);
  console.log(`  → ${path.relative(ROOT, dir)}`);
}
console.log('\n[yt-factory] done. Nothing published — every video is staged for approval.');
