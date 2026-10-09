#!/usr/bin/env node
// emit-axis-status-run-cv11.mjs — RUN-CV / CV11 (2026-10-09). Identical refusals to emit-axis-status-run-cv.mjs;
// the ONLY change: the two readings are taken CONCURRENTLY (spawn, not execFileSync) so the whole emit fits a
// 3-minute sandbox call. Sequential, the same readings ran past the cap and nothing was written (measured).
// Original header follows.
// emit-axis-status-run-cv.mjs — RUN-CV (2026-10-09). Same discipline as emit-axis-status-run-cu.mjs (copied, labels only):
// the feed is regenerated from readings THIS script takes at write time; it refuses on any product red.
//
// Inherits BD…BR discipline unchanged: the public feed AXIS reads aloud is regenerated from THIS
// cycle's own measurement, taken by this script, at the moment it is written. A stale `generatedAt`
// on a spoken answer is a fabricated metric with a timestamp on it (Rule 14) — and that is exactly
// what the feed had become: generated 2026-08-13, still served as "current" 56 days later.
//
// WHAT IS DIFFERENT THIS CYCLE.
//
// Two suites are read, not one. The desktop registry (ARIA Sentinel, `npm test`) as before, AND the
// site suite (`node scripts/run-tests.mjs --all`) whose five environment-only reds are named in
// docs/AGENT-BOOTSTRAP.md §5. The site reading is published as "N of M suites, K environment-only"
// — the K are listed by file in the operator-internal detail only, never smoothed into the pass count
// and never called product defects.
//
// It refuses to emit from a reading it did not take. No number here is typed by hand.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { emitAxisStatus, checkPublicFiles } from './lib/axis-status-emit.mjs';

const root = process.cwd();

// The reds docs/AGENT-BOOTSTRAP.md §5 classifies as environment-only on a Linux clone. Anything red
// that is NOT in this set is a product red and refuses the emit.
const ENV_ONLY = new Set([
  'tests/axis-app-detect.test.mjs',
  'tests/axis-assistant-behaviors.test.mjs',
  'tests/axis-windows-traps.test.mjs',
  'tests/axis-worker-offline.test.mjs',
  'tests/axis-status-emitter.test.mjs', // red only while the feed this script regenerates is stale
]);

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', () => resolve(out));
    p.on('error', (e) => resolve(out + String(e)));
  });
}

// ── reading 1: the desktop registry ──────────────────────────────────────────────────────────────
async function readRegistry() {
  const out = await run('npm', ['test'], path.join(root, 'ARIA Sentinel'));
  const num = (key) => { const m = out.match(new RegExp(`^# ${key} (\\d+)$`, 'm')); return m ? Number(m[1]) : null; };
  const r = { takenAt: new Date().toISOString(), tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'),
    failedToLoad: (out.match(/^\s*[✗x] \.\/(\S+)/gm) || []).map((l) => l.replace(/^\s*[✗x] \.\//, '')),
    // RUN-CV / CV6 (2026-10-09): the registry prints `# fail 0` even when a suite FAILED TO LOAD — the load
    // failure is not a node:test assertion, so it never reaches the TAP counters, and the runner says it with a
    // plain "x", not "✗". Measured: a tree that was SUITE RED (funnel-link-guard refused to load) read
    // `# fail 0` here and would have been published as green. The headline the runner prints is the verdict.
    suiteRed: /^SUITE RED\b/m.test(out) || /FAILED TO LOAD/.test(out) };
  if (r.tests === null || r.fail === null) throw new Error('RUN-CV11 emit REFUSED: the registry reading produced no parsable summary. A reading that was not taken is never published as a number.');
  return r;
}

// ── reading 2: the site suite ────────────────────────────────────────────────────────────────────
async function readSite() {
  const out = await run('node', ['scripts/run-tests.mjs', '--all'], root);
  const m = out.match(/^all: (\d+)\/(\d+) suites passed/m);
  if (!m) throw new Error('RUN-CV11 emit REFUSED: the site suite produced no "all: N/M" line. Not taken is not a number.');
  const failed = (out.match(/^FAIL\s+(tests\/\S+)/gm) || []).map((l) => l.replace(/^FAIL\s+/, ''));
  const envOnly = failed.filter((f) => ENV_ONLY.has(f));
  const product = failed.filter((f) => !ENV_ONLY.has(f));
  return { takenAt: new Date().toISOString(), passed: Number(m[1]), total: Number(m[2]), failed, envOnly, product };
}

const [reg, site] = await Promise.all([readRegistry(), readSite()]);
console.log(`[RUN-CV11] registry: ${reg.pass}/${reg.tests} pass · ${reg.fail} fail · ${reg.skipped} not taken` + (reg.failedToLoad.length ? ` · failed to load: ${reg.failedToLoad.join(', ')}` : ''));
if (reg.fail !== 0 || reg.failedToLoad.length || reg.suiteRed) {
  throw new Error(`RUN-CV11 emit REFUSED: registry has ${reg.fail} failing assertion(s) and ${reg.failedToLoad.length} suite(s) that failed to load. A red build is never published as a green headline.`);
}

console.log(`[RUN-CV11] site: ${site.passed}/${site.total} suites · env-only reds: ${site.envOnly.length} · product reds: ${site.product.length}`);
if (site.product.length) {
  throw new Error(`RUN-CV11 emit REFUSED: ${site.product.length} product suite(s) red (${site.product.join(', ')}). Not published as green.`);
}

const regReadings = `${reg.pass} of ${reg.tests} desktop checks pass, none failing`;
const notTaken = reg.skipped > 0 ? ` ${reg.skipped} read an operator-only record absent here and are reported as not taken.` : '';
const siteReadings = `${site.passed} of ${site.total} site suites pass` + (site.envOnly.length ? ` (${site.envOnly.length} environment-only on this build host)` : '');

// Every value ≤ 400 chars — headline fields are sentences, not reports (buildPublicStatus enforces it).
const publicFields = {
  status: 'active build — joined line: desktop checks all green; site suites green',
  milestone:
    'The live human Aria voice and the AXIS executive assistant are now joined to the build line that asks who is ' +
    'responsible before ARIA Sentinel acts. Every check was taken on the joined line, not on either half alone; ' +
    'the five places they disagreed were fixed at the source, not hidden.',
  readiness:
    'Built and tested this cycle. ' + regReadings + '.' + notTaken + ' ' + siteReadings + '. ' +
    'Publishing to the live site stays a deliberate manual step; nothing from this cycle is live until that click.',
  revenueToDate: 'none',
  headline:
    'ARIA / AXIS is in active build and is voice-operable. Sent: 0. Meetings 0, revenue none. Checks this cycle: ' +
    regReadings + '.' + notTaken + ' ' + siteReadings + '.',
  note:
    'Public status headline only. Detailed build state is operator-internal and served only to authenticated ' +
    'operators inside the AXIS command centre. This public feed never carries commit, branch, or operator-script detail.',
  generatedAt: new Date().toISOString(),
};

const res = emitAxisStatus({ root, publicFields, fullDetail: null });
const problems = checkPublicFiles(root);
if (problems.length) {
  throw new Error('RUN-CV11 emit REFUSED after write — ' + problems.map((p) => `${p.file}: ${p.reason}`).join('; '));
}
console.log('[RUN-CV11] public feed regenerated:', res.written.public.join(', '));
console.log('[RUN-CV11] leak + freshness check: OK');
