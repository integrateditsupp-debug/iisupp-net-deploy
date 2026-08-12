// tests/axis-turn-taking.test.mjs — a turn ends on silence, not on a breath (2026-08-12).
//
// Ahmad: "its still not working well, cuts me off middle of sentence and does not hear things
// properly."
//
// Both symptoms had one cause. The Web Speech API marks a result `isFinal` on ANY pause — including
// the ordinary breath in the middle of a sentence — and both recognizers sent the turn on the first
// final they saw. Worse, axisReadTranscript() reads only from ev.resultIndex onward, so that final
// carried just the newest segment and everything before the pause was discarded. One sentence with
// a comma in it therefore reached AXIS as a truncated question built from its own last few words:
// "cuts me off" and "does not hear properly" are the same bug seen from two sides.
//
// What this protects:
//   · segments ACCUMULATE across an utterance instead of replacing each other
//   · the turn is sent only after a quiet window, and any new speech restarts that window
//   · a trailing conjunction buys extra time, because someone ending on "and" is mid-thought
//   · a recognizer that closes mid-window flushes rather than dropping the sentence
//   · "AXIS stop" and barge-in still act on the INTERIM, so they stay instant
// Run: node tests/axis-turn-taking.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'assets', 'axis-app.js'), 'utf8');
const code = app.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
let n = 0; const ok = (m) => { n++; if (m) console.log('  ok —', m); };

// ---- 1. The buffer exists and is used by BOTH recognizers ----
{
  assert.ok(/function axisTurnBuffer\(/.test(code), 'axisTurnBuffer is missing');
  // Push-to-talk and the hands-free wake listener each need their own buffer; sharing one would
  // let a wake utterance and a held-mic utterance bleed into each other.
  assert.ok(/const turn = axisTurnBuffer\(/.test(code), 'push-to-talk has no turn buffer');
  assert.ok(/const wakeTurn = axisTurnBuffer\(/.test(code), 'the wake listener has no turn buffer');
  ok('both recognizers buffer their turns');
}

// ---- 2. Neither recognizer sends on the first isFinal any more ----
{
  // The old shape: onresult(...) { ... if (t.final) { send() } }. If that returns, the truncation
  // bug is back.
  assert.ok(!/if \(t\.final\) \{ heard = t\.final;/.test(code),
    'push-to-talk is sending on the first final again — that truncates mid-sentence');
  assert.ok(!/if \(!r \|\| !r\.isFinal\) return;/.test(code),
    'the wake listener is back to reading only the last final result');
  ok('no recognizer commits a turn on the first final');
}

// ---- 3. Accumulation, not replacement ----
{
  // The buffer must APPEND finals. `buf = t.final` would reintroduce the lost-words half of the bug.
  assert.ok(/buf = \(buf \? buf \+ ' ' : ''\) \+ t\.final/.test(code),
    'final segments must be appended to the buffer, not replace it');
  ok('segments accumulate across the whole utterance');
}

// ---- 4. Any new speech restarts the quiet window ----
{
  const pushFn = code.slice(code.indexOf('push(t)'), code.indexOf('close()'));
  assert.ok(/clearTimeout\(timer\)/.test(pushFn) && /setTimeout\(flush/.test(pushFn),
    'each result must reset the end-of-turn timer, or a long sentence still gets cut');
  ok('still-talking resets the timer');
}

// ---- 5. The windows are sane, and a trailing conjunction extends them ----
{
  const ms = Number((code.match(/END_OF_TURN_MS = (\d+)/) || [])[1]);
  const trail = Number((code.match(/END_OF_TURN_TRAILING_MS = (\d+)/) || [])[1]);
  assert.ok(ms >= 700 && ms <= 2000, `end-of-turn window ${ms}ms is outside a usable range`);
  assert.ok(trail > ms, 'a trailing conjunction must buy MORE time, not less');
  // Someone who stops on "and" has not finished their sentence.
  assert.ok(/TRAILING_WORD = \/\\b\(and\|but\|so\|or\|because/.test(code),
    'the trailing-word list must cover the common mid-thought conjunctions');
  ok(`quiet window ${ms}ms, extended to ${trail}ms on a trailing conjunction`);
}

// ---- 6. A closing recognizer flushes instead of dropping the sentence ----
{
  assert.ok(/turn\.close\(\)/.test(code), 'push-to-talk does not flush on close');
  assert.ok(/wakeTurn\.close\(\)/.test(code), 'the wake listener does not flush on close');
  // Flush must come BEFORE restMic(), which reads `heard` to decide whether to apologise.
  const onendStart = code.indexOf('axisRec.onend = () => {');
  const seg = code.slice(onendStart, onendStart + 400);
  assert.ok(seg.indexOf('turn.close()') < seg.indexOf('restMic()'),
    'flush must run before restMic(), which branches on whether anything was heard');
  ok('a sentence left in the buffer is flushed, not lost');
}

// ---- 7. Stop and barge-in stay instant ----
// These must NOT wait for the quiet window. Taking a second to honour "AXIS stop" while it is
// still talking is precisely the unresponsiveness being fixed.
{
  const onres = code.slice(code.indexOf('rec.onresult = (ev) => {'));
  const head = onres.slice(0, onres.indexOf('wakeTurn.push('));
  assert.ok(/isStop\(live\)/.test(head), '"AXIS stop" must be checked on the interim, before the window');
  assert.ok(/axisBargeIn\(\)/.test(head), 'barge-in must trigger on the interim, before the window');
  assert.ok(/wakeTurn\.cancel\(\)/.test(head), 'a stand-down must discard the buffered turn');
  ok('stop and barge-in act on the interim, not after the pause');
}

// ---- 8. An error discards the partial turn ----
// Sending half a sentence after a mic error is worse than sending nothing.
{
  // Slice the handler rather than matching a one-line shape: it is legitimately multi-line now that
  // it also suppresses `no-speech` on an auto-opened mic, and pinning the layout would make this
  // guard rot the next time someone edits it — the failure mode this suite exists to prevent.
  const errStart = code.indexOf('axisRec.onerror = (e) => {');
  assert.ok(errStart > 0, 'axisRec.onerror handler not found');
  const errEnd = code.indexOf('\n  };', errStart);
  const errBody = code.slice(errStart, errEnd > errStart ? errEnd : errStart + 300);
  assert.ok(/turn\.cancel\(\)/.test(errBody),
    'a recognition error must discard the partial turn rather than send it');
  ok('a mic error drops the partial rather than sending it');
}

console.log(`axis-turn-taking: ${n} checks passed`);
