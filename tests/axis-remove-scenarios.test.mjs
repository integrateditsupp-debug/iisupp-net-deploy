// axis-remove-scenarios.test.mjs — the 2026-08-12 afternoon transcript, replayed until it executes.
//
// The worker log, verbatim, between 12:15 and 15:16:
//   "okay you can remove all those from our to-do list"        → escalated fast→standard→deep → failed: timeout
//   "all right remove all these items from the to-do list"     → 69s of opus, an answer about removing, nothing removed
//   "remove it"                                                → answered by haiku, nothing removed
//   "remove all those 3 items from queued and do to list"      → failed: timeout
// Every one of those is an ORDER, and every one was spent on a model that cannot click. This suite
// locks the rails that route them to execution instead:
//   1. the exact transcript phrasings — including bare anaphora and STT garble — land on board.remove,
//   2. every verb the board DECLINES to answer has somewhere to land (decline ≠ re-route to chat),
//   3. the utterance decides WHICH rows go: "remove Acme Dental" is one cancellation, never four,
//   4. a recognised command with no rail gets one honest sentence, not a model round trip,
//   5. the escalation ladder's upper rungs get clocks they can actually finish under.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectOp } from '../assets/axis-persona.js';
import { localAnswer, resolveRemovalTargets, unsupportedBoardCommand } from '../assets/axis-priorities.js';
import { applyAxisV2Intents, V2_SCHEMA } from '../scripts/lib/axis-intent-apply.mjs';
import { MAX_TOUCHES } from '../scripts/lib/followups.mjs';
import { TIERS } from '../scripts/lib/axis-model-router.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ok = (m) => console.log('  ok —', m);

// ---- 1. The transcript phrasings that failed today all land on board.remove ----
for (const [say, why] of [
  ['okay you can remove all those from our to-do list', 'the 13:0x timeout, verbatim'],
  ['remove all those 3 items from queued and do to list', 'the 15:16 timeout, verbatim — STT garbled "to-do" into "do to"'],
  ['remove it', 'bare anaphora — the answer that removed nothing'],
  ['delete those', 'bare anaphora, plural'],
  ['clear all', 'bare "all" with no board noun'],
  ['cancel the follow-ups for Acme', 'cancel — a verb the board declines that had NO op to land on'],
  ['archive the overdue items', 'archive, same dead zone'],
  ['wipe the board', 'wipe, same dead zone'],
  ['purge the queue', 'purge, same dead zone'],
  ['cancel that queued task', 'the queued-task phrasing from the complaint'],
  ['take the first one off the list', 'split "take … off" — the adjacent-only form never matched real speech'],
  ['could you remove the overdue follow-ups', 'a polite modal is an order, not a question'],
]) {
  const op = detectOp(say);
  assert.ok(op && op.kind === 'board.remove', `${why}: expected board.remove, got ${op && op.kind}`);
  assert.ok(/confirm/i.test(op.confirm), `${why}: removal is read back for a spoken confirm`);
  assert.equal(localAnswer(say, { followups: { data: { overdue: [{ id: 1, business_id: 1, company: 'X', due_at: Date.now() }] } } }), null,
    `${why}: the board must decline the command, not recite an item`);
}
ok('every failed transcript phrasing now routes to board.remove and declines the board');

// ---- 2. Questions stay questions; repo work stays with Claude Code ----
for (const q of [
  'what is overdue',
  'should we remove the paywall from the site',
  'do we have anything overdue',
  'what should I take away from this meeting',
  'did you remove the items from the list',
]) assert.equal(detectOp(q), null, `a question must never become an op: "${q}"`);
for (const s of ['remove the debug logging from the axis-app script', 'delete the failing test file']) {
  const op = detectOp(s);
  assert.ok(op && op.kind === 'code.build', `a repo edit stays code.build: "${s}" got ${op && op.kind}`);
}
ok('questions and repo edits are untouched by the wider removal net');

// ---- 3. The utterance decides WHICH rows go ----
const rows = [
  { title: 'Acme Dental', fid: 1, bid: 11 },
  { title: 'Bright Smiles Ortho', fid: 2, bid: 22 },
  { title: 'Accounting Plus Business Services', fid: 3, bid: 33 },
  { title: 'Northshore Vet Clinic', fid: 4, bid: 44 },
];
const cases = [
  ['all those', 'all', 4, 'the transcript "all"'],
  ['', 'all', 4, 'no arg means everything, the pre-fix behaviour, now explicit'],
  ['all those 3 items', 'count', 3, '"the three items you just mentioned" — top three, board order'],
  ['Acme Dental', 'named', 1, 'ONE named item is ONE cancellation'],
  ['the follow-ups for Acme', 'named', 1, 'name embedded in filler still resolves'],
  ['accounting plus', 'named', 1, 'partial name, case-insensitive'],
  ['the first one', 'ordinal', 1, 'ordinal → that row alone'],
  ['the last one', 'ordinal', 1, '"one" is a pronoun here, not a count'],
  ['those two', 'count', 2, 'spoken number words'],
  ['Zebra Corp', 'none', 0, 'an unmatched name must NEVER widen to everything'],
];
for (const [arg, mode, n, why] of cases) {
  const r = resolveRemovalTargets(arg, rows);
  assert.equal(r.mode, mode, `${why}: mode ${r.mode} ≠ ${mode} for "${arg}"`);
  assert.equal(r.targets.length, n, `${why}: ${r.targets.length} targets ≠ ${n} for "${arg}"`);
}
assert.equal(resolveRemovalTargets('the first one', rows).targets[0].fid, 1, 'ordinal indexes board order');
assert.equal(resolveRemovalTargets('the last one', rows).targets[0].fid, 4, 'last resolves to the final row');
ok('named beats ordinal beats count beats all — and an unmatched name removes nothing');

// ---- 4. Targeted cancel, end to end against the real schema: the named business goes, the other stays ----
process.env.AXIS_DB_PATH = ':memory:';
const { openDb } = await import('../scripts/lib/axis-db.mjs');
const db = openDb();
const now = Date.now();
// Both sent items are inserted BEFORE either delegate runs: the delegate path autoincrements new
// draft rows at max(id)+1, so interleaving explicit ids with delegates collides on the second seed.
for (const [id, name] of [[1, 'Acme Dental'], [2, 'Bright Smiles Ortho']]) {
  db.prepare("INSERT INTO businesses (id,handle,name,public_email,is_real,created_at) VALUES (?,?,?,?,1,?)")
    .run(id, 'Lead-00' + id, name, 'ops@' + id + '.test', now);
  db.prepare(`INSERT INTO outreach_items (id,business_id,channel,kind,subject,body,to_email,status,created_at,sent_at)
    VALUES (?,?,'email','initial','s','b',?,'sent',?,?)`).run(10 + id, id, 'ops@' + id + '.test', now, now - 86400000);
}
for (const id of [1, 2]) {
  const r = applyAxisV2Intents(db, [{ id: 'ccv2-seed-' + id, schema: V2_SCHEMA, type: 'delegate_followup',
    payload: { business_id: id, outreach_item_id: 10 + id } }]);
  assert.equal(r.applied.length, 1, `cadence seeded for business ${id}`);
}
assert.equal(db.prepare("SELECT COUNT(*) n FROM follow_ups WHERE status='scheduled'").get().n, 2 * MAX_TOUCHES);

// The board rows as the console sees them, resolved exactly the way axisRunOp resolves them —
// and cancelled the way it posts them: ONE business-level intent per named company. A chase is
// several scheduled touches and the board shows only the next; cancelling by follow_up_id alone
// leaves the later touches scheduled and the "removed" item resurfaces days later.
const board = db.prepare(
  "SELECT f.id fid, f.business_id bid, b.name title FROM follow_ups f JOIN businesses b ON b.id=f.business_id WHERE f.status='scheduled' GROUP BY f.business_id").all();
const picked = resolveRemovalTargets('Acme Dental from my to-do list', board);
assert.equal(picked.mode, 'named');
assert.equal(picked.targets.length, 1);
const r2 = applyAxisV2Intents(db, picked.targets.map((t, i) => ({ id: 'ccv2-cancel-' + i, schema: V2_SCHEMA,
  type: 'cancel_followup', payload: { business_id: t.bid } })));
assert.equal(r2.applied.length, 1, 'the named cancellation applies');
assert.equal(r2.applied[0].cancelled, MAX_TOUCHES, 'the WHOLE chase goes, not just the visible touch');
assert.equal(db.prepare("SELECT COUNT(*) n FROM follow_ups WHERE business_id=1 AND status='scheduled'").get().n, 0,
  'Acme Dental: gone from the schedule');
assert.equal(db.prepare("SELECT COUNT(*) n FROM follow_ups WHERE business_id=2 AND status='scheduled'").get().n, MAX_TOUCHES,
  'Bright Smiles: UNTOUCHED — removing one name must never empty the board');
db.close();
ok('named removal cancels the named company\'s whole chase and nothing else, proven against the real schema');

// ---- 5. A recognised command with no rail gets one honest sentence, not a model round trip ----
for (const s of [
  'okay can you open up all the prioritized items so we can action it',   // 19s of model time today
  'mark that one done',
  'snooze this for a week',
  'approve the first one',
  'move it to the top',
]) {
  assert.equal(detectOp(s), null, `no op pretends to handle: "${s}"`);
  assert.ok(unsupportedBoardCommand(s), `but it is recognised as a board command: "${s}"`);
}
for (const q of ['do we have anything overdue', 'what needs me today', 'open the reports for me please'])
  assert.ok(!unsupportedBoardCommand(q), `a question or non-board ask is not claimed: "${q}"`);
const app = read('assets/axis-app.js');
assert.ok(/unsupportedBoardCommand\(text\)/.test(app), 'the console consults the detector in axisSend');
assert.ok(app.indexOf('unsupportedBoardCommand(text)') < app.indexOf("fetch('/.netlify/functions/axis-director'"),
  'the honest decline sits BEFORE the director fetch — these must never reach the model');
ok('unrailed board commands answer honestly in 0ms instead of buying a model round trip');

// ---- 6. The escalation ladder can actually finish, and the console waits for it ----
assert.ok(TIERS.every((t) => typeof t.timeoutMs === 'number' && t.timeoutMs > 0), 'every tier carries its own clock');
for (let i = 1; i < TIERS.length; i++)
  assert.ok(TIERS[i].timeoutMs > TIERS[i - 1].timeoutMs,
    `${TIERS[i].name} must get more time than ${TIERS[i - 1].name} — capping opus at haiku's budget is how "failed: timeout" happened`);
const worker = read('scripts/axis-brain-worker.mjs');
assert.ok(/timeoutMs:\s*tier\.timeoutMs/.test(worker), 'the worker hands each rung its own clock');
assert.ok(/tries > 90/.test(app), 'axisCollect polls long enough for an escalated answer to arrive');
assert.ok(/await postIntent\('cancel_followup'/.test(app),
  'cancellations are awaited — "Queued 3" must count what actually queued, not what was attempted');
ok('per-tier clocks rise up the ladder, the worker uses them, the console waits and counts honestly');

console.log('axis-remove-scenarios test passed (transcript phrasings execute · targeting is exact · unmatched names remove nothing · unrailed commands decline honestly · the ladder finishes).');
