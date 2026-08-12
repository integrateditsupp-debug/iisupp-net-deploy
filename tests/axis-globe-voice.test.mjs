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

// ---- 3. ONE resting size, 15% up from the original 104px ----
// Ahmad, 2026-08-12 (second pass): "take it back to how the globe was initially center and bottom
// middle and small, but increase the size by 15%." The grow-to-25vh behaviour is gone; any return
// of it would reintroduce the "big then suddenly small" complaint, so it is asserted against.
const orbit = css.match(/\.axis-orbit \.axis-globe \{ width:(\d+)px; height:(\d+)px;/);
assert.ok(orbit, 'the orbit globe has a fixed resting size');
assert.equal(Number(orbit[1]), Number(orbit[2]), 'the globe is square');
assert.equal(Number(orbit[1]), Math.round(104 * 1.15), '15% up from the original 104px');
// No state may resize it — that is what "take it back" means.
for (const state of ['listening', 'speaking', 'thinking']) {
  const rule = new RegExp(':root\\[data-axis-state="' + state + '"\\] \\.axis-orbit \\.axis-globe \\{[^}]*(?:width|height):');
  assert.ok(!rule.test(css), `${state} must not resize the globe`);
}
assert.ok(!/\.axis-orbit \.axis-globe[^}]*clamp\([^)]*vh/.test(css), 'no viewport-relative growth remains');
ok(`one resting size at ${orbit[1]}px (104 + 15%), and no state resizes it`);

// ---- 4. it is still bottom-centre ----
assert.ok(/\.axis-orbit \{ position:fixed; left:50%; bottom:22px; transform:translateX\(-50%\)/.test(css),
  'the orbit stays pinned bottom-centre');
ok('bottom-centre, fixed, as it originally was');

// ---- 5. the voice: younger, softer, classy — and still never ARIA ----
assert.ok(P.AXIS_PROSODY.pitch > 1.0, 'younger reads as a higher pitch, not a lowered one');
assert.notEqual(P.AXIS_PROSODY.pitch, 1.05, 'never ARIA pitch');
assert.ok(P.AXIS_PROSODY.volume < 1, 'softer is volume');
assert.ok(P.AXIS_PROSODY.rate < 1, 'classy is unhurried');
const score = (n, l) => P.axisPersonaBonus(n, l);
const libby = score('Microsoft Libby Online (Natural) - English (United Kingdom)', 'en-GB');
const sonia = score('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB');
assert.ok(libby > sonia, 'the younger en-GB voice (Libby) outranks the formal one (Sonia)');
// Maisie is Microsoft's en-GB CHILD voice — "younger woman" must never resolve to a child.
assert.ok(score('Microsoft Maisie Online (Natural) - English (United Kingdom)', 'en-GB') < 0,
  'a child voice can never win the ranking');
assert.ok(score('Microsoft Ryan Online (Natural) - English (United Kingdom)', 'en-GB') < libby, 'never male');
assert.ok(score('Samantha', 'en-US') < libby, 'never the customer orb voice');
ok('AXIS is a younger, softer, en-GB woman — not a child, not male, not ARIA');

console.log('ok — globe grows and speaks; voice is younger, softer, classy');
