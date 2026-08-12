// axis-speech-not-screen.test.mjs — what AXIS SAYS is not what the dock SHOWS.
//
// Ahmad, 2026-08-12: AXIS kept replying "Next: Accounting Plus Business Services — 29 days overdue.
// queued → Approvals." That is a table row read aloud — "→" is not a word, a field separator is not
// a sentence, and nobody says "29 days overdue" when they mean "about a month behind".
//
// The cause was that the dock message and the spoken message were the same string, so board
// formatting went straight to the speaker. These assertions pin the separation.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speechify } from '../assets/axis-persona.js';
import { localAnswer } from '../assets/axis-priorities.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'assets', 'axis-app.js'), 'utf8');
const ok = (m) => console.log('  ok —', m);

// ---- 1. the exact sentence Ahmad reported ----
const reported = 'Next: Accounting Plus Business Services — 29 days overdue. queued → Approvals.';
const said = speechify(reported);
assert.ok(!/→|->/.test(said), 'no arrows survive into speech');
assert.ok(!/·/.test(said), 'no interpuncts survive into speech');
assert.ok(!/\s[—–]\s/.test(said), 'no em-dash field separators survive into speech');
assert.ok(!/^Next:/.test(said), 'a label prefix becomes an opening, not a heading');
assert.ok(/about a month behind/.test(said), `a day count becomes human: ${said}`);
assert.ok(/queued for your approval/.test(said), `a status badge becomes a clause: ${said}`);
ok(`the reported line now speaks as: "${said}"`);

// ---- 2. it applies to EVERYTHING spoken, not just board answers ----
// The whole point is that a template added later cannot leak punctuation into speech. That only
// holds if speechify sits at the single choke point where text becomes an utterance.
assert.ok(/phraseChunks\(polishForSpeech\(speechify\(clean\)\), 180\)/.test(app),
  'speechify runs inside axisSpeak, so every spoken string passes through it');
ok('the speech layer is at the choke point, not bolted onto one caller');

// ---- 3. ordinary prose is left alone ----
for (const plain of ['Nothing is overdue.', 'All quiet. Nothing needs you.',
  'Two approvals waiting on you.', 'I do not have the board yet.']) {
  assert.equal(speechify(plain), plain, `plain English is untouched: ${plain}`);
}
ok('sentences that are already English pass through unchanged');

// ---- 4. day counts read the way people say them ----
assert.match(speechify('3 days overdue'), /3 days overdue/);      // small counts stay exact
assert.match(speechify('9 days overdue'), /about a week overdue/);
assert.match(speechify('16 days overdue'), /a couple of weeks behind/);
assert.match(speechify('29 days overdue'), /about a month behind/);
assert.match(speechify('in 14 days'), /in about 2 weeks/);
assert.match(speechify('in 7 days'), /in a week/);
ok('day counts are spoken in human units, and small ones stay exact');

// ---- 5. the board answer is written as a sentence, not a row ----
// Same snapshot shape the console actually receives (see tests/axis-brain-fallback.test.mjs).
const snap = { followups: { data: {
  overdue: [{ company: 'Accounting Plus Business Services', due_at: '2026-07-14T09:00:00' }],
} } };
const next = localAnswer('what is next', snap, new Date('2026-08-12T09:00:00'));
assert.ok(next && /Accounting Plus/.test(next), `the board answered: ${next}`);
assert.ok(!/^Next:/.test(next), 'the board answer no longer opens with a bare label');
assert.ok(/^Next up is /.test(next), `it opens as a sentence: ${next}`);
// End to end: composed by the board, then spoken. This is the exact path Ahmad heard.
const spoken = speechify(next);
assert.ok(!/→|·/.test(spoken), `the composed answer is speech-clean: ${spoken}`);
assert.ok(/about a month behind/.test(spoken), `and reads in human units: ${spoken}`);
ok(`board → speech: "${spoken}"`);

console.log('ok — AXIS speaks English; the dock keeps its badges');
