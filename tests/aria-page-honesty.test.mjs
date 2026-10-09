#!/usr/bin/env node
// aria-page-honesty.test.mjs — what the ARIA product page (aria.html) says about itself, after the 2026-10-08 run.
//
// Audit top-10 #6: the right rail ran a random-walk "LIVE ACTIVITY · Updated 0s ago" feed, the ops view said
// "ENTERPRISE OPERATIONS · LIVE" over invented figures, and enterVoice() inserted a scripted ARIA reply with fake
// 00:04/00:11 timestamps. Rule 14: real-or-empty, and a demo feed must be labelled as such. Rule 15: everything
// stays (relabelled, not removed). This suite also parses every inline <script> with the real engine (node
// --check), because a page that does not parse is a blank page, and keeps the accessibility attributes honest.
//   node tests/aria-page-honesty.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(root, 'aria.html'), 'utf8');
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

console.log('[honesty] fabricated "live" data is labelled as a demo');
{
  ok('no "Updated 0s ago"', !/Updated 0s ago/.test(page));
  ok('no "Updated ${ago}s ago" ticker', !/Updated \$\{ago\}s ago/.test(page));
  ok('right rail says SIMULATED DEMO FEED', /SIMULATED DEMO FEED/.test(page));
  ok('rail meta says the figures are samples, not live', /Sample figures · not live/.test(page));
  ok('ops topbar says DEMO OPERATIONS VIEW (SAMPLE DATA), not LIVE', /ops: 'DEMO OPERATIONS VIEW \(SAMPLE DATA\)'/.test(page) && !/ENTERPRISE OPERATIONS · LIVE/.test(page));
  ok('ops banner carries a visible sample-data note', /id="opsSampleNote"[^>]*>Sample data for demonstration/.test(page));
  ok('every element is kept (counters, tiers, stat boxes still present)', /data-counter="online"/.test(page) && /TIER 01 - FOUNDATION/.test(page) && /id="opsResolved"/.test(page) && /ARIA DEMO OPERATIONS VIEW/.test(page));
}

console.log('[honesty] the scripted voice reply is gone, the real loop is wired');
{
  ok("no canned `const reply = \"I see what's going on`", !/const reply = "I see what/.test(page));
  ok('no fake 00:04 / 00:11 transcript stamps', !/addTranscript\('YOU','00:04'/.test(page) && !/addTranscript\('ARIA','00:11'/.test(page));
  ok("no '--:--' placeholder stamp", !/'--:--'/.test(page));
  ok('enterVoice hands the view to the conversation glue', /function enterVoice\(initialText\)[\s\S]{0,1500}glue\.begin\(seed\)/.test(page));
  ok('engine asset loaded by <script src> (the page already loads /assets/*.js this way)', /<script src="\/assets\/aria-voice-conversation\.js\?v=\d+" defer><\/script>/.test(page));
  ok('assets/aria-voice-conversation.js exists and is the file under test', fs.existsSync(path.join(root, 'assets/aria-voice-conversation.js')));
  ok('mic click starts the conversation when the engine is available', /if \(glue\.isActive\(\)\) glue\.end\('mic'\);\s*else enterVoice\(''\);/.test(page));
  ok('the original one-shot path is still reachable (ensureRecognition fallback)', /const r = ensureRecognition\(\);\s*if \(!r\)\{ enterVoice\(''\); return; \}/.test(page) && /aria_voice_engine'\) === 'oneshot'/.test(page));
  ok('voice turns are posted with voice:true through the engine; typed input joins a live conversation', /__ariaVoiceGlue\.submitTyped\(v\)/.test(page));
  ok('honest unsupported copy present', /Voice input isn\\'t supported in this browser — typing works\./.test(page));
  ok('honest mic-denied copy present', /Microphone access was blocked/.test(page));
  ok('honest caption: recognition by the browser vendor, conversation to ARIA', /Speech recognition is provided by your browser \(Chrome\/Edge send audio to the browser vendor\); the conversation goes to ARIA\./.test(page));
  ok('sentinel-fix never pretends to run: it offers the download and shows the existing CTA', /On a computer with ARIA Sentinel I can run that fix for you — want the download link\?/.test(page) && /openResolveModal\(hint, null\)/.test(page));
  ok('escalate shows the existing Get a human control', /if \(action\.kind === 'escalate'\) showHandoffControls\(\);/.test(page) && /getElementById\('ariaHandoffBtn'\)/.test(page));
  ok('session id generator present', /function makeWebSessionId\(\)/.test(page) && /crypto\.randomUUID/.test(page));
}

console.log('[a11y] the audit items are in the markup');
{
  ok('chat input named', /id="askInput"[^>]*aria-label="Ask ARIA"/.test(page));
  ok('send button named', /id="sendBtn"[^>]*aria-label="Send"/.test(page));
  ok('mic button named + aria-pressed', /id="micBtn"[^>]*aria-label="[^"]+"[^>]*aria-pressed="false"/.test(page));
  ok('voice End button + state pill exist', /id="voiceEndBtn"/.test(page) && /id="voiceStatePill"[^>]*aria-live="polite"/.test(page));
  ok('Escape ends the voice conversation', /if \(e\.key === 'Escape'\)\{[\s\S]{0,300}__ariaVoiceGlue\.end\('escape'\)/.test(page));
  ok('lead modal is labelled by its title', /id="ariaLeadModal"[^>]*aria-labelledby="alm-title"/.test(page) && /<h3 id="alm-title">/.test(page));
  ok('lead modal labels are associated (for=)', ['alm-name', 'alm-company', 'alm-email', 'alm-phone', 'alm-msg'].every((id) => new RegExp('<label for="' + id + '"').test(page)));
  ok('lead modal: focus trap + Escape closes it', /modal\.classList\.remove\('open'\);return;\}\s*if\(e\.key==='Tab'\)/.test(page));
  ok('viewport meta untouched', /<meta name="viewport" content="width=1280">/.test(page));
}

console.log('[parse] every inline script is handed to the engine');
{
  const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'aria-inline-'));
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0, bad = [];
  while ((m = re.exec(page)) !== null) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (type && !/javascript|module/i.test(type)) continue;
    n++;
    const probe = path.join(scratch, 'inline-' + n + '.js');
    fs.writeFileSync(probe, m[2]);
    try { execFileSync(process.execPath, ['--check', probe], { stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { bad.push('#' + n + ' @line ' + page.slice(0, m.index).split('\n').length + ': ' + String(e.stderr || e.message).split('\n').slice(0, 2).join(' | ')); }
  }
  ok(n + ' inline scripts parse (' + bad.length + ' failures)' + (bad.length ? '\n' + bad.join('\n') : ''), n >= 10 && bad.length === 0);
  const tagPairs = (name) => [(page.match(new RegExp('<' + name + '\\b', 'g')) || []).length, (page.match(new RegExp('</' + name + '>', 'g')) || []).length];
  ok('<script>/<style>/<div> open and close counts balance', ['script', 'style', 'div', 'section', 'aside', 'button', 'form'].every((t) => { const [a, b] = tagPairs(t); return a === b; }));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* full volume */ }
}

console.log(`\naria-page-honesty: ${pass} checks passed`);
