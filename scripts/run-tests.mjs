#!/usr/bin/env node
// run-tests.mjs — runs the repo's test files and reports a single pass/fail.
//
// Written because both AXIS guard suites were unreachable from any automated path: package.json
// had 40 scripts and no `test` key, netlify.toml has no build command (static site), and there is
// no CI workflow and no git hook. A regression test that only runs when a human remembers to type
// its filename is documentation, not a guard. The 2026-08-06 Overview outage shipped past a test
// suite that would have caught it, because nothing ran it.
//
//   node scripts/run-tests.mjs           # the guard set -- fast, must always be green
//   node scripts/run-tests.mjs --all     # every tests/*.test.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const all = process.argv.includes('--all');

// The guard set: the suites that protect the AXIS Command Center shell and the deploy surface.
// Kept small on purpose so there is no excuse to skip it.
// A suite that only runs under --all is a suite nobody runs. RUN-AW recorded that lesson about the
// Sentinel manifest; the same hole exists here. The three 2026-08-11 AXIS suites are added BY HAND
// because they guard the shell too: whether AXIS can hear a wake word the browser actually returns,
// whether a dead brain says what is wrong instead of "try again in a sec", and whether the
// priorities panel ever invents a due date.
const GUARD = [
  'tests/axis-module-graph.test.mjs',
  'tests/axis-overview-panels.test.mjs',
  'tests/axis-voice-hearing.test.mjs',
  'tests/axis-brain-fallback.test.mjs',
  'tests/axis-priorities.test.mjs',
];

const files = all
  ? fs.readdirSync(path.join(ROOT, 'tests'))
      .filter(f => f.endsWith('.test.mjs'))
      .sort()
      .map(f => path.join('tests', f))
  : GUARD;

let passed = 0;
const failed = [];
for (const f of files) {
  if (!fs.existsSync(path.join(ROOT, f))) { failed.push([f, 'missing']); continue; }
  try {
    execFileSync(process.execPath, [f], { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
    passed++;
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    failed.push([f, out.trim().split('\n').slice(-3).join(' | ').slice(0, 300) || `exit ${e.status}`]);
  }
}

for (const [f, why] of failed) console.error(`FAIL  ${f}\n      ${why}`);
console.log(`${all ? 'all' : 'guard'}: ${passed}/${files.length} suites passed`);
process.exit(failed.length ? 1 : 0);
