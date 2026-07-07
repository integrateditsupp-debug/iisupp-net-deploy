import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STATE_DIR = path.join(ROOT, 'senior-director-state');
export const AUTONOMY_DIR = path.join(STATE_DIR, 'autonomy');
export const REPORTS_DIR = path.join(AUTONOMY_DIR, 'agent-reports');
export const SUPERVISOR_STATE_FILE = path.join(AUTONOMY_DIR, 'supervisor-state.json');
export const APPROVAL_INBOX_FILE = path.join(AUTONOMY_DIR, 'approval-inbox.json');
export const APPROVAL_INBOX_MD_FILE = path.join(AUTONOMY_DIR, 'approval-inbox.md');
export const MISSION_QUEUE_FILE = path.join(AUTONOMY_DIR, 'mission-queue.json');
export const STANDING_ORDERS_FILE = path.join(AUTONOMY_DIR, 'standing-orders.md');
export const EXECUTION_BOARD_FILE = path.join(STATE_DIR, 'autonomous-execution-board.md');
export const ACTIVE_HANDOFF_FILE = path.join(STATE_DIR, 'active-agent-handoff.md');
export const OPPORTUNITIES_FILE = path.join(STATE_DIR, 'opportunity-engine', 'opportunities.json');
export const CRM_FILE = path.join(STATE_DIR, 'business-development-crm.json');
export const CEO_APPROVAL_FILE = path.join(STATE_DIR, 'ceo-approval-required.md');
export const HEARTBEAT_FILE = path.join(STATE_DIR, 'heartbeat.json');
export const QUEUE_FILE = path.join(STATE_DIR, 'codex-claude-queue.md');
export const COMMAND_UPDATE_FILE = path.join(STATE_DIR, 'iis-aria-command-update.md');
export const EXECUTION_NOTES_FILE = path.join(ROOT, 'AGENT_EXECUTION_NOTES.md');

export function nowIso() {
  return new Date().toISOString();
}

export async function ensureAutonomyDirs() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function readText(file, fallback = '') {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

export async function writeText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
}

export async function appendText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, text, 'utf8');
}

function slug(value) {
  return String(value || 'agent')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'agent';
}

export async function publishAgentReport(report) {
  await ensureAutonomyDirs();
  const payload = {
    agentId: report.agentId,
    label: report.label || report.agentId,
    generatedAt: report.generatedAt || nowIso(),
    status: report.status || 'ready',
    summary: report.summary || '',
    metrics: report.metrics || {},
    artifacts: Array.isArray(report.artifacts) ? report.artifacts : [],
    approvals: Array.isArray(report.approvals) ? report.approvals : [],
    readyActions: Array.isArray(report.readyActions) ? report.readyActions : [],
    nextActions: Array.isArray(report.nextActions) ? report.nextActions : [],
    focusAreas: Array.isArray(report.focusAreas) ? report.focusAreas : [],
    assignments: Array.isArray(report.assignments) ? report.assignments : [],
    metadata: report.metadata || {}
  };
  const file = path.join(REPORTS_DIR, `${slug(payload.agentId)}.json`);
  await writeJson(file, payload);
  return { file, payload };
}

export function collectApprovalBullets(markdown) {
  return String(markdown || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function classifyApproval(item) {
  if (/approved-to-transmit|send them when an email\/contact surface is available|Direct-contact follow-up queue|Jason Brown \/ Hines follow-up: if Jason has not replied|July 2 warm lead send gate: if Jason Brown and\/or Azim Lila are still silent/i.test(item)) return 'send';
  if (/Friday, 2026-06-12|window opens|dated follow-up|Watch for reply|still silent on \d{4}-\d{2}-\d{2}|follow-up then/i.test(item)) return 'dated_send';
  if (/supplier registration|Create Account|Register|certification|CAPTCHA/i.test(item)) return 'portal_submit';
  if (/publish|preview slice|local-only|deployment-path slice|sample-preview slice|route-guide slice/i.test(item)) return 'publish';
  if (/delete|archive|cleanup/i.test(item)) return 'cleanup';
  if (/OAuth|auth/i.test(item)) return 'auth';
  return 'approval';
}

function recommendedOwnerForOpportunity(item) {
  if (item.type === 'vendor registration') return 'vendor-registration-prep-agent';
  if (item.type === 'tender' || item.type === 'contract') return 'tender-bid-brief-agent';
  if (item.type === 'job') return 'career-application-prep-agent';
  return 'outreach-draft-agent';
}

function normalizeOpportunityTask(item) {
  const nextStep = item.manualDisposition === 'partner_path_only'
    ? 'Use the grounding brief to decide whether to keep this parked, allow partner-path-only prep, or discard it from the active revenue lane.'
    : (item.recommendedNextStep || 'Review fit and keep preparing.');
  return {
    id: item.id,
    title: item.title,
    organization: item.organization,
    type: item.type,
    qualityScore: item.qualityScore ?? null,
    priorityScore: item.priorityScore ?? null,
    difficultyScore: item.difficultyScore ?? null,
    deadline: item.deadline || null,
    status: item.status,
    manualDisposition: item.manualDisposition || null,
    manualReason: item.manualReason || null,
    manualReference: item.manualReference || null,
    whyRelevant: item.whyRelevant || '',
    nextStep,
    sourceLink: item.sourceLink || '',
    ownerAgent: recommendedOwnerForOpportunity(item)
  };
}

function normalizeContactTask(contact) {
  return {
    id: contact.id,
    name: contact.name,
    company: contact.company,
    status: contact.status,
    segment: contact.segment || '',
    signal: contact.signal || '',
    nextAction: contact.nextAction || '',
    ownerAgent: 'business-development-agent'
  };
}

function orderOpportunity(a, b) {
  if ((b.qualityScore || 0) !== (a.qualityScore || 0)) return (b.qualityScore || 0) - (a.qualityScore || 0);
  if ((b.priorityScore || 0) !== (a.priorityScore || 0)) return (b.priorityScore || 0) - (a.priorityScore || 0);
  return (a.difficultyScore || 99) - (b.difficultyScore || 99);
}

function approvalItemRow(item, index) {
  const prefix = `${index + 1}.`;
  const category = item.category.replace(/_/g, ' ');
  return [
    `${prefix} ${item.text}`,
    `   - Category: ${category}`,
    item.ownerAction ? `   - Ahmad action: ${item.ownerAction}` : null
  ].filter(Boolean).join('\n');
}

function opportunityRow(item, index) {
  return [
    `${index + 1}. ${item.title} - ${item.organization}`,
    `   - Type: ${item.type}; quality ${item.qualityScore ?? 'n/a'}; priority ${item.priorityScore ?? 'n/a'}; difficulty ${item.difficultyScore ?? 'n/a'}; status ${item.status}`,
    item.manualReason ? `   - Manual posture: ${item.manualReason}` : null,
    item.manualReference ? `   - Grounding file: \`${item.manualReference}\`` : null,
    `   - Assigned agent: ${item.ownerAgent}`,
    `   - Next step: ${item.nextStep}`,
    item.deadline ? `   - Deadline: ${item.deadline}` : null,
    item.sourceLink ? `   - Link: ${item.sourceLink}` : null
  ].filter(Boolean).join('\n');
}

function contactRow(item, index) {
  return [
    `${index + 1}. ${item.name}${item.company ? ` - ${item.company}` : ''}`,
    `   - Status: ${item.status}`,
    item.segment ? `   - Segment: ${item.segment}` : null,
    item.signal ? `   - Signal: ${item.signal}` : null,
    item.nextAction ? `   - Next action: ${item.nextAction}` : null,
    `   - Assigned agent: ${item.ownerAgent}`
  ].filter(Boolean).join('\n');
}

function agentRow(report) {
  const metricBits = Object.entries(report.metrics || {}).slice(0, 5).map(([key, value]) => `${key}=${value}`);
  return [
    `- ${report.label || report.agentId} (${report.status || 'ready'})`,
    report.summary ? `  ${report.summary}` : null,
    metricBits.length ? `  Metrics: ${metricBits.join(', ')}` : null,
    report.generatedAt ? `  Updated: ${report.generatedAt}` : null
  ].filter(Boolean).join('\n');
}

function standingOrders() {
  return [
    'Standing interpretation rule:',
    '- If Ahmad says `continue`, `proceed`, `do it`, or another clear action verb without restating strategy, agents must continue under the existing IIS/ARIA mission, revenue lanes, and approval rules already stored in shared state and memory.',
    '- Do not ask Ahmad to restate the company objective or vision unless the mission itself has clearly changed.',
    '- Cost-related blockers, approvals, sends, submissions, auth limits, account-creation gates, and risky publish gates must stay visible until Ahmad acts on them or explicitly parks them.',
    '- While waiting on Ahmad-only actions, agents keep piling up more opportunities, conversion improvements, prep packets, vendor-entry lanes, drafts, and cleanup recommendations around the clock.',
    '- Approval and blocker items must be mirrored into the active handoff surface so another active agent can pick them up without Ahmad re-explaining context.'
  ].join('\n');
}

function buildMarkdownBoard(state) {
  return [
    '# Autonomous Execution Board',
    '',
    `Updated: ${state.generatedAt}`,
    '',
    'Purpose: give all active agents one shared operating surface so they can continue safe work automatically and only surface true Ahmad final-action gates.',
    '',
    '## System Snapshot',
    `- Agents reporting: ${state.summary.reportingAgents}`,
    `- Approval inbox items: ${state.summary.approvalCount}`,
    `- Ready Ahmad actions: ${state.summary.readyApprovalCount}`,
    `- Revenue/company opportunities in queue: ${state.summary.opportunityCount}`,
    `- Warm/pending business-development contacts: ${state.summary.contactCount}`,
    `- OpenClaw reachable: ${state.summary.openclawReachable ? 'yes' : 'no'}`,
    '',
    '## Standing Orders',
    ...standingOrders().split('\n'),
    '',
    '## Ahmad Final-Action Inbox',
    state.approvals.length ? state.approvals.map(approvalItemRow).join('\n\n') : '- None right now.',
    '',
    '## Autonomous Revenue Queue',
    state.opportunities.length ? state.opportunities.map(opportunityRow).join('\n\n') : '- No active opportunities queued.',
    '',
    '## Warm Contact Queue',
    state.contacts.length ? state.contacts.map(contactRow).join('\n\n') : '- No warm or pending contacts queued.',
    '',
    '## Agent Check-Ins',
    state.agentReports.length ? state.agentReports.map(agentRow).join('\n\n') : '- No agent reports published yet.',
    '',
    '## Mission Notes',
    '- Agents should continue safe, no-cost, reversible preparation automatically.',
    '- Stop only for Send, Submit, Apply, Register/Create Account, Sign, Certify, Pay, risky Publish, or destructive cleanup.',
    '- Use this board as the shared operating surface instead of relying only on long queue tails.'
  ].join('\n');
}

function buildApprovalMarkdown(state) {
  return [
    '# Approval Inbox',
    '',
    `Updated: ${state.generatedAt}`,
    '',
    'These are the items that still require Ahmad final action. Keep them visible until Ahmad acts on them or explicitly parks them.',
    '',
    state.approvals.length ? state.approvals.map(approvalItemRow).join('\n\n') : '- None right now.'
  ].join('\n');
}

function buildStandingOrdersMarkdown(state) {
  return [
    '# Standing Orders',
    '',
    `Updated: ${state.generatedAt}`,
    '',
    ...standingOrders().split('\n'),
    '',
    'Current status:',
    `- Approval items still open: ${state.summary.approvalCount}`,
    `- Ready Ahmad actions: ${state.summary.readyApprovalCount}`,
    `- Revenue/company opportunities active: ${state.summary.opportunityCount}`,
    `- Warm/pending contacts active: ${state.summary.contactCount}`
  ].join('\n');
}

function buildActiveHandoffMarkdown(state) {
  return [
    '# Active Agent Handoff',
    '',
    `Updated: ${state.generatedAt}`,
    '',
    'Use this when Ahmad says continue/proceed/do it. Do not ask him to restate the mission. Continue the current IIS/ARIA revenue mission and keep the blocker list visible until acted on.',
    '',
    '## Immediate Ahmad Actions Still Open',
    state.approvals.length ? state.approvals.slice(0, 12).map(approvalItemRow).join('\n\n') : '- None right now.',
    '',
    '## Cost / Auth / Submit / Send / Publish Blockers',
    state.approvals.length
      ? state.approvals
        .filter((item) => ['portal_submit', 'send', 'dated_send', 'publish', 'auth', 'approval'].includes(item.category))
        .map((item, index) => approvalItemRow(item, index))
        .join('\n\n')
      : '- None right now.',
    '',
    '## Keep Working While Waiting',
    state.opportunities.length ? state.opportunities.slice(0, 8).map(opportunityRow).join('\n\n') : '- No active revenue queue.',
    '',
    '## Warm Contact Watch',
    state.contacts.length ? state.contacts.slice(0, 5).map(contactRow).join('\n\n') : '- No warm contact queue.',
    '',
    '## Standing Orders',
    ...standingOrders().split('\n')
  ].join('\n');
}

export async function runAutonomySupervisor(options = {}) {
  const generatedAt = nowIso();
  await ensureAutonomyDirs();

  const [opportunityDb, crm, approvalsText, heartbeat, reportFiles] = await Promise.all([
    readJson(OPPORTUNITIES_FILE, { items: [] }),
    readJson(CRM_FILE, { contacts: [] }),
    readText(CEO_APPROVAL_FILE, ''),
    readJson(HEARTBEAT_FILE, {}),
    fs.readdir(REPORTS_DIR).catch(() => [])
  ]);

  const reportPayloads = [];
  for (const file of reportFiles.filter((name) => name.endsWith('.json'))) {
    const payload = await readJson(path.join(REPORTS_DIR, file), null);
    if (payload?.agentId) reportPayloads.push(payload);
  }
  reportPayloads.sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));

  const approvals = collectApprovalBullets(approvalsText).map((text) => {
    const category = classifyApproval(text);
    const ownerAction =
      category === 'send' ? 'Send when ready' :
      category === 'dated_send' ? 'Send or Hold based on reply status/date' :
      category === 'portal_submit' ? 'Register / Create Account / Submit after review' :
      category === 'publish' ? 'Approve publish or hold local only' :
      category === 'cleanup' ? 'Approve cleanup action or keep blocked' :
      category === 'auth' ? 'Refresh auth only if desired' :
      'Approve or review';
    return { text, category, ownerAction };
  });

  const opportunities = (opportunityDb.items || [])
    .filter((item) => item.status !== 'ignored' && item.manualDisposition !== 'direct_no_bid' && item.type !== 'job')
    .map(normalizeOpportunityTask)
    .sort(orderOpportunity)
    .slice(0, 15);

  const contacts = (crm.contacts || [])
    .filter((contact) => !contact.retired && ['accepted', 'message_sent', 'connection_requested', 'replied'].includes(contact.status))
    .map(normalizeContactTask)
    .slice(0, 15);

  const state = {
    generatedAt,
    trigger: options.trigger || 'manual',
    summary: {
      reportingAgents: reportPayloads.length,
      approvalCount: approvals.length,
      readyApprovalCount: approvals.filter((item) => ['send', 'portal_submit', 'publish'].includes(item.category)).length,
      opportunityCount: opportunities.length,
      contactCount: contacts.length,
      openclawReachable: Boolean(heartbeat?.openclaw)
    },
    approvals,
    opportunities,
    contacts,
    agentReports: reportPayloads,
    heartbeat: {
      ts: heartbeat?.ts || null,
      mission: heartbeat?.mission || null,
      ownerEmail: heartbeat?.ownerEmail || null,
      openclaw: Boolean(heartbeat?.openclaw)
    }
  };

  const missionQueue = {
    generatedAt,
    trigger: state.trigger,
    missions: [
      {
        id: 'approval-inbox',
        owner: 'Ahmad',
        status: approvals.length ? 'waiting_on_approval' : 'clear',
        count: approvals.length
      },
      {
        id: 'revenue-opportunities',
        owner: 'shared-agents',
        status: opportunities.length ? 'in_progress' : 'clear',
        count: opportunities.length
      },
      {
        id: 'warm-contacts',
        owner: 'business-development-agent',
        status: contacts.length ? 'in_progress' : 'clear',
        count: contacts.length
      }
    ]
  };

  await Promise.all([
    writeJson(SUPERVISOR_STATE_FILE, state),
    writeJson(APPROVAL_INBOX_FILE, { generatedAt, approvals }),
    writeJson(MISSION_QUEUE_FILE, missionQueue),
    writeText(APPROVAL_INBOX_MD_FILE, buildApprovalMarkdown(state)),
    writeText(EXECUTION_BOARD_FILE, buildMarkdownBoard(state)),
    writeText(STANDING_ORDERS_FILE, buildStandingOrdersMarkdown(state)),
    writeText(ACTIVE_HANDOFF_FILE, buildActiveHandoffMarkdown(state))
  ]);

  if (options.writeTelemetry) {
    await appendText(QUEUE_FILE, `
## ${generatedAt.slice(0, 16).replace('T', ' ')} - Autonomy supervisor rebuilt

- Rebuilt \`senior-director-state/autonomous-execution-board.md\`.
- Rebuilt \`senior-director-state/autonomy/approval-inbox.md\` and \`senior-director-state/autonomy/supervisor-state.json\`.
- Rebuilt \`senior-director-state/active-agent-handoff.md\` so the live approval/blocker list is visible to the active agent lane.
- Reporting agents: ${state.summary.reportingAgents}.
- Approval inbox items: ${state.summary.approvalCount}.
- Revenue/company opportunities queued: ${state.summary.opportunityCount}.
- Warm/pending business-development contacts queued: ${state.summary.contactCount}.
`);
    await appendText(COMMAND_UPDATE_FILE, `

## Autonomous Execution Board
- Latest run: ${generatedAt}
- Board: \`senior-director-state/autonomous-execution-board.md\`
- Approval inbox: \`senior-director-state/autonomy/approval-inbox.md\`
- Active handoff: \`senior-director-state/active-agent-handoff.md\`
- Reporting agents: ${state.summary.reportingAgents}
- Approval inbox items: ${state.summary.approvalCount}
- Revenue/company opportunities queued: ${state.summary.opportunityCount}
- Warm/pending contacts queued: ${state.summary.contactCount}
`);
    await appendText(EXECUTION_NOTES_FILE, `

### ${generatedAt.slice(0, 16).replace('T', ' ')} - Autonomy Supervisor Agent - completed

Scope: Rebuild the shared autonomous operating surface from active agent reports, approvals, opportunities, and business-development state.

Changed files:
- \`scripts/autonomy-supervisor-core.mjs\`
- \`scripts/autonomy-supervisor-agent.mjs\`
- \`senior-director-state/autonomous-execution-board.md\`
- \`senior-director-state/active-agent-handoff.md\`
- \`senior-director-state/autonomy/approval-inbox.md\`
- \`senior-director-state/autonomy/approval-inbox.json\`
- \`senior-director-state/autonomy/mission-queue.json\`
- \`senior-director-state/autonomy/standing-orders.md\`
- \`senior-director-state/autonomy/supervisor-state.json\`
- \`senior-director-state/codex-claude-queue.md\`
- \`senior-director-state/iis-aria-command-update.md\`

Result:
- Rebuilt one shared approval/mission board across the active agents.
- Approval inbox items: ${state.summary.approvalCount}.
- Revenue/company opportunities queued: ${state.summary.opportunityCount}.
- Warm/pending contacts queued: ${state.summary.contactCount}.
- No external send, submit, apply, publish, payment, account creation, legal commitment, or destructive action performed.
`);
  }

  return state;
}
