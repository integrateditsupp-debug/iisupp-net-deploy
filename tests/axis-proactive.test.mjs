// axis-proactive.test.mjs — AXIS speaking up on its own, staying in the conversation, and the
// rails around machine control.
//
// Ahmad, 2026-08-11: "when its in hands free mode it listens to what I am saying", "as long as its
// running… it should give me any updates or progress that is important", "if something needs my
// attention it should go automatically in hands free mode and tell me whats going on then wait for
// me to reply", and "give it access to speak with claude cowork and take control of my machine".
//
// These four were claimed as working once before they were built. This file is the evidence.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'assets', 'axis-app.js'), 'utf8');
const worker = fs.readFileSync(path.join(ROOT, 'scripts', 'axis-brain-worker.mjs'), 'utf8');
const queue = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'axis-brain-queue.mjs'), 'utf8');
const ok = (m) => console.log('  ok —', m);

// ---- 1. continuous conversation: the wake word starts a conversation, it does not gate every turn ----
assert.ok(/const axisConvoOpen = \(\) => Date\.now\(\) < axisConvoUntil/.test(app), 'a conversation window exists');
assert.ok(/const addressed = isWake\(said\) \|\| axisConvoOpen\(\)/.test(app),
  'speech counts as addressed when the floor is open, not only after a wake word');
assert.ok(/if \(axisHandsFree\) axisOpenConvo\(\)/.test(app), 'finishing a turn re-opens the floor');
assert.ok(/axisConvoUntil = 0;\s*\/\/ this utterance consumes the window/.test(app),
  'a handled utterance closes the window — it does not stay open indefinitely');
// The window must be bounded. An unbounded one is a hot mic.
const convo = app.match(/const CONVO_MS = (\d+)/);
assert.ok(convo, 'the window length is a named constant');
assert.ok(Number(convo[1]) > 5000 && Number(convo[1]) <= 60000,
  `conversation window must be bounded and human-sized, got ${convo[1]}ms`);
ok('hands-free stays in the conversation without re-waking, on a bounded window');

// ---- 2. proactive updates, without becoming chatty ----
assert.ok(/async function axisProgressPoll/.test(app), 'progress is polled');
assert.ok(/setInterval\(axisProgressPoll/.test(app), 'polling actually runs');
assert.ok(/if \(!axisEventsSeeded\)/.test(app),
  'the first poll seeds silently — a session must not open by narrating history');
assert.ok(/e\.kind === 'done' \|\| e\.kind === 'error'/.test(app),
  'only finishes and failures are worth speaking; start/info stay in the transcript');
assert.ok(/if \(axisPendingOp \|\| axisListening\) return;/.test(app),
  'a proactive update must never talk across a pending confirm');
ok('important progress is spoken; routine progress is logged');

// ---- 3. something needs Ahmad: hands-free turns itself on and waits ----
assert.ok(/function axisRaiseAttention/.test(app), 'attention has a dedicated path');
assert.ok(/if \(!axisHandsFree\) \{ axisHandsFree = true;/.test(app),
  'attention switches hands-free ON by itself');
assert.ok(/axisOpenConvo\(45000\)/.test(app), 'attention holds the floor open for a reply');
assert.ok(/const attention = fresh\.filter\(\(e\) => e\.kind === 'attention'\)/.test(app),
  'attention events are routed ahead of ordinary updates');
ok('an attention event auto-enters hands-free, speaks, and waits');

// ---- 4. machine control rails ----
assert.ok(/'cowork\.ask', 'machine\.run'/.test(queue), 'the new kinds are allowlisted server-side');
const machine = worker.slice(worker.indexOf("kind === 'machine.run'"), worker.indexOf("kind === 'machine.run'") + 2600);
assert.ok(/confirmed !== true/.test(machine), 'machine control requires an explicit confirm');
const irreversible = machine.match(/const IRREVERSIBLE = \/([^/]+(?:\\\/[^/]*)*)\//);
assert.ok(irreversible, 'there is an irreversible-action denylist');
const re = new RegExp(irreversible[1], 'i');
for (const phrase of ['delete the old branch', 'publish it', 'deploy to prod', 'pay the invoice',
  'send the email', 'create an account', 'rotate the api key', 'wipe the folder']) {
  assert.ok(re.test(phrase), `denylist must stop: "${phrase}"`);
}
for (const phrase of ['clean up the loops registry', 'rebuild the kb index', 'summarise the ledger']) {
  assert.ok(!re.test(phrase), `denylist must not block ordinary work: "${phrase}"`);
}
assert.ok(/'attention'\)/.test(machine), 'a blocked request comes back to Ahmad rather than failing silently');
ok('machine control is confirmed, and irreversible work stops and asks');

// ---- 5. cowork is read-only ----
const cowork = worker.slice(worker.indexOf("kind === 'cowork.ask'"), worker.indexOf("kind === 'cowork.ask'") + 1400);
assert.ok(!/acceptEdits/.test(cowork), 'asking Cowork a question must never carry edit permission');
ok('cowork.ask cannot quietly become a change');

// ---- 6. a self-fix announces itself when it lands ----
assert.ok(/await progress\('Fixed it: '/.test(worker), '"tell me once its done" — a self-fix speaks up');
ok('a completed self-fix reports back unprompted');

console.log('ok — proactive AXIS: conversation, updates, attention, and machine rails');
