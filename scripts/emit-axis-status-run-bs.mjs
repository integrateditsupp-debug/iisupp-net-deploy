#!/usr/bin/env node
// emit-axis-status-run-bs.mjs — RUN-BS.
//
// Inherits BD…BR discipline unchanged: the feed AXIS reads aloud is regenerated from THIS cycle's
// own measurement, taken by this script, at the moment it is written. A stale `generatedAt` on a
// spoken answer is a fabricated metric with a timestamp on it (Rule 14).
//
// WHAT IS DIFFERENT THIS CYCLE. RUN-BR taught the runner to tell a failing check apart from a
// reading it cannot take — but only for operator records under `senior-director-state/`. Five
// suites merged this cycle failed on a clean copy of the shared line for a DIFFERENT reason: they
// read a Windows `.ps1` launcher (git-ignored by design), the operator's Obsidian vault, or counted
// twenty probes that only happen on win32. Four are now reported NOT TAKEN by name; the fifth was a
// real defect — two source files its suite imports had never been banked — and was fixed.
//
// So this emitter takes TWO readings, both by running the real suites, and refuses to publish if
// either one has a single failure:
//
//   1. the Sentinel suite (`npm test` in "ARIA Sentinel"), which is the assertion-level reading;
//   2. the site suite (`node scripts/run-tests.mjs --all`), which is the suite-level reading and is
//      where this cycle's five suites actually live.
//
// No number below is typed by hand.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { emitAxisStatus, checkPublicFiles } from './lib/axis-status-emit.mjs';

const root = process.cwd();

const capture = (cmd, args, cwd) => {
  try {
    return execFileSync(cmd, args, {
      cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return `${err.stdout || ''}${err.stderr || ''}`;
  }
};

// ── reading 1: the assertion-level suite ─────────────────────────────────────────────────────────
function sentinelReading() {
  const out = capture('npm', ['test'], path.join(root, 'ARIA Sentinel'));
  const num = (key) => {
    const m = out.match(new RegExp(`^# ${key} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const r = { label: 'assertion-level', takenAt: new Date().toISOString(),
    tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped') };
  if (r.tests === null || r.fail === null) {
    throw new Error('RUN-BS emit REFUSED: the assertion-level reading produced no parsable summary. A reading that was not taken is never published as a number.');
  }
  return r;
}

// ── reading 2: the suite-level sweep this cycle's work lives in ──────────────────────────────────
function siteReading() {
  const out = capture('node', ['scripts/run-tests.mjs', '--all'], root);
  const m = out.match(/^all:\s+(\d+)\/(\d+)\s+suites passed/m);
  if (!m) {
    throw new Error('RUN-BS emit REFUSED: the suite-level reading produced no parsable summary.');
  }
  return { label: 'suite-level', takenAt: new Date().toISOString(),
    passed: Number(m[1]), total: Number(m[2]), failed: Number(m[2]) - Number(m[1]) };
}

const a = sentinelReading();
const s = siteReading();

console.log(`[RUN-BS] assertion-level: ${a.pass}/${a.tests} pass · ${a.fail} fail · ${a.skipped} not taken`);
console.log(`[RUN-BS] suite-level:     ${s.passed}/${s.total} suites · ${s.failed} failing`);

if (a.fail !== 0) throw new Error(`RUN-BS emit REFUSED: ${a.fail} assertion(s) failed. A red build is never published as a green headline.`);
if (s.failed !== 0) throw new Error(`RUN-BS emit REFUSED: ${s.failed} suite(s) failed. A red build is never published as a green headline.`);

const readings = `${a.pass} of ${a.tests} checks pass with none failing, across ${s.passed} of ${s.total} suites with none failing`;
const notTaken = a.skipped > 0
  ? ` ${a.skipped} checks read something absent here — an internal record, a Windows launcher, or the operator's own notes — and report as not taken, never as passes.`
  : '';

const publicFields = {
  status: 'active build — every check green, and a check that cannot be run here says so',
  milestone:
    'Five checks were failing on a clean copy of the shared line. Four were not the product: they read ' +
    'a Windows launcher or the operator\u2019s own notes, which exist only on the build machine, and now ' +
    'report as not taken instead of as failures. The fifth was a real gap and was fixed, not skipped.',
  readiness:
    'Built and tested this cycle. ' + readings + '.' + notTaken +
    ' Publishing to the live site stays a deliberate manual step.',
  revenueToDate: 'none',
  headline:
    'ARIA / AXIS is in active build and is voice-operable. Sent: 0. Meetings 0, revenue none. Checks ' +
    'this cycle: ' + readings + '.' + notTaken,
  note:
    'Public status headline only. Detailed build state is operator-internal and served only to ' +
    'authenticated operators inside the AXIS command centre. This public feed never carries commit, ' +
    'branch, or operator-script detail.',
  generatedAt: new Date().toISOString(),
};

const res = emitAxisStatus({ root, publicFields, fullDetail: null });
const problems = checkPublicFiles(root);
if (problems.length) {
  throw new Error('RUN-BS emit REFUSED after write — ' + problems.map((p) => `${p.file}: ${p.reason}`).join('; '));
}
console.log('[RUN-BS] public feed regenerated:', res.written.public.join(', '));
console.log('[RUN-BS] leak + freshness check: OK');
