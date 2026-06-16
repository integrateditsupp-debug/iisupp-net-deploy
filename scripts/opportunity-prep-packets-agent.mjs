#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVendorRegistrationMeta } from './vendor-registration-metadata.mjs';
import { publishAgentReport } from './autonomy-supervisor-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const ENGINE_DIR = path.join(STATE_DIR, 'opportunity-engine');
const DB_FILE = path.join(ENGINE_DIR, 'opportunities.json');
const PACKETS_FILE = path.join(ENGINE_DIR, 'prep-packets.md');
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

function isEligible(item) {
  return item.status !== 'ignored' && item.manualDisposition !== 'direct_no_bid';
}

function scoreSort(a, b) {
  const typeRank = (item) => {
    if (item.type === 'tender' || item.type === 'contract') return 3;
    if (item.type === 'vendor registration') return 2;
    if (item.type === 'job') return 0;
    return 1;
  };
  if (typeRank(b) !== typeRank(a)) return typeRank(b) - typeRank(a);
  if ((b.qualityScore || 0) !== (a.qualityScore || 0)) return (b.qualityScore || 0) - (a.qualityScore || 0);
  if ((b.priorityScore || 0) !== (a.priorityScore || 0)) return (b.priorityScore || 0) - (a.priorityScore || 0);
  return (a.difficultyScore || 99) - (b.difficultyScore || 99);
}

function docList(item) {
  const vendorMeta = getVendorRegistrationMeta(item);
  if (item.type === 'vendor registration' && vendorMeta?.requiredDocuments?.length) return vendorMeta.requiredDocuments;
  if (item.requiredDocuments?.length) return item.requiredDocuments;
  if (item.type === 'job') return ['Default AI Engineer resume', 'short cover note', 'work authorization answers'];
  if (item.type === 'vendor registration') return ['company profile', 'services summary', 'insurance/certification checklist'];
  return ['bid/no-bid brief', 'mandatory requirements checklist', 'company profile', 'pricing approach'];
}

function pitchAngle(item) {
  const vendorMeta = getVendorRegistrationMeta(item);
  const text = `${item.title} ${item.organization} ${item.whyRelevant || ''}`.toLowerCase();
  if (item.type === 'job') {
    if (text.includes('ai')) return 'AI engineering, workflow automation, practical product delivery, and client-facing technical judgment.';
    if (text.includes('devops') || text.includes('cloud')) return 'cloud support, automation, troubleshooting, deployment discipline, and systems reliability.';
    if (text.includes('product')) return 'technical product thinking, AI delivery, user workflow understanding, and execution speed.';
    return 'AI, IT support, automation, Microsoft 365, and disciplined technical delivery.';
  }
  if (item.type === 'vendor registration') {
    return (
      vendorMeta?.angle ||
      'Integrated IT Support as a small, responsive technology services provider for IT support, AI automation, M365, software/web, and cybersecurity-aligned operations.'
    );
  }
  if (text.includes('project manager')) return 'technical project delivery, IT coordination, stakeholder communication, and disciplined documentation.';
  if (text.includes('security')) return 'security-aware IT support, application/security review, Microsoft 365 identity hygiene, and escalation discipline.';
  if (text.includes('learning management') || text.includes('lms')) return 'software implementation support, user support, workflow automation, training support, and operational rollout.';
  return 'IT support, AI automation, Microsoft 365, software/web implementation, and managed-service delivery.';
}

function blockers(item) {
  const vendorMeta = getVendorRegistrationMeta(item);
  const out = [];
  if (!item.deadline && ['tender', 'contract'].includes(item.type)) out.push('Confirm deadline on source page.');
  if (!item.estimatedValueOrSalary) out.push(item.type === 'job' ? 'Salary not listed.' : 'Value not listed.');
  if (item.manualDisposition === 'partner_path_only') {
    out.push('Direct bid should stay parked unless a real eligible partner path is proven.');
  }
  if (item.type === 'tender' || item.type === 'contract') out.push('Confirm mandatory requirements and submission forms before final action.');
  if (item.type === 'vendor registration') {
    if (vendorMeta?.blockers?.length) out.push(...vendorMeta.blockers);
    else out.push('Confirm account creation, certification, and legal attestation requirements before final action.');
  }
  if (item.type === 'job') out.push('Confirm work authorization, remote eligibility, and custom questions before final action.');
  if (item.manualReference) out.push(`Review file: ${item.manualReference}`);
  return out;
}

function finalAction(item) {
  const vendorMeta = getVendorRegistrationMeta(item);
  if (item.manualDisposition === 'partner_path_only') {
    return 'Ahmad decides whether to keep this parked, allow partner-path-only prep, or discard it from the active revenue lane.';
  }
  if (vendorMeta?.finalAction) return vendorMeta.finalAction;
  if (item.type === 'job') return 'Ahmad opens source, reviews prepared answers, then clicks Apply/Submit only if satisfied.';
  if (item.type === 'vendor registration') return 'Ahmad opens portal, reviews checklist, then clicks Create Account/Register/Submit/Certify only if satisfied.';
  if (item.type === 'tender' || item.type === 'contract') return 'Ahmad reviews bid/no-bid risk, then clicks Submit/Sign/Certify only if satisfied.';
  return 'Ahmad reviews message, then clicks Send/Connect/Contact only if satisfied.';
}

function packet(item, index) {
  const docs = docList(item);
  const missing = blockers(item);
  const vendorMeta = getVendorRegistrationMeta(item);
  const manualReasonLine = item.manualReason ? `- Manual posture: ${item.manualReason}` : null;
  const manualReferenceLine = item.manualReference ? `- Grounding file: \`${item.manualReference}\`` : null;
  const nextPrep = item.manualDisposition === 'partner_path_only'
    ? 'Use the grounding brief to decide whether to keep this parked, prepare only a partner-path note, or discard it from the active revenue lane.'
    : item.type === 'vendor registration' && vendorMeta?.nextPrep
    ? vendorMeta.nextPrep
    : (item.recommendedNextStep || 'Review source and prepare final-action packet.');
  const draftMessage = item.type === 'vendor registration' && vendorMeta?.draftMessage
    ? vendorMeta.draftMessage
    : (item.draftMessage || 'Draft not generated yet.');
  const prepFileLine = item.type === 'vendor registration' && vendorMeta?.prepPack
    ? `- Prep file: \`${vendorMeta.prepPack}\``
    : null;
  return `## ${index + 1}. ${item.title}

- Organization: ${item.organization}
- Type: ${item.type}
- Priority: ${item.priorityScore}/10
- Difficulty: ${item.difficultyScore}/10
- Deadline: ${item.deadline || 'not found'}
- Value/salary: ${item.estimatedValueOrSalary || 'not found'}
- Source: ${item.sourceLink}

Need-to-know:
- Fit: ${item.whyRelevant || 'possible growth fit'}
- Angle: ${pitchAngle(item)}
${prepFileLine ? `${prepFileLine}\n` : ''}${manualReasonLine ? `${manualReasonLine}\n` : ''}${manualReferenceLine ? `${manualReferenceLine}\n` : ''}- Next prep: ${nextPrep}

Suggested draft:
${draftMessage}

Required documents:
${docs.map((doc) => `- ${doc}`).join('\n')}

Missing / verify before final action:
${missing.map((line) => `- ${line}`).join('\n')}

CEO final action:
- ${finalAction(item)}
`;
}

async function main() {
  const db = await readJson(DB_FILE, { items: [] });
  const active = (db.items || [])
    .filter(isEligible)
    .sort(scoreSort);

  const tenders = active.filter((item) => item.type === 'tender' || item.type === 'contract').slice(0, 7);
  const vendors = active.filter((item) => item.type === 'vendor registration').slice(0, 8);
  const revenuePackets = [...tenders, ...vendors].sort(scoreSort).slice(0, 12);
  const jobs = active.filter((item) => item.type === 'job').slice(0, 3);
  const selected = [...revenuePackets, ...jobs].slice(0, 15);

  const body = `# Opportunity Prep Packets

Updated: ${nowIso}

Rule: these are preparation packets only. Do not send, submit, apply, create accounts, certify, sign, pay, or make legal commitments without Ahmad final approval.

Summary:
- Active opportunities reviewed: ${active.length}
- Prep packets prepared: ${selected.length}
- Revenue/company packets: ${revenuePackets.length}
- Tender/contract packets: ${tenders.length}
- Vendor portal packets: ${vendors.length}
- Career packets: ${jobs.length}

Priority rule:
- Company revenue opportunities come first.
- Career-role packets stay secondary and are capped unless revenue slots are sparse.

${selected.map(packet).join('\n')}
`;

  await fs.writeFile(PACKETS_FILE, body, 'utf8');

  const note = `
## ${nowIso.slice(0, 16).replace('T', ' ')} - Opportunity prep packets generated

- Prepared ${selected.length} no-send/no-submit opportunity packets.
- File: \`senior-director-state/opportunity-engine/prep-packets.md\`
- Prioritized company revenue opportunities first; career opportunities remain secondary.
- No external action taken.
`;
  await fs.appendFile(QUEUE_FILE, note, 'utf8');
  await fs.appendFile(COMMAND_UPDATE_FILE, `

## Opportunity Prep Packets
- Latest run: ${nowIso}
- File: \`senior-director-state/opportunity-engine/prep-packets.md\`
- Prepared packets: ${selected.length}
- No send/submit/apply/account/legal action taken.
`, 'utf8');
  await fs.appendFile(EXECUTION_NOTES, `

### ${nowIso.slice(0, 16).replace('T', ' ')} - Opportunity Prep Packets Agent - completed

Scope: Prepare concrete CEO-final-action packets from the Opportunity Engine database.

Changed files:
- \`scripts/opportunity-prep-packets-agent.mjs\`
- \`senior-director-state/opportunity-engine/prep-packets.md\`
- \`senior-director-state/codex-claude-queue.md\`
- \`senior-director-state/iis-aria-command-update.md\`

Result:
- Prepared ${selected.length} no-send/no-submit packets.
- No external send, submit, apply, contact, account creation, payment, legal commitment, or destructive action performed.
`, 'utf8');

  await publishAgentReport({
    agentId: 'opportunity-prep-packets-agent',
    label: 'Opportunity Prep Packets Agent',
    summary: 'Bid, portal, and job preparation packets are refreshed to the CEO final-action point.',
    metrics: {
      activeItems: active.length,
      preparedPackets: selected.length,
      revenuePackets: revenuePackets.length,
      tenderPackets: tenders.length,
      vendorPackets: vendors.length,
      careerPackets: jobs.length
    },
    artifacts: [
      PACKETS_FILE,
      DB_FILE,
      COMMAND_UPDATE_FILE
    ],
    nextActions: [
      tenders.length ? `Advance ${tenders.length} tender/contract packet(s) to bid/no-bid posture.` : null,
      vendors.length ? `Advance ${vendors.length} vendor registration packet(s) to final checklist posture.` : null
    ].filter(Boolean),
    focusAreas: ['tender-prep', 'vendor-registration-prep', 'ceo-final-action-packets']
  });

  console.log(JSON.stringify({ ok: true, active: active.length, prepared: selected.length, file: PACKETS_FILE }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
