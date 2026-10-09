// agent-preflight.test.mjs — the two readings the preflight exists to get right.
//
// The script's whole job is to refuse two specific ways of being confidently wrong: treating a feed
// that is weeks old as a current reading, and reporting on a branch nobody builds on. Both are
// proven here against a temp-dir fixture, so the assertions do not depend on the state of this
// checkout — a test that passes only while the real repo happens to be on a live branch would go
// quiet the moment it mattered.
//
// Run: node tests/agent-preflight.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'agent-preflight.mjs');

const M = await import(new URL('../scripts/agent-preflight.mjs', import.meta.url).href);

const NOW = '2026-10-08T20:00:00.000Z';

/** A checkout-shaped fixture: only the files the preflight reads, nothing else. */
function fixture({ generatedAt, needsAhmad, bootstrapPaused, runStats } = {}) {
  const dir = makeScratchDir('agent-preflight-');
  if (generatedAt !== undefined) {
    fs.mkdirSync(path.join(dir, '.well-known', 'axis'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.well-known', 'axis', 'status.json'),
      JSON.stringify({ status: 'fixture', generatedAt }),
    );
  }
  if (needsAhmad) fs.writeFileSync(path.join(dir, 'NEEDS-AHMAD.md'), needsAhmad);
  if (runStats) {
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tests', 'run-stats.json'), runStats);
  }
  if (bootstrapPaused) {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'AGENT-BOOTSTRAP.md'), bootstrapPaused);
  }
  return dir;
}

const clean = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// ── The stale flag ────────────────────────────────────────────────────────────────────────────────

test('a feed older than the threshold is STALE, with its age attached', () => {
  const dir = fixture({ generatedAt: '2026-08-13T02:30:03.316Z' });
  try {
    const r = M.statusFeedAge(dir, new Date(NOW));
    assert.equal(r.present, true);
    assert.equal(r.stale, true, 'a feed from August quoted in October is not a current reading');
    assert.ok(r.ageHours > M.STATUS_STALE_HOURS, 'the age is reported, not just the verdict');
    assert.equal(r.thresholdHours, M.STATUS_STALE_HOURS);
  } finally {
    clean(dir);
  }
});

test('a feed inside the threshold is fresh, and the boundary is not off by an hour', () => {
  const now = new Date(NOW);
  const justInside = new Date(now.getTime() - (M.STATUS_STALE_HOURS - 1) * 3600000).toISOString();
  const justOutside = new Date(now.getTime() - (M.STATUS_STALE_HOURS + 1) * 3600000).toISOString();

  const a = fixture({ generatedAt: justInside });
  try {
    assert.equal(M.statusFeedAge(a, now).stale, false, `${M.STATUS_STALE_HOURS - 1}h old is fresh`);
  } finally {
    clean(a);
  }

  const b = fixture({ generatedAt: justOutside });
  try {
    assert.equal(M.statusFeedAge(b, now).stale, true, `${M.STATUS_STALE_HOURS + 1}h old is stale`);
  } finally {
    clean(b);
  }
});

test('a feed that is absent or undated is NOT TAKEN — never reported as fresh', () => {
  const absent = fixture({});
  try {
    const r = M.statusFeedAge(absent, new Date(NOW));
    assert.equal(r.present, false);
    assert.equal(r.stale, null, 'no reading is not the same as a good reading');
  } finally {
    clean(absent);
  }

  const undated = fixture({ generatedAt: undefined });
  fs.mkdirSync(path.join(undated, '.well-known', 'axis'), { recursive: true });
  fs.writeFileSync(path.join(undated, '.well-known', 'axis', 'status.json'), '{"status":"x"}');
  try {
    const r = M.statusFeedAge(undated, new Date(NOW));
    assert.equal(r.present, true);
    assert.equal(r.stale, null);
    assert.match(r.reason, /generatedAt/);
  } finally {
    clean(undated);
  }
});

// ── The dead-branch warning ───────────────────────────────────────────────────────────────────────

test('every dead line warns, by name', () => {
  assert.ok(M.DEAD_LINES.length >= 3, 'the retired lines are enumerated, not implied');
  for (const b of M.DEAD_LINES) {
    const w = M.deadBranchWarning(b);
    assert.ok(w, `${b} must warn`);
    assert.match(w, /DEAD BRANCH/);
    assert.ok(w.includes(b), 'the warning names the branch it is about');
  }
});

test('a live branch does not warn, and a remote-qualified dead line still does', () => {
  assert.equal(M.deadBranchWarning('main'), null);
  assert.equal(M.deadBranchWarning('cc/run-cu-2026-10-08'), null);
  assert.equal(M.deadBranchWarning(null), null, 'a branch that cannot be read is not a dead branch');
  assert.ok(
    M.deadBranchWarning(`remotes/origin/${M.DEAD_LINES[0]}`),
    'the same retired line reached through a remote ref is the same retired line',
  );
});

// ── The two together, through the CLI ─────────────────────────────────────────────────────────────

test('the CLI reports both on a fixture and exits non-zero so a script can act on it', () => {
  const dir = fixture({
    generatedAt: '2026-08-13T02:30:03.316Z',
    needsAhmad: '# NEEDS AHMAD\n\n## 2026-10-08 · fixture\n\n**1. First open item.** detail here\n\n'
      + '**2. Second open item.** more\n\n**3. Third open item.** more\n\n**4. Fourth.** not printed\n',
    bootstrapPaused: '# AGENT BOOTSTRAP\n\n## 8 · Paused / needs Ahmad\n\n'
      + '1. A paused thing that wraps\n   onto a second line.\n2. Another paused thing.\n\n## Next\n',
  });
  try {
    let out = '';
    let status = 0;
    try {
      out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--branch', M.DEAD_LINES[0], '--now', NOW], {
        encoding: 'utf8',
      });
    } catch (e) {
      out = (e.stdout || '') + (e.stderr || '');
      status = e.status;
    }
    assert.equal(status, 1, 'a dead branch or a stale feed is a non-zero exit, not just prose');
    assert.match(out, /DEAD BRANCH/);
    assert.match(out, /STALE/);
    assert.match(out, /First open item/);
    assert.match(out, /Third open item/);
    assert.ok(!out.includes('Fourth'), 'only the first three open items are printed');
    assert.match(out, /A paused thing that wraps onto a second line\./, 'wrapped items are folded');
  } finally {
    clean(dir);
  }
});

test('a clean fixture with a fresh feed and a live branch exits zero', () => {
  const dir = fixture({ generatedAt: NOW });
  try {
    const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--branch', 'main', '--now', NOW], {
      encoding: 'utf8',
    });
    assert.match(out, /fresh/);
    assert.ok(!out.includes('DEAD BRANCH'));
  } finally {
    clean(dir);
  }
});

test('nothing is written and no network is reached — the preflight only reads', () => {
  const dir = fixture({ generatedAt: NOW });
  try {
    const before = fs.readdirSync(dir).sort().join(',');
    execFileSync(process.execPath, [SCRIPT, '--root', dir, '--branch', 'main', '--now', NOW], { encoding: 'utf8' });
    assert.equal(fs.readdirSync(dir).sort().join(','), before, 'the fixture is untouched');
    assert.equal(M.WRITES, false);
    assert.equal(M.SENDS, false);
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(!/\bfetch\s*\(|node:https?|writeFileSync|mkdirSync|appendFileSync/.test(src),
      'no write call and no network client in the source');
  } finally {
    clean(dir);
  }
});

// ── RUN-CU / CU6 (2026-10-09): the CEO-critical ledger is the FIRST thing the preflight prints ──────
test('the red CEO-critical block is rendered first, from a fixture ledger, and an absent ledger is said so', () => {
  const dir = fixture({ generatedAt: NOW, needsAhmad: '## 2026-10-08 · x\n\n**1. y**\n' });
  try {
    // absent → present:false, the block says the ledger is missing, nothing throws
    const none = M.ceoCritical(dir, new Date(NOW));
    assert.equal(none.present, false);
    assert.match(none.block, /ledger not found/);
    // present → counted and classified; the rendered report starts with the block
    const ledger = path.join(dir, M.CEO_CRITICAL_LEDGER_REL); // the record root is never named here
    fs.mkdirSync(path.dirname(ledger), { recursive: true });
    fs.writeFileSync(ledger, [
      '# ledger', '', '## Open', '',
      '| # | what | who is waiting | deadline | category | source file | one-click | found by · on | status |',
      '|---|---|---|---|---|---|---|---|---|',
      '| 1 | Sign the thing | a counterpart | **2026-10-07** | signature | `a.md` | none | Cowork · 2026-10-08 | open |',
      '| 2 | Call someone back | a lead | not recorded | person-waiting | `b.md` | none | Cowork · 2026-10-08 | open |',
      '', '## Closed', '(none yet)', '',
    ].join('\n'));
    const some = M.ceoCritical(dir, new Date(NOW));
    assert.equal(some.present, true);
    assert.equal(some.open, 2);
    assert.equal(some.overdue, 1, 'Oct 7 is overdue on Oct 8');
    assert.equal(some.personWaiting, 1);
    const report = M.render(M.collect({ root: dir, now: new Date(NOW), branch: 'main' }));
    assert.ok(report.startsWith('## 🔴 CEO-CRITICAL — 2 open · 1 overdue'), 'the block precedes the preflight header');
    assert.ok(report.indexOf('🔴') < report.indexOf('── AGENT PREFLIGHT'));
    const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--branch', 'main', '--now', NOW], { encoding: 'utf8' });
    assert.match(out.split('\n')[0], /^## 🔴 CEO-CRITICAL/, 'the CLI prints it first too');
  } finally {
    clean(dir);
  }
});
