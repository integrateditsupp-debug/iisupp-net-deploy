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


// ---- 7. barge-in: interrupting mid-sentence is a turn, not a reset ----
// Ahmad, 2026-08-12: "when its talking and I interrupt or stop it to talk about something it
// mentioned it should listen to me then respond and act accordingly."
//
// Brace-match the functions rather than slicing offsets — a fixed window silently stops covering the
// end of a function as soon as anyone adds a comment (see the axisStandDown guard that went blind).
function fnBody(src, decl) {
  const start = src.indexOf(decl);
  assert.notEqual(start, -1, `${decl} not found`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${decl}`);
}

// The listener must stay armed while AXIS talks, or interrupting by voice is impossible — which is
// exactly what an unconditional axisWakePause() during speech caused.
assert.ok(/if \(axisHandsFree\) axisWakeResume\(\); else axisWakePause\(\);/.test(app),
  'hands-free keeps the mic open while AXIS speaks, so a barge-in can be heard');
// Leaving the mic open means AXIS can hear itself; that has to be handled, not ignored.
assert.ok(/function axisIsSelfEcho/.test(app), 'self-echo is filtered rather than the mic being deafened');
const echo = fnBody(app, 'function axisIsSelfEcho');
assert.ok(/if \(isStop\(said\)\) return false;/.test(echo),
  'a stop is never treated as echo — being unable to interrupt is worse than one dropped turn');
assert.ok(/overlap >= 0\.7/.test(echo), 'echo is judged on word overlap, not an exact string match');

const barge = fnBody(app, 'function axisBargeIn');
assert.ok(/speechSynthesis\.cancel\(\)/.test(barge), 'barge-in silences the reply at once');
assert.ok(/axisOpenConvo\(\)/.test(barge), 'and holds the floor for what Ahmad says next');
// The whole point is that the interruption is ABOUT what was just said.
assert.ok(!/axisPendingOp\s*=|axisHeldRest\s*=/.test(barge),
  'barge-in keeps conversational place — the antecedent for "what you just mentioned"');

const stand = fnBody(app, 'function axisStandDown');
assert.ok(/if \(axisHandsFree\) \{ axisOpenConvo\(\); axisWakeResume\(\); \}/.test(stand),
  'stopping it hands the floor straight back instead of going quiet');
ok('interrupting silences AXIS, keeps the context, and listens for the follow-up');

// ---- 8. it must not narrate its own billing ----
// Ahmad: "it should stop saying using max account when its trying to do something."
const director = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'axis-director.js'), 'utf8');
for (const [label, src] of [['console', app], ['director', director]]) {
  const spoken = src.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  assert.ok(!/Max plan|max account/i.test(spoken),
    `${label} must not tell Ahmad which plan answered — that is plumbing, not conversation`);
}
ok('no tier or plan is announced in anything AXIS says');

console.log('ok — proactive AXIS: conversation, updates, attention, and machine rails');
