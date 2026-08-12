// axis-assistant-behaviors.test.mjs — say what you did, do what you say, and know your sources.
//
// The 2026-08-12 late transcript, verbatim, and what each turn exposed:
//   "okay can you open it up on a web page or something" → "That's open in your browser, Ahmad"
//       — a claim about an action NOTHING performed. The console has go(<screen>); opening is one
//       synchronous call, and it was never wired to the voice.
//   "I didn't ask what's waiting I asked what's going on" → the board recital, AGAIN — "going on"
//       matched the status branch, and no local layer knew a correction from a question.
//   "yes but I literally told you… you didn't do anything… tackle all of these work with me"
//       → the LOST-LAPTOP KB article ("show me… work laptop" overlap).
//   "I don't see anything opened on the browser show me where" → a raw vault note, wikilinks and
//       bold markers read aloud, served because the region boost (+7.8) cleared the answer bar (9)
//       nearly on its own.
// Plus Ahmad, same day: "It cannot tell the difference between using ARIA brain for
// troubleshooting or Obsidian for memory or claude and agents for new solutions… it cannot take
// what is pending and queued to claude to work with it… It also cannot search."
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { detectOp, detectUiOpen, detectQueueWork, detectSearchAsk, isMetaTurn } from '../assets/axis-persona.js';
import { localAnswer } from '../assets/axis-priorities.js';
import { speakable } from '../scripts/lib/axis-vault-brain.mjs';

const require = createRequire(import.meta.url);
const { isConversational, isTroubleshoot, isMemoryQuery } = require('../netlify/functions/lib/axis-brain.cjs');
const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ok = (m) => console.log('  ok —', m);

// ---- 1. Opening a screen is a real rail, not a model's imagination ----
for (const [say, why] of [
  ['okay can you open it up on a web page or something so that I can see the details', 'the turn that got "That\'s open in your browser"'],
  ['open the approvals tab', 'a named screen'],
  ['show me the follow-ups screen', 'show-me phrasing'],
  ['pull up the pipeline', 'pull-up phrasing'],
  ['okay can you open up all the prioritized items so we can action it', 'the 19s-of-model-time turn from the afternoon'],
]) assert.ok(detectUiOpen(say), `${why}: must be ui.open`);
for (const [say, why] of [
  ['how do I open a shared mailbox in outlook', 'a support question is not navigation'],
  ['should we open a new office', 'a strategy question is not navigation'],
]) assert.equal(detectUiOpen(say), null, `${why}`);
const app = read('assets/axis-app.js');
assert.ok(/detectUiOpen\(text\)/.test(app) && /axisOpenTarget\(text\)/.test(app), 'the console consults and executes navigation');
assert.ok(/go\(screen\)/.test(app), 'axisOpenTarget calls go() — the act itself, not a description of it');
assert.ok(app.indexOf('axisOpenTarget(text); return;') < app.indexOf('const qw = detectQueueWork'),
  'navigation runs unconfirmed, before the confirm-gated rails — showing a screen risks nothing');
ok('open/show/pull-up navigates for real; support questions stay questions');

// ---- 2. Meta turns bypass every local answerer ----
for (const [say, why] of [
  ["what's going on talk to me why is it taking you so long", 'the progress complaint the board answered'],
  ["I didn't ask what's waiting I asked what's going on", 'the correction the board answered AGAIN'],
  ["I don't see anything opened on the browser show me where", 'the turn the vault answered with a raw note'],
]) {
  assert.ok(isMetaTurn(say), `${why}: client must flag it`);
  assert.ok(isConversational(say), `${why}: cascade must route it subscription-only`);
}
assert.ok(!isMetaTurn('what is overdue'), 'a board question is not a meta turn');
assert.ok(!isMetaTurn('give me our top priority items'), 'the opening ask is not a meta turn');
assert.ok(/const chat = meta \? null : smallTalk\(text\)/.test(app), 'smallTalk stands aside on a meta turn');
assert.ok(/const instant = meta \? null : axisInstantAnswer\(text\)/.test(app), 'the board stands aside on a meta turn');
assert.ok(/const local = meta \? null : localAnswer\(text, state\.snap\)/.test(app),
  'the degraded fallback stands aside too — reciting the complained-about answer a third time is the one worst reply');
ok('meta turns reach only the brain that holds the transcript');

// ---- 3. Three corpora, three jobs: helpdesk KB ≠ memory ≠ new work ----
assert.ok(isTroubleshoot('outlook keeps asking for password'), 'helpdesk question → helpdesk corpus eligible');
assert.ok(isTroubleshoot('lost my work laptop what should i do'), 'the lost-laptop article for someone actually asking');
assert.ok(!isTroubleshoot('give me our top priority items'), 'a board ask never reaches the helpdesk corpus');
assert.ok(!isTroubleshoot('yes but I literally who cares just draft the proposal'), 'business asks are not troubleshooting');
assert.ok(isMemoryQuery('what did we decide about the whitby dental pricing'), 'memory question flagged');
assert.ok(isMemoryQuery('remind me what we agreed with 123 Dental'), 'remind-me flagged');
const brain = read('netlify/functions/lib/axis-brain.cjs');
assert.ok(/name === 'kb' && !isTroubleshoot\(q\)/.test(brain), 'kb tier is troubleshoot-only in the cascade');
assert.ok(/isMemoryQuery\(q\) && \(name === 'kb' \|\| name === 'research'\)/.test(brain),
  'memory questions never go to helpdesk or research — recall and the vault-reading worker own them');
ok('the cascade routes by what the question IS, not by which corpus shouts loudest');

// ---- 4. The vault answers on EVIDENCE, not region boost, and speaks clean ----
const vb = read('scripts/lib/axis-vault-brain.mjs');
assert.ok(/const evidence = top\.score - \(top\.boost \|\| 0\)/.test(vb),
  'the direct-answer gate subtracts the region boost — ranking keeps it, answering must be earned');
assert.ok(/const airtight = top\.coverage >= 0\.99 && top\.passageCoverage >= 0\.9/.test(vb),
  'an airtight match (every term, one passage) still answers — small corpora earn little idf');
assert.equal(speakable('- **Director autonomy** — Cowork auto-delegates ([[feedback-director-autonomy]])'),
  'Director autonomy — Cowork auto-delegates (feedback-director-autonomy)',
  'wikilinks, bullets and bold never reach a voice');
assert.ok(/return speakable\(text\)/.test(vb), 'every excerpt passes through the cleaner');
const worker = read('scripts/axis-brain-worker.mjs');
assert.ok(/isConversational\(query\) \? null : vault\.vaultTier\(query\)/.test(worker),
  'the worker never lets note-matching answer a conversational turn — the vault rides as context instead');
ok('vault answers are earned and speakable; conversational turns never meet the note matcher');

// ---- 5. The pending queue goes to Claude as WORK ----
for (const [say, why] of [
  ['tackle all of these work with me', 'the transcript ask, verbatim'],
  ['take the pending items to claude and action them', 'the complaint phrasing'],
  ['draft the two pending replies', 'the concrete version'],
  ['go through the queue with me', 'the walk-through phrasing'],
]) {
  const q = detectQueueWork(say);
  assert.ok(q && q.kind === 'queue.work', `${why}: must be queue.work`);
  assert.ok(/cowork/i.test(q.confirm) && /confirm/i.test(q.confirm), `${why}: read back, names Cowork, waits for a yes`);
}
assert.equal(detectQueueWork('what is in the queue'), null, 'asking about the queue is a question, not a dispatch');
assert.ok(/op\.kind === 'queue\.work'/.test(app) && /cowork\.plan/.test(app.slice(app.indexOf("op.kind === 'queue.work'"))),
  'a confirmed queue.work becomes a Cowork job with the board and turns riding along');
ok('the pending queue is one confirm away from Claude, and approvals stay clicks');

// ---- 6. Search finds things and says where they are ----
const s1 = detectSearchAsk('search for Accounting Plus');
assert.ok(s1 && s1.arg === 'Accounting Plus', 'search arg extracted');
const s2 = detectSearchAsk('find the MSA document');
assert.ok(s2 && /MSA/.test(s2.arg), 'find works too');
assert.equal(detectSearchAsk('find out whether the deploy finished'), null, '"find out whether" is a question');
assert.ok(/axisRunSearch\(sk\.arg\)/.test(app), 'the console executes the search');
assert.ok(/Search the repo, the vault notes, and project state for/.test(app),
  'a local miss offers Cowork — the layer that can actually grep the repo and the vault');
ok('search is a rail: snapshot first, Cowork on a miss');

// ---- 7. The system prompt now carries the evidence rule ----
// Jared Rhod's Rule 1 ("Evidence only, never guess"), applied where the failure happened: the
// worker's own system prompt, so no CLI answer claims an act no rail performed.
{
  const sys = fs.readFileSync(path.join(process.env.AXIS_VAULT || path.join(process.env.USERPROFILE || '', 'Documents', 'AXIS-Brain'), '00_Index', 'AXIS-SYSTEM.md'), 'utf8');
  assert.ok(/Never say an action happened/.test(sys), 'the hard rules forbid claiming unperformed actions');
}
ok('the evidence rule is in the hard rules the worker reads at boot');

// ---- 8. The transcript, end to end: every turn now lands on the right rail ----
const snap = { followups: { data: { overdue: [{ id: 7, business_id: 1, company: 'Accounting Plus Business Services', due_at: Date.now() - 29 * 86400000 }] } } };
function route(text) {
  const op = detectOp(text); if (op) return 'op:' + op.kind;
  if (detectUiOpen(text)) return 'ui.open';
  if (detectQueueWork(text)) return 'queue.work';
  if (detectSearchAsk(text)) return 'search';
  const meta = isMetaTurn(text);
  if (!meta) { let la = null; try { la = localAnswer(text, snap); } catch {} if (la) return 'board'; }
  return meta ? 'brain-meta' : 'brain';
}
assert.equal(route('give me our top priority items'), 'board', 'turn 1: the board answers, free');
assert.equal(route('okay can you open it up on a web page or something so that I can see the details'), 'ui.open', 'turn 2: NAVIGATES');
assert.equal(route("what's going on talk to me why is it taking you so long"), 'brain-meta', 'turn 3: the brain, with the transcript');
assert.equal(route("I didn't ask what's waiting I asked what's going on"), 'brain-meta', 'turn 4: never the board again');
assert.equal(route("I don't see anything opened on the browser show me where"), 'brain-meta', 'turn 6: never the vault matcher');
ok('the transcript replayed: act, answer, or hand to the brain — never recite, never dump');

console.log('axis-assistant-behaviors test passed (navigation is real · meta turns reach the brain only · sources route by intent · vault answers are earned and clean · the queue goes to Claude · search works).');
