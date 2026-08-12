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
const css = fs.readFileSync(path.join(ROOT, 'assets', 'axis-tokens.css'), 'utf8');
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

// ---- 3. growth is gradual, and settling is slower than growing ----
const grow = css.match(/:root\[data-axis-state="thinking"\] \.axis-orbit \.axis-globe \{\s*transition:width ([\d.]+)s/);
const rest = css.match(/\.axis-orbit \.axis-globe \{\s*transition:width ([\d.]+)s/);
assert.ok(grow && rest, 'both a growth and a resting transition are defined');
const growS = Number(grow[1]), restS = Number(rest[1]);
assert.ok(growS >= 0.9, `growth must be gradual, got ${growS}s`);
assert.ok(restS > growS, `settling (${restS}s) must be slower than growing (${growS}s) — the "all of a sudden small"`);
ok(`growth ${growS}s, settle ${restS}s — it opens and it settles, neither snaps`);

// ---- 4. it must not freeze at the exact moment it is talking ----
const speak = css.slice(css.indexOf(':root[data-axis-state="speaking"] .axis-orbit .axis-globe {\n  animation:'));
assert.ok(/animation:axis-speak-swell/.test(speak), 'speaking carries its own swell');
assert.ok(/@keyframes axis-speak-swell/.test(css), 'the swell keyframes exist');
// The old rule pinned animation:none on speaking, which stilled the globe mid-sentence.
const speakRule = css.match(/:root\[data-axis-state="speaking"\] \.axis-orbit \.axis-globe \{[^}]*width:clamp[^}]*\}/);
assert.ok(speakRule && !/animation:none/.test(speakRule[0]),
  'the speaking size rule must not kill the animation');
ok('the globe keeps moving while it speaks');

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
