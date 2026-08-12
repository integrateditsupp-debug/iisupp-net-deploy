// axis-conversation-memory.test.mjs — AXIS must remember what IT said, and keep its place
// across an interruption.
//
// Ahmad, 2026-08-11: "when I stop it and tell it to do what it just mentioned it does not remember
// what it said."
//
// The cause was not memory. assets/axis-app.js sent
//     dockLog.filter(m => m.role === 'user')
// to the director — AXIS's own replies were stripped out of the request before it left the browser,
// so the model saw only half the conversation and could not resolve "that". The transcript was on
// screen the entire time, which is precisely what made it read as forgetting.
//
// Three things are pinned here: the whole transcript goes over the wire, a pronoun resolves to what
// is parked, and stop pauses without erasing the place.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isReferential, isContinue, isConfirm, isStop } from '../assets/axis-persona.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'assets', 'axis-app.js'), 'utf8');
const ok = (m) => console.log('  ok — ' + m);

// ---- 1. THE REGRESSION: never ship a user-only transcript again ----
assert.ok(!/messages:\s*dockLog\.filter\(\s*m\s*=>\s*m\.role\s*===\s*'user'\s*\)/.test(app),
  "the director request must not be filtered down to user turns — that is the bug that made AXIS 'forget' what it said");
assert.ok(/messages:\s*axisHistory\(/.test(app), 'director request is built by axisHistory()');
ok('director receives the full transcript, not just the user half');

// ---- 2. axisHistory shapes a valid Messages API conversation ----
assert.ok(/function axisHistory/.test(app), 'axisHistory exists');
const hist = app.slice(app.indexOf('function axisHistory'), app.indexOf('function axisHistory') + 1200);
assert.ok(/m\.role === 'axis' \? 'assistant' : 'user'/.test(hist), 'axis turns are mapped to the assistant role');
assert.ok(/prev\.role === role/.test(hist), 'consecutive same-role turns are joined, not dropped (roles must alternate)');
assert.ok(/recent\[0\]\.role !== 'user'/.test(hist), 'history is trimmed to open on a user turn');
assert.ok(/slice\(-16\)/.test(hist), 'history is capped');
assert.ok(/m === exclude/.test(hist), "the '…' placeholder is excluded from history");
ok('history alternates, opens on a user turn, and is capped');

// ---- 3. a pronoun resolves to what AXIS just offered ----
for (const t of ['do what you just said', 'do what you just mentioned', 'go ahead', 'do that',
                 'okay do that', 'make it so', 'proceed', 'the second one', 'run what you said'])
  assert.ok(isReferential(t), `"${t}" should resolve to the parked proposal`);

// A referential phrase must be the WHOLE utterance. "go ahead and <new instruction>" merely opens
// with the same words and is a fresh request.
for (const t of ['go ahead and tell me about pricing today', 'do that thing with the printer instead',
                 'proceed to upload every video publicly', 'what is the weather', 'stop'])
  assert.ok(!isReferential(t), `"${t}" must NOT be treated as a pronoun`);
ok('referential phrases resolve; longer instructions that merely start with them do not');

// ---- 4. stop can never confirm or resolve anything ----
assert.ok(isStop('stop'), 'stop is recognised');
assert.ok(!isConfirm('stop') && !isReferential('stop') && !isContinue('stop'),
  'a stop must never satisfy a confirmation or a pronoun — it is a brake, not an answer');
ok('stop cannot confirm, continue, or resolve a pronoun');

// ---- 5. stop pauses without erasing the place ----
const stopBlock = app.slice(app.indexOf('if (isStop(raw))'), app.indexOf('if (isStop(raw))') + 900);
assert.ok(!/axisPendingOp = null/.test(stopBlock), 'stop must not discard the parked proposal');
assert.ok(!/axisHeldRest = ''/.test(stopBlock), 'stop must not discard the un-spoken tail');
assert.ok(/Still holding/.test(stopBlock), 'stop reports what it is still holding');
// Take the WHOLE function, not a fixed character window. A 500-char slice silently stopped covering
// the end of axisStandDown as soon as a comment was added to it, which left this guard blind to
// exactly the regression it exists to catch (verified by mutation: injecting `axisPendingOp = null`
// into the function did not trip it).
function fnBody(src, decl) {
  const start = src.indexOf(decl);
  assert.notEqual(start, -1, `${decl} not found`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${decl}`);
}
const sd = fnBody(app, 'function axisStandDown');
// Match the ASSIGNMENT, not the mention: the invariant is that stand-down never *clears* the parked
// proposal or the un-spoken tail. A comment in the function explaining that it deliberately leaves
// them alone is the guard working as intended, and must not read as a violation.
assert.ok(!/\baxisPendingOp\s*=|\baxisHeldRest\s*=/.test(sd),
  'stand-down clears voice state only, never conversational place');
ok('stop halts speech and keeps its place');

// ---- 6. a parked proposal expires rather than lingering forever ----
// Assert the behaviour and the value, not the spelling: the window may be written inline or as a
// named constant, but a parked proposal must be compared against a real age limit, and that limit
// must actually be five minutes.
assert.ok(/axisPendingOp\.t \|\| 0\) > (?:5 \* 60 \* 1000|OP_TTL_MS)/.test(app),
  'a parked proposal is checked against an expiry');
const ttl = app.match(/OP_TTL_MS\s*=\s*([^;]+);/);
if (ttl) {
  // eslint-disable-next-line no-eval
  assert.equal(eval(ttl[1]), 5 * 60 * 1000, 'OP_TTL_MS must be five minutes');
}
assert.ok(/axisPendingOp = \{ \.\.\.op, t: Date\.now\(\) \}/.test(app), 'the proposal is stamped when parked');
assert.ok(/isConfirm\(text\) \|\| isReferential\(text\)/.test(app), 'a pronoun can run the parked proposal');
ok('a stale proposal expires instead of firing on a later "go ahead"');

// ---- 7. the held tail releases on a pronoun as well as on "go on" ----
assert.ok(/axisHeldRest && \(isContinue\(text\) \|\| isReferential\(text\)\)/.test(app),
  'the un-spoken remainder releases on a pronoun too');
ok('held remainder releases on "the rest" and on "do that"');

console.log('\nok — conversation memory: AXIS hears its own half of the conversation');
