// tests/axis-conversation-log.test.mjs — the daily conversation note in the ARIA vault (2026-08-12).
//
// Ahmad, by voice: "create an obsidian note inside [the ARIA] vault that has our conversations
// daily, time stamped and dated — that way you can take a look and have context when we're talking,
// that way you can work more efficiently and I don't have to explain things to you all the time …
// if needed you can go further back to find more context."
//
// What this protects:
//   · a turn is APPENDED to a per-day note, dated and timestamped in LOCAL time
//   · the day boundary is local, not UTC — an evening turn in Toronto must not file under tomorrow
//   · a secret spoken in conversation is redacted, and the turn is still kept
//   · turns read back as turns: what was appended is what comes out, multi-line and all
//   · recall is BOUNDED (turns and characters) — the point is cheaper answers, not a bigger prompt
//   · older conversations are findable by topic, past the recent window
//   · the log folder is git-ignored, so a private conversation can never be committed or published
//   · the worker writes every answered turn and reads recall back into the prompt
// Run: node tests/axis-conversation-log.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ok = () => { n++; };

// A throwaway vault: the suite must never write into Ahmad's real conversations.
const tmp = makeScratchDir('axis-convo-log-');
process.env.AXIS_CONVERSATION_VAULT = tmp;

// pathToFileURL: on Windows an absolute path is not a valid ESM specifier, and this repo's own path
// contains spaces and an em dash.
const log = await import(pathToFileURL(path.join(root, 'scripts', 'lib', 'axis-conversation-log.mjs')).href);

const at = (y, mo, d, h, mi, s) => new Date(y, mo - 1, d, h, mi, s);

// ---- 1. A turn lands in a dated note, under its local timestamp ----
{
  const when = at(2026, 8, 12, 14, 32, 7);
  const res = log.appendTurn({
    question: 'how many videos are staged for the growth library',
    answer: 'Nine staged, three published. The other six are waiting on your thumbnail sign-off.',
    at: when, tier: 'standard', model: 'claude-sonnet-4-6',
  });
  assert.ok(res.written, `appendTurn refused: ${res.reason}`);
  assert.equal(res.day, '2026-08-12');
  assert.equal(res.time, '14:32:07');
  assert.equal(path.basename(res.file), '2026-08-12.md', 'the note is not named after its date');
  assert.equal(path.basename(path.dirname(res.file)), 'AXIS-Conversations',
    'the note is not in the AXIS conversations folder');

  const body = fs.readFileSync(res.file, 'utf8');
  assert.match(body, /^---\r?\n/, 'day note has no frontmatter');
  assert.match(body, /type: axis-conversation/);
  assert.match(body, /date: 2026-08-12/);
  assert.match(body, /^## 14:32:07/m, 'the turn is not timestamped');
  assert.match(body, /\*\*Ahmad:\*\* how many videos are staged/);
  assert.match(body, /\*\*AXIS:\*\* Nine staged/);
  ok();

  // …and an index note points at it, so Ahmad has a way in from Obsidian.
  const idx = fs.readFileSync(path.join(path.dirname(res.file), '_AXIS-Conversations.md'), 'utf8');
  assert.match(idx, /\[\[2026-08-12\]\]/, 'the day is not linked from the index note');
  ok();
}

// ---- 2. The SAME day appends; it does not overwrite ----
// Append-only is the whole durability story: read-modify-write on a file Obsidian may also hold open
// is how a day's context disappears.
{
  const first = fs.readFileSync(log.dayNotePath('2026-08-12'), 'utf8');
  log.appendTurn({
    question: 'and which one is closest to done',
    answer: 'The Sentinel walk-through cut — audio is final, it needs the end card.',
    at: at(2026, 8, 12, 14, 35, 0),
  });
  const after = fs.readFileSync(log.dayNotePath('2026-08-12'), 'utf8');
  assert.ok(after.startsWith(first), 'the second turn rewrote the note instead of appending');
  assert.equal((after.match(/^## \d{2}:\d{2}:\d{2}/gm) || []).length, 2, 'expected two turns in the day note');
  ok();
}

// ---- 3. The day boundary is LOCAL, not UTC ----
// Ahmad is in Toronto (UTC-4/-5). toISOString() would file a 9pm conversation under TOMORROW, so
// "what did we talk about tonight" reads an empty note. This is the bug that breaks recall silently,
// so it is asserted against the actual UTC date rather than assumed.
{
  const evening = at(2026, 8, 12, 21, 30, 0);
  const res = log.appendTurn({
    question: 'log this one late in the evening please',
    answer: 'Logged. This turn exists to prove the day boundary is your clock, not UTC.',
    at: evening,
  });
  assert.equal(res.day, '2026-08-12', 'an evening turn filed under the wrong day');
  assert.equal(res.day, log.localDay(evening));
  // The guard only means something where local and UTC actually differ; where they do, they must
  // disagree, and the local one must win.
  const utcDay = evening.toISOString().slice(0, 10);
  if (utcDay !== '2026-08-12') {
    assert.notEqual(res.day, utcDay, 'the note was filed by UTC date');
  }
  ok();
}

// ---- 4. A secret is redacted, and the turn is STILL kept ----
// Unlike the fact vault (which refuses the write outright), losing the turn would lose the context
// that is the entire point. So the key goes and the conversation stays.
{
  const res = log.appendTurn({
    question: 'is sk-ant-api03-AAAABBBBCCCCDDDDEEEEFFFF still the key on the metered account',
    answer: 'That one is retired. The live key is ghp_AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH0000 — rotate it.',
    at: at(2026, 8, 12, 15, 0, 0),
  });
  assert.ok(res.written, 'a turn containing a secret was dropped entirely');
  assert.equal(res.redacted, true, 'the redaction was not reported');
  const body = fs.readFileSync(res.file, 'utf8');
  assert.ok(!/sk-ant-api03-AAAABBBB/.test(body), 'an Anthropic key was written into the vault');
  assert.ok(!/ghp_AAAABBBB/.test(body), 'a GitHub token was written into the vault');
  assert.match(body, /\[redacted\]/, 'the secret was removed without a marker');
  assert.match(body, /still the key on the metered account/, 'the surrounding turn was lost with the secret');
  ok();
}

// ---- 5. What went in comes back out, as turns ----
{
  const turns = log.readDay('2026-08-12');
  assert.equal(turns.length, 4, `expected 4 turns, parsed ${turns.length}`);
  assert.equal(turns[0].time, '14:32:07', 'turns are not in the order they happened');
  assert.match(turns[0].question, /how many videos are staged/);
  assert.match(turns[0].answer, /Nine staged/);
  assert.equal(turns[0].label, 'standard · claude-sonnet-4-6', 'the tier/model stamp was lost');
  assert.equal(log.readDay('2019-01-01').length, 0, 'a day with no note is not empty');
  ok();

  // A speaker's own markdown must not split one turn into two. `## ` at the start of a line inside
  // an answer is the block delimiter this format is built on.
  const tricky = log.appendTurn({
    question: 'paste me the heading you used',
    answer: 'It was:\n\n## Escalation Trigger\n\nfollowed by the three bullets. Nothing else changed in that section.',
    at: at(2026, 8, 12, 16, 0, 0),
  });
  assert.ok(tricky.written);
  const back = log.readDay('2026-08-12');
  assert.equal(back.length, 5, 'a "## " line inside an answer split the turn in two');
  assert.match(back[4].answer, /^It was:/, 'the answer lost its opening line');
  assert.match(back[4].answer, /## Escalation Trigger/, 'the escaped heading did not survive the round trip');
  ok();
}

// ---- 6. Recall reaches back across DAYS, newest first ----
{
  log.appendTurn({
    question: 'what did we decide about the Apollo plan',
    answer: 'Go annual or churn it — three charges in three days and a failed card is not a plan working.',
    at: at(2026, 8, 11, 9, 15, 0),
  });
  const from = at(2026, 8, 12, 17, 0, 0);
  const recent = log.recentTurns({ days: 7, limit: 10, from });
  assert.ok(recent.length >= 6, `expected turns across both days, got ${recent.length}`);
  assert.equal(recent[0].day, '2026-08-12');
  assert.equal(recent[0].time, '16:00:00', 'recall did not start from the newest turn');
  assert.ok(recent.some((t) => t.day === '2026-08-11'), 'recall never reached yesterday');
  ok();
}

// ---- 7. Recall is BOUNDED ----
// An unbounded recall puts the whole month into every prompt and routes cheap questions to expensive
// tiers — the exact cost rule this is supposed to respect (RULES R1).
{
  const from = at(2026, 8, 12, 17, 0, 0);
  const block = log.recallBlock('which video is closest to done', { from });
  assert.ok(block, 'recall produced nothing at all');
  assert.ok(block.length <= 1800 + 400, `recall block is ${block.length} chars — unbounded`);
  assert.ok((block.match(/Ahmad:/g) || []).length <= 8, 'recall put more than a handful of turns in the prompt');
  assert.match(block, /Obsidian vault/, 'the model is not told where this context came from');
  ok();

  // A turn already in the live session must not be repeated: the caller renders those itself, and
  // paying tokens to say the same thing twice reads as an echo.
  const dupe = log.recallBlock('which video is closest to done', {
    from,
    exclude: [{ role: 'user', content: 'and which one is closest to done' }],
  });
  assert.ok(!/and which one is closest to done/i.test(dupe),
    'recall repeated a turn that is already in the live session');
  ok();

  // Nothing logged → nothing added to the prompt. An empty preamble is still tokens.
  const empty = log.recallBlock('anything at all', { from: at(2019, 1, 1, 12, 0, 0) });
  assert.equal(empty, '', 'recall emitted a header with no turns under it');
  ok();
}

// ---- 8. "that conversation where we discussed X" — findable past the recent window ----
{
  log.appendTurn({
    question: 'what is the story with the MERX account gate on the Toronto managed services notice',
    answer: 'MERX needs an interactive login; the notice cannot be classified until you sign in once in Chrome.',
    at: at(2026, 6, 20, 11, 0, 0),
  });
  const from = at(2026, 8, 12, 17, 0, 0);
  const hits = log.searchTurns('MERX account gate', { days: 90, from });
  assert.ok(hits.length, 'an older conversation on a named topic was not findable');
  assert.match(hits[0].question, /MERX/);
  assert.equal(hits[0].day, '2026-06-20', 'search returned the wrong conversation');
  ok();

  // …and a topical question pulls it into the prompt even though it is outside the recent window.
  const block = log.recallBlock('remind me about the MERX account gate', { from, days: 7, searchDays: 90 });
  assert.match(block, /MERX/, 'the matching older conversation was not recalled');
  ok();

  // A question about nothing in the log must not drag in an unrelated turn.
  assert.equal(log.searchTurns('reseller margin on Synology NAS hardware', { days: 90, from }).length, 0,
    'search matched a conversation that shares no terms with the question');
  ok();
}

// ---- 9. Junk is not logged ----
{
  assert.equal(log.appendTurn({ question: '', answer: 'something' }).written, false);
  assert.equal(log.appendTurn({ question: 'a real question here', answer: '' }).written, false);
  assert.equal(log.appendTurn({ question: 'a real question here', answer: '   ' }).reason, 'no-answer');
  ok();
}

// ---- 10. Stats, for the worker's startup line ----
{
  const s = log.conversationStats({ days: 90, from: at(2026, 8, 12, 18, 0, 0) });
  assert.equal(s.available, true);
  assert.equal(s.days, 3, `expected 3 day notes, counted ${s.days}`);
  assert.ok(s.turns >= 7, `expected the turns written above, counted ${s.turns}`);
  ok();
}

fs.rmSync(tmp, { recursive: true, force: true });

// ---- 11. The default location is git-ignored ----
// The log holds private operating conversation. The one property that makes it safe to write into
// the repo tree is that `aria-vault/` is ignored — the day that rule goes, every conversation Ahmad
// has had becomes publishable by an ordinary `git add -A`.
{
  const def = path.relative(root, path.join(root, 'aria-vault'));
  assert.equal(def, 'aria-vault', 'sanity: the default vault is not the in-repo ARIA vault');
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  const ignoresVault = ignore.split(/\r?\n/).map((l) => l.trim())
    .some((l) => l === 'aria-vault/' || l === 'aria-vault' || l === '/aria-vault/' || l === '/aria-vault');
  assert.ok(ignoresVault,
    'aria-vault/ is no longer git-ignored — the AXIS conversation log would become committable');
  ok();
}

// ---- 12. The worker actually writes it, and actually reads it back ----
// A log nothing writes is an empty folder; a log nothing reads is a diary. Both halves are the ask.
{
  const w = fs.readFileSync(path.join(root, 'scripts', 'axis-brain-worker.mjs'), 'utf8');
  assert.ok(w.includes("from './lib/axis-conversation-log.mjs'"), 'worker does not load the conversation log');
  assert.ok(/convoLog\.appendTurn\(/.test(w), 'worker never writes a turn to the conversation log');
  assert.ok(/convoLog\.recallBlock\(/.test(w), 'worker never reads the conversation log back');
  ok();

  // Recall has to reach the PROMPT. Asserted structurally rather than by line number: the variable
  // must be pushed into the pieces that build the prompt, in the same function that builds it.
  const fn = w.slice(w.indexOf('async function answerQuestion'), w.indexOf('function askClaudeIn'));
  assert.ok(fn.includes('convoLog.recallBlock('), 'recall is not resolved where the prompt is built');
  assert.ok(/pieces\.push\(recall\)/.test(fn), 'recall is computed but never put into the prompt');
  // …and it must be read BEFORE the model is called, not after.
  const iRecall = fn.indexOf('convoLog.recallBlock(');
  const iAsk = fn.indexOf('await askClaude(prompt', iRecall);
  assert.ok(iRecall > 0 && iAsk > iRecall, 'the model is called before the conversation log is read');
  ok();

  // The live session must sit CLOSER to the question than the log. Reversed, the model answers the
  // log instead of the turn Ahmad is actually in.
  assert.ok(fn.indexOf('pieces.push(recall)') < fn.indexOf('pieces.push(convo)'),
    'the historical log is rendered after the live session — the model would answer the log');
  ok();

  // Every ANSWERED turn is logged, including the vault-tier ones that never touch the plan. Anchored
  // on the branch that handles an answer, so moving the call inside that branch is fine and dropping
  // it is not.
  const branch = w.slice(w.indexOf('if (res.answer) {'), w.indexOf('async function sweep'));
  assert.ok(branch.includes('convoLog.appendTurn('),
    'the answered-turn path does not log the conversation');
  assert.ok(!/res\.tier\s*===\s*'vault'\s*\?\s*null\s*:\s*convoLog\.appendTurn/.test(branch),
    'vault-tier answers are excluded from the log — they are conversations too');
  ok();
}

console.log(`axis-conversation-log: ${n} checks passed`);
