import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../aperture-learning.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../assets/aperture-learning.js', import.meta.url), 'utf8');

assert.ok(html.includes('No synthetic live work'), 'operator room must disclose no synthetic live work');
assert.ok(html.includes('Infinity Wisdom live readiness gates'), 'Infinity readiness gates must be visible');
assert.ok(html.includes('Live run locked until bridge tests pass'), 'Infinity live lock copy must remain visible');
assert.ok(html.includes('web flag must halt local runner'), 'STOP bridge gap must remain visible');
assert.ok(html.includes('Public fallback is counts-only'), 'public fallback must be described as counts-only');

for (const stale of [
  'Live AI Agent Office',
  'All branching halts immediately',
  'Code Auditor joined the roster',
  'Research Agent #2 needs review',
  '1,248',
  '99.9%',
]) {
  assert.ok(!html.includes(stale), `aperture-learning.html still contains stale live/demo copy: ${stale}`);
}

for (const stale of [
  "'1,248'",
  '|| drift <',
  "String(num(s.queueDepth) || 134)",
  "'22'",
]) {
  assert.ok(!js.includes(stale), `assets/aperture-learning.js still contains stale simulated fallback: ${stale}`);
}

assert.ok(js.includes('standing by for authenticated telemetry'), 'standby office copy must be rendered when telemetry is absent');
assert.ok(js.includes('Awaiting data'), 'SLA/health empty-state copy must remain explicit');
assert.ok(html.includes("setStatus(d.stopped===true,'public')"), 'public counts state must not be rendered as live running');

console.log('aperture-learning truthfulness test passed');
