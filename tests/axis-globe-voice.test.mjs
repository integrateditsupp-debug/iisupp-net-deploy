// axis-globe-voice.test.mjs — the globe grows and talks like something alive, and AXIS sounds like
// a younger, softer, classier woman.
//
// Ahmad, 2026-08-12: "let the globe expand gradually in a normal speed when it speak. right now it
// get bigs and all of the sudden small. it should now keep growing but when it talks it should be
// more lively and appear like its speaking. change the voice also to be more human like and a
// softer and younger woman but classy."
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../assets/axis-persona.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const globe = fs.readFileSync(path.join(ROOT, 'assets', 'axis-globe.js'), 'utf8');
const cssRaw = fs.readFileSync(path.join(ROOT, 'assets', 'axis-tokens.css'), 'utf8');
// Absence-checks must run on declarations, not prose — the comments describe the removed
// growth behaviour, and matching those would fail for explaining the change.
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');
const ok = (m) => console.log('  ok —', m);

// ---- 1. nothing may SNAP: the Voice Visualizer principle, applied to the globe ----
// This is the actual cause of "it get bigs and all of the sudden small" — the renderer read its
// values straight off STATE[...] every frame, so a state change was a hard cut.
assert.ok(/const cur = \{ \.\.\.STATE\.idle, voice: 0 \}/.test(globe), 'the globe keeps eased current values');
assert.ok(/for \(const k of \['spin', 'glow', 'rim', 'sweep'\]\) cur\[k\] \+= \(target\[k\] - cur\[k\]\) \* EASE/.test(globe),
  'spin, glow, rim and sweep all ride one easing toward the target');
const ease = globe.match(/const EASE = ([\d.]+)/);
assert.ok(ease && Number(ease[1]) > 0 && Number(ease[1]) < 0.12,
  `easing must be gradual, got ${ease && ease[1]}`);
ok('the globe eases between states instead of cutting');

// ---- 2. it must look like it is SPEAKING, not like a spinner ----
assert.ok(/cur\.voice \+= \(\(state === 'speaking' \? 1 : 0\) - cur\.voice\) \* VOICE_EASE/.test(globe),
  'a talking envelope rises and falls with the speaking state');
// Two out-of-phase noise bands — one sine would read as a metronome, which is the spinner look.
const env = globe.match(/cur\.voice \* \(([^;]+)\);/);
assert.ok(env && (env[1].match(/noise\(/g) || []).length >= 2,
  'the envelope sums more than one noise band, so it is irregular like speech');
assert.ok(/talking halo/i.test(globe) && /ctx\.arc\(cx, cy, R \* \(1\.06 \+ env \* 0\.17\)/.test(globe),
  'a halo widens with each syllable');
assert.ok(/const R = Math\.min\(W, H\) \* 0\.36 \* \(1 \+ env \* 0\.06\)/.test(globe),
  'the sphere itself swells with the voice');
ok('speaking is visibly alive — enveloped swell plus a syllable halo');

// ---- 3. ONE resting size, larger again on the fourth pass ----
// Ahmad, 2026-08-12 (fourth pass): "make axis larger." 104px baseline × 1.30 (third pass) × 1.30.
// The grow-to-25vh behaviour is still gone; any return of it would reintroduce the "big then suddenly
// small" complaint.
const orbit = css.match(/\.axis-orbit \.axis-globe \{ width:(\d+)px; height:(\d+)px;/);
assert.ok(orbit, 'the orbit globe has a fixed resting size');
assert.equal(Number(orbit[1]), Number(orbit[2]), 'the globe is square');
assert.equal(Number(orbit[1]), Math.round(104 * 1.30 * 1.30), 'two 30% passes up from the original 104px');
const docked = css.match(/:root\[data-axis-open="1"\] \.axis-orbit \.axis-globe \{ width:(\d+)px/);
assert.ok(docked && Number(docked[1]) === Math.round(96 * 1.30), 'docked globe is 30% up from 96px');
// The phone size is deliberately NOT taken up the full way: the orbit is in the normal flow now, so
// its height is subtracted from the readable area, and a 176px band would eat a phone's viewport.
// Assert the RELATIONSHIP rather than the number, so the phone can be tuned without a test edit.
// Search INSIDE the right media block. There are three `@media (max-width:720px)` blocks (the topbar
// and the strip have their own), so a lazy scan from the first one runs straight past it and matches
// the DESKTOP globe rule — it reported "the phone globe is 176px" and failed for the wrong reason.
// BRACE-MATCH the block rather than splitting on a guessed delimiter: `\n}` looked like a block end
// but these blocks close with an indented brace, so the split silently swallowed the rest of the file.
function mediaBlocks(src, at) {
  const out = [];
  for (let i = src.indexOf(at); i !== -1; i = src.indexOf(at, i + 1)) {
    const open = src.indexOf('{', i);
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) { out.push(src.slice(open + 1, j)); break; }
    }
  }
  return out;
}
const smallBlocks = mediaBlocks(css, '@media (max-width:720px)');
assert.ok(smallBlocks.length >= 1, 'there is a <=720px media block');
const smallBlock = smallBlocks.find((b) => /\.axis-orbit \.axis-globe \{ width:\d+px/.test(b));
assert.ok(smallBlock, 'the <=720px block sizes the orbit globe');
const small = smallBlock.match(/\.axis-orbit \.axis-globe \{ width:(\d+)px/);
assert.ok(Number(small[1]) < Number(orbit[1]),
  `a phone must get a smaller globe than the desktop (${small[1]}px vs ${orbit[1]}px) — the band is real layout now`);
assert.ok(Number(small[1]) >= 104, 'but not smaller than the original baseline — "larger" still has to mean larger');
// No state may resize it — doubly true now that a width change here reflows the page.
for (const state of ['listening', 'speaking', 'thinking']) {
  const rule = new RegExp(':root\\[data-axis-state="' + state + '"\\] \\.axis-orbit \\.axis-globe \\{[^}]*(?:width|height):');
  assert.ok(!rule.test(css), `${state} must not resize the globe`);
}
assert.ok(!/\.axis-orbit \.axis-globe[^}]*clamp\([^)]*vh/.test(css), 'no viewport-relative growth remains');
ok(`one resting size at ${orbit[1]}px (104 + 30% + 30%), and no state resizes it`);

// ---- 4. it sits ABOVE the Overview deck and BELOW the director field ----
// Ahmad, 2026-08-12: "move the axis globe above the overview", then "Leave axis-director field where
// it was, place axis below that". Ordering is structural now — the orbit is an in-flow child of the
// .axis-head band — so this checks the flow, not a pin. See axis-overview-clearance.test.mjs.
assert.ok(!/\.axis-orbit \{[^}]*position:fixed/.test(css),
  'the orbit must stay in the flow — a fixed orbit is what let content slide under it');
assert.ok(!/\.axis-orbit \{[^}]*bottom:22px/.test(css), 'the old bottom-centre pin is gone');
// The transcript has to follow the globe; opening it at the far end of the screen from the thing
// that opened it is the bug this guards.
assert.ok(/\.axis-dock \{ position:fixed; left:50%; right:auto; top:(\d+)px/.test(css),
  'the dock follows the orbit to the top instead of staying at the bottom');
ok('in the flow under the director field, with the dock following it');

// ---- 5. the voice: British, natural, conversational — and still never ARIA ----
// Ahmad 2026-08-12: "revert the voice back to UK woman but none robotic, sound like a natural
// human conversation."
assert.ok(P.AXIS_PROSODY.pitch > 1.0, 'a human register sits above 1.0, not below it');
assert.notEqual(P.AXIS_PROSODY.pitch, 1.05, 'never ARIA pitch');
assert.notEqual(P.AXIS_PROSODY.rate, 0.95, 'never ARIA rate');
assert.ok(P.AXIS_PROSODY.volume < 1, 'softer is volume');
// "None robotic" is prosody near the voice's own training: a neural voice pushed well away from
// its native pace and pitch is what reads as synthetic. Composed, but close to natural.
assert.ok(P.AXIS_PROSODY.rate > 0.95 && P.AXIS_PROSODY.rate <= 1.0,
  'natural is near the voice\'s own pace — just under 1, not dragged');
assert.ok(P.AXIS_PROSODY.pitch <= 1.05, 'natural pitch stays within a few percent of native');
const score = (n, l) => P.axisPersonaBonus(n, l);
const sonia = score('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB');
const libby = score('Microsoft Libby Online (Natural) - English (United Kingdom)', 'en-GB');
assert.ok(sonia > libby, 'Sonia is the house voice; Libby is the alternate');
// The accent is the point of this change: the UK voice must beat the en-US experiment's pick.
const ava = score('Microsoft Ava Online (Natural) - English (United States)', 'en-US');
assert.ok(sonia > ava, 'an en-GB voice outranks the former en-US house voice');
assert.ok(ava > 0, 'en-US stays eligible — an American AXIS beats a robotic one on a bare machine');
// On a Chrome with no en-GB Natural set, Google's UK woman is the natural-sounding fallback — the
// ARIA-collision list must not suppress her now that accent separates the assistants again.
assert.ok(score('Google UK English Female', 'en-GB') > 0,
  'Google UK English Female is a valid UK fallback, not an ARIA collision');
// Maisie is Microsoft's en-GB CHILD voice — "UK woman" must never resolve to a child.
assert.ok(score('Microsoft Maisie Online (Natural) - English (United Kingdom)', 'en-GB') < sonia - 60,
  'a child voice can never win the ranking');
assert.ok(score('Microsoft Guy Online (Natural) - English (United States)', 'en-US') < sonia, 'never male');
assert.ok(score('Samantha', 'en-US') < sonia, 'never the customer orb voice');
// A voice literally named Aria is still the worst possible pick for the OTHER assistant.
assert.ok(score('Microsoft Aria Online (Natural) - English (United States)', 'en-US') < sonia,
  'AXIS never speaks in a voice named Aria');
ok('AXIS is a natural British woman — not a child, not male, not ARIA');

console.log('ok — globe grows and speaks; voice is British, natural, conversational');
