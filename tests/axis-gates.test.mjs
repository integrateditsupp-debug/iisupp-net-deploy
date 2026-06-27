// axis-gates — the single source of truth shared by the AXIS runner and the Infinity Wisdom engine.
// Locks the SAFE_KINDS allow-list + the RISKY_PATTERNS deny markers so the two callers can't drift.
import assert from 'node:assert/strict';
import { classifyJobSafety, SAFE_KINDS, RISKY_PATTERNS } from '../scripts/axis-gates.mjs';

// Safe kinds with benign content pass.
for (const kind of ['kb-article', 'kb-stub', 'doc', 'classifier-keyword', 'scenario', 'test', 'note', 'research-note']) {
  assert.equal(classifyJobSafety({ kind, safe: true, title: 'write a hardware KB article', prompt: 'steps' }).safe, true, `${kind} should be safe`);
}

// Unsafe kind → rejected.
assert.equal(classifyJobSafety({ kind: 'system-fix', safe: true, title: 'x' }).safe, false);
// Not marked safe → rejected.
assert.equal(classifyJobSafety({ kind: 'doc', safe: false, title: 'x' }).safe, false);
// Explicit requiresApproval → rejected.
assert.equal(classifyJobSafety({ kind: 'doc', safe: true, requiresApproval: true, title: 'x' }).safe, false);

// Each risky marker trips even on a safe kind+flag (defense-in-depth).
const riskyTitles = [
  ['push to main', 'push/merge to main'],
  ['deploy to Netlify production', 'deploy/publish'],
  ['send outreach email to the lead list', 'send email/outreach'],
  ['rm -rf the build', 'destructive system action'],
  ['process a stripe refund', 'financial action'],
  ['rotate the api key and reset password', 'credential/secret change'],
  ['git push --force', 'unscoped git push / force-push'],
  ['buy a paid openai api plan', 'paid API / spend'],
  ['spawn unlimited agents', 'uncontrolled agent spawn'],
];
for (const [title, why] of riskyTitles) {
  const v = classifyJobSafety({ kind: 'doc', safe: true, title });
  assert.equal(v.safe, false, `"${title}" must be unsafe`);
  assert.match(v.reason, /risky marker/);
}

assert.ok(SAFE_KINDS.has('doc') && RISKY_PATTERNS.length >= 9);
console.log('axis-gates test suite passed (safe kinds · risky markers · defense-in-depth).');
