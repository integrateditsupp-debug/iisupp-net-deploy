#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishAgentReport } from './autonomy-supervisor-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const ENGINE_DIR = path.join(STATE_DIR, 'opportunity-engine');
const DB_FILE = path.join(ENGINE_DIR, 'opportunities.json');
const OVERRIDES_FILE = path.join(ENGINE_DIR, 'manual-overrides.json');
const REPORT_FILE = path.join(ENGINE_DIR, 'quality-gate-report.md');
const QUEUE_FILE = path.join(STATE_DIR, 'codex-claude-queue.md');
const COMMAND_UPDATE_FILE = path.join(STATE_DIR, 'iis-aria-command-update.md');
const EXECUTION_NOTES = path.join(ROOT, 'AGENT_EXECUTION_NOTES.md');

const nowIso = new Date().toISOString();

const strongFit = [
  /\bai\b/i,
  /artificial intelligence/i,
  /machine learning/i,
  /automation/i,
  /software/i,
  /developer/i,
  /devops/i,
  /cloud/i,
  /azure/i,
  /aws/i,
  /cyber/i,
  /security architect/i,
  /information technology/i,
  /\bit professional/i,
  /microsoft/i,
  /m365/i,
  /help desk/i,
  /it support/i,
  /technical support/i,
  /systems? analyst/i,
  /business system analyst/i,
  /programmer/i,
  /project manager/i,
  /product development/i,
  /product security/i,
  /learning management system/i,
  /\blms\b/i,
  /data/i,
  /telecom/i,
  /hardware maintenance and support/i
];

const weakFit = [
  /armoured sports utility vehicles/i,
  /armoured/i,
  /marine fuel/i,
  /groceries/i,
  /flare station/i,
  /landfill/i,
  /turbidity/i,
  /water purification/i,
  /negotiator services/i,
  /sales(?!force)/i,
  /product marketing/i,
  /courier/i,
  /scheduling coordinator/i,
  /virtual scheduling assistant/i,
  /junior/i,
  /entry[- ]level/i,
  /intern/i,
  /payroll/i,
  /tutor/i,
  /lesson/i,
  /groceries/i,
  /generator rental/i,
  /spare parts?/i,
  /furniture/i,
  /chairs/i,
  /containers?/i,
  /conduit/i,
  /placard holder/i,
  /tractor/i,
  /spectrometer/i,
  /construction(?!.*software|.*technology|.*data|.*security)/i
];

const jobCoreFit = /ai|automation|software|developer|engineer|devops|cloud|security|product manager|product development|technical product|site reliability|solutions engineer|platform/i;
const goodsTenderNoise = /generator|spare parts?|furniture|chairs|containers?|conduit|placard holder|tractor|spectrometer|vehicle|roof|retrofit|repair(?!.*software|.*system)|warehouse|imaging|veterinary|sewage|lift station|force main|cooling coils?|boat house|rehabilitation|lockstation|office space study|replacement/i;
const digitalTenderSignals = /software|application|cloud|cyber|security|data|digital|it support|technical support|help desk|developer|devops|architect|project manager|system|network|backup|identity|microsoft|azure|aws|lms|learning management/i;
const roleStaffingTenderSignals = /\btbips\b|\btsps\b|\bths\b|temporary help services|supply arrangement|level\s?[1-5]\b|stream\s+\d|p\.\d|project manager|security architect|business system analyst|application\/software architect|programmer\/software developer|special advisor|professional services/i;
const managedServiceSignals = /help desk|it support|technical support|managed service|operations support|maintenance and support|workflow|knowledge base|documentation|m365|microsoft 365|office move|website|automation blueprint/i;

function factText(item) {
  return [
    item.title || '',
    item.organization || '',
    item.sourceName || '',
    item.locationOrRemote || '',
    item.summary || '',
    Array.isArray(item.tags) ? item.tags.join(' ') : '',
    item.sourceLink || ''
  ].join(' ');
}

function businessWeight(item) {
  if (item.type === 'tender' || item.type === 'contract') return 3;
  if (item.type === 'vendor registration') return 2;
  if (item.type === 'job') return 0;
  return 1;
}

function matchesOverride(item, rule) {
  const match = rule?.match || {};
  if (match.sourceLinkIncludes && !(item.sourceLink || '').includes(match.sourceLinkIncludes)) return false;
  if (match.titleIncludes && !(`${item.title || ''}`.includes(match.titleIncludes))) return false;
  if (match.organizationIncludes && !(`${item.organization || ''}`.includes(match.organizationIncludes))) return false;
  return Boolean(match.sourceLinkIncludes || match.titleIncludes || match.organizationIncludes);
}

function findOverride(item, overrides) {
  return overrides.find((rule) => matchesOverride(item, rule)) || null;
}

function isGoodsTenderNoise(item) {
  if (!['tender', 'contract'].includes(item.type)) return false;
  const text = factText(item);
  return goodsTenderNoise.test(text) && !digitalTenderSignals.test(text);
}

function isCategoryFeedFalsePositive(item) {
  if (!['tender', 'contract'].includes(item.type)) return false;
  const feed = `${item.sourceName || ''} ${item.organization || ''}`.toLowerCase();
  if (!/(ai opportunities|cybersecurity opportunities|it opportunities)/i.test(feed)) return false;
  const title = `${item.title || ''}`.toLowerCase();
  return !digitalTenderSignals.test(title);
}

function isRoleStaffingTender(item) {
  if (!['tender', 'contract'].includes(item.type)) return false;
  const text = factText(item);
  if (!/government|department|canadabuys|shared services canada|dnd|ised|pspc/i.test(text)) return false;
  if (!roleStaffingTenderSignals.test(text)) return false;
  return !managedServiceSignals.test(text);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function quality(item) {
  const haystack = factText(item);
  let score = 0;
  for (const pattern of strongFit) if (pattern.test(haystack)) score += 1;
  for (const pattern of weakFit) if (pattern.test(haystack)) score -= 2;
  if (item.type === 'vendor registration') score += 4;
  if (item.type === 'tender' || item.type === 'contract') score += 3;
  if (item.type === 'job') score -= 2;
  if (/senior|principal|staff|lead|architect|director|manager|contract|consultant/i.test(haystack)) score += 2;
  if (/junior|entry[- ]level|intern/i.test(haystack)) score -= 3;
  if (item.type === 'job' && !jobCoreFit.test(haystack)) score -= 4;
  if (item.type === 'job' && /sales|marketing|assistant|coordinator|courier/i.test(haystack) && !/salesforce|engineer|developer|ai|automation|technical/i.test(haystack)) score -= 5;
  if (item.type === 'job' && /sales|marketing/i.test(haystack) && !/salesforce|engineer|developer|ai|automation|technical/i.test(haystack)) score -= 3;
  if (isGoodsTenderNoise(item)) score -= 8;
  if (isCategoryFeedFalsePositive(item)) score -= 6;
  if (isRoleStaffingTender(item)) score -= 5;
  if (/remote/i.test(haystack)) score += 1;
  if (/government|department|shared services canada|dnd|canadabuys/i.test(haystack) && score > 0) score += 1;
  return score;
}

function newStatus(item, q) {
  if (item.status === 'submitted' || item.status === 'ignored') return item.status;
  if (q <= 0) return 'ignored';
  if (item.type === 'job') {
    if (q >= 6 && (item.priorityScore || 0) >= 8) return 'needs_review';
    if (q >= 3) return item.status === 'new' ? 'queued' : item.status;
    return 'ignored';
  }
  if (q >= 3 && (item.priorityScore || 0) >= 8) return 'needs_review';
  if (q >= 2) return item.status === 'new' ? 'queued' : item.status;
  return 'queued';
}

async function main() {
  const db = await readJson(DB_FILE, { version: 1, items: [] });
  const overrideDb = await readJson(OVERRIDES_FILE, { overrides: [] });
  const overrides = Array.isArray(overrideDb.overrides) ? overrideDb.overrides : [];
  let parked = 0;
  let promoted = 0;
  let manualParked = 0;
  const decisions = [];

  const items = (db.items || []).map((item) => {
    const override = findOverride(item, overrides);
    const q = quality(item);
    const status = override?.action === 'ignore' ? 'ignored' : newStatus(item, q);
    const next = {
      ...item,
      qualityScore: q,
      qualityGateAt: nowIso,
      status,
      manualDisposition: override?.disposition || null,
      manualReason: override?.reason || null,
      manualReference: override?.reference || null
    };
    if (status === 'ignored' && item.status !== 'ignored') parked += 1;
    if (override?.action === 'ignore' && item.status !== 'ignored') manualParked += 1;
    if (status === 'needs_review' && item.status !== 'needs_review') promoted += 1;
    decisions.push({
      title: item.title,
      organization: item.organization,
      type: item.type,
      oldStatus: item.status,
      status,
      q,
      overrideReason: override?.reason || null
    });
    return next;
  }).sort((a, b) => {
    if (businessWeight(b) !== businessWeight(a)) return businessWeight(b) - businessWeight(a);
    if ((b.qualityScore || 0) !== (a.qualityScore || 0)) return (b.qualityScore || 0) - (a.qualityScore || 0);
    if ((b.priorityScore || 0) !== (a.priorityScore || 0)) return (b.priorityScore || 0) - (a.priorityScore || 0);
    return (a.difficultyScore || 99) - (b.difficultyScore || 99);
  });

  await fs.writeFile(DB_FILE, JSON.stringify({ ...db, updated: nowIso, items }, null, 2), 'utf8');

  const active = items.filter((item) => item.status !== 'ignored');
  const revenueTop = active.filter((item) => item.type !== 'job').slice(0, 15);
  const careerTop = active.filter((item) => item.type === 'job').slice(0, 8);
  const report = `# Opportunity Quality Gate Report

Updated: ${nowIso}

Purpose: reduce junk and keep Ahmad's review list focused on IIS/ARIA revenue opportunities first, then only strong technical career-growth fits.

Summary:
- Total items: ${items.length}
- Active after gate: ${active.length}
- Revenue/company items active: ${active.filter((item) => item.type !== 'job').length}
- Career items active: ${active.filter((item) => item.type === 'job').length}
- Parked/ignored this run: ${parked}
- Manually parked via overrides this run: ${manualParked}
- Promoted to needs review this run: ${promoted}

## Top Revenue / Company Items
${revenueTop.map((item, index) => `${index + 1}. ${item.title} - ${item.organization} (${item.type}, quality ${item.qualityScore}, priority ${item.priorityScore}, status ${item.status})`).join('\n') || '- None'}

## Top Career Items
${careerTop.map((item, index) => `${index + 1}. ${item.title} - ${item.organization} (${item.type}, quality ${item.qualityScore}, priority ${item.priorityScore}, status ${item.status})`).join('\n') || '- None'}

## Parked This Run
${decisions.filter((d) => d.oldStatus !== 'ignored' && d.status === 'ignored').slice(0, 40).map((d) => `- ${d.title} - ${d.organization} (${d.type}, quality ${d.q})${d.overrideReason ? ` | ${d.overrideReason}` : ''}`).join('\n') || '- None'}
`;

  await fs.writeFile(REPORT_FILE, report, 'utf8');

  await fs.appendFile(QUEUE_FILE, `
## ${nowIso.slice(0, 16).replace('T', ' ')} - Opportunity quality gate

- Quality gate applied to ${items.length} opportunity items.
- Active after gate: ${active.length}.
- Parked/ignored this run: ${parked}.
- Report: \`senior-director-state/opportunity-engine/quality-gate-report.md\`.
- No external action taken.
`, 'utf8');

  await fs.appendFile(COMMAND_UPDATE_FILE, `

## Opportunity Quality Gate
- Latest run: ${nowIso}
- Active after gate: ${active.length}
- Parked/ignored this run: ${parked}
- Report: \`senior-director-state/opportunity-engine/quality-gate-report.md\`
- No external action taken.
`, 'utf8');

  await fs.appendFile(EXECUTION_NOTES, `

### ${nowIso.slice(0, 16).replace('T', ' ')} - Opportunity Quality Gate Agent - completed

Scope: Park weak-fit opportunities and improve CEO review quality.

Changed files:
- \`scripts/opportunity-quality-gate-agent.mjs\`
- \`senior-director-state/opportunity-engine/opportunities.json\`
- \`senior-director-state/opportunity-engine/quality-gate-report.md\`
- \`senior-director-state/codex-claude-queue.md\`
- \`senior-director-state/iis-aria-command-update.md\`

Result:
- Reviewed ${items.length} opportunity items.
- Active after gate: ${active.length}.
- Parked/ignored this run: ${parked}.
- No external send, submit, apply, contact, account creation, payment, legal commitment, or destructive action performed.
`, 'utf8');

  await publishAgentReport({
    agentId: 'opportunity-quality-gate-agent',
    label: 'Opportunity Quality Gate Agent',
    summary: 'Opportunity quality gate refreshed the revenue queue and parked weak-fit noise.',
    metrics: {
      totalItems: items.length,
      activeItems: active.length,
      activeRevenueItems: active.filter((item) => item.type !== 'job').length,
      parkedItems: parked,
      manualParkedItems: manualParked,
      promotedItems: promoted
    },
    artifacts: [
      DB_FILE,
      REPORT_FILE,
      COMMAND_UPDATE_FILE
    ],
    nextActions: [
      active.length ? 'Keep prep focused on active revenue/company items first.' : null,
      promoted ? `Review ${promoted} newly promoted item(s).` : null
    ].filter(Boolean),
    focusAreas: ['opportunity-triage', 'bid-no-bid-filtering', 'revenue-first-ranking']
  });

  console.log(JSON.stringify({ ok: true, total: items.length, active: active.length, parked, report: REPORT_FILE }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
