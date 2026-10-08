// tests/axis-job-watchdog.test.mjs — last SUCCESS, never last run (2026-08-12).
//
// Seven failures in one session shared one shape: the job wrote its problem down and nothing
// asserted on it. The registry + watchdog exist so that silence is itself an alert.
//
// The single rule under test: a job that RUNS punctually while FAILING every time must never be
// reported healthy. ARIA KB Pull did exactly that — on schedule, daily, exit code 1, for weeks —
// and every run-based check called it green.
//
// Run: node tests/axis-job-watchdog.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = await import(pathToFileURL(path.join(root, 'scripts', 'lib', 'job-registry.mjs')).href);
let n = 0; const ok = () => { n++; };

const NOW = new Date('2026-08-12T12:00:00Z').getTime();
const H = 3600000;
const job = (over = {}) => ({ id: 't', label: 'T', expectHours: 24, graceFactor: 2, ...over });

// ---- 1. A punctual failure is NOT a success ----
// The whole point. LastTaskResult=1 every morning at 09:00 for three weeks.
{
  const j = job({ evidence: { kind: 'winTask', task: 'X' } });
  const r = R.evaluate(j, { task: { lastResult: 1, lastRun: NOW - 3 * H } }, NOW);
  assert.equal(r.status, 'failing', 'a task that ran on time and exited non-zero must not be ok');
  assert.equal(r.lastSuccessMs, null, 'a failing task has no last success');
  // The conflation that bit the first version of the reporter: ageHours is the age of the last
  // SUCCESS. Populating it from lastRun made the report say "last success 2.8h ago" about a task
  // that has never succeeded.
  assert.equal(r.ageHours, null, 'ageHours must stay null when there is no success');
  assert.ok(r.lastRanHours > 2 && r.lastRanHours < 4, 'the run time is reported separately');
  ok();

  const good = R.evaluate(j, { task: { lastResult: 0, lastRun: NOW - 3 * H } }, NOW);
  assert.equal(good.status, 'ok', 'exit 0 inside the window is healthy');
  ok();
}

// ---- 2. Timestamps carry forward across multi-line entries ----
// pull.log stamps the first line and puts the outcome on the next. A strict same-line match found
// "Done. Wrote 321 bits", found no date on it, and reported a job that succeeded in June as having
// NEVER succeeded. Under-reporting success trains people to ignore the watchdog.
{
  const log = [
    '[2026-08-11T09:00:00] Pulling live bit-KB from https://iisupp.net/...',
    'Done. Wrote 321 bits to aria_brain_pack/bits/ (manifest updated).',
  ].join('\n');
  const hit = R.lastMatchingLine(log, /Done\.\s*Wrote\s+\d+\s+bits/i);
  assert.ok(hit, 'a success line under a dated header was not found');
  assert.equal(new Date(hit.t).toISOString().slice(0, 10), '2026-08-11');
  ok();
}

// ---- 3. The date regex that hid a 22-day outage ----
// `\b` after the day fails against 2026-07-21T09:00:01 — "1" and "T" are both word characters — so
// every line read as undated and the streak was invisible.
// Log stamps are written in LOCAL time (PowerShell `Get-Date`, node's toISOString-less format), so
// they are parsed as local. Comparing against a UTC calendar date would fail for any evening
// entry — asserted on the epoch instead, which tests the parse without baking in a timezone.
{
  const hit = R.lastMatchingLine('[2026-07-21T23:27:16] ERROR: Export failed: 502', /ERROR:/);
  assert.ok(hit, 'an ISO timestamp with a T separator must parse');
  assert.equal(hit.t, new Date('2026-07-21T23:27:16').getTime(),
    'the T-separated timestamp did not parse to the expected instant');
  ok();
}

// ---- 4. A newer failure outranks an older success ----
{
  const j = job({ evidence: { kind: 'log', path: 'x', successRe: /Done\./, failRe: /ERROR:/ } });
  const log = [
    '[2026-08-01T09:00:00] start', 'Done. Wrote 5 bits',
    '[2026-08-11T09:00:00] ERROR: Export failed: 502',
  ].join('\n');
  const r = R.evaluate(j, { present: true, logText: log }, NOW);
  assert.equal(r.status, 'failing', 'a success followed by failures is a failing job');
  assert.ok(r.lastSuccessMs, 'the older success is still reported, so age is knowable');
  ok();
}

// ---- 5. Staleness is silence ----
{
  const j = job({ expectHours: 24, graceFactor: 2, evidence: { kind: 'artifact', path: 'x' } });
  assert.equal(R.evaluate(j, { mtimeMs: NOW - 10 * H }, NOW).status, 'ok');
  assert.equal(R.evaluate(j, { mtimeMs: NOW - 100 * H }, NOW).status, 'stale',
    'past expectHours*graceFactor with no success is stale');
  assert.equal(R.evaluate(j, {}, NOW).status, 'never', 'a missing artifact means it produced nothing');
  ok();
}

// ---- 6. Unknown is never reported as healthy ----
// A watchdog that downgrades "cannot see it" to "fine" is the bug it was built to prevent.
{
  const j = job({ evidence: { kind: 'winTask', task: 'NoSuchTask' } });
  assert.equal(R.evaluate(j, { task: null }, NOW).status, 'unobserved',
    'a task that is not present must be unobserved, not ok');
  ok();
  assert.ok(R.UNOBSERVED_NOTE && /Netlify/.test(R.UNOBSERVED_NOTE),
    'the report must state what it does NOT cover');
  ok();
}

// ---- 7. The watchdog reports its own staleness first ----
{
  const stale = {
    results: [{ id: 'job-watchdog', label: 'This watchdog', status: 'stale', ageHours: 50, lastSuccessMs: 1 },
              { id: 'other', label: 'Other', status: 'ok', ageHours: 1 }],
    counts: { ok: 1, stale: 1 },
    bad: [{ id: 'job-watchdog', label: 'This watchdog', status: 'stale', ageHours: 50 }],
  };
  assert.match(R.spokenSummary(stale), /watchdog itself/i,
    'when the watchdog is stale it must say so before anything else');
  assert.match(R.spokenSummary(stale), /unverified/i, 'and must flag the rest as unverified');
  ok();

  // A failing job with no success must not render "? ago".
  const failing = {
    results: [{ id: 'job-watchdog', status: 'ok', ageHours: 0 }],
    counts: {},
    bad: [{ label: 'Win: ARIA KB Pull', status: 'failing', ageHours: null, lastRanHours: 3 }],
  };
  const said = R.spokenSummary(failing);
  assert.ok(!said.includes('?'), `spoken line leaked a "?" placeholder: ${said}`);
  assert.match(said, /never succeeded/i);
  ok();
}

// ---- 8. Every registered job declares what proves success ----
// Adding an unattended job without an evidence surface is how the next silent failure happens.
{
  for (const j of R.JOBS) {
    assert.ok(j.id && j.label, 'a job is missing id/label');
    assert.ok(j.expectHours > 0, `${j.id} has no expected cadence`);
    assert.ok(j.evidence && j.evidence.kind, `${j.id} declares no evidence surface`);
    if (j.evidence.kind === 'log') {
      assert.ok(j.evidence.successRe instanceof RegExp, `${j.id} has no successRe`);
      // A success pattern that also matches the pre-flight line is how "ran" gets mistaken for
      // "succeeded". pull.log prints "Pulling live bit-KB from ..." on failing runs too.
      assert.ok(!j.evidence.successRe.test('Pulling live bit-KB from https://iisupp.net/x'),
        `${j.id} successRe matches a pre-flight line — it will report failures as successes`);
    }
  }
  ok();
  assert.ok(R.JOBS.some((j) => j.id === 'job-watchdog'), 'the watchdog must watch itself');
  ok();
}

// ---- 9. The runner exists and is wired ----
{
  const runner = fs.readFileSync(path.join(root, 'scripts', 'job-watchdog.mjs'), 'utf8');
  assert.ok(/stampSelf\(\)/.test(runner), 'the watchdog does not stamp itself');
  assert.ok(runner.indexOf('stampSelf();') < runner.indexOf('evaluateAll('),
    'the self-stamp must happen before evaluation, so a crash still leaves proof of the attempt');
  // powershell.exe is a real exe; shell:true would concatenate argv unescaped, and this repo's
  // path contains spaces and an em dash.
  // Code lines only. The comment above legitimately names shell:true while explaining why it is
  // absent, and a guard that matches its own explanation is a guard that can never pass — the same
  // blind-guard failure that tests/axis-blind-guards.test.mjs now catches repo-wide.
  const runnerCode = runner.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/shell:\s*true/.test(runnerCode), 'the watchdog must not spawn with shell:true');
  assert.ok(/process\.exit\(/.test(runner), 'a broken job must produce a non-zero exit for CI');
  ok();
}

// ---- corroboration: a fixed job must stop reading as broken ----
// The Windows scheduler only refreshes LastTaskResult on its NEXT scheduled run, so after a mid-day
// fix the task still reports this morning's exit 1 while the job's own log shows a success minutes
// ago. Reported raw, that is "FAILING, never succeeded" about a working job for up to 24h - the
// same stale-signal-as-current mistake the whole registry exists to kill, one level up.
{
  const NOW = Date.parse('2026-08-12T16:00:00Z');
  const jobs = [
    { id: 'log-job', label: 'KB pull (log)', expectHours: 24, graceFactor: 2,
      evidence: { kind: 'artifact', path: 'x.log' } },
    { id: 'task-job', label: 'Win: KB Pull', expectHours: 24, graceFactor: 2,
      corroboratedBy: 'log-job', evidence: { kind: 'winTask', task: 'KB Pull' } },
  ];
  const evidence = {
    'log-job': { mtimeMs: Date.parse('2026-08-12T15:50:00Z') },        // succeeded 10 min ago
    'task-job': { task: { lastResult: 1, lastRun: Date.parse('2026-08-12T13:00:00Z') } }, // failed 3h ago
  };
  const { results, bad, counts } = R.evaluateAll(evidence, { now: NOW, jobs });
  const task = results.find((r) => r.id === 'task-job');
  assert.equal(task.status, 'recovering', `expected recovering, got ${task.status}`);
  assert.ok(!bad.some((b) => b.id === 'task-job'), 'a recovering job must not be reported as bad');
  assert.match(task.detail, /succeeded/, 'the reason must say the corroborating job succeeded');
  ok();

  // …but a corroborator that is OLDER than the failure proves nothing — still failing.
  const stale = R.evaluateAll({
    'log-job': { mtimeMs: Date.parse('2026-08-12T09:00:00Z') },        // older than the 13:00 failure
    'task-job': evidence['task-job'],
  }, { now: NOW, jobs });
  assert.equal(stale.results.find((r) => r.id === 'task-job').status, 'failing',
    'an older success must not excuse a newer failure');
  ok();

  // Every status the registry can produce needs a label in the report, or the table prints
  // "undefined" — which is exactly how `recovering` first shipped.
  const watchdogSrc = fs.readFileSync(path.join(root, 'scripts', 'job-watchdog.mjs'), 'utf8');
  for (const status of Object.keys(R.SEVERITY)) {
    assert.ok(new RegExp(`\\b${status}\\s*:`).test(watchdogSrc),
      `status "${status}" has no label in the watchdog's ICON map`);
  }
  assert.ok(/recovering/.test(R.spokenSummary({ results, counts, bad })),
    'the spoken line must not claim "all healthy" while hiding a recovering job');
  ok();
}

console.log(`axis-job-watchdog: ${n} checks passed`);
