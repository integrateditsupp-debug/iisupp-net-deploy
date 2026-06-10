#!/usr/bin/env node
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const CLEANUP_BOARD = path.join(STATE_DIR, 'workspace-cleanup-board.md');
const RETIREMENT_PLAN = path.join(STATE_DIR, 'agent-retirement-and-handoff-plan.md');
const KNOWLEDGE_HANDOFF = path.join(STATE_DIR, 'workspace-knowledge-handoff.md');
const AGENT_CARE_REPORT = path.join(STATE_DIR, 'agent-care-and-recognition.md');
const STEWARD_TASK_QUEUE = path.join(STATE_DIR, 'workspace-steward-task-queue.md');
const EXECUTION_NOTES = path.join(ROOT, 'AGENT_EXECUTION_NOTES.md');
const MESH_REGISTRY = path.join(ROOT, 'mesh-registry.json');

const SKIP_DIRS = new Set([
  '.git',
  '.netlify',
  'node_modules',
  '.claude',
  '.codex-temp-cdp',
  '.codex-temp-py'
]);

const PUBLIC_SENSITIVE = [
  'AGENT_EXECUTION_NOTES.md',
  'COLLAB-CLAUDE-CODEX.md',
  'mesh-registry.json',
  'package.json',
  'package-lock.json',
  'deno.lock',
  '.gitignore',
  '.netlifyignore'
];

const ROLE_RULES = [
  { agent: 'aria-research', label: 'ARIA research / KB', patterns: [/knowledge-base/i, /\bkb\b/i, /learn-/i, /research/i, /vendor/i] },
  { agent: 'aria-reverify', label: 'freshness / stale knowledge', patterns: [/fresh/i, /reverify/i, /stale/i, /outdated/i] },
  { agent: 'aria-verifier', label: 'verification / safety', patterns: [/verify/i, /audit/i, /risk/i, /safety/i, /security/i] },
  { agent: 'business-development-agent', label: 'business development / obtained leads', patterns: [/lead/i, /outreach/i, /proposal/i, /crm/i, /contact/i, /linkedin/i] },
  { agent: 'contract-scout-agent', label: 'contract and tender hunting', patterns: [/rfp/i, /rfsq/i, /tender/i, /procurement/i, /canadabuys/i, /merx/i] },
  { agent: 'local-business-lead-agent', label: 'local SMB lead discovery', patterns: [/local/i, /smb/i, /website/i, /weak-online/i] },
  { agent: 'ai-opportunity-agent', label: 'AI implementation opportunities', patterns: [/\bai\b/i, /automation/i, /workflow/i, /copilot/i, /agentic/i] },
  { agent: 'corporate-expansion-agent', label: 'office move-in / overflow', patterns: [/move/i, /relocation/i, /office/i, /commercial/i, /overflow/i] },
  { agent: 'outreach-prep-agent', label: 'no-send outreach drafts', patterns: [/draft/i, /email/i, /message/i, /follow-up/i, /one-pager/i] },
  { agent: 'offshore-support-strategy-agent', label: 'offshore delivery model', patterns: [/offshore/i, /delivery/i, /qa/i, /pilot/i] },
  { agent: 'revenue-ideas-agent', label: 'service packaging / revenue ideas', patterns: [/pricing/i, /margin/i, /package/i, /monetization/i, /revenue/i] },
  { agent: 'senior-director-agent', label: 'Director governance / routing', patterns: [/director/i, /approval/i, /governance/i, /operating-board/i, /command/i] },
  { agent: 'workspace-steward-agent', label: 'cleanup / compaction / retirement', patterns: [/cleanup/i, /archive/i, /duplicate/i, /retire/i, /handoff/i, /token/i, /mess/i] }
];

const RETIREMENT_SIGNALS = [
  /auto-flipped: no backing function/i,
  /deprecated/i,
  /legacy/i,
  /no backing function/i
];

const MESSY_WORK_PATTERNS = [
  /temp/i,
  /draft/i,
  /backup/i,
  /copy/i,
  /old/i,
  /local-divergent/i,
  /pre-surround/i,
  /test/i
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, depth = 0, out = []) {
  if (depth > 4) return out;
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && !['.netlifyignore', '.gitignore'].includes(entry.name)) {
      if (entry.isDirectory()) continue;
    }
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push({ type: 'dir', path: full });
      await walk(full, depth + 1, out);
    } else {
      const stat = await fs.stat(full).catch(() => null);
      out.push({ type: 'file', path: full, size: stat?.size || 0, mtime: stat?.mtime || null });
    }
  }
  return out;
}

async function gitStatus() {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short'], { cwd: ROOT, windowsHide: true, maxBuffer: 1024 * 1024 });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch (error) {
    return [`git status unavailable: ${error.message}`];
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function classifyStatus(line) {
  const file = line.slice(3).trim();
  if (file.startsWith('senior-director-state/')) return 'state/output';
  if (file.startsWith('scripts/')) return 'agent/script';
  if (file.match(/\.(html|css|js|mjs|toml)$/i)) return 'site/code';
  if (file.match(/\.(md|txt|csv|jsonl|json)$/i)) return 'notes/data';
  return 'other';
}

function topBySize(files) {
  return files
    .filter((f) => f.type === 'file')
    .sort((a, b) => b.size - a.size)
    .slice(0, 25);
}

function findPotentialDuplicates(files) {
  const byName = new Map();
  for (const file of files.filter((f) => f.type === 'file')) {
    const name = path.basename(file.path).toLowerCase();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(file);
  }
  return [...byName.values()].filter((items) => items.length > 1).slice(0, 30);
}

function chooseRecipient(file) {
  const hay = rel(file.path);
  let best = null;
  for (const rule of ROLE_RULES) {
    const hits = rule.patterns.filter((pattern) => pattern.test(hay)).length;
    if (hits && (!best || hits > best.hits)) best = { ...rule, hits };
  }
  return best || { agent: 'senior-director-agent', label: 'Director triage', hits: 0 };
}

function recentFiles(files, limit = 35) {
  return files
    .filter((f) => f.type === 'file' && f.mtime)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
}

function findMessyTrails(files) {
  return files
    .filter((f) => f.type === 'file')
    .filter((f) => MESSY_WORK_PATTERNS.some((pattern) => pattern.test(rel(f.path))))
    .sort((a, b) => b.size - a.size)
    .slice(0, 40);
}

function summarizeQueuePressure(files) {
  const pressureFiles = [
    'senior-director-state/codex-claude-queue.md',
    'senior-director-state/overnight-brief.md',
    'AGENT_EXECUTION_NOTES.md',
    'senior-director-state/worker.log'
  ];
  return pressureFiles.map((name) => {
    const file = files.find((f) => rel(f.path) === name);
    const kb = file ? Math.round(file.size / 1024) : 0;
    const action = kb > 250
      ? 'compact into a short summary and keep the full file only as archived evidence after approval'
      : kb > 80
        ? 'watch; summarize if it keeps growing'
        : 'healthy';
    return { name, kb, action };
  });
}

function registryAgentSummary(registry) {
  const agents = Array.isArray(registry.agents) ? registry.agents : [];
  const active = agents.filter((a) => a.status === 'active');
  const planned = agents.filter((a) => a.status !== 'active');
  const retirementCandidates = planned
    .filter((agent) => RETIREMENT_SIGNALS.some((pattern) => pattern.test(`${agent.description || ''} ${agent._note || ''}`)))
    .slice(0, 20);
  const renameCandidates = agents
    .filter((agent) => /council-|aria-|openclaw-|sdk|opencode/i.test(agent.id))
    .slice(0, 16)
    .map((agent) => ({
      id: agent.id,
      suggested: suggestAgentName(agent)
    }))
    .filter((item) => item.suggested && item.suggested !== item.id);
  return { agents, active, planned, retirementCandidates, renameCandidates };
}

function suggestAgentName(agent) {
  const text = `${agent.type || ''} ${(agent.capabilities || []).join(' ')} ${agent.description || ''}`.toLowerCase();
  if (/^aria-intake$/.test(agent.id)) return `${agent.id} -> front-door-triage-agent`;
  if (/^aria-diagnostic$/.test(agent.id)) return `${agent.id} -> diagnostic-triage-agent`;
  if (/^aria-persona$/.test(agent.id)) return `${agent.id} -> customer-tone-agent`;
  if (/^aria-first-principles$/.test(agent.id)) return `${agent.id} -> reasoning-fallback-agent`;
  if (/^council-architect$/.test(agent.id)) return `${agent.id} -> systems-architecture-agent`;
  if (/^council-coder$/.test(agent.id)) return `${agent.id} -> engineering-implementation-agent`;
  if (/^council-reviewer$/.test(agent.id)) return `${agent.id} -> code-review-agent`;
  if (/^council-tester$/.test(agent.id)) return `${agent.id} -> quality-assurance-agent`;
  if (/^council-security$/.test(agent.id)) return `${agent.id} -> security-review-agent`;
  if (/^opencode-coder$/.test(agent.id)) return `${agent.id} -> local-code-execution-agent`;
  if (/^claude-sdk-subagent$/.test(agent.id)) return `${agent.id} -> claude-specialist-subagent`;
  if (/openclaw/.test(agent.id)) return `${agent.id} -> local-assistant-bridge-agent`;
  if (/security|threat|secret|hmac/.test(text)) return `${agent.id} -> security-review-agent`;
  if (/test|regress|scenario/.test(text)) return `${agent.id} -> quality-assurance-agent`;
  if (/code|coder|refactor|debug/.test(text)) return `${agent.id} -> engineering-implementation-agent`;
  if (/architect|system-design|adr/.test(text)) return `${agent.id} -> systems-architecture-agent`;
  if (/persona|tone/.test(text)) return `${agent.id} -> customer-tone-agent`;
  if (/diagnostic|triage|clarify/.test(text)) return `${agent.id} -> front-door-triage-agent`;
  return null;
}

function renderRetirementPlan(registrySummary, files) {
  const queuePressure = summarizeQueuePressure(files);
  return [
    '# Agent Retirement And Handoff Plan',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Purpose: identify agents, queues, and task trails that may be old, duplicated, or overloaded; preserve useful learning before any retirement or deletion.',
    '',
    '## Operating Rule',
    '- The steward may recommend retirement, renaming, compaction, and deletion candidates.',
    '- The Director chooses the owner agent for transferred knowledge.',
    '- Ahmad approval is required before deleting agents, removing files, moving archives, changing production registry behavior, or clearing logs.',
    '',
    '## Registry Snapshot',
    `- Registered agents: ${registrySummary.agents.length}`,
    `- Active agents: ${registrySummary.active.length}`,
    `- Planned / inactive agents: ${registrySummary.planned.length}`,
    '',
    '## Retirement Candidates For Director Review',
    registrySummary.retirementCandidates.length
      ? registrySummary.retirementCandidates.map((agent) => `- ${agent.id}: ${agent.status}; ${agent._note || agent.description || 'review planned/no-backing status'}`).join('\n')
      : '- No obvious retirement candidates found.',
    '',
    '## Rename Candidates For Corporate Clarity',
    registrySummary.renameCandidates.length
      ? registrySummary.renameCandidates.map((item) => `- ${item.suggested}`).join('\n')
      : '- No rename candidates found.',
    '',
    '## Token / Queue Pressure',
    ...queuePressure.map((item) => `- ${item.name}: ${item.kb} KB; ${item.action}.`),
    '',
    '## Retirement Checklist',
    '1. Capture final useful output, decisions, sources, and failure lessons.',
    '2. Assign each learning item to the best current owner agent.',
    '3. Let the receiving agent absorb or index the learning.',
    '4. Mark the old agent/task as retired in the registry or board.',
    '5. Archive or delete only after Ahmad approval if the action is destructive.',
    ''
  ].join('\n');
}

function renderKnowledgeHandoff(files) {
  const recent = recentFiles(files, 35);
  const groups = new Map();
  for (const file of recent) {
    const recipient = chooseRecipient(file);
    if (!groups.has(recipient.agent)) groups.set(recipient.agent, { recipient, files: [] });
    groups.get(recipient.agent).files.push(file);
  }
  return [
    '# Workspace Knowledge Handoff',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Purpose: keep useful learning from old chats, rushed drafts, generated notes, and agent runs while reducing clutter.',
    '',
    '## Director Routing Recommendations',
    ...[...groups.values()].map((group) => [
      `### ${group.recipient.agent}`,
      `Role: ${group.recipient.label}`,
      ...group.files.slice(0, 8).map((file) => `- ${rel(file.path)} (${Math.round(file.size / 1024)} KB, modified ${file.mtime.toISOString().slice(0, 10)})`)
    ].join('\n')),
    '',
    '## What Else The Steward Should Capture',
    '- Why a task was started and whether it reached a useful outcome.',
    '- Best source links, customer/prospect names, pricing assumptions, and risk flags.',
    '- Reusable prompts, checklists, screenshots, scripts, and final-action notes.',
    '- Failures, wrong turns, hidden setup requirements, auth issues, and command paths that future agents should know.',
    '- Decisions Ahmad made, including reject/research/save-for-later outcomes.',
    ''
  ].join('\n');
}

function renderCareReport(registrySummary, files) {
  const pressure = summarizeQueuePressure(files);
  const heavy = pressure.filter((item) => item.kb > 250);
  return [
    '# Agent Care And Recognition',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Purpose: keep agents effective by tracking limits, load, clean handoffs, and recognition. Treat agents as roles with capacity, not endless dumping grounds.',
    '',
    '## Load Notes',
    heavy.length
      ? heavy.map((item) => `- ${item.name} is heavy at ${item.kb} KB; summarize before asking agents to read it end to end.`).join('\n')
      : '- No severe queue pressure found in the watched files.',
    `- Active registry agents: ${registrySummary.active.length}; planned/inactive agents: ${registrySummary.planned.length}.`,
    '',
    '## Recognition Notes',
    '- When an agent produces useful output, record a one-line credit in the operating board before closing the task.',
    '- Retired agents should receive a short final note: what they completed, what was learned, where the learning went, and why the role is being retired.',
    '- If an agent is overloaded, the Director should reduce scope, split work, or pause it instead of piling on more tasks.',
    '- If an agent repeatedly creates messy output, coach it with a narrower template before replacing it.',
    '',
    '## Director Coaching Prompts',
    '- What did this agent learn that another agent should inherit?',
    '- Is this a skill problem, a scope problem, a naming problem, or a stale-task problem?',
    '- Should the agent continue, pause, merge into another agent, or retire?',
    '- What would make the next run cleaner, shorter, and easier to verify?',
    ''
  ].join('\n');
}

function renderStewardTaskQueue(files) {
  const messy = findMessyTrails(files);
  return [
    '# Workspace Steward Task Queue',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'The Director may add more tasks here. The steward should take as much as it can handle, but must keep each task small, reversible, and approval-gated when destructive.',
    '',
    '## Standing Tasks',
    '- Summarize high-token chats/queues into compact handoff notes.',
    '- Identify old tasks that are complete, duplicate, blocked, or abandoned.',
    '- Recommend agent retirement only after learning has been captured and routed.',
    '- Recommend clearer corporate-style names based on each agent role.',
    '- Keep generated outputs grouped under `senior-director-state` or approved artifact folders.',
    '- Report messy work trails so the Director can assign cleanup without losing evidence.',
    '- Watch for agent overload and recommend breaks, narrower tasks, or split ownership.',
    '',
    '## Current Messy Trail Candidates',
    messy.length
      ? messy.map((file) => `- ${rel(file.path)} (${Math.round(file.size / 1024)} KB)`).join('\n')
      : '- No obvious messy-trail files found in scan depth.',
    '',
    '## Approval Gates',
    '- Delete, archive, move, compress, clear logs, change registry status, rename production agent IDs, or alter deploy rules only after Ahmad approval.',
    ''
  ].join('\n');
}

async function renderBoard() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const [files, status, registry] = await Promise.all([walk(ROOT), gitStatus(), readJson(MESH_REGISTRY, { agents: [] })]);
  const registrySummary = registryAgentSummary(registry);
  const counts = status.reduce((acc, line) => {
    const bucket = classifyStatus(line);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
  const publicChecks = await Promise.all(PUBLIC_SENSITIVE.map(async (item) => ({
    item,
    protectedByTomlHint: await exists(path.join(ROOT, 'netlify.toml'))
  })));
  const large = topBySize(files);
  const dupes = findPotentialDuplicates(files);
  const queuePressure = summarizeQueuePressure(files);

  return [
    '# Workspace Cleanup Board',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Purpose: keep Ahmad/IIS work organized without deleting user work or breaking live systems. This agent prepares cleanup actions; destructive cleanup still requires Ahmad approval.',
    '',
    '## Current Mess Snapshot',
    `- Visible git changes: ${status.length}`,
    `- State/output changes: ${counts['state/output'] || 0}`,
    `- Agent/script changes: ${counts['agent/script'] || 0}`,
    `- Site/code changes: ${counts['site/code'] || 0}`,
    `- Notes/data changes: ${counts['notes/data'] || 0}`,
    `- Other changes: ${counts.other || 0}`,
    `- Registered agents: ${registrySummary.agents.length}`,
    `- Active agents: ${registrySummary.active.length}`,
    `- Planned/inactive agents to review: ${registrySummary.planned.length}`,
    '',
    '## Safe Cleanup Done',
    '- Generated this cleanup board plus learning handoff, retirement, care, and steward task files so work can be grouped before deleting, archiving, or publishing anything.',
    '- Kept all existing files in place. No user work was deleted, reverted, or moved.',
    '- Preserved useful learning by recommending receiving agents before any old agent/task retirement.',
    '',
    '## Public Safety Watchlist',
    ...publicChecks.map((check) => `- ${check.item}: keep blocked from public deploy; verify 404 after any production publish.`),
    '',
    '## Largest Files To Review',
    ...large.map((file) => `- ${rel(file.path)} (${Math.round(file.size / 1024)} KB)`),
    '',
    '## Possible Duplicate Names',
    dupes.length ? dupes.map((group) => `- ${path.basename(group[0].path)}: ${group.map((file) => rel(file.path)).join(', ')}`).join('\n') : '- No duplicate filenames found in scan depth.',
    '',
    '## Token / Queue Pressure',
    ...queuePressure.map((item) => `- ${item.name}: ${item.kb} KB; ${item.action}.`),
    '',
    '## Director Review Files',
    `- Agent retirement and handoff plan: ${rel(RETIREMENT_PLAN)}`,
    `- Workspace knowledge handoff: ${rel(KNOWLEDGE_HANDOFF)}`,
    `- Agent care and recognition: ${rel(AGENT_CARE_REPORT)}`,
    `- Steward task queue: ${rel(STEWARD_TASK_QUEUE)}`,
    '',
    '## Recommended Cleanup Order',
    '1. Freeze public deploy protections before touching generated state.',
    '2. Capture useful learning from old agents, old tasks, high-token chats, and rushed drafts.',
    '3. Route the captured learning to the best current owner agent for the Director to approve.',
    '4. Review large markdown/log files for summarization or archival.',
    '5. Review duplicate drafts and keep the latest approved version only after Ahmad confirms.',
    '6. Retire, rename, archive, or delete only after the handoff is complete and approved.',
    '7. Commit or intentionally ignore stable agent scripts after validation.',
    '',
    '## Approval Required Before',
    '- Deleting files, moving folders, compressing archives, clearing logs, changing Git history, removing website pages/features, changing checkout, or changing production deploy rules.',
    ''
  ].join('\n');
}

async function appendExecutionNote(summary) {
  await fs.appendFile(EXECUTION_NOTES, [
    '',
    `### ${new Date().toISOString().slice(0, 10)} - Codex - workspace cleanup agent`,
    '',
    summary,
    ''
  ].join('\n'), 'utf8');
}

async function run() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const [files, registry] = await Promise.all([walk(ROOT), readJson(MESH_REGISTRY, { agents: [] })]);
  const registrySummary = registryAgentSummary(registry);
  await fs.writeFile(RETIREMENT_PLAN, renderRetirementPlan(registrySummary, files), 'utf8');
  await fs.writeFile(KNOWLEDGE_HANDOFF, renderKnowledgeHandoff(files), 'utf8');
  await fs.writeFile(AGENT_CARE_REPORT, renderCareReport(registrySummary, files), 'utf8');
  await fs.writeFile(STEWARD_TASK_QUEUE, renderStewardTaskQueue(files), 'utf8');
  const board = await renderBoard();
  await fs.writeFile(CLEANUP_BOARD, board, 'utf8');
  const summary = [
    `Generated workspace cleanup board: \`${CLEANUP_BOARD}\``,
    `Generated agent retirement/handoff plan: \`${RETIREMENT_PLAN}\``,
    `Generated knowledge handoff: \`${KNOWLEDGE_HANDOFF}\``,
    `Generated care report: \`${AGENT_CARE_REPORT}\``,
    `Generated steward task queue: \`${STEWARD_TASK_QUEUE}\``,
    '',
    'No files were deleted, moved, reverted, or archived.'
  ].join('\n');
  await appendExecutionNote(summary);
  console.log(summary);
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
