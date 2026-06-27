// Infinity Wisdom — SAFETY tests. The engine's dangerous parts must be impossible by construction.
// planCycle() is pure, so every property is asserted with no I/O. Covers the five mandated tests:
// (1) kill-switch halts, (2) caps cannot be exceeded, (3) risky never auto-runs, (4) no leak in the
// public asset, (5) new-agent gate — plus routing, STOP detection, and the tamper-evident log.
import assert from 'node:assert/strict';
import {
  planCycle, checkStop, bestFitAgent, rollupCounts, toPublicCounts, assertNoLeak,
  sealLog, verifyLog, DEFAULT_CAPS,
} from '../scripts/infinity-wisdom-core.mjs';
import { classifyJobSafety } from '../scripts/axis-gates.mjs';

const now = 1_000_000;
// Helper: a safe doc branch.
const safeBranch = (id, over = {}) => ({ id, depth: 1, kind: 'doc', safe: true, title: `task ${id}`, prompt: 'write a doc', capability: 'doc', ...over });
const agentReg = (caps) => ({ agents: caps.map((c, i) => ({ id: `a${i}`, name: `agent-${c}`, capabilities: [c] })), runningAgentIds: [], counts: {} });

// ── (1) KILL-SWITCH halts mid-loop → empty plan, nothing enqueued ─────────────────────────────────
{
  // checkStop detects both env and file.
  assert.equal(checkStop({ envKill: '1' }), 'env INFINITY_WISDOM_STOP=1');
  assert.equal(checkStop({ killFileExists: true }), 'kill-switch file present');
  assert.equal(checkStop({}), null);

  const branches = [safeBranch('t1'), safeBranch('t2'), safeBranch('t3')];
  const plan = planCycle({ state: agentReg(['doc']), branches, stop: 'kill-switch file present', now });
  assert.equal(plan.halted, true);
  assert.equal(plan.enqueue.length, 0, 'STOP ⇒ nothing is enqueued');
  assert.equal(plan.newAgents.length, 0, 'STOP ⇒ no new agents');
  assert.equal(plan.approvals.length, 0);
  assert.ok(plan.logEntries.some((e) => e.action === 'halt'));
}

// ── (2) CAPS cannot be exceeded — even with a flood of branches ──────────────────────────────────
{
  const caps = { maxConcurrentAgents: 8, maxEnqueuePerCycle: 3, maxBranchesPerCycle: 6, maxNewAgentsPerCycle: 1, newAgentApprovalThreshold: 1, maxBranchDepth: 4, maxTotalAgents: 24, minCycleIntervalMs: 0 };
  const flood = Array.from({ length: 50 }, (_, i) => safeBranch(`f${i}`));
  const plan = planCycle({ state: agentReg(['doc']), branches: flood, caps, now });
  assert.ok(plan.enqueue.length <= caps.maxEnqueuePerCycle, `enqueue ${plan.enqueue.length} must be ≤ ${caps.maxEnqueuePerCycle}`);
  assert.ok(plan.newAgents.length <= caps.maxNewAgentsPerCycle);
  // Only maxBranchesPerCycle branches are even considered (rate limit on compounding).
  const considered = plan.enqueue.length + plan.approvals.length + plan.dropped.filter((d) => d.reason !== 'cap:maxBranchesPerCycle').length;
  assert.ok(considered <= caps.maxBranchesPerCycle);

  // Branch deeper than maxBranchDepth is dropped, never enqueued.
  const deep = planCycle({ state: agentReg(['doc']), branches: [safeBranch('deep', { depth: 9 })], caps, now });
  assert.equal(deep.enqueue.length, 0);
  assert.ok(deep.dropped.some((d) => /maxBranchDepth/.test(d.reason)));

  // Concurrent-agent cap: with 8 already running, no headroom ⇒ nothing new enqueues.
  const busy = { ...agentReg(['doc']), runningAgentIds: ['a','b','c','d','e','f','g','h'] };
  const full = planCycle({ state: busy, branches: [safeBranch('x')], caps, now });
  assert.equal(full.enqueue.length, 0, 'no concurrency headroom ⇒ defer, not run');

  // Total-agent ceiling: a registry at the ceiling cannot spawn a new agent for an unmatched need.
  const ceilingAgents = { agents: Array.from({ length: 24 }, (_, i) => ({ id: `c${i}`, name: `c${i}`, capabilities: ['unrelated'] })), runningAgentIds: [], counts: {} };
  const ceil = planCycle({ state: ceilingAgents, branches: [safeBranch('need-new', { capability: 'totally-novel' })], caps, now });
  assert.equal(ceil.newAgents.length, 0, 'at maxTotalAgents no new agent is created');
  assert.ok(ceil.approvals.some((a) => /maxTotalAgents/.test(a.gate)));
}

// ── (3) RISKY branch never auto-runs → routes to approvals ───────────────────────────────────────
{
  const caps = { ...DEFAULT_CAPS, minCycleIntervalMs: 0 };
  const risky = [
    { id: 'r1', depth: 1, kind: 'doc', safe: true, title: 'Deploy the site to Netlify production', prompt: 'publish live', capability: 'doc' },
    { id: 'r2', depth: 1, kind: 'doc', safe: true, title: 'Send the outreach emails to the lead list', prompt: 'email prospects', capability: 'doc' },
    { id: 'r3', depth: 1, kind: 'system-fix', safe: true, title: 'rotate the stripe api key', prompt: 'change credential', capability: 'x' }, // unsafe kind
    { id: 'r4', depth: 1, kind: 'doc', safe: true, title: 'push to main and force-push', prompt: 'git push --force origin main', capability: 'doc' },
  ];
  const plan = planCycle({ state: agentReg(['doc', 'x']), branches: risky, caps, now });
  assert.equal(plan.enqueue.length, 0, 'no risky branch may be enqueued');
  assert.equal(plan.approvals.length, 4, 'all four risky branches route to approvals');
  for (const a of plan.approvals) assert.ok(a.gate, 'each parked branch carries a gate reason');
  // Sanity: the gate itself classifies these as unsafe.
  assert.equal(classifyJobSafety({ kind: 'doc', safe: true, title: 'deploy to netlify production' }).safe, false);
  assert.equal(classifyJobSafety({ kind: 'doc', safe: true, title: 'write a hardware KB article' }).safe, true);
}

// ── (4) NO SENSITIVE DATA in the public asset → counts only ──────────────────────────────────────
{
  const state = {
    updatedAt: '2026-06-27T00:00:00Z', stopped: false,
    agents: [{ id: 'a0', name: 'SECRET-Agent-Smith', capabilities: ['outreach'], email: 'lead@prospect.com' }],
    runningAgentIds: ['a0'],
    counts: { tasksDone: 12, branchesSpawned: 30, newAgentsTotal: 3, approvalsPending: 2 },
    nodes: [{ id: 'n1', title: 'Confidential prospect strategy', prompt: 'do not leak', assignedAgentName: 'SECRET-Agent-Smith' }],
  };
  const pub = toPublicCounts(state);
  // Only numeric counts + flags.
  assert.equal(pub.agentsActive, 1);
  assert.equal(pub.tasksDone, 12);
  assert.equal(pub.stopped, false);
  // The serialized public payload must contain none of the sensitive strings.
  const json = JSON.stringify(pub);
  for (const leak of ['SECRET-Agent-Smith', 'prospect', 'Confidential', 'do not leak', 'outreach', 'lead@']) {
    assert.ok(!json.includes(leak), `public asset leaked: ${leak}`);
  }
  assert.equal(assertNoLeak(pub), true, 'public payload passes the no-leak assertion');
  // And the assertion actually catches a leak when present.
  assert.equal(assertNoLeak({ name: 'oops' }), false);
  assert.equal(assertNoLeak({ title: 'oops' }), false);
}

// ── (5) NEW-AGENT GATE — over threshold → approvals, never a silent army ─────────────────────────
{
  const caps = { ...DEFAULT_CAPS, maxNewAgentsPerCycle: 1, newAgentApprovalThreshold: 1, maxEnqueuePerCycle: 10, maxBranchesPerCycle: 10, minCycleIntervalMs: 0 };
  // Three branches each needing a DISTINCT novel capability (no existing agent fits).
  const needNew = [
    safeBranch('nn1', { capability: 'novel-cap-1' }),
    safeBranch('nn2', { capability: 'novel-cap-2' }),
    safeBranch('nn3', { capability: 'novel-cap-3' }),
  ];
  const plan = planCycle({ state: agentReg(['doc']), branches: needNew, caps, now });
  assert.equal(plan.newAgents.length, 1, 'at most one net-new agent auto-created per cycle');
  assert.ok(plan.approvals.length >= 2, 'the rest are gated to approvals (no silent army)');
  for (const a of plan.approvals) assert.ok(a.requiresNewAgent === true && /new-agent/.test(a.gate));
  // The one created agent is logged + reversible.
  assert.equal(plan.newAgents[0].reversible, true);
  assert.ok(plan.logEntries.some((e) => e.action === 'new-agent'));
}

// ── RATE BUDGET — a cycle too soon after the last is skipped (compute budget) ────────────────────
{
  const caps = { ...DEFAULT_CAPS, minCycleIntervalMs: 60000 };
  const soon = planCycle({ state: agentReg(['doc']), branches: [safeBranch('t')], caps, now: 1000, lastCycleAt: 990 });
  assert.equal(soon.rateSkipped, true);
  assert.equal(soon.enqueue.length, 0, 'rate-skipped cycle enqueues nothing');
}

// ── ROUTING — best-fit existing agent wins; only a genuine gap creates a new agent ───────────────
{
  const agents = [{ id: 'a0', name: 'kb-agent', capabilities: ['kb-article', 'doc'] }, { id: 'a1', name: 'sc-agent', capabilities: ['scenario'] }];
  assert.equal(bestFitAgent({ capability: 'doc' }, agents).id, 'a0');
  assert.equal(bestFitAgent({ capability: 'scenario' }, agents).id, 'a1');
  assert.equal(bestFitAgent({ capability: 'totally-unknown' }, agents), null);
  // In a cycle, a matched branch routes (no new agent) while a gap creates one.
  const caps = { ...DEFAULT_CAPS, minCycleIntervalMs: 0 };
  const plan = planCycle({ state: { agents, runningAgentIds: [], counts: {} }, branches: [safeBranch('m', { capability: 'doc' })], caps, now });
  assert.equal(plan.newAgents.length, 0, 'a covered branch reuses an existing agent');
  assert.equal(plan.enqueue[0].assignedAgentId, 'a0');
}

// ── TAMPER-EVIDENT LOG — detects modification / truncation ───────────────────────────────────────
{
  const entries = [{ ts: 't', action: 'enqueue', id: 'a', reason: 'x' }, { ts: 't', action: 'new-agent', id: 'b', reason: 'y' }, { ts: 't', action: 'approval', id: 'c', reason: 'z' }];
  const sealed = sealLog(entries);
  assert.equal(verifyLog(entries, sealed).ok, true);
  const tampered = entries.map((e, i) => (i === 1 ? { ...e, id: 'HACKED' } : e));
  assert.equal(verifyLog(tampered, sealed).ok, false);
  assert.equal(verifyLog(entries.slice(0, 2), sealed).ok, false); // truncation
}

console.log('infinity-wisdom safety test suite passed (STOP · caps · risky→approvals · no-leak · new-agent gate · rate budget · routing · tamper-log).');
