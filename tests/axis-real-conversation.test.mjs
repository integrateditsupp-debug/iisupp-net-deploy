// axis-real-conversation.test.mjs — Ahmad's actual 2026-08-12 microphone transcript, pinned.
//
// He sent this verbatim:
//   "I did not catch that — press the mic and say it again."
//   okay hold on
//   "The user said 'okay hold on' — they're pausing. I'll wait. / Standing by."
//   what is the status on the YouTube videos
//   "1 approval waiting, 1 client reply waiting, 6 follow-ups due, 6 overdue. Top: Accounting Plus…"
//   now I said what's the status on the YouTube video      -> the identical paragraph
//   bro what's the status on the YouTube video             -> the identical paragraph again
//
// Four distinct faults in seven lines. Each one gets an assertion here, phrased against his exact
// words, because a summary of a bug is easy to satisfy and the bug itself is not.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectOp, smallTalk, stripMetaNarration, markRepeat, isWake, stripWake } from '../assets/axis-persona.js';
import { localAnswer } from '../assets/axis-priorities.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'assets', 'axis-app.js'), 'utf8');
const ok = (m) => console.log('  ok —', m);

// A board with something on it, so a wrong answer would be a confident wrong answer.
const snap = { overview: { data: { kpis: { awaiting_approval: 1, messages_waiting: 1, followups_due: 6 } } } };

// ---- 1. a YouTube question is not a board question ----
// This is the whole bug: localAnswer matched the word "status" and returned follow-up counts, so
// three consecutive questions about the channel were answered with client follow-ups.
for (const q of [
  'what is the status on the YouTube videos',
  "now I said what's the status on the YouTube video",
  "bro what's the status on the YouTube video",
]) {
  assert.equal(localAnswer(q, snap), null, `the board must decline: "${q}"`);
  const op = detectOp(q);
  assert.ok(op && op.kind === 'video.status', `must route to the channel: "${q}"`);
}
// ...while real board questions still work, or the fix would have broken the thing that worked.
for (const q of ['what is the status today', 'give me the status', 'whats going on']) {
  assert.ok(localAnswer(q, snap), `the board still answers: "${q}"`);
}
ok('YouTube questions reach the channel; board questions still reach the board');

// ---- 2. "okay hold on" is turn-management, not a question for a model ----
assert.equal(typeof smallTalk('okay hold on'), 'string', '"okay hold on" is answered locally');
assert.ok(smallTalk('okay hold on').length < 25, 'and answered briefly, the way a person would');
assert.equal(smallTalk('what is the status on the YouTube videos'), null,
  'a real question is never swallowed as small talk');
// It must be handled BEFORE the network call, or the round trip still happens. Scope the ordering
// check to the send function — "axis-director" appears earlier in the file for unrelated reasons,
// so comparing raw file offsets compares the wrong things.
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
// Since 2026-08-12 smallTalk stands aside on a meta turn ("I didn't ask what's waiting…"), so the
// consultation reads `meta ? null : smallTalk(text)` — same rail, one new guard in front of it.
const sendFn = fnBody(app, 'async function axisSend');
const chatAt = sendFn.indexOf('const chat = meta ? null : smallTalk(text)');
const fetchAt = sendFn.indexOf('axis-director');
assert.notEqual(chatAt, -1, 'axisSend consults smallTalk (behind the meta-turn guard)');
assert.notEqual(fetchAt, -1, 'axisSend calls the director');
assert.ok(chatAt < fetchAt, 'small talk is handled before the director call, not after it');
assert.ok(/const chat = meta \? null : smallTalk\(text\);[\s\S]{0,320}return;/.test(sendFn),
  'small talk returns without calling the brain');
ok('turn-management is answered locally, without a round trip');

// ---- 3. AXIS never narrates Ahmad in the third person ----
const narrated = "The user said 'okay hold on' — they're pausing. I'll wait. Standing by.";
const cleaned = stripMetaNarration(narrated);
assert.ok(!/the user/i.test(cleaned), 'no "the user" survives');
assert.ok(!/they'?re pausing/i.test(cleaned), 'no narration of what he is doing survives');
assert.ok(cleaned.length > 0, 'something is still said');
// Ordinary answers must pass through untouched — this filter must not eat real content.
assert.equal(stripMetaNarration('Six follow-ups are due today.'), 'Six follow-ups are due today.');
assert.equal(stripMetaNarration('They are due on Friday.'), 'They are due on Friday.');
ok('third-person narration is stripped; real answers pass through unchanged');

// ---- 4. asking twice does not get the identical paragraph twice ----
const answer = '1 approval waiting, 1 client reply waiting, 6 follow-ups due, 6 overdue.';
assert.equal(markRepeat(answer, ''), answer, 'the first answer is untouched');
const second = markRepeat(answer, answer);
assert.notEqual(second, answer, 'a verbatim repeat is acknowledged');
assert.ok(/same|still|unchanged/i.test(second), 'and acknowledged in words a person would use');
assert.ok(second.includes('1 approval waiting'), 'without inventing different numbers');
ok('repeating itself is acknowledged, not replayed');

// ---- 5. "Axie" is heard, including as "access" ----
for (const q of ['axie whats the status', 'axic what is the status', 'access what is the status',
  'so access whats the status', 'acts show me the priorities', 'hey axie']) {
  assert.ok(isWake(q), `must wake on: "${q}"`);
  assert.ok(!/^(?:so |hey )?(?:axie|axic|access|acts)\b/i.test(stripWake(q)),
    `the wake word must not reach the brain: "${q}"`);
}
// ...but this is an IT company; these sentences are said all day and must be ignored.
for (const q of ['access is restricted', 'remote access is down', 'access to the portal',
  'access control list', 'can you access it', 'grant them access tomorrow', 'he acts strangely']) {
  assert.ok(!isWake(q), `must NOT wake on: "${q}"`);
}
ok('"Axie" wakes it even when heard as "access" — and ordinary IT talk does not');

// ---- 6. hands-free never tells him to press a button he is not holding ----
// It was the first line of his transcript.
// Strip comments BEFORE slicing, and slice to the handler's own closing brace rather than a fixed
// byte count. Both matter: the comment above the branch quotes the very string being ordered
// against ("press the mic"), so an offset comparison on raw text compares a comment to a statement
// and reports the opposite of the truth — and a fixed 600-char window silently stopped covering the
// branch as soon as comments were added above it, which is the blind-guard rot in
// source-grep-guards-go-blind. Now it cannot drift with length.
const appCode = app.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const onendStart = appCode.indexOf('axisRec.onend = () => {');
assert.ok(onendStart > 0, 'axisRec.onend handler not found');
const onendEnd = appCode.indexOf('\n  };', onendStart);
assert.ok(onendEnd > onendStart, 'could not find the end of the axisRec.onend handler');
const onend = appCode.slice(onendStart, onendEnd);
assert.ok(/if \(axisHandsFree\) \{ axisOpenConvo\(\); axisWakeResume\(\); return; \}/.test(onend),
  'in hands-free a missed phrase just listens again');
assert.ok(onend.indexOf('axisHandsFree') < onend.indexOf('press the mic'),
  'the hands-free path is taken before the press-the-mic advice');
ok('a missed phrase in hands-free re-listens instead of giving button instructions');

console.log('ok — the 2026-08-12 transcript cannot happen again');
