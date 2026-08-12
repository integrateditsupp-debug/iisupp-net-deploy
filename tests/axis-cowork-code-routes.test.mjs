// tests/axis-cowork-code-routes.test.mjs — AXIS as the front end for Cowork and Claude Code.
//
// Ahmad, 2026-08-12: "It does not work with claude code or claude cowork to action the business
// workflows and tasks… nor does it plan out with me anything or work with me like I would with
// claude cowork or claude code. I want Axis basically the visual and verbal extension of claude code
// and cowork. claude cowork to be use by axis for planning and different models for the type of task
// being asked and claude code to execute any code."
//
// The plumbing already existed — the worker could run cowork.ask, self.fix and machine.run on the Max
// plan. What did not exist was a route from how Ahmad actually TALKS to any of it:
//   · cowork.ask only fired if he said the words "ask cowork". Nobody plans that way.
//   · self.fix is repair-only by design (a repair verb AND a reference to AXIS itself), so new work
//     — "build the intake form", "add a column to the roster" — had no route and got ANSWERED
//     instead of done.
//
// What this protects:
//   · planning phrasings reach Cowork, and Cowork never runs below the standard tier
//   · build phrasings reach Claude Code, on the execution floor, not the cost ladder
//   · neither route hijacks an ordinary question — the failure mode that once turned 5 of 16
//     realistic support questions into "say confirm, or cancel"
//   · an explicitly named model still wins over both defaults
// Run: node tests/axis-cowork-code-routes.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(pathToFileURL(path.join(root, 'assets', 'axis-persona.js')).href);
const R = await import(pathToFileURL(path.join(root, 'scripts', 'lib', 'axis-model-router.mjs')).href);
const worker = fs.readFileSync(path.join(root, 'scripts', 'axis-brain-worker.mjs'), 'utf8');
const queue = fs.readFileSync(path.join(root, 'netlify', 'functions', 'axis-brain-queue.mjs'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets', 'axis-app.js'), 'utf8');
let n = 0; const ok = (m) => { n++; if (m) console.log('  ok —', m); };

const kindOf = (s) => { const op = P.detectOp(s); return op && op.kind; };

// ---- 1. Planning reaches Cowork, in the words he'd actually use ----
{
  for (const said of [
    "let's plan the tenant migration for next month",
    'help me work out the approach for the overflow pilot',
    'can we think through the pricing for managed support',
    "let's prioritise the gov bids together",
    'help me scope the website intake fix',
  ]) {
    assert.equal(kindOf(said), 'cowork.plan', `"${said}" should reach Cowork planning`);
  }
  ok('planning phrasings route to Cowork');
}

// ---- 2. Building reaches Claude Code ----
{
  for (const said of [
    'build the intake form on the contact page',
    'add a column to the roster table',
    'wire the webhook for the Stripe endpoint',
    'write a test for the paywall',
    'refactor the axis dock component',
  ]) {
    assert.equal(kindOf(said), 'code.build', `"${said}" should reach Claude Code`);
  }
  ok('build phrasings route to Claude Code');
}

// ---- 3. Neither route hijacks an ordinary question ----
// This is the guard that matters most. A bare verb trigger once turned 5 of 16 realistic support
// questions into a confirm prompt instead of an answer — "it is failing more than before".
{
  for (const said of [
    'how do I fix a stuck windows update',
    'what is the plan for the PSPC bid',            // a question ABOUT a plan, not a request to plan
    'should we build a client portal',              // strategy question, not an instruction
    'how many videos are staged',
    'what is the monthly spend cap',
    'why is the paywall firing twice',
    'the client needs us to fix their vpn',
    'can you explain the reseller margin',
  ]) {
    const k = kindOf(said);
    assert.ok(k !== 'cowork.plan' && k !== 'code.build',
      `"${said}" must stay a question, got ${k}`);
  }
  ok('ordinary questions are still answered, not turned into confirmations');
}

// ---- 4. A plan or build with no subject is not actionable ----
{
  assert.equal(kindOf("let's plan"), null, '"let\'s plan" has no subject and must not fire');
  assert.equal(kindOf('build it'), null, '"build it" has no antecedent and must not become a repo edit');
  ok('a request with no subject is declined rather than guessed at');
}

// ---- 5. Model selection: Cowork picks per request but never drops to the fast tier ----
{
  const trivial = R.modelForRequest('plan the wording of one button', 'cowork');
  assert.notEqual(trivial.model, R.TIER_BY_NAME.fast.model,
    'planning must never run on the fast tier, however small the subject sounds');
  const hard = R.modelForRequest('plan the end-to-end migration with trade-offs', 'cowork');
  assert.equal(hard.model, R.TIER_BY_NAME.deep.model, 'a genuine architecture plan should reach the deep tier');
  ok('Cowork matches the request, floored at standard');
}

// ---- 6. Execution has a quality floor, not a cost ladder ----
// A wrong cheap answer costs a re-ask; a wrong edit costs a debugging session or a bad deploy.
{
  const build = R.modelForRequest('add a column to the roster table', 'execute');
  assert.equal(build.model, R.EXECUTE_MODEL, 'execution must use the execution model');
  assert.equal(R.EXECUTE_MODEL, 'claude-opus-5', 'the execution floor should be opus 5 by default');
  // Even a trivial-sounding edit stays on the floor.
  assert.equal(R.modelForRequest('rename one css class', 'execute').model, R.EXECUTE_MODEL,
    'a small edit is still an edit — no cost-optimising execution');
  ok('execution runs on the floor regardless of how small it sounds');
}

// ---- 7. A named model still wins ----
{
  for (const [said, want] of [
    ['build the intake form using fable 5', 'claude-fable-5'],
    ['plan the migration with opus 4.8', 'claude-opus-4-8'],
    ['run that on haiku', 'claude-haiku-4-5'],
  ]) {
    assert.equal(R.modelForRequest(said, 'execute').model, want, `"${said}" should honour the named model`);
  }
  // …but a passing mention must not re-route the task.
  assert.notEqual(R.modelForRequest('why is opus expensive', 'answer').model, 'claude-opus-5',
    'merely mentioning a model name must not select it');
  ok('an explicit model instruction overrides both defaults');
}

// ---- 8. Both kinds are wired end to end ----
{
  for (const kind of ['cowork.plan', 'code.build']) {
    assert.ok(worker.includes(`kind === '${kind}'`), `the worker has no handler for ${kind}`);
    assert.ok(queue.includes(`'${kind}'`), `${kind} is not on the queue allow-list`);
    assert.ok(app.includes(`'${kind}'`), `the console has no acknowledgement for ${kind}`);
  }
  ok('persona → queue → worker → console, for both routes');
}

// ---- 9. Planning stays read-only; building is allowed to edit ----
// A planning conversation must never quietly become a commit.
{
  const plan = worker.slice(worker.indexOf("kind === 'cowork.plan'"), worker.indexOf("kind === 'code.build'"));
  assert.ok(!/acceptEdits/.test(plan), 'cowork.plan must not be given edit permission');
  const build = worker.slice(worker.indexOf("kind === 'code.build'"), worker.indexOf("kind === 'machine.run'"));
  assert.ok(/acceptEdits/.test(build), 'code.build needs edit permission to do anything');
  // And a build must be told the rules it can break by accident.
  assert.ok(/do not publish or deploy/i.test(build), 'the build prompt must forbid publishing');
  assert.ok(/test/i.test(build), 'the build prompt must require a test');
  ok('planning cannot edit; building can, under the standing rules');
}

console.log(`axis-cowork-code-routes: ${n} checks passed`);
