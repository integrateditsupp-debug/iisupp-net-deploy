// axis-fleet-manage.test.mjs — the fleet reports to AXIS, and AXIS can manage it.
//
// Ahmad, 2026-08-12: "have all the agents report to axis and give axis full access to manage them."
// Reporting already existed (watchdog + steward digests into the vault); managing did not — no task
// kind could run, pause, or resume a scheduled agent. This locks the new rail end to end: the voice
// grammar routes, the queue allows the kinds, the worker maps verbs to fixed cmdlets against a fixed
// roster, and the read-only status pull tolerates the watchdog's deliberate non-zero exit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectOp } from '../assets/axis-persona.js';

const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ok = (m) => console.log('  ok —', m);

// ---- 1. Voice grammar: status is unconfirmed, controls are confirmed ----
for (const say of ['how are the agents', 'check the fleet', 'fleet status', 'are any agents failing']) {
  const op = detectOp(say);
  assert.ok(op && op.kind === 'fleet.status', `"${say}" must route to fleet.status, got ${op && op.kind}`);
}
for (const [say, kind] of [
  ['run the opportunity engine agent', 'fleet.run'],
  ['kick off the kb pull agent now', 'fleet.run'],
  ['pause the workspace cleanup agent', 'fleet.pause'],
  ['disable the business development agent', 'fleet.pause'],
  ['resume the workspace cleanup agent', 'fleet.resume'],
  ['re-enable the quality gate agent', 'fleet.resume'],
]) {
  const op = detectOp(say);
  assert.ok(op && op.kind === kind, `"${say}" must route to ${kind}, got ${op && op.kind}`);
  assert.ok(/confirm/i.test(op.confirm), `${kind} is read back for a spoken confirm`);
}
// Questions about the fleet are questions, never controls.
assert.notEqual((detectOp('should I pause the cleanup agent') || {}).kind, 'fleet.pause',
  'a question is never a control');
assert.notEqual((detectOp('what does the opportunity engine agent do') || {}).kind, 'fleet.run',
  'asking what an agent does must not run it');
ok('grammar: status unconfirmed, run/pause/resume confirmed, questions stay questions');

// ---- 2. The queue allows exactly the named kinds ----
const queue = read('netlify/functions/axis-brain-queue.mjs');
for (const k of ['fleet.status', 'fleet.run', 'fleet.pause', 'fleet.resume'])
  assert.ok(queue.includes(`'${k}'`), `queue ALLOWED must include ${k}`);
ok('queue: fleet kinds on the allow-list');

// ---- 3. The worker: fixed roster, fixed cmdlets, confirm gate, no shell:true ----
const worker = read('scripts/axis-brain-worker.mjs');
assert.ok(/const FLEET_AGENTS = \{/.test(worker), 'a fixed roster exists');
for (const task of ['ARIA KB Pull', 'IIS Business Development Agent Morning', 'IIS CEO Action Digest Hourly',
  'IIS Interaction Avoidance Agent Hourly', 'IIS Opportunity Engine Hourly', 'IIS Opportunity Prep Packets Hourly',
  'IIS Opportunity Quality Gate Hourly', 'IIS Workspace Cleanup Agent Daily'])
  assert.ok(worker.includes(`'${task}'`), `roster carries the watchdog's task name: ${task}`);
assert.ok(/'fleet\.run': 'Start-ScheduledTask'/.test(worker) && /'fleet\.pause': 'Disable-ScheduledTask'/.test(worker)
  && /'fleet\.resume': 'Enable-ScheduledTask'/.test(worker),
  'each verb maps to one fixed cmdlet — the queue can name an agent, never a command');
assert.ok(/kind === 'fleet\.run' \|\| kind === 'fleet\.pause' \|\| kind === 'fleet\.resume'[\s\S]{0,400}confirmed !== true/.test(worker),
  'controls require the spoken confirm');
assert.ok(/resolveFleetAgent\(arg\)/.test(worker) && /Which agent\? I manage:/.test(worker),
  'an unknown name gets the roster read back, never a guess');
// powershell.exe is spawned directly — shell:true would shred this repo's em-dash path.
const psBlock = worker.slice(worker.indexOf('function psScheduledTask'), worker.indexOf('async function runTask'));
assert.ok(/spawn\('powershell\.exe'/.test(psBlock) && !/shell:\s*true/.test(psBlock),
  'scheduled-task cmdlets run without shell:true');
// The status pull must not treat the watchdog's non-zero "something is broken" exit as a failure.
assert.ok(/fleet\.status[\s\S]{0,900}c\.on\('close', \(\) =>/.test(worker),
  'fleet.status captures output regardless of exit code — a broken agent is the answer, not an error');
ok('worker: roster + cmdlet map + confirm gate + exit-code tolerance');

// ---- 4. The console runs status immediately, like video.status ----
assert.ok(/op\.kind === 'video\.status' \|\| op\.kind === 'fleet\.status'/.test(read('assets/axis-app.js')),
  'fleet.status is read-only and runs without the confirm round-trip');
ok('console: status answers immediately');

console.log('axis-fleet-manage test passed (voice → queue → worker rail: fixed roster, fixed cmdlets, confirm-gated controls, unconfirmed read-only status).');
