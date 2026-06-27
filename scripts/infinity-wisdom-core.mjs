// infinity-wisdom-core — the PURE, no-I/O safety + planning heart of the Infinity Wisdom engine.
//
// Ahmad's vision: agents finish tasks → completions are reviewed → the system BRANCHES the best next
// paths → each branch is ROUTED to a best-fit existing agent or a NEW agent is created only if none
// fits → safe work EXECUTES via the AXIS runner → logged to Obsidian → loop 24/7 until STOP.
//
// "No room for error." This module makes the dangerous parts impossible by construction:
//   • STOP        — checkStop(): a kill-switch (file OR env) makes planCycle() return an EMPTY plan.
//   • $0 spend    — this module performs NO actions. It only PRODUCES A PLAN (which safe jobs to
//                   enqueue, which to route to approvals). The AXIS runner is the only executor, and
//                   it re-gates every job. Nothing here can call a paid API.
//   • safe-only   — every branch is run through the SHARED gate (axis-gates.classifyJobSafety). Risky
//                   branches go to `approvals`, NEVER to `enqueue`.
//   • growth caps — planCycle() can never emit more than the caps allow: concurrent agents, branch
//                   depth, branches/cycle, new-agents/cycle, enqueue/cycle, total-agent ceiling. The
//                   caps are applied as hard slices on the OUTPUT, so a buggy upstream cannot exceed them.
//   • new-agent   — a net-new agent over the per-cycle threshold (or the total ceiling) is GATED:
//     gate          routed to approvals as a logged, reversible request, never silently created.
//   • RULE 14     — toPublicCounts() emits counts only (no names/titles/prompts) for any public asset.
//   • audit       — sealLog()/verifyLog() hash-chain every decision (tamper-evident); no silent drops.
//
// planCycle() is PURE and deterministic given its inputs (including `now`), so every safety property is
// unit-tested without touching the filesystem, the network, or the clock.

import crypto from 'node:crypto';
import { classifyJobSafety } from './axis-gates.mjs';

// ── Growth caps (controlled infinity, not a fork bomb). Conservative defaults; override via opts.caps.
export const DEFAULT_CAPS = Object.freeze({
  maxConcurrentAgents: 8,        // never run more than N agents at once
  maxBranchDepth: 4,             // a branch deeper than this is dropped (no infinite descent)
  maxBranchesPerCycle: 6,        // rate-limit how many next-paths spawn per cycle
  maxNewAgentsPerCycle: 1,       // auto-create at most this many net-new agents per cycle…
  newAgentApprovalThreshold: 1,  // …and anything beyond the Nth new agent this cycle → approvals
  maxEnqueuePerCycle: 3,         // rate-limit jobs handed to the AXIS runner per cycle
  maxTotalAgents: 24,            // hard ceiling on the whole fleet (no silent army)
  minCycleIntervalMs: 60000,     // compute/rate budget — cycles may not run closer than this
});

const GENESIS = 'infinity-wisdom-genesis-v1';

// ── STOP ────────────────────────────────────────────────────────────────────────────────────────
// Pure: the driver passes whether the kill file exists + the env value. Either halts everything.
export function checkStop({ killFileExists = false, envKill = '' } = {}) {
  if (String(envKill || '') === '1') return 'env INFINITY_WISDOM_STOP=1';
  if (killFileExists) return 'kill-switch file present';
  return null;
}

// ── Best-fit routing over the capability registry ────────────────────────────────────────────────
// Returns the existing agent whose capabilities best cover the branch's required capability, or null.
export function bestFitAgent(branch, agents = []) {
  const need = String(branch.capability || branch.kind || '').toLowerCase();
  if (!need) return null;
  let best = null, bestScore = 0;
  for (const a of agents) {
    if (a.retired) continue;
    const caps = (a.capabilities || []).map((c) => String(c).toLowerCase());
    let score = 0;
    if (caps.includes(need)) score += 3;
    for (const c of caps) if (c && (need.includes(c) || c.includes(need))) score += 1;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore > 0 ? best : null;
}

// Map an Infinity-Wisdom branch to the AXIS job shape the shared gate understands.
function branchToJobShape(branch) {
  return { kind: branch.kind, safe: branch.safe === true, title: branch.title, prompt: branch.prompt, files: branch.files, requiresApproval: branch.requiresApproval };
}

/**
 * Plan ONE cycle. PURE — returns a plan; performs no I/O. The driver enacts the plan (writes the AXIS
 * queue, the approvals inbox, the new-agent specs, the Obsidian log) — but can only ever enact what
 * this function permits, and this function can never exceed the caps.
 *
 * @param {object} input
 *   state        { agents:[{id,name,capabilities,retired?}], runningAgentIds?:string[], counts? }
 *   completions  [{ id, agentId, title, ... }]  finished tasks awaiting review
 *   branches     [{ id, parentId, depth, kind, title, prompt, capability, safe?, risky?, requiresNewAgent?, ... }]
 *                candidate next-paths derived from completions (director/heuristic supplied)
 *   caps         partial caps override (merged over DEFAULT_CAPS)
 *   stop         reason string|null (from checkStop)
 *   now          epoch ms (injected)
 *   lastCycleAt  epoch ms of the previous cycle (for the rate budget)
 * @returns {{ halted, haltReason, enqueue, approvals, newAgents, dropped, logEntries, counts }}
 */
export function planCycle(input = {}) {
  const caps = { ...DEFAULT_CAPS, ...(input.caps || {}) };
  const now = Number.isFinite(input.now) ? input.now : 0;
  const state = input.state || {};
  const agents = Array.isArray(state.agents) ? state.agents.filter((a) => !a.retired) : [];
  const runningIds = new Set(state.runningAgentIds || []);
  const branches = Array.isArray(input.branches) ? input.branches : [];

  const enqueue = [], approvals = [], newAgents = [], dropped = [], logEntries = [];
  const log = (action, branchId, reason) => logEntries.push({ action, id: branchId, reason });

  // ── STOP — halt everything. Empty plan. ────────────────────────────────────────────────────────
  if (input.stop) {
    log('halt', '*', input.stop);
    return { halted: true, haltReason: input.stop, enqueue, approvals, newAgents, dropped, logEntries,
      counts: rollupCounts(state, { enqueue, approvals, newAgents }) };
  }

  // ── Compute/rate budget — too soon since the last cycle ⇒ no work this tick. ────────────────────
  if (Number.isFinite(input.lastCycleAt) && (now - input.lastCycleAt) < caps.minCycleIntervalMs) {
    log('rate-skip', '*', `min interval ${caps.minCycleIntervalMs}ms not elapsed`);
    return { halted: false, rateSkipped: true, enqueue, approvals, newAgents, dropped, logEntries,
      counts: rollupCounts(state, { enqueue, approvals, newAgents }) };
  }

  // Available concurrency this cycle = headroom under the concurrent-agent cap.
  let concurrencyHeadroom = Math.max(0, caps.maxConcurrentAgents - runningIds.size);
  let totalAgents = agents.length;
  let newAgentsThisCycle = 0;
  let branchesConsidered = 0;

  for (const raw of branches) {
    // Cap: branches considered per cycle (rate limit on compounding).
    if (branchesConsidered >= caps.maxBranchesPerCycle) { dropped.push({ id: raw.id, reason: 'cap:maxBranchesPerCycle' }); log('drop', raw.id, 'cap:maxBranchesPerCycle'); continue; }
    branchesConsidered++;

    // Cap: branch depth (no infinite descent).
    const depth = Number(raw.depth) || 0;
    if (depth > caps.maxBranchDepth) { dropped.push({ id: raw.id, reason: 'cap:maxBranchDepth' }); log('drop', raw.id, `cap:maxBranchDepth(${depth})`); continue; }

    // Gate: safe vs risky — risky NEVER auto-runs; it goes to approvals.
    const verdict = classifyJobSafety(branchToJobShape(raw));
    if (!verdict.safe) { approvals.push({ ...raw, status: 'needs-approval', gate: verdict.reason }); log('approval', raw.id, verdict.reason); continue; }

    // Route or create.
    let agent = bestFitAgent(raw, agents);
    let routedNewAgent = null;
    if (!agent) {
      // No existing agent fits → a NEW agent is needed. This is GATED.
      if (totalAgents >= caps.maxTotalAgents) {
        approvals.push({ ...raw, status: 'needs-approval', gate: `cap:maxTotalAgents(${caps.maxTotalAgents}) — new agent blocked`, requiresNewAgent: true });
        log('approval', raw.id, 'cap:maxTotalAgents — new agent gated'); continue;
      }
      if (newAgentsThisCycle >= caps.newAgentApprovalThreshold || newAgentsThisCycle >= caps.maxNewAgentsPerCycle) {
        approvals.push({ ...raw, status: 'needs-approval', gate: 'new-agent over per-cycle threshold — human OK required', requiresNewAgent: true });
        log('approval', raw.id, 'new-agent gated (per-cycle threshold)'); continue;
      }
      // Within the gate: auto-create ONE new agent, logged + reversible.
      routedNewAgent = { id: `agent-${raw.id}`, name: raw.suggestedAgentName || `IW-${raw.kind}-agent`, capabilities: [raw.capability || raw.kind].filter(Boolean), createdFor: raw.id, createdAtCycle: now, source: 'infinity-wisdom', reversible: true };
      newAgents.push(routedNewAgent); newAgentsThisCycle++; totalAgents++;
      agent = routedNewAgent;
      log('new-agent', routedNewAgent.id, `created for ${raw.id}`);
    }

    // Cap: concurrent agents + enqueue/cycle. If no headroom, defer (re-queued next cycle), don't drop.
    if (concurrencyHeadroom <= 0) { dropped.push({ id: raw.id, reason: 'cap:maxConcurrentAgents (deferred)' }); log('defer', raw.id, 'cap:maxConcurrentAgents'); continue; }
    if (enqueue.length >= caps.maxEnqueuePerCycle) { dropped.push({ id: raw.id, reason: 'cap:maxEnqueuePerCycle (deferred)' }); log('defer', raw.id, 'cap:maxEnqueuePerCycle'); continue; }

    enqueue.push({ ...raw, status: 'queued', safe: true, assignedAgentId: agent.id, assignedAgentName: agent.name });
    concurrencyHeadroom--;
    log('enqueue', raw.id, `→ ${agent.name}`);
  }

  // ── HARD OUTPUT CLAMP — even if the logic above had a bug, the plan can never exceed the caps. ──
  const clampedEnqueue = enqueue.slice(0, caps.maxEnqueuePerCycle);
  const clampedNewAgents = newAgents.slice(0, caps.maxNewAgentsPerCycle);
  if (clampedEnqueue.length !== enqueue.length) log('clamp', '*', 'enqueue clamped to cap');
  if (clampedNewAgents.length !== newAgents.length) log('clamp', '*', 'newAgents clamped to cap');

  return {
    halted: false,
    enqueue: clampedEnqueue,
    approvals,
    newAgents: clampedNewAgents,
    dropped,
    logEntries,
    counts: rollupCounts(state, { enqueue: clampedEnqueue, approvals, newAgents: clampedNewAgents }),
  };
}

// Roll up the counts used by the public (scrubbed) asset + the dashboard.
export function rollupCounts(state = {}, plan = {}) {
  const agents = Array.isArray(state.agents) ? state.agents.filter((a) => !a.retired) : [];
  const prior = state.counts || {};
  return {
    agentsActive: agents.length,
    runningNow: (state.runningAgentIds || []).length,
    tasksDone: Number(prior.tasksDone || 0),
    branchesSpawned: Number(prior.branchesSpawned || 0) + (plan.enqueue ? plan.enqueue.length : 0),
    newAgentsTotal: Number(prior.newAgentsTotal || 0) + (plan.newAgents ? plan.newAgents.length : 0),
    approvalsPending: Number(prior.approvalsPending || 0) + (plan.approvals ? plan.approvals.length : 0),
    enqueuedThisCycle: plan.enqueue ? plan.enqueue.length : 0,
  };
}

// ── Public scrub (RULE 14 + no-leak) — counts ONLY. No names, titles, prompts, ids, or capabilities. ─
const COUNT_KEYS = ['agentsActive', 'runningNow', 'tasksDone', 'branchesSpawned', 'newAgentsTotal', 'approvalsPending'];
export function toPublicCounts(state = {}) {
  // Always recompute so agent-derived fields (agentsActive/runningNow) come from the live agent list,
  // not whatever a partial state.counts happened to carry. Cumulative fields come from state.counts.
  const counts = rollupCounts(state, {});
  const out = { v: 'infinity-wisdom-public-v1', updatedAt: state.updatedAt || null, stopped: state.stopped === true };
  for (const k of COUNT_KEYS) out[k] = Number(counts[k] || 0);
  return out; // ONLY numeric counts + flags — safe to serve publicly.
}

// Assert a would-be-public payload carries no sensitive fields (used by the no-leak test + the driver).
export function assertNoLeak(payload) {
  const json = JSON.stringify(payload || {});
  const FORBIDDEN = /"(name|title|prompt|agentName|assignedAgentName|capabilities|files|reason|gate|email|client|prospect|lead|secret|token|password)"\s*:/i;
  return !FORBIDDEN.test(json);
}

// ── Tamper-evident decision log (sha256 hash chain — same construction as the KB recycler). ───────
function serialize(e) { return JSON.stringify({ ts: String((e && e.ts) || ''), action: String((e && e.action) || ''), id: String((e && e.id) || ''), reason: String((e && e.reason) || '') }); }
export function entryHash(prev, entry) { return crypto.createHash('sha256').update(String(prev || GENESIS) + '|' + serialize(entry)).digest('hex'); }
export function sealLog(entries = []) { let h = GENESIS; const chain = []; for (const e of (Array.isArray(entries) ? entries : [])) { h = entryHash(h, e); chain.push(h); } return { v: 'iw-seal-v1', count: chain.length, chain, seal: h }; }
export function verifyLog(entries = [], sealed = {}) {
  const list = Array.isArray(entries) ? entries : []; const prior = Array.isArray(sealed.chain) ? sealed.chain : [];
  let h = GENESIS, brokenAt = -1;
  for (let i = 0; i < list.length; i++) { h = entryHash(h, list[i]); if (brokenAt === -1 && (i >= prior.length || h !== prior[i])) brokenAt = i; }
  const countMismatch = list.length !== (Number.isFinite(sealed.count) ? sealed.count : prior.length);
  const ok = brokenAt === -1 && !countMismatch;
  return { ok, tampered: !ok, brokenAt: ok ? -1 : (brokenAt === -1 ? Math.min(list.length, prior.length) : brokenAt), reason: ok ? 'intact' : (countMismatch ? 'row-count-changed' : 'entry-modified') };
}
