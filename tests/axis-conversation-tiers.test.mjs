// axis-conversation-tiers.test.mjs — a correction must never be answered by a document matcher.
//
// The 2026-08-12 evening transcript, verbatim. Ahmad, about the YouTube pipeline: "videos sound
// very robotic have it sound more smooth human-like and make it more clear text on the page one
// for the cover" — and AXIS answered with the "Teams: no audio in meetings" helpdesk article,
// because a keyword tier scored "sound" against "audio" and shipped the top hit. He corrected it:
// "I don't know what are you talking about teams I'm talking about YouTube" — and the word "teams"
// re-matched the SAME article. He corrected it again: "that's not what I'm asking you about" — and
// got outreach sales copy. Three turns of a person being misunderstood, each answered by word
// overlap against the wrong corpus.
//
// The rails this suite locks:
//   1. corrections and instructions are CONVERSATIONAL — the cascade sends them only to the tier
//      that reads the conversation (the subscription worker), never to recall/research/kb,
//   2. a production direction about the videos routes to Claude Code as work, not to Q&A at all,
//   3. a status ask that carries a direction in the same breath runs the status AND parks the
//      direction — the second half of the sentence no longer evaporates,
//   4. genuine knowledge questions still reach the $0 keyword tiers first — the fix must not tax
//      every lookup with a model round trip.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { detectOp, detectVideoDirection } from '../assets/axis-persona.js';

const require = createRequire(import.meta.url);
const { isConversational } = require('../netlify/functions/lib/axis-brain.cjs');
const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ok = (m) => console.log('  ok —', m);

// ---- 1. The three misunderstood turns are conversational; lookups are not ----
for (const [say, why] of [
  ["looks give me key hold on Alex give me key and videos sound very robotic have it sound more smooth human-like and make it more clear text on the page one for the cover so that it attracts people's attention",
    'the instruction that pulled the Teams article'],
  ["I don't know what are you talking about teams I'm talking about YouTube", 'the correction that RE-pulled it'],
  ["that's not what I'm asking you about", 'the correction that pulled sales copy'],
  ["I'm talking about our YouTube channel or YouTube Flow pipeline", 'the third correction'],
  ['no, I meant the follow-up schedule', 'a redirect'],
]) assert.ok(isConversational(say), `${why}: must be conversational — keyword tiers must not see it`);
for (const [say, why] of [
  ['outlook keeps asking for password', 'the KB hit that scores 28 — the fix must not break it'],
  ['printer is offline', 'the KB hit that scores 36'],
  ['Teams has no audio in meetings', 'the Teams article for someone actually asking about Teams'],
  ['what does CSP stand for in the Microsoft partner program', 'a banked recall'],
  ['tell me the most prioritized item', 'a lookup phrasing'],
  ['how do I fix a stuck windows update', 'a support question'],
]) assert.ok(!isConversational(say), `${why}: a knowledge question still rides the $0 tiers`);
ok('corrections and instructions are conversational; lookups keep the cheap tiers');

// ---- 2. The cascade actually enforces it ----
const brain = read('netlify/functions/lib/axis-brain.cjs');
assert.ok(/const conversational = isConversational\(q\)/.test(brain), 'askBrain classifies the turn');
assert.ok(/conversational && name !== 'subscription'/.test(brain),
  'a conversational turn is ineligible for every tier except the one that reads the conversation');
ok('askBrain routes conversational turns to the subscription worker only');

// ---- 3. Production directions are WORK, routed to Claude Code, confirm-gated ----
for (const [say, why] of [
  ["looks give me key hold on Alex give me key and videos sound very robotic have it sound more smooth human-like and make it more clear text on the page one for the cover so that it attracts people's attention",
    'the transcript direction, STT garble and all'],
  ['can we enhance the video quality', 'the second ask in the combined sentence'],
  ['make the thumbnails look better', 'a cover direction'],
]) {
  const d = detectVideoDirection(say);
  assert.ok(d && d.kind === 'video.direct', `${why}: expected video.direct`);
  assert.ok(/claude code/i.test(d.confirm) && /confirm/i.test(d.confirm), `${why}: read back, names Claude Code`);
}
for (const [say, why] of [
  ['what is the status on the youtube videos', 'a status question is not a direction'],
  ['why do the videos sound robotic', 'a question about the symptom is not an instruction'],
  ['how many videos are staged', 'a count'],
]) assert.equal(detectVideoDirection(say), null, `${why}`);
ok('video directions land on video.direct with a spoken confirm; questions do not');

// ---- 4. Status + direction in one breath: the status runs, the direction parks ----
const combo = "okay perfect now tell me what's the status of the YouTube videos can we enhance the video quality there's no image";
const op = detectOp(combo);
assert.ok(op && op.kind === 'video.status', 'the status half still runs immediately');
assert.ok(detectVideoDirection(combo), 'the direction half is detected instead of evaporating');
const app = read('assets/axis-app.js');
assert.ok(/detectVideoDirection\(text\)/.test(app), 'the console consults the direction detector');
assert.ok((app.match(/detectVideoDirection\(text\)/g) || []).length >= 2,
  'checked BOTH after a status op and as its own rail — the combined sentence needs the first');
assert.ok(/video\.direct/.test(app) && /code\.build/.test(app.slice(app.indexOf("op.kind === 'video.direct'"))),
  'a confirmed direction becomes a Claude Code job (code.build), the rail with edit permission');
ok('the combined sentence runs the status and parks the direction for a confirm');

// ---- 5. The learn choke point refuses state, deixis and garble ----
// The store was found holding — promoted:true, recall-eligible at 55%+ — "tell me the most
// prioritized item" (a stale board), "you already said that what are the" (a banked complaint),
// "listen look at" (garble), and "tell me more about that" banked as the timeless answer "I don't
// have anything before this to point back to". Twelve were deleted on 2026-08-12; this keeps the
// class out. The gate lives in the QUEUE's learn action because both bankers (cloud learnBack and
// the worker's bank) flow through it.
const queue = read('netlify/functions/axis-brain-queue.mjs');
assert.ok(/STATE_QUERY/.test(queue) && /DEIXIS/.test(queue), 'the learn action carries the gate');
assert.ok(/not-knowledge/.test(queue), 'refusal is reported with a reason, not silently dropped');
{
  const state = queue.match(/const STATE_QUERY = (\/.*\/i);/);
  const deixis = queue.match(/const DEIXIS = (\/.*\/i);/);
  assert.ok(state && deixis, 'both gate regexes are extractable for proving');
  const STATE_QUERY = eval(state[1]); const DEIXIS = eval(deixis[1]);
  for (const q of ['tell me the most prioritized item', 'give me status update', 'tell me what do we have in the queue',
    'what are the priority items we need to work on', 'in one short sentence which item on the board is most overdue'])
    assert.ok(STATE_QUERY.test(q), `state question must be refused: "${q}"`);
  for (const q of ['tell me more about that', 'you already said that what are the'])
    assert.ok(DEIXIS.test(q), `deixis must be refused: "${q}"`);
  for (const q of ['how do I fix a stuck windows update', 'what backup retention should we recommend to a 20-person firm',
    'what does CSP stand for in the microsoft partner program'])
    assert.ok(!STATE_QUERY.test(q) && !DEIXIS.test(q), `knowledge must still bank: "${q}"`);
}
ok('the learn gate refuses live-state answers, continuations and garble; knowledge still banks');

// ---- 6. This transcript's removal exchange stays fixed (regression from round 1) ----
const rm = detectOp('okay remove the top priority top three priority items');
assert.ok(rm && rm.kind === 'board.remove', 'the stuttered removal routes to board.remove');
assert.ok(/top priority top three priority items/.test(rm.arg), 'the arg carries the utterance for targeting');
ok('the round-1 removal rail is untouched');

console.log('axis-conversation-tiers test passed (corrections never meet the document matcher · directions are work for Claude Code · combined sentences keep both halves · lookups keep the $0 tiers).');
