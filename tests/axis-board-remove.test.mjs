// axis-board-remove.test.mjs — "remove these items" must remove items, not recite them.
//
// The 2026-08-12 transcript, verbatim: Ahmad said "all right remove all these items from the to-do
// list", then "remove the items that are in priority list", then "work with Claude cowork to remove
// the three priority items you just mentioned" — and AXIS answered "Next up is Accounting Plus
// Business Services, 29 days overdue. It is queued → Approvals." twice, because the word "priority"
// was enough for the board's question-answerer to claim the sentence, and no code path could cancel
// a follow-up anyway. This locks all three legs of the fix:
//   1. the board declines commands (they are not questions),
//   2. the voice grammar routes removal to a real op,
//   3. cancel_followup actually cancels — schedule row and its pending Approvals draft together.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { localAnswer } from '../assets/axis-priorities.js';
import { detectOp } from '../assets/axis-persona.js';
import { applyAxisV2Intents, V2_HANDLERS, V2_SCHEMA } from '../scripts/lib/axis-intent-apply.mjs';
import { MAX_TOUCHES } from '../scripts/lib/followups.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ok = (m) => console.log('  ok —', m);

// A board with one overdue follow-up — the exact shape that produced "Next up is …".
const snap = { followups: { data: { overdue: [
  { id: 7, business_id: 1, company: 'Accounting Plus Business Services', due_at: Date.now() - 29 * 86400000 },
] } } };

// ---- 1. Commands are declined by the board, questions still answered ----
for (const cmd of [
  'all right remove all these items from the to-do list',
  'remove the items that are in priority list',
  'work with claude cowork to remove the three priority items you just mentioned',
  'clear the overdue follow-ups',
]) assert.equal(localAnswer(cmd, snap), null, `a command must fall through, got an answer for: "${cmd}"`);
assert.ok(/Next up is Accounting Plus/.test(localAnswer('what is the next priority', snap)),
  'a genuine question about the board is still answered locally, for free');
assert.ok(/overdue/.test(localAnswer('what is overdue', snap)), 'status questions still answered');
ok('the board answers questions and declines commands');

// ---- 2. The voice grammar routes removal to board.remove — even when Cowork is named ----
for (const [say, why] of [
  ['remove the items that are in priority list', 'the transcript phrasing'],
  ['all right remove all these items from the to-do list', 'the to-do phrasing'],
  ['work with claude cowork to remove the three priority items you just mentioned', 'naming Cowork must not divert a removal to a read-only Q&A'],
  ['clear the overdue follow-ups', 'the literal phrasing'],
]) {
  const op = detectOp(say);
  assert.ok(op && op.kind === 'board.remove', `${why}: expected board.remove, got ${op && op.kind}`);
  assert.ok(/confirm/i.test(op.confirm), 'removal is read back for a spoken confirm first');
  assert.ok(/approvals stay yours/i.test(op.confirm), 'the confirm says approvals are not touched');
}
// Questions about priorities are NOT removals, and code.build must not swallow board removals.
assert.equal(detectOp('what should I remove from the priority list'), null, 'a question is never an op');
assert.notEqual((detectOp('remove the stale test file from the repo') || {}).kind, 'board.remove',
  'a repo edit is not a board removal');
ok('removal lands on board.remove, confirmed out loud, approvals excluded');

// ---- 3. cancel_followup cancels the schedule row AND its pending Approvals draft ----
process.env.AXIS_DB_PATH = ':memory:';
const { openDb } = await import('../scripts/lib/axis-db.mjs');
const db = openDb();
db.prepare("INSERT INTO businesses (id,handle,name,public_email,is_real,created_at) VALUES (1,'Lead-001','Acme Dental','ops@acme.test',1,?)").run(Date.now());
db.prepare(`INSERT INTO outreach_items (id,business_id,channel,kind,subject,body,to_email,status,created_at,sent_at)
  VALUES (10,1,'email','initial','s','b','ops@acme.test','sent',?,?)`).run(Date.now(), Date.now() - 20 * 86400000);
const entry = (type, payload) => ({ id: 'ccv2-' + type + '-' + Math.random().toString(36).slice(2, 6), schema: V2_SCHEMA, type, payload });

// Seed a real cadence through the existing delegate path, then cancel it by voice.
let r = applyAxisV2Intents(db, [entry('delegate_followup', { business_id: 1, outreach_item_id: 10 })]);
assert.equal(r.applied.length, 1, 'seed cadence scheduled');
assert.equal(db.prepare("SELECT COUNT(*) n FROM follow_ups WHERE status='scheduled'").get().n, MAX_TOUCHES);

r = applyAxisV2Intents(db, [entry('cancel_followup', { business_id: 1 })]);
assert.equal(r.applied.length, 1, 'cancel_followup applies');
assert.equal(r.applied[0].cancelled, MAX_TOUCHES, 'every scheduled row cancelled');
assert.equal(db.prepare("SELECT COUNT(*) n FROM follow_ups WHERE status='scheduled'").get().n, 0,
  'nothing left on the board — the rows Ahmad asked to remove are gone');
assert.equal(db.prepare("SELECT COUNT(*) n FROM outreach_items WHERE kind='followup' AND status='pending'").get().n, 0,
  'the pending Approvals drafts for a cancelled chase are cancelled too, not left to jam the queue');
assert.equal(db.prepare("SELECT status FROM outreach_items WHERE id=10").get().status, 'sent',
  'sent history is never touched — removal is not deletion of the record of what happened');

// Stale re-cancel is a no-op, not an error; garbage is rejected with a reason.
r = applyAxisV2Intents(db, [entry('cancel_followup', { business_id: 1 })]);
assert.equal(r.rejected.length, 1, 'no scheduled rows left → rejected with a reason, never a throw');
r = applyAxisV2Intents(db, [entry('cancel_followup', {})]);
assert.ok(r.rejected.length === 1 && /required/.test(r.rejected[0].reason), 'empty payload rejected');
db.close();
ok('cancel_followup: schedule + pending draft cancelled, history untouched, garbage rejected');

// ---- 4. Wiring: every end of the loop stays connected (each broke silently once) ----
assert.ok(Object.keys(V2_HANDLERS).includes('cancel_followup'), 'handler table exposes cancel_followup');
assert.ok(read('netlify/functions/axis-intent.mjs').includes("'cancel_followup'"), 'endpoint knows the type');
assert.ok(read('assets/axis-app.js').includes("postIntent('cancel_followup'"), 'the console posts it on board.remove');
assert.ok(/board:\s*axisBoardContext\(\)/.test(read('assets/axis-app.js')), 'the console sends the board with chat and tasks');
assert.ok(/askBrain\(\{ query: askText, turns, board/.test(read('netlify/functions/axis-director.js')),
  'the director hands the conversation to the cascade instead of collapsing it to one string');
assert.ok(/turns: sanitizeTurns\(body\.turns\)/.test(read('netlify/functions/axis-brain-queue.mjs')),
  'the queue carries sanitized turns to the worker');
const worker = read('scripts/axis-brain-worker.mjs');
assert.ok(/conversationBlock\(turns, board\)/.test(worker) && /conversationBlock\(task\.turns, task\.board\)/.test(worker),
  'the worker renders the conversation into both Q&A and Cowork/Code prompts');
// Phase 1 (2026-08-13) added one guard in front of the same gate: an answer the availability
// claim-guard had to correct is never banked either (`!contradicted &&`). Same rail, one more
// reason to refuse.
assert.ok(/\(!contradicted && worthLearning\(query, res\.answer\)\)\s*\?\s*vault\.learn/.test(worker),
  'the vault write-back is gated — a clarifying question must never be banked as knowledge');
ok('client → endpoint → queue → worker wiring intact, vault write-back gated');

console.log('axis-board-remove test passed (commands decline the board · board.remove routes and confirms · cancel_followup cancels schedule + draft · wiring and learn-gate intact).');
