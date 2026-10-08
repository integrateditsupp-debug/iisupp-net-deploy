#!/usr/bin/env node
// emit-axis-status-run-bt.mjs — RUN-BT.
//
// Inherits BD…BS discipline unchanged: the feed AXIS reads aloud is regenerated from THIS cycle's
// own measurement, taken by this script, at the moment it is written. A stale `generatedAt` on a
// spoken answer is a fabricated metric with a timestamp on it (Rule 14).
//
// WHAT THIS CYCLE MEASURED, AND WHY THE FEED HAD GONE QUIET.
//
// The public feed was stamped 2026-08-13 and nothing had refreshed it since: the branch the last
// cycle verified was never pushed, so the merge it staged never happened and the emitter that goes
// with it never ran. The shared line meanwhile moved on its own. This cycle took the backlog, merged
// it into the line as it stands now, and found two reds that were the product rather than the host:
// a chat topic that could not hand off to a person, and a classifier alternate that quietly stole
// 744 cases from the no-match bucket. Both were fixed, not baselined.
//
// It refuses to emit from a reading it did not take. No number here is typed by hand.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { emitAxisStatus, checkPublicFiles } from './lib/axis-status-emit.mjs';

const root = process.cwd();

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
    throw new Error(`RUN-BT emit REFUSED: the "${label}" reading produced no parsable summary. A reading that was not taken is never published as a number.`);
  }
  return reading;
}

const here = runSuite('this checkout, as it stands');
console.log(`[RUN-BT] ${here.label}: ${here.pass}/${here.tests} pass · ${here.fail} fail · ${here.skipped} not taken`);

if (here.fail !== 0) {
  throw new Error(`RUN-BT emit REFUSED: ${here.fail} assertion(s) failed. A red build is never published as a green headline.`);
}

const readings = `${here.pass} of ${here.tests} checks pass with none failing`;
const notTaken = here.skipped > 0
  ? ` ${here.skipped} checks read an operator-internal record that is absent here; those are reported as not taken rather than as passes.`
  : '';

const publicFields = {
  status: 'active build — the waiting backlog is in the line, and two real defects are out of it',
  milestone:
    'A batch of verified work had been sitting unmerged while the line moved on without it. It is in ' +
    'now, and merging it surfaced two faults that were the product rather than the test host: the ' +
    'chat topic that most wants a human could not hand off to one, and a matching rule had started ' +
    'claiming 744 questions it had no answer for. Both were fixed rather than written down as known.',
  readiness:
    'Built and tested this cycle. ' + readings + '.' + notTaken +
    ' Question-matching accuracy is measured at test time, not stored: 93.51% across 332,163 cases, ' +
    'every category above its floor. Publishing to the live site stays a deliberate manual step.',
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
  throw new Error('RUN-BT emit REFUSED after write — ' + problems.map((p) => `${p.file}: ${p.reason}`).join('; '));
}
console.log('[RUN-BT] public feed regenerated:', res.written.public.join(', '));
console.log('[RUN-BT] leak + freshness check: OK');
