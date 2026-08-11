// tests/axis-priorities.test.mjs — S15 Priorities (2026-08-11).
// Ahmad: "add a priority section of all items being worked on and due dates."
// The failure mode this guards is FABRICATION: a priorities screen is only useful if every date on
// it is real. Approvals and inbox messages genuinely have no deadline field, so they must render as
// "no due date" and sort last — never be given a plausible-looking one.
// Run: node tests/axis-priorities.test.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(pathToFileURL(path.join(root, 'assets', 'axis-priorities.js')).href);
let n = 0; const ok = () => { n++; };

const NOW = new Date('2026-08-11T14:00:00');
const at = (iso) => iso;

// ---- 1. Due-date maths is calendar-day based, not clock-based ----
assert.equal(P.daysUntil('2026-08-11T09:00:00', NOW), 0, 'earlier the same day is still "today"');
assert.equal(P.daysUntil('2026-08-11T23:00:00', NOW), 0, 'later the same day is "today"');
assert.equal(P.daysUntil('2026-08-12T01:00:00', NOW), 1, 'tomorrow');
assert.equal(P.daysUntil('2026-08-08T23:00:00', NOW), -3, 'three days overdue');
assert.equal(P.daysUntil('not-a-date', NOW), null, 'an unparseable date is null, never 0');
// The bug this prevents: a 9am-today item reading as "overdue" at 2pm.
assert.equal(P.dueLabel('2026-08-11T09:00:00', NOW).tone, 'today', 'a due-today item is never shown overdue');
ok();

// ---- 2. Labels + tone ----
assert.equal(P.dueLabel('2026-08-08T09:00:00', NOW).text, '3 days overdue');
assert.equal(P.dueLabel('2026-08-10T09:00:00', NOW).text, 'yesterday');
assert.equal(P.dueLabel('2026-08-11T09:00:00', NOW).text, 'today');
assert.equal(P.dueLabel('2026-08-12T09:00:00', NOW).text, 'tomorrow');
assert.equal(P.dueLabel('2026-08-15T09:00:00', NOW).text, 'in 4 days');
assert.equal(P.dueLabel(null, NOW).text, 'no due date', 'a missing date says so in words');
assert.equal(P.dueLabel(null, NOW).tone, 'none');
ok();

// ---- 3. An empty snapshot produces an empty board — never a demo row ----
assert.deepEqual(P.collectPriorities({}), [], 'no data → no items');
assert.deepEqual(P.collectPriorities({ followups: { data: {} }, approvals: { data: { rows: [] } } }), []);
assert.deepEqual(P.collectInFlight({}), [], 'no fleet → nothing "being worked on"');
ok();

// ---- 4. Real rows are lifted with their OWN dates, and undated work sorts last ----
const snap = {
  followups: { data: {
    overdue:   [{ company: 'Acme Dental', due_at: '2026-08-06T09:00:00' }],
    due_today: [{ company: 'Bay Legal',   due_at: '2026-08-11T09:00:00' }],
    upcoming:  [{ company: 'Cedar Clinic', due_at: '2026-08-19T09:00:00' }],
  } },
  approvals: { data: { rows: [
    { status: 'pending', subject: 'Intro email — Bay Legal', created_at: '2026-08-10T09:00:00' },
    { status: 'approved', subject: 'already handled' },
  ] } },
  inbox: { data: { rows: [
    { classification: 'reply_to_outreach', subject: 'Re: your note', actioned: false },
    { classification: 'noise', subject: 'newsletter', actioned: false },
    { classification: 'new_inbound_request', subject: 'handled already', actioned: true },
  ] } },
};
const items = P.collectPriorities(snap);
assert.equal(items.length, 5, '3 follow-ups + 1 pending approval + 1 actionable inbox message');
assert.equal(items[0].title, 'Acme Dental', 'most overdue sorts first');
assert.equal(items[1].title, 'Bay Legal', 'due today next');
assert.equal(items[2].title, 'Cedar Clinic', 'upcoming after that');
// The core honesty assertion: sources without a deadline field get null, not a guess.
const undated = items.slice(3);
assert.ok(undated.every(i => i.dueAt === null), 'approvals + inbox carry NO invented due date');
assert.ok(undated.every(i => P.dueLabel(i.dueAt).text === 'no due date'));
assert.ok(items.findIndex(i => i.source === 'Approval') > 2, 'undated work never out-ranks a real deadline');
// Non-actionable / already-handled rows are excluded, matching Badge Law.
assert.ok(!items.some(i => i.title === 'newsletter'), 'noise is not a priority');
assert.ok(!items.some(i => i.title === 'handled already'), 'actioned messages drop off');
assert.ok(!items.some(i => i.title === 'already handled'), 'non-pending approvals drop off');
ok();

// ---- 5. "Being worked on" reflects only what the fleet actually reports ----
const flight = P.collectInFlight({
  fleet: { data: { agents: [
    { name: 'Cartographer', status: 'running', role: 'research' },
    { name: 'Sentry', status: 'dormant', role: 'inbox' },
    { name: 'Miner', status: 'idle' },
  ] } },
  outreach: { data: { drafts: [{}, {}] } },
});
assert.equal(flight.length, 2, 'one running agent + the outreach drafts');
assert.equal(flight[0].title, 'Cartographer');
assert.ok(!flight.some(f => f.title === 'Sentry'), 'a dormant agent is not "being worked on"');
assert.ok(!flight.some(f => f.title === 'Miner'), 'an idle agent is not "being worked on"');
assert.equal(flight[1].title, '2 outreach drafts', 'draft count is pluralised from the real array');
ok();

console.log(`axis-priorities: ${n}/5 groups green — every due date is a real field; sources without one say "no due date" and sort last.`);
