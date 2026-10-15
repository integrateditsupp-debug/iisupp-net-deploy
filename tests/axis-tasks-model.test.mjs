// tests/axis-tasks-model.test.mjs — RUN-AX3 (2026-10-15): the ONE live task list and every mutation on it.
//
// Ahmad: "AXIS cannot see the live task view … Fix this issue so it can view everything … and edit, adjust,
// modify, remove, delete, update, action, follow up, reject, approve, cancel, acknowledge, reply, etc."
// netlify/functions/lib/axis-tasks.cjs, run against an in-memory Blobs store. Fails the moment a source drops
// off the list, an id stops being stable, a "delete" destroys a record, a mutation goes unaudited, a sending
// approval is executed from chat, a store that did not answer reads as an empty list, or the situation model
// ranks a row the overlay took out. No network, no node_modules beyond the repo's own.
// Run: node tests/axis-tasks-model.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createMemoryBlobs, envelope } from './lib/axis-memory-store.mjs';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const T = require(path.join(ROOT, 'netlify/functions/lib/axis-tasks.cjs'));
const IDS = require(path.join(ROOT, 'netlify/functions/lib/axis-task-ids.cjs'));
const S = require(path.join(ROOT, 'netlify/functions/lib/axis-situation.cjs'));
const L = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/axis-ceo-ledger.mjs')).href);
const P = await import(pathToFileURL(path.join(ROOT, 'assets/axis-priorities.js')).href);
let groups = 0; const ok = () => { groups++; };

// Thursday 2026-10-15, 10:00 in Toronto.
const NOW = new Date('2026-10-15T14:00:00Z');
const at = (iso) => new Date(iso);
// A functions dir of our own: the program state file names one failed agent; nothing is read from the repo's.
const FN_DIR = makeScratchDir('axis-tasks-model-');
fs.writeFileSync(path.join(FN_DIR, '_axis-state-full.json'), JSON.stringify({ agents: [{ name: 'Scout', status: 'failed', note: 'no token' }, { name: 'Pitch', status: 'ok' }] }));

const LEDGER = [
  { ref: '#1', n: 1, section: 'open', what: 'Answer the HEC IT-RFP question', who: "the agency's desk", deadline: '2026-10-09T16:00:00.000Z', category: 'deadline-14d', one_click: null, status: 'OVERDUE', overdue: true, closed: false, cleared: false },
  { ref: '#5', n: 5, section: 'open', what: 'Fix the Apollo payment method', who: 'enrichment, outbound', deadline: null, category: 'payment', one_click: 'Apollo billing page', status: 'open', overdue: false, closed: false, cleared: false },
  { ref: '#9', n: 9, section: 'open', what: 'Suite-census 14-day clock', who: 'the test programme', deadline: '2026-10-23T03:59:00.000Z', category: 'deadline-14d', one_click: null, status: 'cleared 2026-10-09', overdue: false, closed: false, cleared: true },
  { ref: 'watch', n: 1, section: 'watch', what: 'CDIC RFSA closes 2026-10-29', who: '', deadline: '2026-10-30T03:59:00.000Z', soft_date: '2026-10-15', category: 'watch', one_click: null, status: 'watch', overdue: false, closed: false, cleared: false },
];
function seed(mem) {
  mem.reset();
  mem.put('axis-exec', 'todos', [
    { id: 'todo-a', title: 'Sign the Whereby cancel', priority: 'high', needsYou: true, note: 'your signature', done: false, created_at: '2026-10-10T00:00:00Z' },
    { id: 'todo-b', title: 'Draft Q4 newsletter', priority: 'normal', needsYou: false, note: '', done: false, created_at: '2026-10-11T00:00:00Z' },
  ]);
  mem.put('axis-exec', 'tasks', [
    { id: 'task-ok', title: 'Nightly backup check', instructions: 'check backups', every_minutes: 1440, status: 'active', runs: 12, last_result: { summary: 'ok' } },
    { id: 'task-bad', title: 'Apollo refresh', instructions: 'refresh leads', every_minutes: 60, status: 'active', runs: 3, last_result: { error: 'card declined' } },
  ]);
  mem.put('axis-exec', 'approvals', [
    { id: 'apr-spend', kind: 'spend', title: 'Buy domain iisupport.ca', detail: 'registrar', costUsd: 12, status: 'pending', created_at: '2026-10-14T00:00:00Z' },
    { id: 'apr-reply', kind: 'reply', title: 'Reply to Acme: quote', detail: 'pricing question', costUsd: 0, payload: { mailbox: 'ahmad.wasee@iisupp.net', to: 'ceo@acme.example', subject: 'Re: quote', text: 'Thanks — here it is.' }, status: 'pending', created_at: '2026-10-14T01:00:00Z' },
    { id: 'apr-free', kind: 'decision', title: 'Keep the Friday digest', detail: 'no cost', costUsd: 0, status: 'pending', created_at: '2026-10-14T02:00:00Z' },
  ]);
  mem.put('axis-exec', 'followups', [{ id: 'fu-1', parent: 'todo:todo-a', parentTitle: 'Sign the Whereby cancel', title: 'Follow up: Whereby — confirm the refund', note: 'confirm', due: '2026-10-20T13:00:00.000Z', owner: 'ahmad', status: 'open', created_at: '2026-10-14T00:00:00Z' }]);
  mem.put('axis-exec', 'workspace', []);
  mem.put('axis-exec', 'local-jobs', [
    { id: 'job-cmd', kind: 'command', title: 'Clear the print queue', instructions: 'net stop spooler', status: 'needs_approval', created_at: '2026-10-15T12:00:00Z' },
    { id: 'job-q', kind: 'claude', title: 'Build the proposal', instructions: 'proposal', status: 'queued', created_at: '2026-10-15T12:00:00Z' },
  ]);
  mem.put('axis-snapshots', 'overview', envelope('overview', { kpis: { pipeline_value: 68000, mrr: 1200 }, needs_you_now: [], ceo_critical: LEDGER }));
  mem.put('axis-snapshots', 'followups', envelope('followups', { overdue: [{ id: 7, business_id: 1, company: 'Acme Dental', due_at: Date.parse('2026-10-12T13:00:00Z'), status: 'scheduled', outreach_item_id: 70 }], due_today: [], upcoming: [{ id: 8, business_id: 2, company: 'Bright Smiles', due_at: Date.parse('2026-10-20T13:00:00Z'), status: 'scheduled' }], auto_cancelled: [] }));
  mem.put('axis-snapshots', 'approvals', envelope('approvals', { rows: [{ id: 99, channel: 'email', kind: 'initial', subject: 'Intro to Lead-007', status: 'pending', business_id: 3, created_at: Date.parse('2026-10-13T00:00:00Z') }, { id: 98, subject: 'old one', status: 'approved' }] }));
  mem.put('axis-snapshots', 'inbox', envelope('inbox', { rows: [{ id: 41, thread_id: 't41', classification: 'reply_to_outreach', subject: 'Re: network audit quote', from_email: 'it@bay.example', received_at: '2026-10-14T15:00:00Z', actioned: false, snippet: 'send the plan', suggested_reply: { subject: 'Re: network audit quote', body: 'Hi —' } }, { id: 42, classification: 'noise', subject: 'newsletter' }] }));
  mem.put('axis-snapshots', 'documents', envelope('documents', { rows: [{ id: 'd1', type: 'proposal', title: 'Proposal — 141 Bay', status: 'draft', due_at: '2026-10-16T16:00:00Z' }, { id: 'd2', title: 'Sent one', status: 'sent' }] }));
  mem.put('axis-snapshots', 'waiting_reply', envelope('waiting_reply', { count: 1, needs_delegation: 1, rows: [{ id: 501, business_id: 5, company: 'Cedar Clinic', subject: 'Intro', days_waiting: 21, touches_done: 3, next_action: 'delegate to Director', delegate: true }] }));
  mem.put('axis-brain-jobs', 'worker-heartbeat', { t: Date.now() });
  mem.put('axis-brain-jobs', 'done/q-fail', { id: 'q-fail', kind: 'code.build', arg: 'fix the flaky test', t: 2, error: 'exit 1' });
  mem.put('axis-brain-jobs', 'task/q-work', { id: 'q-work', kind: 'research.web', arg: 'grant scan', t: 3, picked: true });
}
const mem = createMemoryBlobs();
T._setGetStore(mem.getStore);
const list = (opts = {}) => T.listTasks({ now: NOW, fnDir: FN_DIR, ...opts });
const act = (action, id, fields = {}, extra = {}) => T.mutate({ now: NOW, fnDir: FN_DIR, action, id, fields, via: 'chat', ...extra });
const find = (L_, id) => (L_._all || L_.items).find((i) => i.id === id);
const fails = async (p, status, code) => { try { await p; } catch (e) { assert.equal(e.status, status, `${code}: status ${e.status} — ${e.message}`); if (code) assert.equal(e.code, code); return e; } assert.fail(`expected ${status} ${code}`); };

try {
  // ---- 1. One list over every source, every row with a stable id ----
  seed(mem);
  {
    const A = await list();
    assert.equal(A.ok, true);
    assert.deepEqual({ exec: A.sources.exec, board: A.sources.board, overlay: A.sources.overlay, audit: A.sources.audit, queue: A.sources.queue }, { exec: 'ok', board: 'live', overlay: 'ok', audit: 'ok', queue: 'ok' }, 'every store answered and says so');
    const expectIds = ['todo:todo-a', 'todo:todo-b', 'followup:fu-1', 'automation:task-ok', 'automation:task-bad', 'approval:apr-spend', 'approval:apr-reply', 'approval:apr-free',
      'pc:job-cmd', 'pc:job-q', 'ledger:#1', 'ledger:#5', 'ledger:#9', `ledger:watch-${IDS.hash8('CDIC RFSA closes 2026-10-29')}`, 'board-followup:7', 'board-followup:8', 'board-approval:99',
      'inbox:41', 'document:d1', 'waiting:501', 'job:q-fail', 'job:q-work', 'agent:Scout'];
    for (const id of expectIds) assert.ok(find(A, id), `the list carries ${id}`);
    for (const id of ['board-approval:98', 'inbox:42', 'document:d2', 'agent:Pitch']) assert.ok(!find(A, id), `${id} is not work (decided / noise / sent / healthy)`);
    // shape
    for (const i of A.items) {
      for (const k of ['id', 'source', 'kind', 'title', 'status', 'owner', 'actions']) assert.ok(k in i, `${i.id} has ${k}`);
      assert.ok(T.STATUSES.includes(i.status), `${i.id} status ${i.status} is one of the eight`);
      assert.ok(/^(ahmad|axis|agent:[A-Za-z]+)$/.test(i.owner), `${i.id} owner ${i.owner}`);
      assert.ok(Array.isArray(i.audit));
    }
    // the store says the status — never inferred
    assert.equal(find(A, 'ledger:#9').status, 'done', 'a ledger row stamped cleared reads done (the ledger said so)');
    assert.equal(find(A, 'automation:task-ok').owner, 'axis');
    assert.equal(find(A, 'automation:task-bad').owner, 'ahmad', 'a failing automation needs Ahmad');
    // ranking flags come from the situation model
    assert.equal(find(A, 'ledger:#1').needsMe, true, 'his overdue ledger row needs him');
    assert.equal(A.items[0].id, 'ledger:#1', 'and leads the list');
    assert.equal(find(A, 'todo:todo-b').axisHandling, true, 'a not-needs-you to-do is AXIS handling');
    assert.equal(find(A, 'job:q-work').axisHandling, true, 'a working worker job is AXIS handling');
    assert.deepEqual(find(A, 'job:q-work').actions, [], 'an in-flight worker job is view-only');
    assert.equal(find(A, 'board-followup:8').needsMe, false, 'an upcoming follow-up is on the list but not "needs you" yet');
    // counts agree with the filters
    for (const f of A.filters) assert.equal(f.count, T.filterItems(A.items, f.id).length, `filter ${f.id} count`);
    assert.equal(A.counts.needsMe, A.items.filter((i) => i.status === 'open' && i.needsMe).length);
    // stable: shuffle every store's order and rebuild — the same ids
    const shuffled = createMemoryBlobs();
    seed(shuffled);
    shuffled.put('axis-exec', 'todos', [...mem.read('axis-exec', 'todos')].reverse());
    shuffled.put('axis-exec', 'approvals', [...mem.read('axis-exec', 'approvals')].reverse());
    T._setGetStore(shuffled.getStore);
    const B = await list();
    T._setGetStore(mem.getStore);
    assert.deepEqual(B.items.map((i) => i.id).sort(), A.items.map((i) => i.id).sort(), 'ids do not depend on order');
    // rows without a store id still get a stable id (hash of their identifying fields)
    const noId = S.buildSituation({ now: NOW, snapshots: { inbox: { data: { rows: [{ classification: 'reply_to_outreach', subject: 'x', from: 'a', received_at: '2026-10-14' }] } } }, exec: { todos: [{ title: 'untitled id', needsYou: true }] } });
    const again = S.buildSituation({ now: NOW, snapshots: { inbox: { data: { rows: [{ classification: 'reply_to_outreach', subject: 'x', from: 'a', received_at: '2026-10-14' }] } } }, exec: { todos: [{ title: 'untitled id', needsYou: true }] } });
    assert.deepEqual(noId.needsAhmad.map((i) => i.id), again.needsAhmad.map((i) => i.id));
    assert.ok(noId.needsAhmad.every((i) => /^(inbox|todo):h-[0-9a-f]{8}$/.test(i.id)), 'hash ids for rows with no store id');
    // filter + query
    assert.ok((await list({ filter: 'approvals' })).items.every((i) => i.kind === 'approval' && i.status === 'open'));
    assert.deepEqual((await list({ filter: 'open', q: 'apollo payment' })).items.map((i) => i.id), ['ledger:#5']);
    ok();
  }

  // ---- 2. Every mutation, on every source ----
  seed(mem);
  {
    // to-do (assistant store): complete / reopen / update / snooze / follow up / assign / draft / archive
    let r = await act('complete', 'todo:todo-a');
    assert.equal(r.item.status, 'done'); assert.equal(mem.read('axis-exec', 'todos').find((t) => t.id === 'todo-a').done, true);
    assert.equal(r.receipt, '✔ Done: Sign the Whereby cancel');
    r = await act('reopen', 'todo:todo-a');
    assert.equal(r.item.status, 'open'); assert.equal(mem.read('axis-exec', 'todos').find((t) => t.id === 'todo-a').done, false);
    r = await act('update', 'todo:todo-a', { title: 'Sign the Whereby cancellation', due: 'friday', priority: 'normal', owner: 'ahmad' });
    const ta = mem.read('axis-exec', 'todos').find((t) => t.id === 'todo-a');
    assert.equal(ta.title, 'Sign the Whereby cancellation'); assert.equal(ta.due, '2026-10-17T03:59:00.000Z', 'a bare day is end of that Toronto day'); assert.equal(ta.priority, 'normal');
    assert.match(r.receipt, /^✎ Updated Sign the Whereby cancel: title Sign the Whereby cancellation, due Fri Oct 16/);
    r = await act('snooze', 'todo:todo-a', { until: 'monday' });
    assert.equal(r.item.status, 'snoozed'); assert.equal(r.item.snoozedUntil, '2026-10-19T13:00:00.000Z');
    assert.equal(r.receipt, '⏰ Snoozed Sign the Whereby cancellation to Mon Oct 19');
    r = await act('reopen', 'todo:todo-a');
    assert.equal(r.item.status, 'open', 'reopen clears a snooze');
    r = await act('follow_up', 'todo:todo-a', { when: '2026-10-21', note: 'chase the signature' });
    assert.ok(r.created && r.created.id.startsWith('followup:'), 'a follow-up item was created');
    assert.equal(r.created.parent, 'todo:todo-a', 'linked to its parent');
    assert.equal(r.created.due, '2026-10-21T13:00:00.000Z');
    assert.deepEqual(r.item.followUps, [r.created.id], 'the parent lists it');
    assert.match(r.receipt, /^🔁 Follow-up set for Sign the Whereby cancellation — Wed Oct 21$/);
    r = await act('assign', 'todo:todo-b', { agent: 'pitch' });
    assert.equal(r.item.owner, 'agent:Pitch'); assert.equal(mem.read('axis-exec', 'todos').find((t) => t.id === 'todo-b').needsYou, false);
    const cmd = mem.keys('axis-inbox', 'pending/axis-').map((k) => mem.read('axis-inbox', k)).find((e) => e.taskId === 'todo:todo-b');
    assert.ok(cmd && cmd.action === 'command' && cmd.agent === 'Pitch' && cmd.needsApproval === false && /Draft Q4 newsletter/.test(cmd.intent), 'assign queues the director\'s command shape to axis-inbox');
    r = await act('draft_reply', 'todo:todo-a', { text: 'Hi Whereby — please confirm the cancellation.' });
    const doc = mem.read('axis-exec', 'workspace')[0];
    assert.equal(doc.reply_for, 'todo:todo-a'); assert.equal(doc.status, 'draft'); assert.equal(doc.content, 'Hi Whereby — please confirm the cancellation.');
    assert.equal(r.item.draft.docId, doc.id, 'the row shows "draft ready"');
    assert.equal(r.receipt, '📝 Reply drafted for Sign the Whereby cancellation — your send');
    r = await act('archive', 'todo:todo-b');
    assert.equal(r.item.status, 'archived');

    // AXIS follow-up: complete / reopen / cancel / archive
    r = await act('complete', 'followup:fu-1'); assert.equal(mem.read('axis-exec', 'followups').find((f) => f.id === 'fu-1').status, 'done');
    r = await act('reopen', 'followup:fu-1'); assert.equal(r.item.status, 'open');
    r = await act('cancel', 'followup:fu-1'); assert.equal(r.item.status, 'cancelled');
    assert.equal(r.receipt, '⊘ Cancelled: Follow up: Whereby — confirm the refund');

    // automations: acknowledge the failing one, edit, cancel (pause), reopen, archive
    r = await act('acknowledge', 'automation:task-bad'); assert.equal(r.item.status, 'acknowledged');
    r = await act('update', 'automation:task-ok', { detail: 'check backups and the restore test' });
    assert.equal(mem.read('axis-exec', 'tasks').find((t) => t.id === 'task-ok').instructions, 'check backups and the restore test');
    r = await act('cancel', 'automation:task-ok'); assert.equal(mem.read('axis-exec', 'tasks').find((t) => t.id === 'task-ok').status, 'paused');
    r = await act('reopen', 'automation:task-ok'); assert.equal(mem.read('axis-exec', 'tasks').find((t) => t.id === 'task-ok').status, 'active');

    // assistant approvals — the gate: sending / spending is Ahmad's click
    r = await act('approve', 'approval:apr-reply');
    assert.equal(r.staged, true); assert.equal(r.needsClick, true);
    assert.equal(mem.read('axis-exec', 'approvals').find((a) => a.id === 'apr-reply').status, 'pending', 'asked by chat, a sending approval is NOT approved');
    assert.match(r.receipt, /^🖐 Your click: approve Reply to Acme: quote — it sends/);
    assert.deepEqual(r.item.staged && r.item.staged.action, 'approve', 'the row shows it is waiting for his click');
    r = await act('approve', 'approval:apr-spend', {}, { via: 'voice' });
    assert.equal(r.staged, true, 'a $12 spend asked by voice is staged too');
    assert.match(r.receipt, /commits \$12/);
    r = await act('approve', 'approval:apr-reply', {}, { via: 'console' });
    assert.equal(r.staged, undefined); assert.equal(mem.read('axis-exec', 'approvals').find((a) => a.id === 'apr-reply').status, 'approved', 'his console click approves (the cron sends — one place sends mail)');
    assert.equal(r.item.staged, null, 'the staged marker clears');
    r = await act('approve', 'approval:apr-free');
    assert.equal(mem.read('axis-exec', 'approvals').find((a) => a.id === 'apr-free').status, 'approved', 'a no-cost, no-send decision approves from chat');
    r = await act('reject', 'approval:apr-spend', { reason: 'not this quarter' });
    const sp = mem.read('axis-exec', 'approvals').find((a) => a.id === 'apr-spend');
    assert.equal(sp.status, 'declined'); assert.equal(sp.reason, 'not this quarter'); assert.equal(r.receipt, '✖ Rejected: Buy domain iisupport.ca');
    r = await act('archive', 'approval:apr-free'); assert.equal(r.item.status, 'archived', 'a decided approval can leave the list');

    // Axis Local: a command is his click; a queued job can be cancelled
    r = await act('approve', 'pc:job-cmd');
    assert.equal(r.staged, true, 'running a command on his PC is never approved from chat');
    assert.equal(mem.read('axis-exec', 'local-jobs').find((j) => j.id === 'job-cmd').status, 'needs_approval');
    r = await act('approve', 'pc:job-cmd', {}, { via: 'console' });
    assert.equal(mem.read('axis-exec', 'local-jobs').find((j) => j.id === 'job-cmd').status, 'queued');
    r = await act('cancel', 'pc:job-q');
    assert.equal(mem.read('axis-exec', 'local-jobs').find((j) => j.id === 'job-q').status, 'declined');

    // CEO ledger rows (his machine's file is never touched — the overlay is)
    r = await act('acknowledge', 'ledger:#1');
    assert.equal(r.item.status, 'acknowledged'); assert.ok(mem.read('axis-task-overlay', 'rows')['ledger:#1'].sig, 'the acknowledgement remembers the row it saw');
    r = await act('snooze', 'ledger:#5', { until: 'next week' });
    assert.equal(r.item.status, 'snoozed');
    r = await act('reopen', 'ledger:#5'); assert.equal(r.item.status, 'open');
    r = await act('update', 'ledger:#5', { owner: 'axis', due: '2026-10-18' });
    assert.equal(r.item.owner, 'axis'); assert.equal(r.item.due, '2026-10-19T03:59:00.000Z', 'an edit to a row this side cannot write lives in the overlay');
    r = await act('assign', 'ledger:#5', { agent: 'Ledger' }); assert.equal(r.item.owner, 'agent:Ledger');
    r = await act('complete', 'ledger:#5'); assert.equal(r.item.status, 'done');

    // the worker's board: intents the worker applies, plus the overlay
    r = await act('cancel', 'board-followup:7');
    const cf = mem.keys('axis-inbox', 'pending/ccv2-').map((k) => mem.read('axis-inbox', k)).find((e) => e.type === 'cancel_followup');
    assert.deepEqual(cf.payload, { follow_up_id: 7 }, 'cancel queues the console\'s own cancel_followup (the worker applies it)');
    assert.equal(cf.schema, 'axis-cc-v2'); assert.equal(r.item.status, 'cancelled'); assert.equal(r.queued, true);
    r = await act('approve', 'board-approval:99');
    assert.equal(r.staged, true, 'an outreach draft sends — from chat it is staged');
    assert.ok(!mem.keys('axis-inbox', 'pending/ccv2-').map((k) => mem.read('axis-inbox', k)).some((e) => e.type === 'approve'), 'and NO approve intent was queued');
    r = await act('approve', 'board-approval:99', {}, { via: 'console' });
    assert.ok(mem.keys('axis-inbox', 'pending/ccv2-').map((k) => mem.read('axis-inbox', k)).some((e) => e.type === 'approve' && e.payload.item_id === 99), 'his click queues the same approve intent the Approvals screen does');
    assert.equal(r.item.status, 'approved');
    r = await act('complete', 'inbox:41');
    assert.ok(mem.keys('axis-inbox', 'pending/ccv2-').map((k) => mem.read('axis-inbox', k)).some((e) => e.type === 'mark_handled' && e.payload.message_id === 41));
    assert.equal(r.item.status, 'done');
    r = await act('acknowledge', 'document:d1'); assert.equal(r.item.status, 'acknowledged');
    r = await act('assign', 'waiting:501', { agent: 'Pitch' });
    assert.ok(mem.keys('axis-inbox', 'pending/ccv2-').map((k) => mem.read('axis-inbox', k)).some((e) => e.type === 'delegate_followup' && e.payload.business_id === 5 && e.payload.outreach_item_id === 501), 'a waiting thread is delegated through the Waiting Reply intent');
    r = await act('acknowledge', 'job:q-fail'); assert.equal(r.item.status, 'acknowledged');
    r = await act('snooze', 'agent:Scout', { until: 'tomorrow' }); assert.equal(r.item.status, 'snoozed');
    await fails(act('complete', 'job:q-work'), 409, 'not_allowed');

    // create
    r = await act('create', null, { title: 'Call the CDIC desk', due: '2026-10-20', priority: 'high' });
    assert.ok(r.item.id.startsWith('todo:')); assert.equal(r.item.priority, 'high'); assert.equal(r.item.owner, 'ahmad'); assert.equal(r.receipt, '➕ Added: Call the CDIC desk — due Tue Oct 20');
    ok();
  }

  // ---- 3. "Delete" is archive — nothing is ever destroyed, and archived rows stay readable ----
  {
    const before = mem.read('axis-exec', 'todos').length;
    await act('archive', 'todo:todo-a');
    await act('archive', 'automation:task-bad');
    await act('archive', 'board-followup:8');
    assert.equal(mem.read('axis-exec', 'todos').length, before, 'the to-do is still in the store');
    assert.ok(mem.read('axis-exec', 'todos').find((t) => t.id === 'todo-a').archived, 'flagged archived, not removed');
    assert.ok(mem.read('axis-exec', 'tasks').find((t) => t.id === 'task-bad'), 'the automation is still in the store (paused)');
    assert.equal(mem.read('axis-exec', 'tasks').find((t) => t.id === 'task-bad').status, 'paused');
    const done = await list({ filter: 'done' });
    for (const id of ['todo:todo-a', 'todo:todo-b', 'automation:task-bad', 'board-followup:8']) assert.equal(find(done, id).status, 'archived', `${id} readable under Done / archived`);
    assert.ok(mem.writes.every((w) => !w.deleted), 'no blob was deleted by any mutation');
    const back = await act('reopen', 'todo:todo-a');
    assert.equal(back.item.status, 'open', 'and an archived row can come back');
    ok();
  }

  // ---- 4. Every mutation is audited: { at, actor, action, id, before, after, via } ----
  {
    const log = mem.read('axis-task-audit', 'log');
    assert.ok(log.length >= 40, `the audit holds every mutation (${log.length})`);
    for (const e of log) {
      for (const k of ['at', 'actor', 'action', 'id', 'before', 'after', 'via']) assert.ok(k in e, `audit entry has ${k}`);
      assert.ok(['ahmad', 'axis'].includes(e.actor)); assert.ok(['chat', 'voice', 'console'].includes(e.via));
    }
    assert.equal(log[0].action, 'reopen', 'newest first'); assert.equal(log[0].id, 'todo:todo-a');
    assert.deepEqual(log[0].before.status, 'archived'); assert.deepEqual(log[0].after.status, 'open');
    assert.ok(log.some((e) => e.action === 'approve.staged' && e.id === 'approval:apr-reply' && e.via === 'chat'), 'a staged approval is audited as staged');
    assert.ok(log.some((e) => e.action === 'approve' && e.id === 'approval:apr-reply' && e.via === 'console'), 'his click is audited as console');
    assert.ok(!log.some((e) => e.id === 'job:q-work'), 'a refused action (complete on an in-flight job) left no audit entry');
    assert.ok(log.some((e) => e.action === 'create' && e.after && e.after.parent === 'todo:todo-a'), 'a follow-up\'s birth is audited with its parent');
    const L2 = await list({ filter: 'all' });
    const a = find(L2, 'todo:todo-a').audit;
    assert.ok(a.length > 0 && a.length <= 5, 'each row carries its last 5');
    assert.equal(a[0].action, 'reopen');
    const r = await T.mutate({ now: NOW, fnDir: FN_DIR, action: 'complete', id: 'todo:todo-a', actor: 'axis', via: 'console' });
    assert.equal(r.audit.actor, 'axis', 'actor "axis" is recorded when AXIS acts on its own');
    assert.equal(mem.read('axis-task-audit', 'log')[0].actor, 'axis');
    ok();
  }

  // ---- 5. The overlay is respected by the situation model, the ledger consumers and the console queue ----
  seed(mem);
  {
    await act('acknowledge', 'ledger:#1');
    await act('snooze', 'board-followup:7', { until: '2026-10-17' });
    await act('archive', 'todo:todo-a');
    await act('complete', 'inbox:41');
    const sit = await S.loadSituation({ now: NOW, fnDir: FN_DIR, getStore: mem.getStore });
    const ids = sit.needsAhmad.map((i) => i.id);
    assert.equal(sit.sources.overlay, true, 'the situation read the overlay');
    for (const id of ['ledger:#1', 'board-followup:7', 'todo:todo-a', 'inbox:41']) assert.ok(!ids.includes(id), `${id} left the ranking`);
    assert.ok(ids.includes('ledger:#5'), 'untouched rows still rank');
    assert.ok(!/Answer the HEC/.test(sit.text), 'the brains no longer read an acknowledged row as needing him');
    // the snooze ends on its own
    const later = await S.loadSituation({ now: at('2026-10-17T14:00:00Z'), fnDir: FN_DIR, getStore: mem.getStore });
    assert.ok(later.needsAhmad.some((i) => i.id === 'board-followup:7'), 'a snoozed row is back once its snooze ends');
    // an acknowledgement lapses when the row itself changes
    const changedLedger = LEDGER.map((r) => (r.ref === '#1' ? { ...r, deadline: '2026-10-21T16:00:00.000Z', overdue: false } : r));
    mem.put('axis-snapshots', 'overview', envelope('overview', { kpis: {}, ceo_critical: changedLedger }));
    const moved = await S.loadSituation({ now: NOW, fnDir: FN_DIR, getStore: mem.getStore });
    assert.ok(moved.needsAhmad.some((i) => i.id === 'ledger:#1'), 'a new deadline on an acknowledged row brings it back');
    mem.put('axis-snapshots', 'overview', envelope('overview', { kpis: {}, ceo_critical: LEDGER }));
    // the pure builder honours a passed overlay the same way
    const pure = S.buildSituation({ now: NOW, snapshots: { overview: { data: { ceo_critical: LEDGER } } }, overlay: { 'ledger:#5': { status: 'done' } } });
    assert.ok(!pure.needsAhmad.some((i) => i.id === 'ledger:#5'));
    assert.ok(pure.needsAhmad.some((i) => i.id === 'ledger:#1'));
    // scripts/lib/axis-ceo-ledger.mjs consumers (the worker's ledger block) — the ledger file is never edited
    const overlay = mem.read('axis-task-overlay', 'rows');
    assert.equal(L.ledgerRowId(LEDGER[0]), 'ledger:#1');
    const blk = L.ceoLedgerBlock(LEDGER, { overlay, now: NOW });
    assert.ok(!/#1 Answer the HEC/.test(blk) && /#5 Fix the Apollo/.test(blk), 'the worker\'s ledger block drops the acknowledged row');
    assert.match(L.ceoLedgerBlock(LEDGER), /#1 Answer the HEC/, 'no overlay → unchanged');
    // the console's Priorities queue / Talk rail / board block
    const snap = { overview: { data: { ceo_critical: LEDGER } }, followups: { data: { overdue: [{ id: 7, company: 'Acme Dental', due_at: '2026-10-12T13:00:00Z' }] } } };
    const L3 = await list();
    P.setTaskOverlay(L3.overlay);
    const pri = P.collectPriorities(snap, NOW).map((i) => i.id);
    P.setTaskOverlay(null);
    assert.ok(!pri.includes('ledger:#1') && !pri.includes('board-followup:7') && pri.includes('ledger:#5'), `the console queue honours the overlay (${pri.join(', ')})`);
    assert.ok(P.collectPriorities(snap, NOW).some((i) => i.id === 'ledger:#1'), 'and is unchanged without it');
    ok();
  }

  // ---- 6. Honest when a store does not answer — unavailable, never empty; refusals write nothing ----
  {
    mem.down('axis-exec');
    const D = await list();
    assert.equal(D.sources.exec, 'unavailable', 'the assistant store is reported unavailable');
    assert.ok(!D.items.some((i) => i.source === 'todo'), 'and its rows are absent, not invented');
    assert.ok(/NOT ANSWERING: assistant store unavailable/.test(T.tasksBlock(D)), 'the brain is told which store did not answer');
    const writes = mem.writes.length;
    await fails(act('create', null, { title: 'x' }), 503, 'store_unavailable');
    assert.equal(mem.writes.length, writes, 'a refused action wrote nothing');
    mem.up('axis-exec');
    mem.down('axis-task-overlay');
    const O = await list();
    assert.equal(O.sources.overlay, 'unavailable');
    const w2 = mem.writes.length;
    await fails(act('acknowledge', 'ledger:#5'), 503, 'store_unavailable');
    assert.equal(mem.writes.length, w2, 'no audit for an action that did not happen');
    mem.up('axis-task-overlay');
    assert.match(T.renderListAnswer({ ok: false }), /could not read the live task list/);
    ok();
  }

  // ---- 7. Bad asks are refused with the reason (and, for a vague name, the candidates) ----
  seed(mem);
  {
    await fails(act('frobnicate', 'todo:todo-a'), 400, 'unknown_action');
    await fails(act('complete', 'todo:nope'), 400, 'unknown_id');
    const e1 = await fails(act('complete', 'board-approval:99'), 409, 'not_allowed');
    assert.ok(e1.extra.actions.includes('approve'), 'the refusal lists what the row CAN do');
    const amb = await fails(T.mutate({ now: NOW, fnDir: FN_DIR, action: 'snooze', match: 'apollo', fields: { until: 'friday' }, via: 'chat' }), 409, 'ambiguous');
    assert.ok(amb.extra.candidates.length >= 2 && amb.extra.candidates.length <= 3, 'an ambiguous name returns up to 3 candidates');
    assert.ok(amb.extra.candidates.some((c) => c.id === 'ledger:#5') && amb.extra.candidates.some((c) => c.id === 'automation:task-bad'));
    const two = await fails(T.mutate({ now: NOW, fnDir: FN_DIR, action: 'complete', match: 'whereby', via: 'chat' }), 409, 'ambiguous');
    assert.deepEqual(two.extra.candidates.map((c) => c.id).sort(), ['followup:fu-1', 'todo:todo-a'], '"whereby" names the to-do AND its follow-up — never a guess');
    const one = await T.mutate({ now: NOW, fnDir: FN_DIR, action: 'complete', match: 'sign the whereby', via: 'chat' });
    assert.equal(one.item.id, 'todo:todo-a', 'an unambiguous name resolves');
    await fails(act('snooze', 'ledger:#5', { until: 'someday maybe' }), 400, 'bad_field');
    await fails(act('snooze', 'ledger:#5', { until: '2026-10-01' }), 400, 'bad_field');
    await fails(act('assign', 'ledger:#5', { agent: 'Nobody' }), 400, 'bad_field');
    await fails(act('draft_reply', 'ledger:#5', {}), 400, 'bad_field');
    await fails(act('update', 'ledger:#5', {}), 400, 'bad_field');
    assert.equal(T.canonAction('followUp'), 'follow_up'); assert.equal(T.canonAction('replyDraft'), 'draft_reply'); assert.equal(T.canonAction('delete'), 'archive');
    ok();
  }

  // ---- 8. Dates are Toronto calendar days ----
  {
    const w = (s, o) => { const d = IDS.parseWhen(s, { now: NOW, ...o }); return d && d.toISOString(); };
    assert.equal(w('friday'), '2026-10-16T13:00:00.000Z');
    assert.equal(w('thursday'), '2026-10-22T13:00:00.000Z', 'today\'s weekday means next week');
    assert.equal(w('next week'), '2026-10-19T13:00:00.000Z');
    assert.equal(w('tomorrow at 14:30'), '2026-10-16T18:30:00.000Z');
    assert.equal(w('in 3 days'), '2026-10-18T13:00:00.000Z');
    assert.equal(w('2026-11-03'), '2026-11-03T14:00:00.000Z', 'EST after the clocks change');
    assert.equal(w('2026-10-20', { defaultHour: 23, defaultMinute: 59 }), '2026-10-21T03:59:00.000Z');
    assert.equal(w('garbage'), null);
    assert.equal(IDS.dueLabel('2026-10-14T03:59:00Z', NOW), 'OVERDUE 2d');
    assert.equal(IDS.fmtWhen('2026-10-16T19:00:00Z'), 'Fri Oct 16 15:00');
    ok();
  }
} finally {
  T._setGetStore(null);
  try { fs.rmSync(FN_DIR, { recursive: true, force: true }); } catch {}
}
console.log(`[axis-tasks-model] ${groups} groups passed`);
