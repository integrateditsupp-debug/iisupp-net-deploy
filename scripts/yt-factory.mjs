#!/usr/bin/env node
// yt-factory.mjs — turns an ARIA KB topic into a finished, watchable video.
//
// Ahmad, 2026-08-11: educational tech-support content for @AIHelpdesk-IIS, "not lecturing", with a
// hook, that pulls the viewer to the next video. Built entirely from tools already on the machine,
// so a batch costs $0:
//   script    — the local `claude` CLI on the Max plan (API key scrubbed from the child env)
//   voice     — Windows SAPI via PowerShell (System.Speech)
//   slides    — headless Chrome rendering brand-styled HTML to PNG
//   render    — ffmpeg
//   thumbnail — the same Chrome path, 1280x720
//
// NOTHING IS PUBLISHED HERE. Output lands in content/youtube/staged/<slug>/ for approval. Uploading
// is an external send and stays a hard stop — see scripts/yt-upload.mjs for that half.
//
// Usage:
//   node scripts/yt-factory.mjs --count 3            # 3 long-form from unused KB topics
//   node scripts/yt-factory.mjs --count 5 --short    # 5 shorts (vertical, ~40s)
//   node scripts/yt-factory.mjs --topic "printer"    # a specific topic

import { spawn, execFile } from 'node:child_process';
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

// ── 2. Voice (Windows SAPI, free) ────────────────────────────────────────────
async function speak(text, wavPath) {
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -match 'Zira|Hazel|Female' } | Select-Object -First 1
if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }
$s.Rate = 1
$s.SetOutputToWaveFile(${JSON.stringify(wavPath)})
$s.Speak([IO.File]::ReadAllText(${JSON.stringify(wavPath + '.txt')}))
$s.Dispose()`;
  fs.writeFileSync(wavPath + '.txt', text, 'utf8');
  await sh('powershell', ['-NoProfile', '-Command', ps]);
  fs.unlinkSync(wavPath + '.txt');
  const out = await sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wavPath]);
  return parseFloat(String(out).trim()) || 0;
}

// ── 3. Slides + thumbnail (headless Chrome → PNG) ────────────────────────────
const BRAND = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:__W__px;height:__H__px;background:#07070a;color:#ececee;
    font-family:Inter,'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative}
  .bg{position:absolute;inset:0;background:
    radial-gradient(120% 90% at 12% 0%, rgba(210,169,78,.20), transparent 62%),
    radial-gradient(80% 70% at 100% 100%, rgba(210,169,78,.10), transparent 60%)}
  .grid{position:absolute;inset:0;opacity:.16;
    background-image:linear-gradient(rgba(210,169,78,.30) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(210,169,78,.30) 1px,transparent 1px);
    background-size:64px 64px;-webkit-mask-image:radial-gradient(circle at 50% 45%,#000 30%,transparent 78%)}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;padding:__PAD__px}
  .kicker{font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:.30em;text-transform:uppercase;
    color:#d2a94e;font-size:__KICK__px;margin-bottom:26px}
  h1{font-size:__H1__px;line-height:1.06;font-weight:700;letter-spacing:-.02em}
  h1 em{font-style:normal;color:#d2a94e}
  p{font-size:__P__px;line-height:1.34;color:#dfe1e6;font-weight:500}
  .rule{width:96px;height:4px;background:#d2a94e;border-radius:3px;margin:30px 0}
  .brand{position:absolute;left:__PAD__px;bottom:44px;font-family:'JetBrains Mono',monospace;
    font-size:__BR__px;letter-spacing:.20em;color:rgba(236,236,238,.50);text-transform:uppercase}
  .n{position:absolute;right:__PAD__px;bottom:40px;font-family:'JetBrains Mono',monospace;
    font-size:__BR__px;color:rgba(210,169,78,.55)}`;

function slideHTML({ kicker, title, body, w, h, short }) {
  const css = BRAND
    .replace(/__W__/g, w).replace(/__H__/g, h)
    .replace(/__PAD__/g, short ? 78 : 110)
    .replace(/__KICK__/g, short ? 24 : 20)
    .replace(/__H1__/g, short ? 78 : 68)
    .replace(/__P__/g, short ? 52 : 40)
    .replace(/__BR__/g, short ? 20 : 17);
  return `<!doctype html><meta charset="utf-8"><style>${css}</style>
  <div class="bg"></div><div class="grid"></div><div class="wrap">
    ${kicker ? `<div class="kicker">${kicker}</div>` : ''}
    ${title ? `<h1>${title}</h1><div class="rule"></div>` : ''}
    ${body ? `<p>${body}</p>` : ''}
  </div>
  <div class="brand">AI Helpdesk · Integrated IT Support</div>`;
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

// Split the spoken script into on-screen beats. One idea per slide, never a wall of text.
function beats(script, max) {
  const sents = String(script).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [script];
  const out = []; let buf = '';
  for (const s of sents) {
    if ((buf + ' ' + s).trim().length > 155 && buf) { out.push(buf.trim()); buf = s; } else buf += ' ' + s;
    if (out.length >= max - 1) break;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.slice(0, max);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── 4. Render ────────────────────────────────────────────────────────────────
async function render(dir, script, title, dur, short) {
  const W = short ? 1080 : 1920, H = short ? 1920 : 1080;
  const parts = beats(script, short ? 4 : 7);
  const per = Math.max(2.2, dur / (parts.length + 1));

  const pngs = [];
  const hookWords = title.split(/\s+/);
  const hookHTML = slideHTML({ kicker: 'AI Helpdesk', w: W, h: H, short,
    title: esc(hookWords.slice(0, 3).join(' ')) + ' <em>' + esc(hookWords.slice(3).join(' ')) + '</em>' });
  const p0 = path.join(dir, 'slide-0.png'); await shot(hookHTML, p0, W, H); pngs.push(p0);

  for (let i = 0; i < parts.length; i++) {
    const p = path.join(dir, `slide-${i + 1}.png`);
    await shot(slideHTML({ kicker: `Step ${i + 1}`, body: esc(parts[i]), w: W, h: H, short }), p, W, H);
    pngs.push(p);
  }

  // concat demuxer: each slide held for `per` seconds, last one repeated so the list is well-formed
  const list = pngs.map((p) => `file '${p.replace(/\\/g, '/')}'\nduration ${per.toFixed(3)}`).join('\n')
    + `\nfile '${pngs[pngs.length - 1].replace(/\\/g, '/')}'\n`;
  const listFile = path.join(dir, 'slides.txt');
  fs.writeFileSync(listFile, list, 'utf8');

  const out = path.join(dir, 'video.mp4');
  await sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-i', path.join(dir, 'voice.wav'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=0.4`,
    '-c:a', 'aac', '-b:a', '160k', '-shortest', out]);
  for (const p of pngs) { try { fs.unlinkSync(p); } catch {} }
  try { fs.unlinkSync(listFile); } catch {}
  return out;
}

// ── 5. Topic selection ───────────────────────────────────────────────────────
function loadLedger() { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { made: [] }; } }
function saveLedger(l) { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2)); }

function pickTopics(n) {
  const kb = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'aria-kb-chunks.json'), 'utf8'));
  const all = (kb.chunks || kb).filter((c) => c && c.title && String(c.content || '').length > 400);
  const done = new Set(loadLedger().made.map((m) => m.slug));
  let pool = all.filter((c) => !done.has(c.slug));
  if (TOPIC_Q) pool = pool.filter((c) => new RegExp(TOPIC_Q, 'i').test(c.title + ' ' + c.slug));
  return pool.slice(0, n);
}

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// ── main ─────────────────────────────────────────────────────────────────────
const topics = pickTopics(COUNT);
if (!topics.length) { console.error('[yt-factory] no unused KB topics matched'); process.exit(1); }
console.log(`[yt-factory] building ${topics.length} ${SHORT ? 'short' : 'long-form'} video(s)`);

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

  process.stdout.write('  voice  … ');
  const dur = await speak(script, path.join(dir, 'voice.wav'));
  console.log(`ok (${dur.toFixed(1)}s)`);

  process.stdout.write('  render … ');
  await render(dir, script, t.title.replace(/^"|"$/g, ''), dur, SHORT);
  console.log('ok');

  process.stdout.write('  title/thumb … ');
  const meta = await askPlan(
    `You write YouTube metadata for a real IT company's channel. Return STRICT JSON only, no prose, no code fence:
{"title":"<=60 chars, a real search phrase a frustrated person would type, no clickbait lies, no emoji",
 "thumb":"3-5 WORDS MAX for the thumbnail, all caps, the pain not the topic",
 "description":"2-3 short lines, plain, ends with one line inviting subscribe",
 "tags":["8-12 lowercase search tags"]}`,
    `Video topic: ${t.title}\n\nScript:\n${script.slice(0, 900)}`);
  let m = {};
  try { m = JSON.parse(String(meta).replace(/^```(json)?|```$/gm, '').trim()); } catch { m = {}; }
  // Thumbnails live or die on mobile, where the card is ~250px wide. The slide layout is far too
  // airy at that size, so the thumbnail gets its own composition: text filling the frame, a gold
  // accent word, and a fix-promise strip. Legibility beats elegance here.
  const thumbText = (m.thumb || t.title).toString().toUpperCase().replace(/^"|"$/g, '').slice(0, 34);
  const tw = thumbText.split(/\s+/);
  const thumbHTML = `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1280px;height:720px;background:#07070a;font-family:Inter,'Segoe UI',system-ui,sans-serif;
      color:#fff;position:relative;overflow:hidden}
    .bg{position:absolute;inset:0;background:
      radial-gradient(90% 80% at 8% 0%, rgba(210,169,78,.30), transparent 60%),
      radial-gradient(70% 70% at 105% 105%, rgba(210,169,78,.16), transparent 60%)}
    .grid{position:absolute;inset:0;opacity:.20;
      background-image:linear-gradient(rgba(210,169,78,.4) 1px,transparent 1px),
                       linear-gradient(90deg,rgba(210,169,78,.4) 1px,transparent 1px);
      background-size:72px 72px;-webkit-mask-image:radial-gradient(circle at 40% 50%,#000 25%,transparent 80%)}
    .bar{position:absolute;left:0;top:0;bottom:0;width:16px;background:#d2a94e}
    .w{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;padding:56px 64px 56px 92px}
    h1{font-size:${tw.length > 4 ? 118 : 146}px;line-height:.93;font-weight:800;letter-spacing:-.035em;
      text-transform:uppercase;text-shadow:0 6px 30px rgba(0,0,0,.65)}
    h1 em{font-style:normal;color:#f0c96a}
    .fix{margin-top:34px;display:inline-flex;align-self:flex-start;align-items:center;gap:14px;
      background:#d2a94e;color:#140d02;font-weight:800;font-size:34px;letter-spacing:.02em;
      padding:14px 26px;border-radius:10px;text-transform:uppercase}
    .brand{position:absolute;right:44px;bottom:34px;font-family:'JetBrains Mono',monospace;font-size:22px;
      letter-spacing:.18em;color:rgba(255,255,255,.62);text-transform:uppercase}
  </style>
  <div class="bg"></div><div class="grid"></div><div class="bar"></div>
  <div class="w">
    <h1>${esc(tw.slice(0, -1).join(' '))} <em>${esc(tw.slice(-1)[0] || '')}</em></h1>
    <div class="fix">Fixed in ${Math.max(1, Math.round(dur / 60))} min</div>
  </div>
  <div class="brand">AI Helpdesk</div>`;
  await shot(thumbHTML, path.join(dir, 'thumbnail.png'), 1280, 720);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    slug, kb_slug: t.slug, kind: SHORT ? 'short' : 'long',
    title: (m.title || t.title).toString().slice(0, 95),
    description: (m.description || '').toString().slice(0, 4500),
    tags: Array.isArray(m.tags) ? m.tags.slice(0, 12) : [],
    duration_s: Math.round(dur), source: 'aria-kb', cost: 0,
    status: 'staged-awaiting-approval', created_at: new Date().toISOString(),
  }, null, 2));
  console.log('ok');

  ledger.made.push({ slug, kb_slug: t.slug, kind: SHORT ? 'short' : 'long', at: new Date().toISOString() });
  saveLedger(ledger);
  console.log(`  → ${path.relative(ROOT, dir)}`);
}
console.log('\n[yt-factory] done. Nothing published — every video is staged for approval.');
