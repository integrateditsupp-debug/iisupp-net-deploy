#!/usr/bin/env node
// agent-preflight.mjs — the thirty seconds before an agent starts work.
//
// WHY THIS EXISTS (2026-10-08). The fleet's recurring failure is not a bad decision, it is a
// confident one taken against a stale reading. Concrete, all from the record:
//   · a scheduled watcher spent ~29 runs reporting on `cc/master-fix-2026-07-02`, a branch whose tip
//     had been an ancestor of main for four weeks — every report was about a line nobody was on;
//   · the AXIS status feed was quoted as current while `generatedAt` was weeks old;
//   · `NEEDS-AHMAD.md` collected one-clicks nobody re-read, so the same push was "newly" discovered
//     cycle after cycle.
// None of that needs a smarter agent. It needs the five readings printed, with their ages attached,
// before anything is written.
//
// WHAT IT REFUSES TO DO. It takes no network, writes no file, runs no git command that can mutate a
// repository (`log`, `rev-parse`, `symbolic-ref` only), and when a reading cannot be taken it says so
// instead of substituting a guess. Zero dependencies; Windows and Linux.
//
//   node scripts/agent-preflight.mjs
//   node scripts/agent-preflight.mjs --json
//   node scripts/agent-preflight.mjs --root <dir> --branch <name> --now <iso>   # for tests
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PREFLIGHT_SCHEMA = 'agent-preflight.v1';
export const SENDS = false;
export const WRITES = false;

/** Mirrors `docs/AGENT-BOOTSTRAP.md` §1. A branch here is history, not a place to build. */
export const DEAD_LINES = Object.freeze([
  'merge-v2-to-main',
  'cc/master-fix-2026-07-02',
  'axis-command-center-v2',
  'cc/run-bh-2026-08-11',
]);

export const DEFAULT_BRANCH = 'main';

/** Past this, the AXIS status feed is not a current reading. */
export const STATUS_STALE_HOURS = 24;

const BOOTSTRAP_CANDIDATES = Object.freeze([
  path.join('senior-director-state', 'AGENT-BOOTSTRAP.md'),
  path.join('docs', 'AGENT-BOOTSTRAP.md'),
]);

const STATUS_FEED = path.join('.well-known', 'axis', 'status.json');
const RUN_STATS = path.join('tests', 'run-stats.json');
const NEEDS_AHMAD = 'NEEDS-AHMAD.md';

const repoRoot = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readTextOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function readJsonOrNull(file) {
  const raw = readTextOrNull(file);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── git, read-only and never fatal ───────────────────────────────────────────────────────────────
// A fixture directory is not a repository and an agent's preflight must still run there, so every
// git reading is optional and its absence is reported as absent, not as an error.
function git(args, root) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch {
    return null;
  }
}

export function gitFacts(root, branchOverride) {
  const branch = branchOverride || git(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  return {
    branch: branch || null,
    head: git(['rev-parse', '--short', 'HEAD'], root),
    commits: (git(['log', '-10', '--pretty=format:%h %ad %an: %s', '--date=short'], root) || '')
      .split('\n')
      .filter(Boolean),
  };
}

/**
 * A dead line, or null. The warning is about the branch the agent is standing on — reporting on a
 * retired line produces findings that are true of nothing anybody will ship.
 */
export function deadBranchWarning(branch) {
  if (!branch) return null;
  const name = String(branch).trim().replace(/^remotes\/[^/]+\//, '');
  if (!DEAD_LINES.includes(name)) return null;
  return `DEAD BRANCH: \`${name}\` is a retired line (docs/AGENT-BOOTSTRAP.md §1). `
    + `Findings taken here describe a line nobody is building on. Move to \`${DEFAULT_BRANCH}\` `
    + 'or to the live cc/run-* branch before you report anything.';
}

/**
 * Age of the AXIS status feed's own `generatedAt`, with the stale verdict attached.
 * `present:false` is a reading that was not taken; it is never reported as fresh.
 */
export function statusFeedAge(root, now = new Date()) {
  const file = path.join(root, STATUS_FEED);
  const feed = readJsonOrNull(file);
  if (!feed) return { present: false, stale: null, reason: `${STATUS_FEED} absent or unparseable` };
  const generatedAt = feed.generatedAt || null;
  const t = generatedAt ? Date.parse(generatedAt) : NaN;
  if (!generatedAt || Number.isNaN(t)) {
    return { present: true, generatedAt, stale: null, reason: 'generatedAt missing or unparseable' };
  }
  const ageHours = (now.getTime() - t) / 3600000;
  return {
    present: true,
    generatedAt,
    ageHours: Math.round(ageHours * 10) / 10,
    stale: ageHours > STATUS_STALE_HOURS,
    thresholdHours: STATUS_STALE_HOURS,
  };
}

/** The classifier/product loop's own numbers, or null when the file is absent. */
export function runStatsSummary(root) {
  const s = readJsonOrNull(path.join(root, RUN_STATS));
  if (!s) return null;
  return {
    label: s.label ?? null,
    lastRun: s.last_run_iso ?? s.last_run_at ?? null,
    totalRuns: s.total_runs ?? null,
    lastPassRatePct: s.last_pass_rate_pct ?? null,
    lastPassCount: s.last_pass_count ?? null,
    lastFailCount: s.last_fail_count ?? null,
    corpusSize: s.current_corpus_size ?? null,
  };
}

/**
 * The first N open items in `NEEDS-AHMAD.md`. Items are `**1. …**` lines under a dated `## ` heading;
 * newest is at the top of the file, so file order is the order Ahmad should read them in.
 */
export function firstNeedsAhmadItems(root, limit = 3) {
  const text = readTextOrNull(path.join(root, NEEDS_AHMAD));
  if (text === null) return { present: false, items: [] };
  const items = [];
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      section = heading[1].trim();
      continue;
    }
    const item = line.match(/^\*\*(\d+)\.\s*(.+?)\*\*(.*)$/);
    if (!item) continue;
    const title = `${item[1]}. ${item[2].trim()}`;
    items.push({ section, title, tail: item[3].trim().slice(0, 160) });
    if (items.length >= limit) break;
  }
  return { present: true, items };
}

/**
 * The paused / needs-Ahmad list, read out of the bootstrap rather than restated here — one list, one
 * place to correct it. Returns the bootstrap file used, so a reader can tell which copy answered.
 */
export function bootstrapPaused(root) {
  for (const rel of BOOTSTRAP_CANDIDATES) {
    const text = readTextOrNull(path.join(root, rel));
    if (text === null) continue;
    const m = text.match(/^##[^\n]*Paused[^\n]*$([\s\S]*?)(?=^##\s|\Z)/m);
    if (!m) continue;
    // A numbered item wraps across physical lines in the source. Printing only the first line cuts
    // the sentence in half, so continuation lines are folded back into the item they belong to.
    const lines = [];
    for (const raw of m[1].split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (/^\d+\.\s/.test(line)) lines.push(line);
      else if (lines.length) lines[lines.length - 1] += ` ${line}`;
    }
    return { file: rel, lines: lines.map((l) => l.replace(/\s+/g, ' ')) };
  }
  return { file: null, lines: [] };
}

export function collect({ root, now = new Date(), branch = null } = {}) {
  const base = root || repoRoot();
  const g = gitFacts(base, branch);
  return {
    schema: PREFLIGHT_SCHEMA,
    takenAt: now.toISOString(),
    root: base,
    git: g,
    deadBranch: deadBranchWarning(g.branch),
    statusFeed: statusFeedAge(base, now),
    runStats: runStatsSummary(base),
    needsAhmad: firstNeedsAhmadItems(base, 3),
    paused: bootstrapPaused(base),
  };
}

export function render(r) {
  const L = [];
  const dash = (v) => (v === null || v === undefined ? '—' : v);
  L.push('── AGENT PREFLIGHT ' + '─'.repeat(50));
  L.push(`taken at   ${r.takenAt}`);
  L.push(`root       ${r.root}`);
  L.push(`branch     ${dash(r.git.branch)}    HEAD ${dash(r.git.head)}`);
  if (r.deadBranch) {
    L.push('');
    L.push(`!! ${r.deadBranch}`);
  }
  L.push('');
  L.push('last 10 commits');
  if (r.git.commits.length) for (const c of r.git.commits) L.push(`  ${c}`);
  else L.push('  — no git history readable here');

  L.push('');
  L.push('AXIS status feed (.well-known/axis/status.json)');
  const s = r.statusFeed;
  if (!s.present) L.push(`  — reading not taken: ${s.reason}`);
  else if (s.stale === null) L.push(`  — reading not taken: ${s.reason}`);
  else {
    L.push(`  generatedAt ${s.generatedAt}  (${s.ageHours}h old)`);
    L.push(s.stale
      ? `  !! STALE — older than ${s.thresholdHours}h. Do not quote this feed as current.`
      : `  fresh (threshold ${s.thresholdHours}h)`);
  }

  L.push('');
  L.push('tests/run-stats.json');
  if (!r.runStats) L.push('  — absent');
  else {
    L.push(`  ${dash(r.runStats.label)}`);
    L.push(`  last run ${dash(r.runStats.lastRun)} · run #${dash(r.runStats.totalRuns)} · `
      + `pass ${dash(r.runStats.lastPassRatePct)}% (${dash(r.runStats.lastPassCount)} pass / `
      + `${dash(r.runStats.lastFailCount)} fail) · corpus ${dash(r.runStats.corpusSize)}`);
  }

  L.push('');
  L.push('NEEDS-AHMAD.md — first 3 open items');
  if (!r.needsAhmad.present) L.push('  — file absent');
  else if (!r.needsAhmad.items.length) L.push('  — no numbered items found');
  else for (const it of r.needsAhmad.items) {
    L.push(`  ${it.title}`);
    if (it.section) L.push(`      under: ${it.section}`);
  }

  L.push('');
  L.push(`paused / needs Ahmad${r.paused.file ? ` (from ${r.paused.file})` : ''}`);
  if (!r.paused.lines.length) L.push('  — no bootstrap paused list found');
  else for (const l of r.paused.lines) L.push(`  ${l}`);

  L.push('─'.repeat(69));
  return L.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
  };
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('agent-preflight — read-only state readings before an agent starts work.\n'
      + '  --json            machine-readable\n'
      + '  --root <dir>      read a different checkout (default: this repo)\n'
      + '  --branch <name>   override the branch reading (tests / detached HEAD)\n'
      + '  --now <iso>       override "now" so the stale verdict is deterministic');
  } else {
    const nowRaw = arg('--now');
    const parsedNow = nowRaw ? new Date(nowRaw) : new Date();
    const now = Number.isNaN(parsedNow.getTime()) ? new Date() : parsedNow;
    const report = collect({ root: arg('--root'), branch: arg('--branch'), now });
    console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : render(report));
    // Non-zero when a reading says STOP AND LOOK: a dead branch, or a stale feed being treated as
    // current. A warning nobody can wire into a script is a warning that gets skipped.
    process.exitCode = report.deadBranch || report.statusFeed.stale === true ? 1 : 0;
  }
}
