// tests/axis-windows-traps.test.mjs — the five Windows traps, made mechanical (2026-08-12).
//
// Each of these cost real debugging time on this machine, each is invisible when it fires, and each
// is a one-line mistake anyone would make again. A comment in a runbook does not prevent them; a
// failing test does.
//
//   1. `$env:X = $null` assigns an EMPTY STRING. An empty ANTHROPIC_API_KEY still occupies its slot
//      in the credential precedence chain, beats the claude.ai OAuth login, and authenticates as
//      nobody. Only `Remove-Item Env:\X` unsets. This is why the Max plan went unused and a metered
//      account was billed until it ran dry.
//   2. Windows PowerShell 5.1 reads a .ps1 as ANSI unless it carries a UTF-8 BOM. An em dash from a
//      UTF-8 editor decodes as mojibake, produces a stray quote, and the script fails to PARSE —
//      silently, because the Startup shortcut runs it with -WindowStyle Hidden.
//   3. `*>>` and `>>` write UTF-16LE in 5.1. The supervisor log came out as spaced-apart mojibake,
//      useless for the one job it had.
//   4. A date regex with a trailing `\b` fails against 2026-07-21T09:00:01 — "1" and "T" are both
//      word characters. That hid a three-week outage: every log line read as undated.
//   5. A launcher started with -WindowStyle Hidden that writes no log cannot report anything. Trap 2
//      was invisible for exactly this reason.
//
// Run: node tests/axis-windows-traps.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ok = () => { n++; };
const problems = [];

function listFiles(dir, ext, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
const codeLines = (src) => src.split(/\r?\n/).map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*#/.test(l));

// ---------------------------------------------------------------------------
// PowerShell launchers
// ---------------------------------------------------------------------------
const ps1 = listFiles(path.join(root, 'scripts'), '.ps1');
assert.ok(ps1.length > 0, 'no .ps1 launchers found — has the layout moved?');

for (const f of ps1) {
  const src = fs.readFileSync(f, 'utf8');
  const hasBOM = src.charCodeAt(0) === 0xFEFF;

  // Trap 2 — non-ASCII without a BOM is a silent parse failure under PS 5.1.
  if (!hasBOM) {
    for (const [ln, line] of codeLines(src)) {
      const bad = [...line].find((c) => c.charCodeAt(0) > 126);
      if (bad) { problems.push(`${rel(f)}:${ln} non-ASCII ${JSON.stringify(bad)} in a .ps1 with no UTF-8 BOM — PS 5.1 will mojibake it and may fail to parse`); break; }
    }
  }

  for (const [ln, line] of codeLines(src)) {
    // Trap 1 — blanking is not unsetting.
    if (/\$env:[A-Za-z_][A-Za-z0-9_]*\s*=\s*\$null/.test(line)) {
      problems.push(`${rel(f)}:${ln} \`$env:X = $null\` assigns an empty string; use Remove-Item Env:\\X to unset`);
    }
    // Trap 3 — redirection operators write UTF-16.
    if (/\*?>>?\s*\$?\w*Log\b/i.test(line) && !/Add-Content|Out-File/.test(line)) {
      problems.push(`${rel(f)}:${ln} redirection to a log writes UTF-16LE in PS 5.1; pipe to Add-Content -Encoding utf8`);
    }
  }

  // Trap 5 — a runner launched hidden that cannot report is a runner whose failures are invisible.
  //
  // Keyed on the FILENAME, not on the file mentioning -WindowStyle Hidden. The install-*.ps1
  // scripts write that flag into the Startup shortcut they create; they do not run hidden
  // themselves, and flagging them was a false positive. It is the run-*.ps1 files that the
  // shortcuts launch hidden, and the shortcut supplies the flag — so the runner cannot know it is
  // hidden by reading itself. Every runner must log, unconditionally.
  if (/[\\/]run-[^\\/]+\.ps1$/.test(f)) {
    const logs = /Add-Content|Out-File|Set-Content|Start-Transcript/i.test(src);
    if (!logs) {
      problems.push(`${rel(f)} is a run-* launcher (started hidden by a Startup shortcut) and writes no log — a parse error or crash here is unobservable`);
    }
  }
}
ok();

// ---------------------------------------------------------------------------
// Trap 4 — the date regex that hid the outage.
// ---------------------------------------------------------------------------
// A `\b` immediately after a date pattern fails on ISO timestamps. Scanning our own scripts rather
// than the whole tree keeps this fast and keeps the finding actionable.
for (const f of listFiles(path.join(root, 'scripts'), '.mjs')) {
  const src = fs.readFileSync(f, 'utf8');
  for (const [ln, line] of src.split(/\r?\n/).map((l, i) => [i + 1, l])) {
    if (/^\s*\/\//.test(line)) continue;
    // e.g. /\b20\d\d-\d\d-\d\d\b/ — the trailing \b is the defect.
    if (/\\d\\d-\\d\\d\\b/.test(line) || /\d\\d-\\d\\d\\b/.test(line)) {
      problems.push(`${rel(f)}:${ln} date regex ends in \\b — it will not match 2026-07-21T09:00:01 ("1" and "T" are both word chars)`);
    }
  }
}
ok();

// ---------------------------------------------------------------------------
// Trap 6 (Node side) — argv concatenation under shell:true.
// ---------------------------------------------------------------------------
// With shell:true Node concatenates argv WITHOUT escaping, and this repo lives under
// "ARIA — Real-Time AI Assistant". Any path or quoted string passed as a flag value is shredded,
// which is why the AXIS worker sends its prompt over stdin instead.
for (const f of listFiles(path.join(root, 'scripts'), '.mjs')) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/shell:\s*(true|process\.platform)/.test(src)) continue;
  for (const [ln, line] of src.split(/\r?\n/).map((l, i) => [i + 1, l])) {
    if (/^\s*\/\//.test(line)) continue;
    // A flag whose value is a path-ish literal or a joined path, pushed into an args array.
    if (/(push|,)\s*'--[a-z-]+'\s*,\s*(path\.join|`|['"][^'"]*[\\/][^'"]*['"])/.test(line)) {
      problems.push(`${rel(f)}:${ln} a path-valued CLI flag under shell:true will be shredded by the Windows shell`);
    }
  }
}
ok();

// RATCHET on the no-log runners. Nine launchers predate this check and write no log. Their
// FAILURES are no longer invisible — job-watchdog asserts on each one's Windows LastTaskResult, so
// a non-zero exit is now reported — but their REASONS still are, which is a diagnosability gap
// worth closing deliberately rather than by an unattended mass edit of nine live jobs.
//
// New runners must log from the start. To clear one from this list, give it the shape used by
// run-axis-brain-worker.ps1: pipe the invocation through
//   | ForEach-Object { Add-Content -Path $Log -Value ([string]$_) -Encoding utf8 }
// with $ErrorActionPreference relaxed across the call.
const NOLOG_BASELINE = new Set([
  'scripts/run-business-development-agent.ps1',
  'scripts/run-ceo-action-digest-agent.ps1',
  'scripts/run-interaction-avoidance-agent.ps1',
  'scripts/run-miner-worker.ps1',
  'scripts/run-opportunity-engine-once.ps1',
  'scripts/run-opportunity-prep-packets-agent.ps1',
  'scripts/run-opportunity-quality-gate-agent.ps1',
  'scripts/run-senior-director-worker.ps1',
  'scripts/run-sentry-worker.ps1',
  'scripts/run-workspace-cleanup-agent.ps1',
]);

const fresh = problems.filter((p) => {
  if (!p.includes('writes no log')) return true;
  return ![...NOLOG_BASELINE].some((b) => p.startsWith(b + ' '));
});

if (fresh.length) {
  assert.fail(`${fresh.length} Windows trap(s) found — each of these is silent when it fires:\n  `
    + fresh.join('\n  '));
}

const carried = problems.length - fresh.length;
if (carried) console.log(`axis-windows-traps: ${carried} pre-existing no-log runner(s) carried in the baseline (failures still caught by job-watchdog)`);

console.log(`axis-windows-traps: ${n} trap classes checked across ${ps1.length} launchers, clean`);
