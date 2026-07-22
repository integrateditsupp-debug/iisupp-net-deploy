// AXIS Command Center — contract + privacy tests.
// Public /assets/axis-state.json is COUNTS-ONLY (no names/titles/strategy). Named detail is gated behind the
// authenticated /api/axis-state (verifyAperture). The director endpoint handles all actions without throwing.
// Run: node tests/axis-command-center.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ok = () => { n++; };

// ---- 1. roster ----
const roster = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'axis-roster.json'), 'utf8'));
assert.ok(Array.isArray(roster.agents) && roster.agents.length >= 20, 'roster has the named agents');
assert.ok(roster.agents.every(a => a.name && a.fn && a.does), 'each agent has name/fn/does');
ok();

// ---- 2. PUBLIC axis-state is counts-only ----
const state = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'axis-state.json'), 'utf8'));
for (const k of ['generatedAt', 'health', 'autoApprove', 'approvalsSummary', 'activitySummary', 'agentsSummary']) {
  assert.ok(k in state, `public axis-state has ${k}`);
}
assert.deepEqual(state.approvals, [], 'public approvals array is EMPTY (titles gated)');
assert.deepEqual(state.recentActivity, [], 'public recentActivity is EMPTY (prose gated)');
assert.equal(typeof state.approvalsSummary.pending, 'number', 'approvals are COUNTS only');
assert.ok('classifierSelfTestPassPct' in state.health, 'self-test pct clearly labeled');
assert.ok(!('ariaPassPct' in state.health), 'old ambiguous ariaPassPct removed');
ok();

// ---- 3. HARD PRIVACY GATE: public file leaks NO names / approval titles / strategy ----
const blob = JSON.stringify(state);
const leaks = [
  [/[A-Za-z]:\\Users|\/Users\//, 'absolute file path'],
  [/senior-director-state\/|staged-[a-z0-9-]+\.md/, 'internal path/filename'],
  [/[\w.+-]+@[\w.-]+\.(com|net|org|ca)/, 'email address'],
  [/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/, 'phone number'],
  [/`[^`]+`/, 'backtick span'],
  // proper-noun / strategy leaks Cowork found live:
  [/jason|hines|\brbc\b|tangs|physiotherapy|numeric corporate/i, 'named prospect/company'],
  [/approved-to-transmit|first-send queue|supplier registration|next live action|follow-up only if/i, 'deal strategy / approval title'],
];
for (const [re, label] of leaks) assert.ok(!re.test(blob), `public axis-state must not contain ${label}`);
ok();

// ---- 4. AUTHED /api/axis-state gates the named detail (rejects no/invalid session) ----
const ax = (await import(pathToFileURL(path.join(root, 'netlify', 'functions', 'axis-state.mjs')).href)).default;
assert.equal(typeof ax, 'function', 'axis-state exports a handler');
assert.equal((await ax(new Request('https://x/api/axis-state', { method: 'OPTIONS' }))).status, 204, 'OPTIONS → 204');
assert.equal((await ax(new Request('https://x/api/axis-state', { method: 'GET' }))).status, 401, 'NO session → 401');
assert.equal((await ax(new Request('https://x/api/axis-state', { method: 'GET', headers: { Authorization: 'Bearer not.a.real.jwt' } }))).status, 401, 'INVALID session → 401');
// the private full-detail file exists + is NOT the public one (carries the gated arrays)
const full = JSON.parse(fs.readFileSync(path.join(root, 'netlify', 'functions', '_axis-state-full.json'), 'utf8'));
assert.ok(Array.isArray(full.approvals) && Array.isArray(full.recentActivity), 'full state has the detail arrays');
ok();

// ---- 4b. Browser-served constants carry UI vocabulary ONLY (R-series gate review 2026-07-21):
// assets/axis-constants.js rides the pre-auth module graph AND is world-readable under publish=".".
// The outreach playbook (LOCKED template, identity/watched mailbox, pacing/ramp strategy, Blobs
// store names, rail caps) must live ONLY in scripts/lib/axis-private-constants.mjs (force-404'd). ----
const pubConsts = await import(pathToFileURL(path.join(root, 'assets', 'axis-constants.js')).href);
for (const k of ['APPROVED_TEMPLATE', 'OUTREACH_IDENTITY', 'CASL', 'BLOBS', 'DEFAULT_RAILS', 'BANNED_FILLER', 'OUTREACH_PACING', 'OUTREACH_LIMITS', 'DEMO_LINK'])
  assert.ok(!(k in pubConsts), `browser constants must NOT export ${k} (operator-internal)`);
const pubConstsText = fs.readFileSync(path.join(root, 'assets', 'axis-constants.js'), 'utf8');
assert.ok(!/calendar\.app\.google|watch_mailbox|first_batch_daily_cap|axis-inbox/.test(pubConstsText), 'no playbook strings in the browser constants file');
const workerConsts = await import(pathToFileURL(path.join(root, 'scripts', 'lib', 'axis-constants.mjs')).href);
for (const k of ['APPROVED_TEMPLATE', 'OUTREACH_IDENTITY', 'CASL', 'BLOBS', 'DEFAULT_RAILS', 'SNAPSHOT_MODULES', 'PIPELINE_STAGES'])
  assert.ok(k in workerConsts, `worker namespace still exports ${k} (no drift)`);
ok();

// ---- 5. director endpoint contract (no throw on any action; AXIS CC v2 P1a auth spine: every
// action fails CLOSED without an Aperture session — unauthed callers get 401, never an execution) ----
const handler = (await import(pathToFileURL(path.join(root, 'netlify', 'functions', 'axis-director.js')).href)).handler;
assert.equal((await handler({ httpMethod: 'OPTIONS' })).statusCode, 204, 'OPTIONS → 204');
assert.equal((await handler({ httpMethod: 'GET' })).statusCode, 405, 'GET → 405');
const cmd = await handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'command', intent: 'queue find leads' }) });
assert.equal(cmd.statusCode, 401, 'unauthed command → 401 (fail-closed, P1a)');
const apr = await handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'approval', approvalId: 'apr-1', decision: 'approve' }) });
assert.equal(apr.statusCode, 401, 'unauthed approval → 401 (fail-closed, P1a)');
ok();

console.log(`AXIS Command Center test passed (${n} groups · roster · PUBLIC counts-only · no-name/title/strategy leak · AUTHED /api/axis-state gates detail (401) · director endpoint fail-closed contract).`);
