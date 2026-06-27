#!/usr/bin/env node
/* ============================================================================
 * Infinity Wisdom — the autonomous branching agent ENGINE (driver / I/O layer).
 *
 * Per documents/product-engineering/Infinity-Wisdom-Workflow.md. Each cycle:
 *   MONITOR  — read the agent capability registry + newly-COMPLETED AXIS jobs + director-supplied branches
 *   REVIEW   — a completed job is a reviewable completion
 *   BRANCH   — derive the best next safe paths (deterministic heuristic + director input), depth-capped
 *   ROUTE/CREATE — planCycle() routes each branch to a best-fit agent or (gated) a new agent
 *   EXECUTE  — enqueue SAFE jobs to the AXIS runner's queue (axis-jobs.jsonl); risky → approvals inbox
 *   LOG      — Obsidian markdown + a tamper-evident JSONL log; update state + the public counts-only asset
 *   LOOP     — repeat until STOP.
 *
 * SAFETY — this driver performs NO actions and spends NO money. It only PLANS (via the pure core) and
 * writes queue/log/state files. The AXIS runner is the sole executor and re-gates every job. By default
 * the driver only ENQUEUES (it does not invoke the runner) — pass --run-axis to also drain the queue via
 * `axis-runner --once` after planning (still safe-only, kill-switch-gated). STOP, the growth caps, the
 * risky→approvals routing, the new-agent gate, and the no-leak scrub all live in the pure core and are
 * enforced on every cycle.
 *
 * Usage:
 *   node scripts/infinity-wisdom.mjs --once         # plan + enact exactly one cycle
 *   node scripts/infinity-wisdom.mjs --loop         # loop until STOP (kill-switch-gated, rate-limited)
 *   node scripts/infinity-wisdom.mjs --dry-run      # plan only; write the public asset + log, enqueue NOTHING
 *   node scripts/infinity-wisdom.mjs --run-axis     # also drain the queue via the AXIS runner after planning
 *   node scripts/infinity-wisdom.mjs --stop         # arm the STOP kill-switch and exit
 * ==========================================================================*/
'use strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  planCycle, checkStop, toPublicCounts, assertNoLeak, rollupCounts,
  sealLog, DEFAULT_CAPS,
} from './infinity-wisdom-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const IW_STATE = path.join(STATE_DIR, 'infinity-wisdom-state.json');
const IW_LOG = path.join(STATE_DIR, 'infinity-wisdom-log.jsonl');
const IW_SEAL = path.join(STATE_DIR, 'infinity-wisdom-log.seal.json');
const IW_BRANCHES = path.join(STATE_DIR, 'infinity-wisdom-branches.jsonl'); // director-supplied (optional)
const PUBLIC_ASSET = path.join(ROOT, 'infinity-wisdom-public.json');        // counts ONLY — safe to serve publicly
const AXIS_JOBS = path.join(STATE_DIR, 'axis-jobs.jsonl');
const APPROVALS = path.join(STATE_DIR, 'autonomy', 'axis-approvals.jsonl');
const NEW_AGENTS_DIR = path.join(STATE_DIR, 'auto-created-agents');
const OBSIDIAN_LOG = path.join(ROOT, 'aria-vault', '11_CorpusCallosum', 'Infinity-Wisdom-Log.md');
const STOP_FILE = path.join(STATE_DIR, 'INFINITY-WISDOM-STOP');
const RUN_LOG = path.join(STATE_DIR, 'infinity-wisdom-run.log');

const ARGS = process.argv.slice(2);
const ONCE = ARGS.includes('--once');
const LOOP = ARGS.includes('--loop');
const DRY = ARGS.includes('--dry-run');
const RUN_AXIS = ARGS.includes('--run-axis');
const STOP_CMD = ARGS.includes('--stop');

const nowMs = () => Date.now();
const nowIso = () => new Date().toISOString();

async function rlog(line) { const s = `[${nowIso()}] ${line}`; console.log(s); try { await fsp.appendFile(RUN_LOG, s + '\n', 'utf8'); } catch {} }
function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }
function readJsonl(p) { try { return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } }

// ── Initial capability registry — one agent per SAFE kind, seeded on first run (the existing fleet). ─
function seedRegistry() {
  const kinds = [['kb-agent', ['kb-article', 'kb-stub']], ['doc-agent', ['doc', 'note']], ['classifier-agent', ['classifier-keyword']], ['scenario-agent', ['scenario', 'test']], ['research-agent', ['research-note']]];
  return kinds.map(([name, capabilities], i) => ({ id: `seed-${i}`, name, capabilities, source: 'seed', createdAt: nowIso() }));
}

// ── BRANCH — deterministic, HONEST next-best safe paths from a completion (RULE 14: real follow-on work). ─
function deriveBranches(completion, depth) {
  const base = { parentId: completion.id, depth: depth + 1, safe: true };
  const t = String(completion.title || completion.id);
  const map = {
    'kb-stub': [
      { kind: 'kb-article', capability: 'kb-article', title: `Expand to a full article: ${t}`, prompt: `Expand the KB stub "${t}" into a full RULE-16 article (problem→cause→steps→verify→related).` },
      { kind: 'classifier-keyword', capability: 'classifier-keyword', title: `Add classifier keywords for: ${t}`, prompt: `Propose classifier keywords/product-names for "${t}" as a note (no code edits).` },
    ],
    'kb-article': [{ kind: 'scenario', capability: 'scenario', title: `Add coverage scenarios for: ${t}`, prompt: `List 6 natural-phrasing test scenarios for "${t}".` }],
    'doc': [{ kind: 'note', capability: 'note', title: `Index/summarize: ${t}`, prompt: `Write a one-paragraph index entry summarizing the doc "${t}".` }],
    'classifier-keyword': [{ kind: 'scenario', capability: 'scenario', title: `Regression scenarios for keywords: ${t}`, prompt: `Write regression scenarios validating the keywords from "${t}".` }],
  };
  return (map[completion.kind] || [{ kind: 'note', capability: 'note', title: `Review follow-up: ${t}`, prompt: `Note the next best step after "${t}".` }])
    .map((b, i) => ({ id: `iw-${completion.id}-b${i}-${Math.abs(hash(t + i)) % 100000}`, ...base, ...b }));
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

async function enactPlan(plan, state) {
  // 1. SAFE enqueue → append to the AXIS runner's queue as queued jobs (it re-gates them).
  if (!DRY && plan.enqueue.length) {
    const jobs = readJsonl(AXIS_JOBS);
    const existing = new Set(jobs.map((j) => j.id));
    for (const b of plan.enqueue) {
      if (existing.has(b.id)) continue;
      jobs.push({ id: b.id, kind: b.kind, safe: true, status: 'queued', push: false, requireFrontmatter: false,
        title: b.title, targetFile: targetFileFor(b), prompt: b.prompt, origin: 'infinity-wisdom', assignedAgent: b.assignedAgentName, branchDepth: b.depth });
    }
    await fsp.writeFile(AXIS_JOBS, jobs.map((j) => JSON.stringify(j)).join('\n') + '\n', 'utf8');
  }
  // 2. Approvals (risky + gated new-agent) → approvals inbox, never auto-run.
  if (!DRY && plan.approvals.length) {
    await fsp.mkdir(path.dirname(APPROVALS), { recursive: true });
    const lines = plan.approvals.map((a) => JSON.stringify({ ts: nowIso(), source: 'infinity-wisdom', jobId: a.id, kind: a.kind, title: a.title, reason: a.gate, status: 'needs-approval', requiresNewAgent: a.requiresNewAgent === true }));
    await fsp.appendFile(APPROVALS, lines.join('\n') + '\n', 'utf8');
  }
  // 3. New agents (within the gate) → logged spec file + added to the registry.
  if (!DRY) for (const na of plan.newAgents) {
    state.agents.push(na);
    const spec = `---\nid: ${na.id}\nname: ${na.name}\ncapabilities: [${(na.capabilities || []).join(', ')}]\nsource: infinity-wisdom\nreversible: true\ncreatedAt: ${nowIso()}\n---\n\n# ${na.name}\n\nAuto-created by the Infinity Wisdom engine for branch \`${na.createdFor}\` because no existing agent\ncovered the capability \`${(na.capabilities || []).join(', ')}\`. Reversible (delete this file + the registry\nentry to retire). Creation logged in the tamper-evident Infinity Wisdom log.\n`;
    await fsp.mkdir(NEW_AGENTS_DIR, { recursive: true });
    await fsp.writeFile(path.join(NEW_AGENTS_DIR, `${na.name}.md`), spec, 'utf8');
  }
  return plan;
}

function targetFileFor(b) {
  const slug = String(b.id).replace(/[^a-z0-9-]/gi, '-').slice(0, 60);
  if (b.kind === 'kb-article' || b.kind === 'kb-stub') return `knowledge-base/_drafts/${slug}.md`;
  if (b.kind === 'scenario' || b.kind === 'test') return `documents/audits/iw-scenarios-${slug}.md`;
  return `documents/product-engineering/iw-notes-${slug}.md`;
}

// Append decisions to the tamper-evident log + re-seal; mirror a human-readable line to Obsidian.
async function writeLogs(logEntries) {
  if (!logEntries.length) return;
  const stamped = logEntries.map((e) => ({ ts: nowIso(), ...e }));
  await fsp.appendFile(IW_LOG, stamped.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  const all = readJsonl(IW_LOG);
  await fsp.writeFile(IW_SEAL, JSON.stringify(sealLog(all), null, 2), 'utf8');
  try {
    await fsp.mkdir(path.dirname(OBSIDIAN_LOG), { recursive: true });
    const md = `\n### ${nowIso()} — cycle\n` + stamped.map((e) => `- \`${e.action}\` ${e.id} — ${e.reason}`).join('\n') + '\n';
    await fsp.appendFile(OBSIDIAN_LOG, md, 'utf8');
  } catch {}
}

async function writePublicAsset(state) {
  const pub = toPublicCounts(state);
  if (!assertNoLeak(pub)) { await rlog('ABORT public write — leak check failed'); return false; } // never write a leaky asset
  await fsp.writeFile(PUBLIC_ASSET, JSON.stringify(pub, null, 2), 'utf8');
  return true;
}

async function runAxisOnce() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'axis-runner.mjs'), '--once'], { cwd: ROOT, stdio: 'inherit' });
    child.on('close', (code) => resolve(code));
    child.on('error', () => resolve(1));
  });
}

async function cycle() {
  const stop = checkStop({ killFileExists: fs.existsSync(STOP_FILE), envKill: process.env.INFINITY_WISDOM_STOP });
  const state = readJson(IW_STATE, null) || { v: 'infinity-wisdom-v1', startedAt: nowIso(), cycle: 0, stopped: false, agents: seedRegistry(), processedCompletions: [], counts: { tasksDone: 0, branchesSpawned: 0, newAgentsTotal: 0, approvalsPending: 0 }, lastCycleAt: 0 };

  // MONITOR — newly-completed AXIS jobs are the completions to review/branch.
  const doneJobs = readJsonl(AXIS_JOBS).filter((j) => j.status === 'done');
  const seen = new Set(state.processedCompletions || []);
  const completions = doneJobs.filter((j) => !seen.has(j.id));
  // BRANCH — heuristic next-paths + any director-supplied branches.
  let branches = [];
  for (const c of completions) branches.push(...deriveBranches(c, Number(c.branchDepth) || 0));
  branches.push(...readJsonl(IW_BRANCHES).filter((b) => b && b.id && !b._consumed));

  // PLAN (pure core — all gates + caps enforced here).
  const caps = { ...DEFAULT_CAPS, ...(state.caps || {}) };
  const plan = planCycle({ state, branches, caps, stop, now: nowMs(), lastCycleAt: state.lastCycleAt || 0 });

  // ENACT (planner-only; no execution, no spend).
  if (!stop && !plan.rateSkipped) await enactPlan(plan, state);

  // Update state + counts.
  state.cycle = (state.cycle || 0) + 1;
  state.stopped = Boolean(stop);
  state.stopReason = stop || null;
  if (!stop && !plan.rateSkipped) {
    for (const c of completions) (state.processedCompletions ||= []).push(c.id);
    state.counts.tasksDone = (state.counts.tasksDone || 0) + completions.length;
    state.counts.branchesSpawned = (state.counts.branchesSpawned || 0) + plan.enqueue.length;
    state.counts.newAgentsTotal = (state.counts.newAgentsTotal || 0) + plan.newAgents.length;
    state.counts.approvalsPending = (state.counts.approvalsPending || 0) + plan.approvals.length;
    state.lastCycleAt = nowMs();
    // Track the live tree (capped to keep the file investor-presentable, not unbounded).
    state.nodes = [...plan.enqueue.map((b) => ({ id: b.id, parentId: b.parentId, depth: b.depth, kind: b.kind, title: b.title, agent: b.assignedAgentName, status: 'queued' })), ...(state.nodes || [])].slice(0, 200);
  }
  state.updatedAt = nowIso();
  state.runningAgentIds = state.runningAgentIds || [];

  await fsp.mkdir(STATE_DIR, { recursive: true });
  // DRY = pure preview: persist NOTHING durable (no state cursor advance, no tamper-log append, no
  // queue) so a later real --once still sees the same completions. We DO refresh the public asset so
  // Cowork/investors can preview the projected counts (still counts-only, leak-checked).
  if (!DRY) {
    await fsp.writeFile(IW_STATE, JSON.stringify(state, null, 2), 'utf8');
    await writeLogs(plan.logEntries);
  }
  await writePublicAsset(state);

  await rlog(`cycle ${state.cycle}${stop ? ' — HALTED (' + stop + ')' : plan.rateSkipped ? ' — rate-skipped' : ''}: completions ${completions.length} · enqueued ${plan.enqueue.length} · approvals ${plan.approvals.length} · new-agents ${plan.newAgents.length}`);

  if (!DRY && RUN_AXIS && !stop && plan.enqueue.length) { await rlog('  · draining one safe job via the AXIS runner…'); await runAxisOnce(); }
  return { stop, plan };
}

async function main() {
  if (STOP_CMD) { await fsp.mkdir(STATE_DIR, { recursive: true }); await fsp.writeFile(STOP_FILE, `STOP ${nowIso()}`, 'utf8'); await rlog('STOP armed — kill-switch file written. The engine will halt on its next cycle.'); return; }
  await rlog(`Infinity Wisdom start — mode=${LOOP ? 'loop' : ONCE ? 'once' : DRY ? 'dry-run' : 'once'}${RUN_AXIS ? ' +run-axis' : ''}`);
  if (!LOOP) { await cycle(); await rlog('done (single cycle)'); return; }
  // LOOP — until STOP. The rate budget inside planCycle prevents a hot spin; we also sleep between cycles.
  const caps = { ...DEFAULT_CAPS, ...((readJson(IW_STATE, {}) || {}).caps || {}) };
  for (;;) {
    const { stop } = await cycle();
    if (stop) { await rlog('loop halted by STOP.'); break; }
    await new Promise((r) => setTimeout(r, Math.max(1000, caps.minCycleIntervalMs)));
  }
}

main().catch(async (e) => { await rlog(`FATAL: ${String(e && e.stack || e)}`); process.exit(1); });
