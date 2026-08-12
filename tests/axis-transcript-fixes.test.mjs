// tests/axis-transcript-fixes.test.mjs - the two failures in Ahmad's 2026-08-12 voice transcript.
//
// What he heard:
//   AXIS: One moment.
//   AXIS: Unchanged - one moment.
//   AXIS: Same as a moment ago - one moment.
//   AXIS: I did not hear anything. Try again, a little closer to the mic.   (twice, after he spoke)
//
// Cause 1: markRepeat() marks any answer identical to the previous one. Two slow questions both
// return the ack "One moment.", so the second got prefixed - producing a sentence that says
// nothing. A holding line repeating is not a machine repeating itself.
//
// Cause 2: axisTurnDone() re-opens the mic 350ms after AXIS stops speaking. If Ahmad has not
// started yet the recognizer fires 'no-speech', and axisMicError reported it - scolding him about
// mic distance for a mic he never opened. Silence after an auto-open is the normal case.
//
// Run: node tests/axis-transcript-fixes.test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(pathToFileURL(path.join(root,'assets','axis-persona.js')).href);
const app = fs.readFileSync(path.join(root,'assets','axis-app.js'),'utf8');
import assert from 'node:assert/strict';
let n=0; const ok=(m)=>{n++;console.log('  ok -',m)};

// 1. A holding line repeated is not a repeat
assert.equal(P.markRepeat('One moment.','One moment.'),'One moment.');
assert.equal(P.isTransientLine('On it.'), true);
assert.equal(P.isTransientLine('Checking.'), true);
ok('acks and "One moment." never get the Unchanged prefix');

// 2. A real repeated answer still gets marked
assert.match(P.markRepeat('Six follow-ups are due.','Six follow-ups are due.'), /^(Same as a moment ago|Still the same|Unchanged) — six/);
ok('a substantive repeat is still acknowledged');

// 3. no-speech on an auto-opened mic is silent
assert.ok(/let axisMicAutoOpen = false;/.test(app), 'auto-open flag missing');
assert.ok(/auto = false\) \{\s*\n\s*axisMicAutoOpen = !!auto;/.test(app), 'axisMicToggle does not record auto');
assert.ok(/if \(auto && e && e\.error === 'no-speech'\) return;/.test(app), 'no-speech is still reported on an auto mic');
ok('auto-opened mic goes quiet on no-speech instead of scolding');

// 4. axisTurnDone passes auto:true
const td = app.slice(app.indexOf('function axisTurnDone'), app.indexOf('function axisTurnDone')+800);
assert.ok(/axisMicToggle\(s\.micId, s\.inputId, \(\) => axisSend\(s\.inputId\), true\)/.test(td),
  'the self-opened mic in axisTurnDone is not flagged auto');
ok('axisTurnDone flags its own mic as auto');

// 5. a mic Ahmad opened himself still reports
assert.ok(/\$\('axisMic'\)\?\.addEventListener\('click', \(\) => axisMicToggle\(\)\)/.test(app),
  'manual click path changed');
ok('a deliberately opened mic keeps its note');
console.log(`transcript-fixes: ${n} checks passed`);
