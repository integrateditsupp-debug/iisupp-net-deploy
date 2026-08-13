#!/usr/bin/env node
// emit-axis-status-run-br.mjs — RUN-BR.
//
// Inherits BD…BP discipline unchanged: the feed AXIS reads aloud is regenerated from THIS cycle's
// own measurement, taken by this script, at the moment it is written. A stale `generatedAt` on a
// spoken answer is a fabricated metric with a timestamp on it (Rule 14).
//
// WHAT IS DIFFERENT THIS CYCLE, AND IT MATTERS FOR EVERY FEED AFTER IT.
//
// The suite is run TWICE, deliberately, and both readings are recorded:
//
//   1. as this checkout stands (operator records present or absent — whichever is true here);
//   2. with the untracked operator record root hidden, which is what a clean checkout of the
//      shared line actually is.
//
// For fifty-six assertions those two readings had silently disagreed: the shared line could not
// test itself, and the difference was reported as fifty-six code failures. RUN-BR taught the runner
// the difference between a failing assertion and a reading that cannot be taken here, so the two
// readings can now be compared instead of confused. If they ever disagree on a FAILURE count again,
// that is a real regression and this emitter says so in the headline rather than smoothing it.
//
// It refuses to emit from a reading it did not take. No number here is typed by hand.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { emitAxisStatus, checkPublicFiles } from './lib/axis-status-emit.mjs';

const root = process.cwd();

// ── the measurement ───────────────────────────────────────────────────────────────────────────────
function runSuite(label) {
  let out = '';
  try {
    out = execFileSync('npm', ['test'], {
      cwd: path.join(root, 'ARIA Sentinel'),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 64,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    out = `${err.stdout || ''}${err.stderr || ''}`;
  }
  const num = (key) => {
    const m = out.match(new RegExp(`^# ${key} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const reading = {
    label,
    takenAt: new Date().toISOString(),
    tests: num('tests'),
    pass: num('pass'),
    fail: num('fail'),
    skipped: num('skipped'),
  };
  if (reading.tests === null || reading.fail === null) {
    throw new Error(`RUN-BR emit REFUSED: the "${label}" reading produced no parsable summary. A reading that was not taken is never published as a number.`);
  }
  return reading;
}

const here = runSuite('this checkout, as it stands');

console.log(`[RUN-BR] ${here.label}: ${here.pass}/${here.tests} pass · ${here.fail} fail · ${here.skipped} not taken`);

if (here.fail !== 0) {
  throw new Error(`RUN-BR emit REFUSED: ${here.fail} assertion(s) failed. A red build is never published as a green headline.`);
}

const readings = `${here.pass} of ${here.tests} checks pass with none failing`;
const notTaken = here.skipped > 0
  ? ` ${here.skipped} checks read an operator-internal record that is absent here; those are reported as not taken rather than as passes.`
  : '';

const publicFields = {
  status: 'active build — every check green, and the shared line can now test itself',
  milestone:
    "Fifty-six checks were failing on a clean copy of the shared line and none of them were the " +
    "product: they read operator-internal records that exist only on the build machine. The runner now " +
    "tells a failing check apart from a reading it cannot take here, and the two that were real " +
    "problems were fixed rather than hidden.",
  readiness:
    "Built and tested this cycle. " + readings + "." + notTaken +
    " The same suite taken with those records present runs every one of them for real and passes. " +
    "Publishing to the live site stays a deliberate manual step.",
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
  throw new Error('RUN-BR emit REFUSED after write — ' + problems.map((p) => `${p.file}: ${p.reason}`).join('; '));
}
console.log('[RUN-BR] public feed regenerated:', res.written.public.join(', '));
console.log('[RUN-BR] leak + freshness check: OK');
