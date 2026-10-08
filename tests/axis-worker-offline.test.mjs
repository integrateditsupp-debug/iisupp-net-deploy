// tests/axis-worker-offline.test.mjs — the out-of-credit misdiagnosis (2026-08-12).
//
// Ahmad: "its now saying this again: 'My reasoning brain is out of credit. Top up the Anthropic
// account (Plans & Billing) and I am back.'"
//
// It was not out of credit in the sense that message implies. The local worker was not running, so
// the Max plan — the tier that is supposed to answer, for free — was unreachable, every $0 tier
// declined, and the director fell through to the metered API, which really is empty. The message
// was technically true about the API and completely wrong about what to DO: it sent Ahmad to Plans
// & Billing to spend money on a problem fixed by starting a process.
//
// What this protects:
//   · a billing error is re-diagnosed as worker_offline when the worker is in fact down
//   · the advice names the actual fix and says no top-up is needed
//   · the check runs only on the error path, so the happy path pays nothing for it
//   · the supervisor that keeps the worker alive stays a supervisor (restart loop + log)
//   · the launcher truly UNSETS the credential vars rather than blanking them
// Run: node tests/axis-worker-offline.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const B = require(path.join(root, 'netlify', 'functions', 'lib', 'axis-brain.cjs'));
const director = fs.readFileSync(path.join(root, 'netlify', 'functions', 'axis-director.js'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'scripts', 'run-axis-brain-worker.ps1'), 'utf8');
let n = 0; const ok = () => { n++; };

// ---- 1. workerOnline exists and fails closed ----
{
  assert.equal(typeof B.workerOnline, 'function', 'workerOnline is not exported');
  assert.equal(await B.workerOnline({}), false, 'no origin must read as offline, not as online');
  assert.equal(await B.workerOnline({ origin: '' }), false);
  // An unreachable origin must resolve false rather than reject — this runs inside an error path
  // and a throw there would replace an honest diagnosis with a 500.
  assert.equal(await B.workerOnline({ origin: 'https://127.0.0.1:1' }), false, 'must swallow network failure');
  ok();
}

// ---- 2. The director re-diagnoses a billing error when the worker is down ----
{
  assert.ok(/workerOnline/.test(director), 'the director never checks whether the worker is alive');
  assert.ok(/worker_offline/.test(director), 'there is no worker_offline reason code');
  // The rewrite must be reachable from the billing branch specifically.
  const i = director.indexOf("reason === 'no_credit'");
  assert.ok(i > 0, 'the no_credit branch does not trigger the worker check');
  const window = director.slice(i, i + 1200);
  assert.ok(/workerOnline/.test(window), 'the worker check is not inside the billing branch');
  assert.ok(/worker_offline/.test(window), 'the billing branch does not re-diagnose');
  ok();

  // The advice has to name the fix and defuse the spend, or it is the same wrong instruction.
  assert.ok(/axis-brain-worker\.mjs/.test(window), 'the message does not say what to start');
  assert.ok(/no top-?up/i.test(window), 'the message does not say a top-up is unnecessary');
  ok();
}

// ---- 3. The check is on the error path only ----
// Calling it on every request would add a Blobs round trip to the hot path to answer a question
// that only matters when something already failed.
{
  const iCheck = director.indexOf('workerOnline');
  const iErr = director.indexOf('classifyBrainError(r.status, errBody)');
  assert.ok(iErr > 0 && iCheck > iErr,
    'the liveness check runs before the API error is classified — that is the hot path');
  ok();
}

// ---- 4. The launcher is a supervisor, not a one-shot ----
// The previous version ran node once, hidden, with no log: any death was silent and permanent, and
// the only symptom was AXIS telling Ahmad to top up his account.
{
  assert.ok(/while\s*\(\s*\$true\s*\)/.test(runner), 'the launcher does not restart the worker');
  assert.ok(/Start-Sleep/.test(runner), 'there is no backoff between restarts');
  assert.ok(/axis-brain-worker\.log/.test(runner), 'a death still leaves no written reason behind');
  ok();
}

// ---- 5. The launcher UNSETS the credential vars ----
// `$env:X = $null` assigns an EMPTY STRING in PowerShell. An empty ANTHROPIC_API_KEY still occupies
// its slot in the precedence chain, beating the OAuth login and authenticating as nobody — the exact
// trap this launcher exists to avoid.
{
  assert.ok(/Remove-Item\s+"?Env:/.test(runner), 'the launcher does not truly unset the credential vars');
  assert.ok(!/\$env:ANTHROPIC_API_KEY\s*=\s*\$null/.test(runner),
    'blanking a credential var is not unsetting it — use Remove-Item');
  ok();
}

// ---- 6. The launcher is pure ASCII ----
// Windows PowerShell 5.1 reads a .ps1 as ANSI unless it carries a UTF-8 BOM. An em dash written by
// a UTF-8 editor decoded as mojibake, produced a stray quote, and the script failed to parse —
// silently, because the Startup shortcut runs it with -WindowStyle Hidden.
{
  const bad = [...runner].map((c, i) => [c, i]).filter(([c]) => c.charCodeAt(0) > 126);
  assert.equal(bad.length, 0,
    `non-ASCII in the launcher will mojibake under PS 5.1: ${bad.slice(0, 3).map(([c]) => JSON.stringify(c)).join(', ')}`);
  ok();
}

// ---- 7. The log is written as UTF-8, not UTF-16 ----
// PowerShell 5.1's `*>>` redirection writes UTF-16LE; the worker's own lines came out as
// spaced-apart mojibake, making the log useless for the one job it has.
{
  // Code lines only: the launcher's comments legitimately name `*>> $Log` while explaining why it
  // is not used, and matching those would make the guard unfixable.
  const code = runner.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.ok(!/\*>>\s*\$Log/.test(code), 'redirection operators write UTF-16 in PS 5.1');
  assert.ok(/Add-Content[^\n]*-Encoding utf8/.test(code), 'the log is not pinned to UTF-8');
  ok();
}


// ---- 8. Only ONE supervisor may run ----
// Two supervisors means two workers polling the same Blobs job queue, which has no claim
// semantics: both see a pending job, one deletes it, and the other answers a job the console has
// already abandoned. The console times out, the cascade falls through to the metered API, and AXIS
// reports "out of credit" for a plan that was working the whole time. Observed 2026-08-12 with
// PIDs 32488 and 45920 both alive after a Startup shortcut and a manual launch overlapped.
{
  assert.ok(runner.includes('System.Threading.Mutex'),
    'the supervisor has no single-instance guard - a second launch starts a second worker');
  assert.ok(runner.includes('if (-not $createdNew)'), 'the guard must exit when it did not create the mutex');
  // Session-scoped, not Global: Global needs elevation, and these are per-user-session daemons.
  assert.ok(runner.includes('Local' + String.fromCharCode(92) + 'AxisBrainWorkerSupervisor'),
    'the mutex must be session-scoped');
  // A mutex, not a lockfile: Windows releases it when the process dies, so a hard kill cannot
  // leave a stale lock that blocks every future start.
  const guardCode = runner.split(String.fromCharCode(10))
    .filter((l) => !l.trim().startsWith('#')).join(String.fromCharCode(10));
  assert.ok(!guardCode.includes('lockfile'), 'a lockfile would survive a hard kill; use the mutex');
  ok();
}

console.log(`axis-worker-offline: ${n} checks passed`);
