// axis-intent-apply.test.mjs — the Waiting Reply "Delegate" button must actually reach the follow-up
// engine. It shipped once as a no-op: the UI posted a v2 intent, the endpoint queued it, and the worker's
// approve-hop dropped it into `hold` forever because it only understood the legacy command/approval shape.
// This locks the whole hand-off: v2 dispatch, payload validation, the STOP rail, and the wiring itself.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyAxisV2Intents, V2_HANDLERS, V2_SCHEMA } from '../scripts/lib/axis-intent-apply.mjs';
import { MAX_TOUCHES } from '../scripts/lib/followups.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ── in-memory DB against the real schema (no fixture file, no seeding of the live DB) ─────────────
process.env.AXIS_DB_PATH = ':memory:';
const { openDb } = await import('../scripts/lib/axis-db.mjs');
const db = openDb();
db.prepare("INSERT INTO businesses (id,handle,name,public_email,is_real,created_at) VALUES (1,'Lead-001','Acme Dental','ops@acme.test',1,?)").run(Date.now());
db.prepare(`INSERT INTO outreach_items (id,business_id,channel,kind,subject,body,to_email,status,created_at,sent_at)
  VALUES (10,1,'email','initial','s','b','ops@acme.test','sent',?,?)`).run(Date.now(), Date.now() - 20 * 86400000);
db.prepare(`INSERT INTO outreach_items (id,business_id,channel,kind,subject,body,to_email,status,created_at)
  VALUES (11,1,'email','initial','s','b','ops@acme.test','pending',?)`).run(Date.now());

const entry = (type, payload, over = {}) => Object.assign({ id: 'ccv2-' + type, schema: V2_SCHEMA, type, payload }, over);

// 1. The happy path: a delegation schedules the full cadence as PENDING outreach.
let r = applyAxisV2Intents(db, [entry('delegate_followup', { business_id: 1, outreach_item_id: 10 })]);
assert.equal(r.applied.length, 1, 'delegate_followup applies');
assert.equal(r.applied[0].scheduled, MAX_TOUCHES, 'schedules the full cadence');
const scheduled = db.prepare("SELECT COUNT(*) n FROM follow_ups WHERE business_id=1 AND status='scheduled'").get().n;
assert.equal(scheduled, MAX_TOUCHES, 'follow_ups rows exist → the Follow-ups tab has something to show');
const pending = db.prepare("SELECT COUNT(*) n FROM outreach_items WHERE business_id=1 AND kind='followup' AND status='pending'").get().n;
assert.equal(pending, MAX_TOUCHES, 'every touch is PENDING — nothing can send without clearing Approvals');
const due = db.prepare("SELECT MIN(due_at) d FROM follow_ups WHERE business_id=1").get().d;
assert.ok(due <= Date.now(), 'touch 1 is due immediately — a cold lead is chased now, not in 3 days');

// 2. Idempotent: re-clicking Delegate cannot exceed MAX_TOUCHES (the STOP rail), and that is not an error.
r = applyAxisV2Intents(db, [entry('delegate_followup', { business_id: 1, outreach_item_id: 10 })]);
assert.equal(r.applied.length, 1, 'a capped delegation still succeeds');
assert.equal(r.applied[0].scheduled, 0, 'no extra touches past the cap');
assert.equal(r.applied[0].capped, true, 'cap is reported, not silently swallowed');
assert.equal(db.prepare("SELECT COUNT(*) n FROM follow_ups WHERE business_id=1").get().n, MAX_TOUCHES, 'cadence never exceeds MAX_TOUCHES');

// 3. Bad payloads are REJECTED (consumed with a reason), never applied and never left to jam the queue.
const bad = [
  entry('delegate_followup', {}),                                        // no business_id
  entry('delegate_followup', { business_id: 999 }),                      // unknown business
  entry('delegate_followup', { business_id: 1, outreach_item_id: 999 }), // unknown item
  entry('delegate_followup', { business_id: 1, outreach_item_id: 11 }),  // item never actually sent
];
r = applyAxisV2Intents(db, bad);
assert.equal(r.applied.length, 0, 'no bad payload applies');
assert.equal(r.rejected.length, 4, 'every bad payload is rejected with a reason');
assert.ok(r.rejected.every((x) => typeof x.reason === 'string' && x.reason.length), 'rejections carry a reason');

// 4. Anything unrecognised HOLDS for Ahmad — unknown v2 types and legacy shapes alike.
r = applyAxisV2Intents(db, [
  entry('some_future_type', { business_id: 1 }),
  { id: 'legacy', action: 'command', intent: 'find leads' },
]);
assert.equal(r.applied.length + r.rejected.length, 0, 'unknown types are never guessed at');
assert.equal(r.held.length, 2, 'unknown v2 type and legacy shape both hold');

// 5. Never throws on garbage.
assert.equal(applyAxisV2Intents(db, null).applied.length, 0, 'null input safe');
assert.equal(applyAxisV2Intents(db, [{}, null]).held.length, 0, 'items without ids are skipped');
db.close();

// ── wiring: the three ends of the loop must stay connected ────────────────────────────────────────
// Each of these was broken at some point in exactly this way, and every break is silent at runtime.
assert.ok(read('netlify/functions/axis-intent.mjs').includes("'delegate_followup'"),
  'the endpoint must mark delegate_followup known, or the queued record reads as unrecognised');
assert.ok(read('assets/axis-app.js').includes("postIntent('delegate_followup'"),
  'the Waiting Reply screen must still post the intent the worker applies');
const worker = read('scripts/senior-director-worker.mjs');
assert.ok(worker.includes('applyAxisV2Intents'), 'the worker must call the v2 applier from its inbox hop');
assert.ok(/pushSnapshots/.test(worker), 'the worker must republish snapshots after applying, or the UI never updates');
assert.ok(Object.keys(V2_HANDLERS).includes('delegate_followup'), 'handler table exposes delegate_followup');

console.log('axis-intent-apply test passed (delegate → cadence scheduled pending · idempotent at the cap · bad payloads rejected · unknown held · UI/endpoint/worker wiring intact).');
