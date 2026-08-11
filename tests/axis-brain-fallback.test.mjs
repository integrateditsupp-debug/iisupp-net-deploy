// tests/axis-brain-fallback.test.mjs — honest brain errors + $0 local answers + hands-free re-arm.
//
// 2026-08-11: Ahmad asked AXIS "tell me the status for today" and got
// "Brain busy. Try again in a sec." for a day. The real cause was HTTP 400
// "Your credit balance is too low to access the Anthropic API" — a permanent condition that
// retrying can never fix. One generic message for every failure mode hid it completely.
// This locks in: every distinguishable failure says what it actually is, and AXIS keeps answering
// from the snapshot instead of going mute.
// Run: node tests/axis-brain-fallback.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { classifyBrainError } = require(path.join(root, 'netlify', 'functions', 'axis-director.js'));
const P = await import(pathToFileURL(path.join(root, 'assets', 'axis-priorities.js')).href);
const app = fs.readFileSync(path.join(root, 'assets', 'axis-app.js'), 'utf8');
let n = 0; const ok = () => { n++; };

// ---- 1. The exact production error is named, and never told to retry ----
const REAL = '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}';
const credit = classifyBrainError(400, REAL);
assert.equal(credit.reason, 'no_credit');
assert.match(credit.text, /out of credit/i, 'says the account is out of credit');
assert.ok(!/try again/i.test(credit.text), 'NEVER tells Ahmad to retry a permanent billing failure');
ok();

// ---- 2. Every other failure mode is distinguishable and actionable ----
assert.equal(classifyBrainError(401, '{"error":{"type":"authentication_error"}}').reason, 'auth');
assert.match(classifyBrainError(401, 'authentication_error').text, /ANTHROPIC_API_KEY/, 'names the env var to fix');
assert.equal(classifyBrainError(403, '{"error":{"type":"permission_error"}}').reason, 'permission');
assert.equal(classifyBrainError(404, '{"error":{"type":"not_found_error"}}').reason, 'bad_model');
assert.match(classifyBrainError(404, 'not_found_error').text, /ARIA_MODEL/, 'names the model env var');
// Transient failures are the ONLY ones allowed to suggest retrying.
assert.equal(classifyBrainError(429, '{}').reason, 'rate_limit');
assert.match(classifyBrainError(429, '{}').text, /again/i);
assert.equal(classifyBrainError(529, '{}').reason, 'overloaded');
assert.match(classifyBrainError(529, '{}').text, /again/i);
// An unrecognised failure reports its real status rather than being dressed up as transient.
const unknown = classifyBrainError(418, '{}');
assert.match(unknown.text, /418/, 'unknown failures surface the real status code');
assert.ok(!/try again/i.test(unknown.text), 'an unknown failure is not claimed to be transient');
ok();

// ---- 3. $0 local answers — real numbers only, no LLM ----
const snap = {
  overview: { data: { kpis: { awaiting_approval: 3, messages_waiting: 1, followups_due: 2 } } },
  followups: { data: {
    overdue: [{ company: 'Acme Dental', due_at: '2026-08-06T09:00:00' }],
    due_today: [{ company: 'Bay Legal', due_at: '2026-08-11T09:00:00' }],
  } },
  approvals: { data: { rows: [{ status: 'pending', subject: 'Intro email' }] } },
  fleet: { data: { agents: [{ name: 'Cartographer', status: 'running' }] } },
};
const NOW = new Date('2026-08-11T14:00:00');
const status = P.localAnswer('tell me the status for today', snap, NOW);
assert.match(status, /3 approvals waiting/, 'reports the real approval count');
assert.match(status, /1 client reply waiting/, 'singular client reply');
assert.match(status, /Acme Dental/, 'names the most urgent item');
assert.match(P.localAnswer('what needs me', snap, NOW), /waiting on you/i);
assert.match(P.localAnswer('what is next', snap, NOW), /Acme Dental/);
assert.match(P.localAnswer('anything overdue', snap, NOW), /1 overdue/);
assert.match(P.localAnswer('what are the agents working on', snap, NOW), /Cartographer/);
ok();

// ---- 4. Rule 14 holds in the fallback: no board → say so; needs reasoning → decline ----
assert.match(P.localAnswer('status', {}, NOW), /do not have the board yet/i,
  'an empty snapshot is reported honestly, never as "all quiet"');
assert.match(P.localAnswer('status', { overview: { data: { kpis: { awaiting_approval: 0, messages_waiting: 0, followups_due: 0 } } } }, NOW),
  /all quiet/i, 'real zeros are "all quiet"');
// Anything needing actual reasoning returns null so the caller reports the outage instead of guessing.
assert.equal(P.localAnswer('write a cold email to a dental clinic', snap, NOW), null);
assert.equal(P.localAnswer('why did the deploy fail', snap, NOW), null);
ok();

// ---- 5. Hands-free re-arm — the "does not listen until I press record" bug ----
// Calling .start() on an abort()ed SpeechRecognition throws InvalidStateError in Chrome, and the
// throw was swallowed. Resume must therefore build a FRESH recognizer, never reuse the old one.
assert.match(app, /function axisWakeResume\(\)[^\n]*axisWakeStart\(\)/,
  'resume starts a fresh recognizer instead of restarting an aborted one');
assert.ok(!/axisWakeRec \? axisWakeRec\.start\(\)/.test(app), 'the aborted-instance restart is gone');
assert.match(app, /function axisWakePause\(\)[\s\S]{0,220}axisWakeRec = null/,
  'pause drops the dead recognizer so it cannot be reused');
// The flag must be set before arming — the recognizer's own handlers gate on it.
assert.match(app, /axisHandsFree = true; axisSyncWakeBtn\(\);[\s\S]{0,400}axisWakeStart\(\)/,
  'hands-free flag is set before the listener is armed');
assert.match(app, /setInterval\(\(\) => \{[\s\S]{0,260}axisWakeStart\(\);[\s\S]{0,40}\}, 4000\)/,
  'watchdog re-arms a dropped wake listener');
ok();

// ---- 6. The console degrades to the board instead of going mute ----
for (const [marker, why] of [
  ['localAnswer(text, state.snap)', 'a degraded reply is answered from the snapshot'],
  ['function axisBrainDown', 'the brain-state badge exists'],
  ["axisBrainDown(j.reason", 'the real reason drives the badge'],
  ['axisBrainNoted', 'the outage is reported once per session, not every turn'],
]) assert.ok(app.includes(marker), why);
ok();

console.log(`axis-brain-fallback: ${n}/6 groups green — every brain failure names itself, AXIS answers from the board, hands-free re-arms on its own.`);
