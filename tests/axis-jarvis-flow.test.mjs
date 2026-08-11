// AXIS — JARVIS flow + woman's-voice guard (2026-08-11).
// Proves the conversational layer added on 2026-08-11 behaves, AND that it was purely additive:
// every voice behavior the v1 console shipped is still present in axis-app.js. If a future edit
// deletes the mic, the humanizer, the persisted voice key, or the hard-stop gate, this goes red.
// Run: node tests/axis-jarvis-flow.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'assets', 'axis-app.js'), 'utf8');
const shellA = fs.readFileSync(path.join(root, 'axis.html'), 'utf8');
const shellB = fs.readFileSync(path.join(root, 'aperture-learning.html'), 'utf8');
const P = await import(pathToFileURL(path.join(root, 'assets', 'axis-persona.js')).href);
let n = 0; const ok = () => { n++; };

// ---- 1. AXIS is a woman's voice, and NOT the customer orb's voice ----
const score = (name, lang) => P.axisPersonaBonus(name, lang);
assert.ok(score('Microsoft Sonia Online (Natural)', 'en-GB') > 0, 'the AXIS house voice ranks up');
assert.ok(score('Microsoft Guy Online (Natural)', 'en-US') < 0, 'AXIS is never a male voice');
assert.ok(score('Microsoft Sonia Online (Natural)', 'en-GB') > score('Microsoft Guy Online (Natural)', 'en-US'), 'female beats male');
// ARIA (aria-core.js) prefers Samantha/Zira/Google UK English Female. AXIS must not wear them.
for (const ariaVoice of ['Samantha', 'Microsoft Zira Desktop', 'Karen', 'Victoria']) {
  assert.ok(score(ariaVoice, 'en-US') < score('Microsoft Sonia Online (Natural)', 'en-GB'),
    `AXIS ranks ARIA's "${ariaVoice}" below its own voice — the two products never sound alike`);
}
// The demote is a penalty, not a ban: a bare browser still lands on a female voice, never a male one.
assert.ok(score('Google UK English Female', 'en-GB') > score('Google UK English Male', 'en-GB'),
  'worst case, a shared female voice still beats a male one');
// Regression: "Female" must not trip the \bmale\b demote pattern.
assert.ok(score('Google UK English Female', 'en-GB') > 0, '"Female" is not demoted as "male"');
// Prosody is deliberately apart from ARIA's en-US rate .95 / pitch 1.05.
assert.ok(P.AXIS_PROSODY.pitch < 1.0 && P.AXIS_PROSODY.pitch !== 1.05, 'AXIS speaks in a lower, composed register');
ok();

// ---- 2. Turn grammar: wake, stand-down, confirm, deny ----
assert.ok(P.isWake('AXIS, what is going on'), 'wake word heard');
assert.ok(P.isWake('hey axis status'), '"hey axis" heard');
assert.ok(!P.isWake('what is going on'), 'un-addressed speech is ignored — the mic is not a hot line');
assert.equal(P.stripWake('AXIS, what is going on'), 'what is going on', 'wake phrase stripped before the director sees it');
assert.equal(P.stripWake('what is going on'), 'what is going on', 'a non-wake utterance passes through intact');
assert.ok(P.isStop('AXIS stop'), 'spoken kill-switch heard');
assert.ok(P.isStop('axis, stand down'), 'kill-switch synonyms heard');
// Stand-down outranks everything: it must never be read as a confirmation.
assert.ok(!P.isConfirm('AXIS stop'), 'stand-down is never a confirm');
assert.ok(P.isConfirm('confirm'), 'verbal confirm heard');
assert.ok(P.isConfirm('go ahead'), 'natural confirm heard');
assert.ok(P.isDeny('no, cancel that'), 'verbal decline heard');
assert.ok(!P.isConfirm('no, cancel that'), 'a decline is never read as a confirm');
ok();

// ---- 3. Rule 14: AXIS never voices a number it does not have ----
assert.match(P.greetLine(null, 9), /do not have the board/i, 'no snapshot → says so, never invents a briefing');
assert.match(P.greetLine({ awaiting_approval: 0, messages_waiting: 0, followups_due: 0 }, 9), /all quiet/i, 'real zeros → honest "all quiet"');
assert.match(P.greetLine({ awaiting_approval: 3, messages_waiting: 1, followups_due: 0 }, 9), /Good morning, Ahmad\. 3 approvals waiting, 1 client reply waiting\./, 'real counts spoken exactly, singular/plural correct');
assert.match(P.greetLine({ awaiting_approval: 1 }, 19), /^Good evening, Ahmad\./, 'greeting tracks time of day');
assert.ok(!/\bsir\b|\bboss\b/i.test(P.greetLine({ awaiting_approval: 1 }, 9)), 'addresses Ahmad by name — never "sir", never "boss"');
ok();

// ---- 4. Hard-stops stay hard-stops (spec §SAFETY RAILS) ----
assert.match(P.routeTail('Pitch', true), /needs your click/i, 'an irreversible/anomalous item is click-only');
assert.ok(!/say confirm/i.test(P.routeTail('Pitch', true)), 'AXIS never offers to voice-confirm a hard-stop');
assert.match(P.routeTail('Pitch', false), /say confirm/i, 'a plain route may be confirmed by voice');
// …and the app only arms a voice-confirmable route when needsApproval is false.
assert.ok(/if \(!j\.needsApproval\) axisPendingRoute =/.test(app), 'app arms the spoken confirm ONLY for non-hard-stop routes');
assert.ok(/function axisStandDown/.test(app) && /axisPendingRoute = null/.test(app), 'stand-down clears any unconfirmed route');
assert.ok(/e\.ctrlKey && e\.altKey && e\.key\.toLowerCase\(\) === 'k'/.test(app), 'Ctrl+Alt+K kill-switch bound');
ok();

// ---- 5. The flow is wired into the app ----
for (const [marker, why] of [
  ["from './axis-persona.js'", 'app imports the persona layer'],
  ['axisSpeak(ackLine())', 'instant acknowledgement — no dead air on a spoken turn'],
  ['function axisWakeStart', 'wake-word listener present'],
  ['function axisTurnDone', 'hands-free hands the floor back after AXIS finishes'],
  ['axisWakePause()', 'push-to-talk and the wake listener never fight over the mic'],
  ['function axisBootBriefing', 'spoken boot briefing present'],
  ['axisHandsFreeToggle', 'hands-free is an explicit opt-in toggle'],
]) assert.ok(app.includes(marker), why);
// Hands-free must default OFF — it holds the microphone open.
assert.ok(/let axisHandsFree = false/.test(app), 'hands-free defaults OFF (mic stays closed until asked)');
// The wake button exists in BOTH shells, and the two shells stay byte-identical.
for (const [name, html] of [['axis.html', shellA], ['aperture-learning.html', shellB]])
  assert.ok(/id="axisWake"/.test(html), `${name} has the hands-free toggle`);
assert.equal(shellA, shellB, 'axis.html and aperture-learning.html stay identical (both are served)');
ok();

// ---- 6. PURELY ADDITIVE: nothing the v1 voice contract shipped was removed ----
for (const marker of [
  'axisMicToggle', 'axisVoiceToggle', 'axisHumanizeForSpeech', 'axis-voice-name',
  'axisVoiceNext', 'axisSetVoice', 'let axisVoiceOn = true', 'speechSynthesis.cancel()',
  'onvoiceschanged', 'axisSpeak(reply.text)', 'natural|neural',
]) assert.ok(app.includes(marker), `v1 voice behavior "${marker}" still present — the flow was added, not swapped in`);
assert.ok(/if \(\/\(guy\|davis\|andrew/.test(app), 'the original voice ranking line is kept intact (superseded, not deleted)');
ok();

console.log(`axis-jarvis-flow: ${n}/6 groups green — AXIS keeps its name, gains a distinct woman's voice and a JARVIS turn flow; every prior voice behavior intact.`);
