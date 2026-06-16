#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishAgentReport } from './autonomy-supervisor-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const OPP_DIR = path.join(STATE_DIR, 'opportunity-engine');
const AGENT_DIR = path.join(STATE_DIR, 'auto-created-agents');
const OPPORTUNITIES_FILE = path.join(OPP_DIR, 'opportunities.json');
const BOARD_FILE = path.join(STATE_DIR, 'interaction-avoidance-board.md');
const QUEUE_FILE = path.join(STATE_DIR, 'codex-claude-queue.md');
const COMMAND_UPDATE_FILE = path.join(STATE_DIR, 'iis-aria-command-update.md');
const EXECUTION_NOTES = path.join(ROOT, 'AGENT_EXECUTION_NOTES.md');

const now = new Date();
const nowIso = now.toISOString();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function append(file, content) {
  await fs.appendFile(file, content, 'utf8');
}

function scoreSort(a, b) {
  if ((b.priorityScore || 0) !== (a.priorityScore || 0)) return (b.priorityScore || 0) - (a.priorityScore || 0);
  return (a.difficultyScore || 99) - (b.difficultyScore || 99);
}

function pickPrepAgent(item) {
  if (item.type === 'tender' || item.type === 'contract') return 'tender-bid-brief-agent';
  if (item.type === 'vendor registration') return 'vendor-registration-prep-agent';
  if (item.type === 'job') return 'career-application-prep-agent';
  return 'outreach-draft-agent';
}

function nextPrep(item) {
  if (item.type === 'tender' || item.type === 'contract') {
    return 'Create bid/no-bid brief, mandatory requirements checklist, deadline check, documents list, and draft response outline. Stop before Submit/Certify/Sign.';
  }
  if (item.type === 'vendor registration') {
    return 'Create registration checklist, company profile answer set, required documents list, and portal readiness note. Stop before Create Account/Certify/Submit.';
  }
  if (item.type === 'job') {
    return 'Prepare fit summary, resume angle, cover/application draft, required answers, and blockers. Stop before Apply/Submit.';
  }
  return 'Prepare buyer profile, pain hypothesis, tailored no-send message, and low-friction next step. Stop before Send/Connect/Contact.';
}

function finalAction(item) {
  if (item.type === 'vendor registration') return 'Ahmad only clicks Create Account/Register/Submit/Certify after reviewing prepared checklist.';
  if (item.type === 'job') return 'Ahmad only clicks Apply/Submit after reviewing prepared application.';
  if (item.type === 'tender' || item.type === 'contract') return 'Ahmad only clicks Submit/Sign/Certify after reviewing bid package and risks.';
  return 'Ahmad only clicks Send/Connect/Contact after reviewing message.';
}

function lineItem(item, index) {
  return [
    `${index + 1}. ${item.title} - ${item.organization}`,
    `   - Type: ${item.type}; priority ${item.priorityScore}/10; difficulty ${item.difficultyScore}/10`,
    `   - Source: ${item.sourceLink}`,
    `   - Assigned prep agent: ${pickPrepAgent(item)}`,
    `   - Agent next step: ${nextPrep(item)}`,
    `   - CEO final action: ${finalAction(item)}`
  ].join('\n');
}

async function writeAgentSpecs() {
  await fs.mkdir(AGENT_DIR, { recursive: true });
  const specs = {
    'tender-bid-brief-agent.md': {
      title: 'Tender Bid Brief Agent',
      purpose: 'Turn tender/contract opportunities into bid/no-bid briefs and final-action packets.',
      stop: 'Submit, Sign, Certify, Pay, legal commitment, penalty/bond exposure, false claim.'
    },
    'vendor-registration-prep-agent.md': {
      title: 'Vendor Registration Prep Agent',
      purpose: 'Prepare bank, government, hospital, university, and enterprise vendor portal registrations.',
      stop: 'Create Account, Submit, Certify, Pay, legal attestation, credential/security change.'
    },
    'career-application-prep-agent.md': {
      title: 'Career Application Prep Agent',
      purpose: 'Prepare high-value job, contract, consulting, and remote role applications.',
      stop: 'Apply, Submit, external upload, false answer, salary/legal commitment.'
    },
    'outreach-draft-agent.md': {
      title: 'Outreach Draft Agent',
      purpose: 'Prepare buyer profiles, pain hypotheses, no-send messages, and follow-up drafts.',
      stop: 'Send, Connect, Contact, spammy behavior, platform-risk behavior, reputation-sensitive claim.'
    },
    'ceo-final-action-compressor-agent.md': {
      title: 'CEO Final Action Compressor Agent',
      purpose: 'Reduce open tasks into one-minute CEO action packets and route all preparable work back to other agents.',
      stop: 'Any final external action or irreversible change.'
    }
  };

  for (const [file, spec] of Object.entries(specs)) {
    const body = `# ${spec.title}

Created: ${nowIso}

Purpose: ${spec.purpose}

Operating rule:
- Do all safe, no-cost, reversible preparation without asking Ahmad.
- Use public or user-provided data only.
- Keep communication to Ahmad need-to-know.
- If blocked, create the next smallest prep task for another agent before asking Ahmad.

Hard stop:
- ${spec.stop}

Output:
- Prepared packet.
- Missing information.
- Exact CEO final action.
- Risk note if any.
`;
    await fs.writeFile(path.join(AGENT_DIR, file), body, 'utf8');
  }
}

async function main() {
  const db = await readJson(OPPORTUNITIES_FILE, { items: [] });
  const items = [...(db.items || [])].filter((item) => item.status !== 'ignored').sort(scoreSort);
  const top = items.slice(0, 15);
  const ready = items.filter((item) => item.status === 'ready_to_submit').slice(0, 10);
  const review = items.filter((item) => item.status === 'needs_review').slice(0, 10);
  const vendor = items.filter((item) => item.type === 'vendor registration').slice(0, 8);
  const career = items.filter((item) => item.type === 'job').slice(0, 8);
  const contract = items.filter((item) => item.type === 'tender' || item.type === 'contract').slice(0, 8);

  await writeAgentSpecs();

  const board = `# Interaction Avoidance Board

Updated: ${nowIso}

Purpose: reduce Ahmad interaction. Agents should keep working until only a true final action remains.

## Rule
- If work is safe, no-cost, reversible, internal, no-send, and no-submit: do it.
- If a task is blocked, first create the next prep packet or route it to an auto-created prep agent.
- Ask Ahmad only for cost, legal exposure, reputation risk, irreversible damage, account creation, credential/security change, platform-risk action, deletion/move/archive without backup, or final external Send/Connect/Contact/Submit/Apply/Approve/Accept/Sign/Certify.

## Auto-Created Prep Agents
- tender-bid-brief-agent
- vendor-registration-prep-agent
- career-application-prep-agent
- outreach-draft-agent
- ceo-final-action-compressor-agent

## Next Work Agents Can Do Without Ahmad
${top.length ? top.map(lineItem).join('\n\n') : '- No current items.'}

## One-Minute CEO Final Actions
${ready.length ? ready.map(lineItem).join('\n\n') : '- No ready-to-submit items yet. Agents should keep preparing.'}

## Needs Review Queue
${review.length ? review.map(lineItem).join('\n\n') : '- No needs-review items.'}

## Contract/Tender Prep Queue
${contract.length ? contract.map(lineItem).join('\n\n') : '- No contract/tender items.'}

## Career Prep Queue
${career.length ? career.map(lineItem).join('\n\n') : '- No career items.'}

## Vendor Portal Prep Queue
${vendor.length ? vendor.map(lineItem).join('\n\n') : '- No vendor portal items.'}
`;

  await fs.writeFile(BOARD_FILE, board, 'utf8');

  const queueUpdate = `
## ${nowIso.slice(0, 16).replace('T', ' ')} - Interaction Avoidance Agent run

- Created/updated auto-created prep agent specs in \`senior-director-state/auto-created-agents\`.
- Wrote \`senior-director-state/interaction-avoidance-board.md\`.
- Agents should route preparable work to those specs before asking Ahmad.
- Current opportunity base: ${items.length} active items, ${ready.length} ready items, ${review.length} review items.
- Hard stops remain final external action, cost, legal/reputation/irreversible/platform risk, account creation, credential/security change, or destructive file action without backup.
`;
  await append(QUEUE_FILE, queueUpdate);

  const commandUpdate = `

## Interaction Avoidance Agent
- Latest run: ${nowIso}
- Board: \`senior-director-state/interaction-avoidance-board.md\`
- Auto-created prep agents: \`senior-director-state/auto-created-agents\`
- Active items routed for prep: ${items.length}
- Do not ask Ahmad unless true CEO final action or hard risk gate.
`;
  await append(COMMAND_UPDATE_FILE, commandUpdate);

  const executionNote = `

### ${nowIso.slice(0, 16).replace('T', ' ')} - Interaction Avoidance Agent - completed

Scope: Create prep-agent routing so safe work continues without Ahmad interaction.

Changed files:
- \`scripts/interaction-avoidance-agent.mjs\`
- \`senior-director-state/auto-created-agents/*\`
- \`senior-director-state/interaction-avoidance-board.md\`
- \`senior-director-state/codex-claude-queue.md\`
- \`senior-director-state/iis-aria-command-update.md\`

Result:
- Routed ${items.length} active opportunities into prep paths.
- Created one-minute CEO final-action section.
- No external send, submit, apply, contact, cost, legal commitment, account creation, or destructive action performed.
`;
  await append(EXECUTION_NOTES, executionNote);

  await publishAgentReport({
    agentId: 'interaction-avoidance-agent',
    label: 'Interaction Avoidance Agent',
    summary: 'Prep-agent routing and one-minute CEO final-action lanes are refreshed.',
    metrics: {
      activeItems: items.length,
      readyItems: ready.length,
      reviewItems: review.length,
      contractItems: contract.length,
      vendorItems: vendor.length,
      careerItems: career.length
    },
    artifacts: [
      BOARD_FILE,
      AGENT_DIR,
      COMMAND_UPDATE_FILE
    ],
    readyActions: [
      ready.length ? `${ready.length} item(s) are marked ready for Ahmad-only final action when surfaced live.` : null
    ].filter(Boolean),
    nextActions: [
      contract.length ? `Keep tender prep moving on ${contract.length} contract/tender item(s).` : null,
      vendor.length ? `Keep supplier registration prep moving on ${vendor.length} portal item(s).` : null
    ].filter(Boolean),
    focusAreas: ['interaction-reduction', 'prep-agent-routing', 'ceo-final-action-compression']
  });

  console.log(JSON.stringify({
    ok: true,
    activeItems: items.length,
    readyItems: ready.length,
    reviewItems: review.length,
    board: BOARD_FILE,
    agentDir: AGENT_DIR
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
