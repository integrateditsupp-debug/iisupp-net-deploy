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

// ---- 3. ONE resting size, 30% up from the original 104px ----
// Ahmad, 2026-08-12 (third pass): "make the size 30% instead of the 15% it is right now."
// The 104px baseline is unchanged — the percentage is the knob. The grow-to-25vh behaviour is still
// gone; any return of it would reintroduce the "big then suddenly small" complaint.
const orbit = css.match(/\.axis-orbit \.axis-globe \{ width:(\d+)px; height:(\d+)px;/);
assert.ok(orbit, 'the orbit globe has a fixed resting size');
assert.equal(Number(orbit[1]), Number(orbit[2]), 'the globe is square');
assert.equal(Number(orbit[1]), Math.round(104 * 1.30), '30% up from the original 104px');
// The two derived sizes scale off their own baselines, so the whole set stays proportional.
const docked = css.match(/:root\[data-axis-open="1"\] \.axis-orbit \.axis-globe \{ width:(\d+)px/);
assert.ok(docked && Number(docked[1]) === Math.round(74 * 1.30), 'docked globe is 30% up from 74px');
const small = css.match(/@media \(max-width:720px\) \{\s*\.axis-orbit \.axis-globe \{ width:(\d+)px/);
assert.ok(small && Number(small[1]) === Math.round(78 * 1.30), 'the <=720px globe is 30% up from 78px');
// No state may resize it — that is what "take it back" means.
for (const state of ['listening', 'speaking', 'thinking']) {
  const rule = new RegExp(':root\\[data-axis-state="' + state + '"\\] \\.axis-orbit \\.axis-globe \\{[^}]*(?:width|height):');
  assert.ok(!rule.test(css), `${state} must not resize the globe`);
}
assert.ok(!/\.axis-orbit \.axis-globe[^}]*clamp\([^)]*vh/.test(css), 'no viewport-relative growth remains');
ok(`one resting size at ${orbit[1]}px (104 + 30%), and no state resizes it`);

// ---- 4. it sits ABOVE the Overview, not under it ----
// Ahmad, 2026-08-12: "move the axis globe above the overview." It was bottom:22px, which put AXIS
// underneath the deck it fronts. Top-anchored now, clearing the 57px topbar.
assert.ok(/\.axis-orbit \{ position:fixed; left:50%; top:(\d+)px; transform:translateX\(-50%\)/.test(css),
  'the orbit is top-anchored so it sits above the Overview');
assert.ok(!/\.axis-orbit \{[^}]*bottom:22px/.test(css), 'the old bottom-centre pin is gone');
// The transcript has to follow the globe; opening it at the far end of the screen from the thing
// that opened it is the bug this guards.
assert.ok(/\.axis-dock \{ position:fixed; left:50%; right:auto; top:(\d+)px/.test(css),
  'the dock follows the orbit to the top instead of staying at the bottom');
ok('top-anchored above the Overview, with the dock following it');

// ---- 5. the voice: American, classy, upscale — and still never ARIA ----
// Ahmad 2026-08-12: "change the voice to a english USA accent but classy and up scale style."
assert.ok(P.AXIS_PROSODY.pitch > 1.0, 'a human register sits above 1.0, not below it');
assert.notEqual(P.AXIS_PROSODY.pitch, 1.05, 'never ARIA pitch');
assert.notEqual(P.AXIS_PROSODY.rate, 0.95, 'never ARIA rate');
assert.ok(P.AXIS_PROSODY.volume < 1, 'softer is volume');
assert.ok(P.AXIS_PROSODY.rate < 0.95, 'upscale is unhurried — slower than ARIA, not merely under 1');
const score = (n, l) => P.axisPersonaBonus(n, l);
const ava = score('Microsoft Ava Online (Natural) - English (United States)', 'en-US');
const jenny = score('Microsoft Jenny Online (Natural) - English (United States)', 'en-US');
assert.ok(ava > jenny, 'the upscale US voice (Ava) outranks the default assistant one (Jenny)');
// The accent is the point of this change: an American voice must beat the old British house voice.
const libby = score('Microsoft Libby Online (Natural) - English (United Kingdom)', 'en-GB');
assert.ok(ava > libby, 'an en-US voice outranks the former en-GB house voice');
assert.ok(libby > 0, 'en-GB stays eligible — a British AXIS beats a robotic one on a bare machine');
// Maisie is Microsoft's en-GB CHILD voice — "classy woman" must never resolve to a child.
assert.ok(score('Microsoft Maisie Online (Natural) - English (United Kingdom)', 'en-GB') < 0,
  'a child voice can never win the ranking');
assert.ok(score('Microsoft Guy Online (Natural) - English (United States)', 'en-US') < ava, 'never male');
assert.ok(score('Samantha', 'en-US') < ava, 'never the customer orb voice');
// Both assistants are American now, so a voice literally named Aria is the worst possible pick.
assert.ok(score('Microsoft Aria Online (Natural) - English (United States)', 'en-US') < ava,
  'AXIS never speaks in a voice named Aria');
ok('AXIS is an upscale American woman — not a child, not male, not ARIA');

console.log('ok — globe grows and speaks; voice is American, classy, upscale');
