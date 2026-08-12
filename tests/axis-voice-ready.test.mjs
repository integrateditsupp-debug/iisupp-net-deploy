// tests/axis-voice-ready.test.mjs — the persona must never be bypassed (2026-08-12).
//
// Ahmad: "the voice was not changed as well to a english speaking woman. why was that not processed."
//
// It WAS processed — axis-persona.js shipped en-US, the live file served rate 0.93 / pitch 1.10 and
// the en-US bonus. The persona was simply never consulted. speechSynthesis.getVoices() is populated
// ASYNCHRONOUSLY in Chrome and returns an EMPTY array on the first call after a page load, so
// axisPickVoice() returned null and `if (v) { u.voice = v; u.lang = v.lang; }` left BOTH unset. The
// browser then spoke with its own default.
//
// On this machine that default is a man. The only installed SAPI voices are:
//   Microsoft David Desktop   en-US  Male     <- Chrome's default, and what got used
//   Microsoft Zira Desktop    en-US  Female
// So the first reply after every load came out male, with no accent, rate or pitch from the persona.
// Editing axis-persona.js could never fix that, which is exactly why the change looked ignored.
//
// What this protects:
//   · a reply WAITS for the voice list instead of speaking without one
//   · the wait is bounded, so a browser that never fires the event cannot mute AXIS
//   · when no voice is rankable at all, the LANGUAGE is still pinned to en-US
//   · the ranker, given this machine's real inventory, picks a woman
// Run: node tests/axis-voice-ready.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'assets', 'axis-app.js'), 'utf8');
const code = app.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
const P = await import(pathToFileURL(path.join(root, 'assets', 'axis-persona.js')).href);
let n = 0; const ok = (m) => { n++; if (m) console.log('  ok —', m); };

// ---- 1. A reply waits for the voice list ----
{
  assert.ok(/function axisVoicesReady\(/.test(code), 'axisVoicesReady is missing');
  assert.ok(/voiceschanged/.test(code), 'nothing listens for the voice list to arrive');
  // The guard must sit INSIDE axisSpeak, before the utterance is built.
  const start = code.indexOf('function axisSpeak(text) {');
  assert.ok(start > 0, 'axisSpeak not found');
  const head = code.slice(start, code.indexOf('speechSynthesis.cancel()', start));
  assert.ok(/getVoices\(\) \|\| \[\]\)\.length/.test(head),
    'axisSpeak does not check whether voices have loaded before speaking');
  assert.ok(/axisVoicesReady\(\)/.test(head), 'axisSpeak does not wait for the voice list');
  ok('a reply holds until the voice list exists');
}

// ---- 2. The wait is bounded ----
// A browser that never fires voiceschanged must not silence AXIS permanently.
{
  const ms = Number((code.match(/VOICE_WAIT_MS = (\d+)/) || [])[1]);
  assert.ok(ms > 0 && ms <= 4000, `voice wait ${ms}ms is missing or unreasonable`);
  assert.ok(/setTimeout\(finish, VOICE_WAIT_MS\)/.test(code), 'the wait has no timeout escape');
  ok(`bounded at ${ms}ms, then it speaks regardless`);
}

// ---- 3. With no rankable voice, the language is still pinned ----
// An unset lang is how a non-US default got through in the first place.
{
  assert.ok(/else u\.lang = 'en-US'/.test(code),
    'when no voice ranks, u.lang must still be pinned to en-US');
  ok('language is pinned even with no voice to rank');
}

// ---- 4. Given THIS machine's real inventory, the ranker picks a woman ----
// Enumerated live on 2026-08-12 via System.Speech.GetInstalledVoices().
{
  const bare = [
    ['Microsoft David Desktop - English (United States)', 'en-US'],   // Male
    ['Microsoft Zira Desktop - English (United States)', 'en-US'],    // Female
  ];
  const ranked = bare.map(([nm, l]) => ({ nm, s: P.axisPersonaBonus(nm, l) })).sort((a, b) => b.s - a.s);
  assert.match(ranked[0].nm, /Zira/, 'on a bare SAPI machine AXIS must still pick the female voice');
  assert.ok(P.axisPersonaBonus(bare[0][0], 'en-US') < P.axisPersonaBonus(bare[1][0], 'en-US'),
    'the male voice must rank below the female one');
  ok('the two-voice machine still resolves to a woman');
}

// ---- 5. …and an American one wherever a real choice exists ----
{
  const chrome = [
    ['Google US English', 'en-US'],
    ['Google UK English Female', 'en-GB'],
    ['Microsoft Zira Desktop - English (United States)', 'en-US'],
  ];
  const win = chrome.map(([nm, l]) => ({ nm, s: P.axisPersonaBonus(nm, l) })).sort((a, b) => b.s - a.s)[0];
  assert.equal(win.nm, 'Google US English', 'in Chrome the American voice must win, not the UK one');
  ok('American wins wherever the browser offers a choice');
}

console.log(`axis-voice-ready: ${n} checks passed`);
