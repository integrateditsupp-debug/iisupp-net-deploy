// AXIS CC v2 — voice regression guard. The v1 console (assets/aperture-learning.js, 4ee1b883 push-to-talk,
// 0e17c2ca humanized voice) had full voice chat: push-to-talk mic in + humanized spoken replies out.
// "No functionality lost" law: the v2 hub dock must carry the SAME behavior — mic → transcript → auto-send
// to axis-director, spoken reply with neural-voice ranking, humanize + sentence chunking, persisted voice
// choice (same localStorage key as v1 so a chosen voice carries over), voice ON by default, barge-in.
// Run: node tests/axis-voice-dock.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ok = () => { n++; };

const app = fs.readFileSync(path.join(root, 'assets', 'axis-app.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'axis.html'), 'utf8');
const v1 = fs.readFileSync(path.join(root, 'assets', 'aperture-learning.js'), 'utf8');

// ---- 1. dock markup has the voice controls ----
const dock = shell.slice(shell.indexOf('axisDock'), shell.indexOf('palette'));
assert.ok(/id="axisMic"/.test(dock), 'dock has the push-to-talk mic button');
assert.ok(/id="axisVoice"/.test(dock), 'dock has the spoken-replies toggle');
assert.ok(/id="axisSend"/.test(dock), 'dock keeps the Send button');
ok();

// ---- 2. mic input: push-to-talk → transcript → auto-send to axis-director ----
assert.ok(/window\.SpeechRecognition\s*\|\|\s*window\.webkitSpeechRecognition/.test(app), 'mic uses the browser Web Speech API (free, on-device trigger — no paid API)');
// Auto-send is still the behaviour, but it no longer happens inside onresult. A turn now ends on
// SILENCE rather than on the first isFinal (axisTurnBuffer), because sending on the first final
// truncated Ahmad mid-sentence. So assert the two halves of the path instead of their adjacency —
// the old /onresult[\s\S]{0,220}send\(\)/ was an offset anchor and rotted the moment the send moved.
assert.ok(/onresult[\s\S]{0,400}turn\.push\(/.test(app), 'onresult feeds the turn buffer');
assert.ok(/axisTurnBuffer\(\([^)]*\)\s*=>\s*\{[^}]*send\(\)/.test(app),
  'the turn buffer auto-sends once the utterance is complete');
assert.ok(/send = axisSend/.test(app), 'dock mic default-binds to axisSend (public panel passes its own sender)');
assert.ok(/axis-director/.test(app), 'dock send is wired to the axis-director function');
ok();

// ---- 3. spoken replies: the reply AXIS returns is spoken ----
assert.ok(/axisSpeak(?:Turn)?\(reply\.text\)/.test(app), 'axis-director reply is spoken aloud');
assert.ok(/let axisVoiceOn = true/.test(app), 'voice defaults ON (v1 behavior — "I want to talk, it\'s faster")');
assert.ok(/speechSynthesis\.cancel\(\)/.test(app), 'barge-in: new speech/mic cancels current speech');
ok();

// ---- 4. humanized voice (the 0e17c2ca "sounds robotic" fix) is fully ported, not downgraded ----
assert.ok(/natural\|neural/.test(app), 'voice ranking prefers Neural/Natural voices');
assert.ok(/axis-voice-name/.test(app), 'manual voice choice persists — SAME localStorage key as v1, so a v1-picked voice carries over');
assert.ok(/axisVoiceNext/.test(app) && /axisSetVoice/.test(app), 'manual voice cycle/set controls kept');
assert.ok(/axisHumanizeForSpeech/.test(app), 'humanize-for-speech layer present');
assert.ok(/180/.test(app.slice(app.indexOf('function axisSpeak'))), 'sentence chunking (Chrome long-utterance cutoff guard)');
assert.ok(/onvoiceschanged/.test(app), 'async voice-list warm-up present');
ok();

// ---- 5. humanize behaves like v1 (behavioral, not just textual) ----
const m = app.match(/function axisHumanizeForSpeech\([\s\S]*?\n}/);
assert.ok(m, 'humanize function extractable');
const humanize = new Function('return ' + m[0])();
assert.equal(humanize('ARIA runs 24/7 — always on'), 'ARIA runs twenty-four seven, always on');
assert.equal(humanize('• 90% green'), '90 percent green');
assert.ok(!/[*_`#]/.test(humanize('**bold** `code` # heading')), 'markdown stripped for speech');
ok();

// ---- 6. no functionality lost the OTHER way: v1 console keeps its voice ----
for (const marker of ['axisMicToggle', 'axisVoiceToggle', 'axisHumanizeForSpeech', 'axis-voice-name']) {
  assert.ok(v1.includes(marker), `v1 console still has ${marker}`);
}
ok();

console.log(`axis-voice-dock: ${n}/6 groups green — v2 dock carries the full v1 voice chat (mic in + humanized spoken replies), wired to axis-director.`);
