#!/usr/bin/env node
// loops/cli/loops.mjs — manage the IIS loop registry.
// Zero deps. Source of truth: loops/registry.json. YAML loops at loops/{id}.yaml.
//
// Subcommands (see LOOPS_SPEC §2):
//   list            list all loops with status
//   show <id>       print one loop's record + YAML
//   add <yaml-path> register a new loop (validates against schema)
//   run <id>        trigger immediate one-off run
//   pause <id>      stop cron runs
//   resume <id>     re-enable cron
//   kill <id>       force-stop running iteration
//   graph           render the spawns tree (ASCII + Mermaid to docs/loops-graph.mmd)
//   ledger          last 50 entries from docs/LOOPS_LEDGER.md
//   budget          today's spend across all loops vs cap

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const LOOPS_DIR  = resolve(__dirname, '..');
const REPO_ROOT  = resolve(LOOPS_DIR, '..');
const REGISTRY   = resolve(LOOPS_DIR, 'registry.json');
const LEDGER     = resolve(REPO_ROOT, 'docs', 'LOOPS_LEDGER.md');
const GRAPH_OUT  = resolve(REPO_ROOT, 'docs', 'loops-graph.mmd');

const [, , subcmd, ...rest] = process.argv;

function loadRegistry() {
  if (!existsSync(REGISTRY)) {
    return { schema: 'iis-loops/v1', updated: new Date().toISOString(), loops: [] };
  }
  return JSON.parse(readFileSync(REGISTRY, 'utf8'));
}
function saveRegistry(reg) {
  reg.updated = new Date().toISOString();
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
}
function findLoop(reg, id) {
  return reg.loops.find(l => l.id === id);
}
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

// ---- tiny YAML reader (flat keys + block scalars) — good enough for our format ----
function loadYAML(path) {
  const raw = readFileSync(path, 'utf8');
  const out = { _raw: raw };
  let key = null, buf = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (m && !line.startsWith(' ')) {
      if (key && buf.length) out[key] = buf.join('\n').trim();
      key = m[1];
      const v = m[2].trim();
      if (v === '|' || v === '>') { buf = []; }
      else if (v === '') { buf = []; }
      else { out[key] = v; key = null; buf = []; }
    } else if (key && line.startsWith(' ')) {
      buf.push(line.replace(/^\s{2}/, ''));
    }
  }
  if (key && buf.length) out[key] = buf.join('\n').trim();
  return out;
}

// ---- LEDGER append ----
function ledger(entry) {
  const dir = dirname(LEDGER);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(LEDGER)) writeFileSync(LEDGER, '# Loops Ledger\n\nAppend-only. Newest at top is fine; readers tolerate either order.\n\n');
  const ts = new Date().toISOString();
  appendFileSync(LEDGER, `- ${ts} | ${entry}\n`);
}

// ---- commands ----
const COMMANDS = {
  list() {
    const reg = loadRegistry();
    if (!reg.loops.length) { console.log('No loops registered. Use:  loops add <yaml-path>'); return; }
    console.log(`Registry: ${reg.loops.length} loop(s)  (updated ${reg.updated})`);
    console.log(`${pad('ID', 26)}${pad('STATUS', 10)}${pad('OWNER', 10)}${pad('CLASS', 18)}CADENCE`);
    console.log('-'.repeat(85));
    for (const l of reg.loops) {
      console.log(`${pad(l.id, 26)}${pad(l.status, 10)}${pad(l.owner, 10)}${pad(l.class || '?', 18)}${l.cadence}`);
    }
  },

  show(id) {
    if (!id) { console.error('usage: loops show <id>'); process.exit(2); }
    const reg = loadRegistry();
    const l = findLoop(reg, id);
    if (!l) { console.error(`unknown loop: ${id}`); process.exit(1); }
    console.log('--- registry record ---');
    console.log(JSON.stringify(l, null, 2));
    if (l.yaml && existsSync(resolve(REPO_ROOT, l.yaml))) {
      console.log('\n--- yaml ---');
      console.log(readFileSync(resolve(REPO_ROOT, l.yaml), 'utf8'));
    } else {
      console.log(`\n(yaml file ${l.yaml} not found)`);
    }
  },

  add(yamlPath) {
    if (!yamlPath) { console.error('usage: loops add <yaml-path>'); process.exit(2); }
    const abs = resolve(REPO_ROOT, yamlPath);
    if (!existsSync(abs)) { console.error(`not found: ${abs}`); process.exit(1); }
    const y = loadYAML(abs);
    // schema validation per LOOPS_SPEC §1
    const required = ['id', 'title', 'goal', 'owner', 'cadence', 'inputs', 'outputs', 'tools_allowed', 'constraints', 'verification', 'on_failure'];
    const missing = required.filter(k => !y[k]);
    if (missing.length) { console.error(`schema fail — missing: ${missing.join(', ')}`); process.exit(1); }
    if (!/(\d|stop conditions?|stop when)/i.test(y.goal)) {
      console.error('schema fail — goal must contain a measurable phrase or stop condition');
      process.exit(1);
    }
    const allowedConstraints = ['$0 spend', 'HARD RULE', 'Garry Tan', 'human review'];
    const okConstraint = allowedConstraints.some(c => y.constraints.includes(c));
    if (!okConstraint) {
      console.error('schema fail — constraints must mention at least one locked rule ($0 spend / HARD RULE / Garry Tan / human review)');
      process.exit(1);
    }
    const reg = loadRegistry();
    if (findLoop(reg, y.id)) {
      console.error(`loop ${y.id} already exists. use:  loops show ${y.id}`);
      process.exit(1);
    }
    reg.loops.push({
      id: y.id,
      title: y.title,
      yaml: yamlPath,
      owner: y.owner,
      cadence: y.cadence,
      class: y.class || '?',
      status: 'idle',
      approved_spend_usd: 0,
      last_run: null,
      success_count: 0,
      failure_count: 0,
      spawns: [],
      serves_top_goal: !!(y.serves === 'top-goal'),
    });
    saveRegistry(reg);
    ledger(`add ${y.id} — ${y.title}`);
    console.log(`registered ${y.id}`);
  },

  pause(id) { setStatus(id, 'paused'); },
  resume(id) { setStatus(id, 'idle'); },
  kill(id)   { setStatus(id, 'killed'); },

  run(id) {
    if (!id) { console.error('usage: loops run <id>'); process.exit(2); }
    const reg = loadRegistry();
    const l = findLoop(reg, id);
    if (!l) { console.error(`unknown loop: ${id}`); process.exit(1); }
    console.log(`running ${id} (manual trigger)…`);
    // Phase 1: runners aren't wired yet. Log a ledger entry and exit.
    // Phase 2: Codex implements the actual runner per-loop in netlify/functions/loop-runner-{id}.mjs
    ledger(`run ${id} — manual trigger (runner not yet wired; placeholder)`);
    console.log('placeholder — runner for this loop is not yet implemented.');
    console.log('Codex: implement netlify/functions/loop-runner-' + id + '.mjs');
  },

  graph() {
    const reg = loadRegistry();
    if (!reg.loops.length) { console.log('(empty registry)'); return; }
    // ASCII
    console.log('Loop spawns graph:');
    for (const l of reg.loops) {
      console.log(`  ${l.id}`);
      for (const s of (l.spawns || [])) console.log(`    └─ ${s}`);
    }
    // Mermaid
    const dir = dirname(GRAPH_OUT);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const lines = ['graph LR'];
    for (const l of reg.loops) {
      for (const s of (l.spawns || [])) lines.push(`  ${l.id} --> ${s}`);
    }
    writeFileSync(GRAPH_OUT, lines.join('\n') + '\n');
    console.log(`\nMermaid written → ${GRAPH_OUT}`);
  },

  ledger() {
    if (!existsSync(LEDGER)) { console.log('(no ledger yet)'); return; }
    const raw = readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.startsWith('- '));
    console.log(raw.slice(-50).join('\n'));
  },

  budget() {
    const reg = loadRegistry();
    const today = new Date().toISOString().slice(0, 10);
    const spend = reg.loops.reduce((s, l) => s + (l.approved_spend_usd || 0), 0);
    console.log(`Today (${today}):`);
    console.log(`  Loops registered: ${reg.loops.length}`);
    console.log(`  Approved daily spend: $${spend.toFixed(2)} (cap $100, lockdown default $0)`);
    if (spend > 0) console.log('  ⚠ any spend requires Ahmad approval per feedback-spend rule');
    else console.log('  ✓ $0 spend — within lockdown');
  },

  help() {
    console.log(`loops <subcmd> [args]

  list           show all registered loops
  show <id>      print one loop's record + yaml
  add <yaml>     register a new loop from yaml file
  run <id>       trigger immediate run (placeholder until runners wired)
  pause <id>     stop cron
  resume <id>    re-enable cron
  kill <id>      force-stop
  graph          spawns tree (ASCII + Mermaid)
  ledger         last 50 ledger entries
  budget         today's spend vs cap

Spec: docs/LOOPS_SPEC.md`);
  },
};

function setStatus(id, status) {
  if (!id) { console.error(`usage: loops ${status === 'paused' ? 'pause' : status === 'killed' ? 'kill' : 'resume'} <id>`); process.exit(2); }
  const reg = loadRegistry();
  const l = findLoop(reg, id);
  if (!l) { console.error(`unknown loop: ${id}`); process.exit(1); }
  const prev = l.status;
  l.status = status;
  saveRegistry(reg);
  ledger(`${prev} → ${status}: ${id}`);
  console.log(`${id}: ${prev} → ${status}`);
}

if (!subcmd || subcmd === 'help' || subcmd === '--help' || subcmd === '-h') {
  COMMANDS.help();
} else if (!COMMANDS[subcmd]) {
  console.error(`unknown subcommand: ${subcmd}`);
  COMMANDS.help();
  process.exit(2);
} else {
  COMMANDS[subcmd](...rest);
}
