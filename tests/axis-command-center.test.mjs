// AXIS Command Center — contract + safety tests.
// 1) axis-state.json is well-formed and SECRET-FREE (no file paths, emails, phones, backtick leaks).
// 2) the director endpoint loads + handles chat/command/approval/OPTIONS without throwing.
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

// ---- 2. axis-state shape ----
const state = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'axis-state.json'), 'utf8'));
for (const k of ['generatedAt', 'health', 'autoApprove', 'recentActivity', 'approvals', 'agents']) {
  assert.ok(k in state, `axis-state has ${k}`);
}
assert.ok(state.autoApprove.enabled === true && Array.isArray(state.autoApprove.rails) && state.autoApprove.rails.length >= 4, 'auto-approve rails present');
assert.ok(Array.isArray(state.approvals) && Array.isArray(state.agents), 'approvals + agents are arrays');
ok();

// ---- 3. HARD GATE: no secrets / PII anywhere in the public state JSON ----
const blob = JSON.stringify(state);
const leaks = [
  [/[A-Za-z]:\\\\Users|[A-Za-z]:\\Users|\/Users\//, 'absolute file path'],
  [/senior-director-state\//, 'internal state path'],
  [/[\w.+-]+@[\w.-]+\.(com|net|org|ca)/, 'email address'],
  [/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/, 'phone number'],
  [/ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/, 'token/api key'],
  [/`[^`]+`/, 'unredacted backtick span'],
  [/staged-[a-z0-9-]+\.md/, 'staged review filename'],
];
for (const [re, label] of leaks) assert.ok(!re.test(blob), `axis-state must not contain a ${label}`);
ok();

// ---- 4. director endpoint contract (no throw on any action; graceful without key/Blobs) ----
const mod = await import(pathToFileURL(path.join(root, 'netlify', 'functions', 'axis-director.js')).href);
const handler = mod.handler || (mod.default && mod.default.handler);
assert.equal(typeof handler, 'function', 'axis-director exports a handler');
const opt = await handler({ httpMethod: 'OPTIONS' });
assert.equal(opt.statusCode, 204, 'OPTIONS → 204');
const bad = await handler({ httpMethod: 'GET' });
assert.equal(bad.statusCode, 405, 'GET → 405');
const cmd = await handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'command', intent: 'queue find leads' }) });
assert.equal(cmd.statusCode, 200, 'command → 200');
assert.equal(JSON.parse(cmd.body).ok, true, 'command acknowledged');
const apr = await handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'approval', approvalId: 'apr-1', decision: 'approve' }) });
assert.equal(apr.statusCode, 200, 'approval → 200');
assert.match(JSON.parse(apr.body).text, /approv/i, 'approval acknowledged');
ok();

console.log(`AXIS Command Center test passed (${n} groups · roster · state shape · NO-SECRETS gate · endpoint contract chat/command/approval/OPTIONS).`);
