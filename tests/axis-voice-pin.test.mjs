// axis-voice-pin.test.mjs — a pinned voice must never make a voice change invisible.
//
// Ahmad, 2026-08-12: "change the voice as it did not change." The prosody and preference list HAD
// been changed; the change could not reach him. axisPickVoice() honoured the localStorage pin before
// it ever ranked, so a single axisVoiceNext() cycle at any point in the past silently overrode every
// later persona change — permanently, and with no way to tell from the UI.
//
// The fix is a policy revision stamped alongside the pin. This file guards the mechanism, because
// the failure mode is invisible: everything looks correct in the source and nothing changes in the ear.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../assets/axis-persona.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'assets', 'axis-app.js'), 'utf8');
const ok = (m) => console.log('  ok —', m);

// ---- 1. the revision exists and is exported/imported ----
assert.ok(typeof P.VOICE_POLICY_REV === 'string' && P.VOICE_POLICY_REV.length > 6,
  'the persona exports a voice policy revision');
assert.ok(/import \{[^}]*VOICE_POLICY_REV/s.test(app), 'the console imports it');
ok('a voice policy revision is defined and imported');

// ---- 2. a pin made under an older revision is RELEASED, not honoured ----
assert.ok(/pinnedRev !== VOICE_POLICY_REV/.test(app), 'the pin is checked against the current revision');
assert.ok(/removeItem\('axis-voice-name'\)/.test(app), 'a stale pin is cleared rather than merely ignored');
ok('a stale pin is released back to the ranker');

// ---- 3. even a CURRENT pin cannot break the persona ----
assert.ok(/axisPersonaBonus\(hit\.name, hit\.lang\) > 0/.test(app),
  'a pinned voice must still satisfy the persona (never male, child, or ARIA)');
ok('a pin can never put AXIS on a male, child, or ARIA voice');

// ---- 4. a deliberate pick still persists ----
assert.ok((app.match(/setItem\('axis-voice-rev', VOICE_POLICY_REV\)/g) || []).length >= 2,
  'both axisVoiceNext and axisSetVoice stamp the current revision');
assert.ok(/window\.axisClearVoice/.test(app), 'there is an escape hatch to drop a pin');
ok('a deliberate pick survives, and can be cleared');

// ---- 5. the resulting voice is young, soft, professional, classy ----
const s = (n, l) => P.axisPersonaBonus(n, l);
const libby = s('Microsoft Libby Online (Natural) - English (United Kingdom)', 'en-GB');
assert.ok(P.AXIS_PROSODY.pitch > 1.05, 'young reads as a raised pitch');
assert.ok(P.AXIS_PROSODY.volume <= 0.85, 'softer is volume, not pitch');
assert.ok(P.AXIS_PROSODY.rate < 1, 'classy is unhurried');
assert.ok(libby > s('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB'),
  'the younger en-GB Natural voice leads');
assert.ok(s('Microsoft Maisie Online (Natural) - English (United Kingdom)', 'en-GB') < 0,
  '"young woman" must never resolve to a child voice');
// Every family softened, and none may collide with ARIA's own rate/pitch.
assert.ok(Object.values(P.VOICE_PROFILES).every((p) => p.volume <= 0.9), 'every family is softened');
assert.ok(Object.values(P.VOICE_PROFILES).every((p) => !(p.rate === 0.95 && p.pitch === 1.05)),
  'no family lands on ARIA rate/pitch');
ok('young, softer, professional — and still never ARIA');

console.log('ok — the voice changes, and a stale pin can no longer hide it');
