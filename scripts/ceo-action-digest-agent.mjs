#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVendorRegistrationMeta } from './vendor-registration-metadata.mjs';
import { publishAgentReport } from './autonomy-supervisor-core.mjs';
import {
  APPROVED_PUBLISH_SUMMARY,
  LOCAL_ONLY_STAGED_REVIEW_FILES,
  approvalTextForReview
} from './staged-review-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const ENGINE_DIR = path.join(STATE_DIR, 'opportunity-engine');
const DB_FILE = path.join(ENGINE_DIR, 'opportunities.json');
const DIGEST_FILE = path.join(STATE_DIR, 'ceo-now-action-digest.md');
const CEO_APPROVAL_FILE = path.join(STATE_DIR, 'ceo-approval-required.md');
const QUEUE_FILE = path.join(STATE_DIR, 'codex-claude-queue.md');
const COMMAND_UPDATE_FILE = path.join(STATE_DIR, 'iis-aria-command-update.md');
const EXECUTION_NOTES = path.join(ROOT, 'AGENT_EXECUTION_NOTES.md');

const nowIso = new Date().toISOString();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function readText(file, fallback = '') {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return fallback;
  }
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function isEligible(item) {
  return item.status !== 'ignored' && item.manualDisposition !== 'direct_no_bid';
}

function rank(a, b) {
  if ((b.qualityScore || 0) !== (a.qualityScore || 0)) return (b.qualityScore || 0) - (a.qualityScore || 0);
  if ((b.priorityScore || 0) !== (a.priorityScore || 0)) return (b.priorityScore || 0) - (a.priorityScore || 0);
  return (a.difficultyScore || 99) - (b.difficultyScore || 99);
}

function collectApprovalBullets(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function approvalSection(title, items) {
  if (!items.length) return `## ${title}\n- None.\n`;
  return `## ${title}\n${items.map((item) => `- ${item}`).join('\n')}\n`;
}

function classifyApprovalQueue(items) {
  const sendNow = [];
  const upcoming = [];
  const publish = [];
  const portal = [];
  const alreadyApproved = [];

  for (const item of items) {
    if (/already on `origin\/main`/i.test(item)) {
      alreadyApproved.push(item);
      continue;
    }
    if (/approved-to-transmit|send them when an email\/contact surface is available/i.test(item)) {
      sendNow.push(item);
      continue;
    }
    if (/Jason Brown/i.test(item)) {
      upcoming.push(item);
      continue;
    }
    if (/supplier registration|portal CAPTCHA|Create Account|certification/i.test(item)) {
      portal.push(item);
      continue;
    }
    if (/publish|local-only|preview slice|deployment-path slice|sample-preview slice/i.test(item)) {
      publish.push(item);
    }
  }

  return { sendNow, upcoming, publish, portal, alreadyApproved };
}

function watchlistLine(item, index) {
  const vendorMeta = getVendorRegistrationMeta(item);
  const nextPrep = item.manualDisposition === 'partner_path_only'
    ? 'Use the grounding brief to decide whether to keep this parked, allow partner-path-only prep, or discard it from the active revenue lane.'
    : item.type === 'vendor registration' && vendorMeta?.nextPrep
    ? vendorMeta.nextPrep
    : (item.recommendedNextStep || 'Review source and continue prep.');
  const lines = [
    `${index + 1}. ${item.title} - ${item.organization}`,
    `   - Type: ${item.type}; quality ${item.qualityScore ?? 'n/a'}; priority ${item.priorityScore}/10; difficulty ${item.difficultyScore}/10`,
    `   - Why: ${item.whyRelevant || 'growth fit'}`,
  ];
  if (item.manualReason) {
    lines.push(`   - Manual posture: ${item.manualReason}`);
  }
  if (item.type === 'vendor registration' && vendorMeta?.prepPack) {
    lines.push(`   - Prep file: \`${vendorMeta.prepPack}\``);
  }
  if (item.manualReference) {
    lines.push(`   - Grounding file: \`${item.manualReference}\``);
  }
  lines.push(`   - Next prep: ${nextPrep}`);
  lines.push(`   - Link: ${item.sourceLink}`);
  return lines.join('\n');
}

async function main() {
  const db = await readJson(DB_FILE, { items: [] });
  const approvalMarkdown = await readText(CEO_APPROVAL_FILE, '');
  const active = (db.items || []).filter(isEligible).sort(rank);
  const business = active.filter((item) => item.type !== 'job');
  const businessWatch = business
    .filter((item) => item.status !== 'ready_to_submit')
    .slice(0, 5);
  const approvalItems = collectApprovalBullets(approvalMarkdown);
  const approvalSet = new Set(approvalItems);
  if (!approvalSet.has(APPROVED_PUBLISH_SUMMARY)) {
    approvalItems.push(APPROVED_PUBLISH_SUMMARY);
    approvalSet.add(APPROVED_PUBLISH_SUMMARY);
  }
  for (const review of LOCAL_ONLY_STAGED_REVIEW_FILES) {
    const reviewFile = path.join(ROOT, review.relPath);
    const text = approvalTextForReview(review);
    if (!approvalSet.has(text) && await fileExists(reviewFile)) {
      approvalItems.push(text);
      approvalSet.add(text);
    }
  }
  const approvals = classifyApprovalQueue(approvalItems);
  const queueCount = approvals.sendNow.length + approvals.upcoming.length + approvals.publish.length + approvals.portal.length;
  const readyCount = approvals.sendNow.length + approvals.publish.length + approvals.portal.length;

  const normalizedApprovalMarkdown = `# CEO Approval Required

Updated: ${nowIso}

${approvalItems.map((item) => `- ${item}`).join('\n')}

The Director may continue no-cost, reversible work that does not involve external sends, paid actions, final paperwork, penalties, contracts, or irreversible commitments.
`;

  const body = `# CEO Now Action Digest

Updated: ${nowIso}

Need-to-know:
- Approved CEO queue items tracked: ${queueCount}
- Ready for CEO action when the live surface is available: ${readyCount}
- Upcoming dated CEO actions: ${approvals.upcoming.length}
- Business opportunities still under prep: ${business.length}

Rule: nothing below was submitted, sent, applied, registered, paid, signed, certified, or published. CEO-facing items stay business-first; career items remain outside this digest.

${approvalSection('Ready For CEO Send / Publish / Register Decisions', [
  ...approvals.sendNow,
  ...approvals.publish,
  ...approvals.portal
])}

${approvalSection('Upcoming Dated CEO Actions', approvals.upcoming)}

${approvalSection('Already Approved And Waiting On Deployment Surface', approvals.alreadyApproved)}

## Business Opportunities Still Under Prep
${businessWatch.length ? businessWatch.map(watchlistLine).join('\n\n') : '- None.'}

## Next Agent Work
- Keep routing hourly research through the quality gate and prep packets.
- Tighten business watchlist quality and keep career-role noise out of the CEO lane.
- Stop at Submit, Send, Apply, Register/Create Account, Sign, Certify, Pay, or risky production Publish.
`;

  await fs.writeFile(CEO_APPROVAL_FILE, normalizedApprovalMarkdown, 'utf8');
  await fs.writeFile(DIGEST_FILE, body, 'utf8');
  await fs.appendFile(QUEUE_FILE, `
## ${nowIso.slice(0, 16).replace('T', ' ')} - CEO digest generated

- Created \`senior-director-state/ceo-now-action-digest.md\`.
- Approved CEO queue items tracked: ${queueCount}.
- Ready CEO actions on live surfaces: ${readyCount}.
- No external action taken.
`, 'utf8');
  await fs.appendFile(COMMAND_UPDATE_FILE, `

## CEO Now Action Digest
- Latest run: ${nowIso}
- File: \`senior-director-state/ceo-now-action-digest.md\`
- Approved CEO queue items tracked: ${queueCount}
- Ready CEO actions on live surfaces: ${readyCount}
- No external action taken.
`, 'utf8');
  await fs.appendFile(EXECUTION_NOTES, `

### ${nowIso.slice(0, 16).replace('T', ' ')} - CEO Action Digest Agent - completed

Scope: Compress active opportunity work into a short CEO need-to-know action digest.

Changed files:
- \`scripts/ceo-action-digest-agent.mjs\`
- \`senior-director-state/ceo-now-action-digest.md\`
- \`senior-director-state/codex-claude-queue.md\`
- \`senior-director-state/iis-aria-command-update.md\`

Result:
- Created CEO digest with ${queueCount} tracked CEO queue items and ${business.length} business opportunities under prep.
- Ready CEO actions on live surfaces: ${readyCount}.
- No external send, submit, apply, contact, account creation, payment, legal commitment, or destructive action performed.
`, 'utf8');

  await publishAgentReport({
    agentId: 'ceo-action-digest-agent',
    label: 'CEO Action Digest Agent',
    summary: 'CEO-only approval, send, publish, and register decisions are compressed into a short digest.',
    metrics: {
      queueItems: queueCount,
      readyActions: readyCount,
      upcomingActions: approvals.upcoming.length,
      businessPrepItems: business.length
    },
    artifacts: [
      DIGEST_FILE,
      CEO_APPROVAL_FILE,
      COMMAND_UPDATE_FILE
    ],
    approvals: approvalItems,
    readyActions: [
      readyCount ? `${readyCount} CEO action(s) are ready when the live surface is available.` : null
    ].filter(Boolean),
    nextActions: [
      businessWatch.length ? `Keep preparing ${businessWatch.length} top business opportunity watchlist item(s).` : null
    ].filter(Boolean),
    focusAreas: ['ceo-action-compression', 'approval-inbox', 'business-first-routing']
  });

  console.log(JSON.stringify({ ok: true, queueCount, readyCount, business: business.length, file: DIGEST_FILE }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
