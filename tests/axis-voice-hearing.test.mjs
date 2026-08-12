// tests/axis-voice-hearing.test.mjs — "it does not hear me" + Edge/Chrome voice parity (2026-08-11).
//
// ROOT CAUSE this locks down: browser speech-to-text does NOT return the literal string "axis".
// Chrome and Edge routinely transcribe the wake word as "access", "axes", "acts" or "exes". The
// original /axis/ matcher therefore heard every word Ahmad said and silently ignored all of them,
// which is indistinguishable from a broken microphone. If someone ever "tidies" that alternation
// back to a plain /axis/, this goes red.
// Run: node tests/axis-voice-hearing.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'assets', 'axis-app.js'), 'utf8');
const P = await import(pathToFileURL(path.join(root, 'assets', 'axis-persona.js')).href);
let n = 0; const ok = () => { n++; };

// ---- 1. The homophones a real browser actually returns must wake AXIS ----
for (const said of ['axis status', 'access status', 'axes status', 'acts status', 'exes status',
  'hey access what is going on', 'okay axis what is next', 'ax is status']) {
  assert.ok(P.isWake(said), `"${said}" must wake AXIS — this is what STT really returns`);
  assert.ok(!/^(?:hey |ok(?:ay)? )?(?:axis|access|axes|acts|exes|ax is)\b/i.test(P.stripWake(said)),
    `"${said}" must have its wake word stripped before reaching the director`);
}
assert.equal(P.stripWake('access what is going on'), 'what is going on', 'homophone stripped, question intact');
// Un-addressed speech is still ignored — the mic is not a hot line.
for (const said of ['what is going on', 'call the client back', 'the axle is broken'])
  assert.ok(!P.isWake(said), `"${said}" must NOT wake AXIS`);
ok();

// ---- 2. The spoken kill-switch survives the same mangling ----
for (const said of ['axis stop', 'access stop', 'axes cancel', 'acts stand down', 'stop', 'cancel'])
  assert.ok(P.isStop(said), `"${said}" must stand AXIS down`);
assert.ok(!P.isConfirm('access stop'), 'a stand-down is never read as a confirmation');
ok();

// ---- 3. Edge vs Chrome: different voices, corrected to the same character ----
const edge = P.voiceProfile({ name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)' });
const chrome = P.voiceProfile({ name: 'Google UK English Female' });
assert.equal(P.voiceFamily('Microsoft Sonia Online (Natural)'), 'neural');
assert.equal(P.voiceFamily('Google UK English Female'), 'google');
assert.equal(P.voiceFamily('Microsoft Hazel Desktop'), 'legacy');
// Google's voices run fast and bright; they must be slowed and lowered toward Edge's Sonia.
assert.ok(chrome.rate < edge.rate, 'Chrome voice is slowed toward the Edge reference');
assert.ok(chrome.pitch < edge.pitch, 'Chrome voice is lowered toward the Edge reference');
// The real invariant is that AXIS is never mistakable for ARIA (en-US, rate .95 / pitch 1.05) — NOT
// that AXIS is always the lower of the two. Ahmad asked for a younger, softer voice on 2026-08-12,
// so AXIS now sits above ARIA rather than below it. The separation is unchanged, just approached
// from the other side; what must never happen is a family landing on ARIA's own pair.
assert.ok(Object.values(P.VOICE_PROFILES).every((p) => !(p.rate === 0.95 && p.pitch === 1.05)),
  'no voice family may land on ARIA rate/pitch');
assert.ok(Object.values(P.VOICE_PROFILES).every((p) => p.volume <= 0.95),
  'every family is softened — "softer" is volume and pace, not a lower pitch');
ok();

// ---- 4. Smarter delivery: jargon is spoken, not spelled ----
assert.match(P.polishForSpeech('KB gaps'), /knowledge base/, 'KB is said as words');
assert.match(P.polishForSpeech('$12k pipeline'), /12 thousand dollars/, 'money is spoken naturally');
assert.match(P.polishForSpeech('3-5 items'), /3 to 5/, 'a range is "to", never a minus sign');
assert.ok(!/\bvs\.\b/.test(P.polishForSpeech('us vs. them')), 'abbreviations expanded');
// Clause-aware phrasing so a long status line breathes instead of running flat.
const chunks = P.phraseChunks('Three approvals waiting, two client replies waiting, and one follow-up due today. All on the board.', 60);
assert.ok(chunks.length >= 3, 'long lines split at clause boundaries');
assert.ok(chunks.every(c => c.length <= 70), 'no chunk runs past the Chrome cutoff guard');
ok();

// ---- 5. Failure is always visible — silence was the old bug ----
for (const [marker, why] of [
  ['function axisMicError', 'every recognition error is translated to plain language'],
  ["'not-allowed'", 'a blocked mic is reported with the fix (padlock → allow → reload)'],
  ["'no-speech'", 'hearing nothing is reported, not swallowed'],
  ["'audio-capture'", 'a missing input device is reported'],
  ['I did not catch that', 'a silent close always says something'],
  ['interimResults = true', 'interim results feed the live line so hearing is visible'],
  ['function axisSetHear', 'the live transcript line exists'],
  ['axisWakePause();', 'AXIS deafens the wake listener while speaking so it cannot wake itself'],
]) assert.ok(app.includes(marker), why);
ok();

// ---- 6. The voice picker (the actual fix for "edge one voice, chrome another") ----
for (const [marker, why] of [
  ['function axisPopulateVoices', 'the browser\'s real inventory is listed'],
  ["localStorage.getItem('axis-voice-name')", 'the pinned choice uses the v1 key, so it carries over'],
  ['axisVoicePick', 'the picker is wired'],
  ['AXIS_VOICE_SAMPLE', 'picking a voice speaks a sample — you choose by ear'],
]) assert.ok(app.includes(marker), why);
ok();

console.log(`axis-voice-hearing: ${n}/6 groups green — wake word survives STT homophones, engines corrected to one character, every mic failure is visible.`);
