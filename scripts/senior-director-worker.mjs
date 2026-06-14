#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPROVED_PUBLISH_SUMMARY,
  LOCAL_ONLY_STAGED_REVIEW_FILES,
  approvalTextForReview
} from './staged-review-files.mjs';
import { publishAgentReport, runAutonomySupervisor } from './autonomy-supervisor-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const LOG_FILE = path.join(STATE_DIR, 'worker.log');
const HEARTBEAT_FILE = path.join(STATE_DIR, 'heartbeat.json');
const LOCK_FILE = path.join(STATE_DIR, 'worker.lock.json');
const SEEN_LEADS_FILE = path.join(STATE_DIR, 'seen-leads.json');
const LEAD_QUEUE_FILE = path.join(STATE_DIR, 'lead-queue.jsonl');
const AGENT_QUEUE_FILE = path.join(STATE_DIR, 'codex-claude-queue.md');
const OVERNIGHT_BRIEF_FILE = path.join(STATE_DIR, 'overnight-brief.md');
const OPERATING_BOARD_FILE = path.join(STATE_DIR, 'director-operating-board.md');
const APPROVALS_FILE = path.join(STATE_DIR, 'ceo-approval-required.md');
const GROWTH_WORKBOOK_FILE = path.join(STATE_DIR, 'IIS_Growth_Engine.xlsx');
const GROWTH_RESEARCH_NOTES_FILE = path.join(STATE_DIR, 'growth-research-notes.md');
const MCP_SCAN_FILE = path.join(STATE_DIR, 'mcp-advantage-scan.json');
const MCP_SCAN_REPORT_FILE = path.join(STATE_DIR, 'mcp-advantage-scan.md');
const BUSINESS_DEV_BRIEF_FILE = path.join(STATE_DIR, 'business-development-daily-brief.md');
const OBTAINED_LEADS_FILE = path.join(STATE_DIR, 'Obtained Leads - contact now.md');
const COMMAND_SYSTEM_FILE = path.join(STATE_DIR, 'iis-aria-command-system.md');
const COMMAND_UPDATE_FILE = path.join(STATE_DIR, 'iis-aria-command-update.md');
const REVENUE_SPRINT_FILE = path.join(STATE_DIR, 'revenue-generation-sprint.md');
const ARIA_PACKAGES_FILE = path.join(STATE_DIR, 'aria-monetization-packages.md');
const GROWTH_LIBRARY_ENGINE_FILE = path.join(STATE_DIR, 'growth-library-product-engine.md');
const LAST_MILE_PROTOCOL_FILE = path.join(STATE_DIR, 'last-mile-execution-protocol.md');
const WORKSPACE_CLEANUP_BOARD_FILE = path.join(STATE_DIR, 'workspace-cleanup-board.md');
const AGENT_RETIREMENT_PLAN_FILE = path.join(STATE_DIR, 'agent-retirement-and-handoff-plan.md');
const WORKSPACE_KNOWLEDGE_HANDOFF_FILE = path.join(STATE_DIR, 'workspace-knowledge-handoff.md');
const AGENT_CARE_REPORT_FILE = path.join(STATE_DIR, 'agent-care-and-recognition.md');
const WORKSPACE_STEWARD_QUEUE_FILE = path.join(STATE_DIR, 'workspace-steward-task-queue.md');
const EXECUTION_NOTES = path.join(ROOT, 'AGENT_EXECUTION_NOTES.md');

const CFG = {
  baseUrl: process.env.IIS_BASE_URL || 'https://iisupp.net',
  ownerEmail: process.env.SENIOR_DIRECTOR_OWNER_EMAIL || 'ahmad.wasee@iisupp.net',
  openclawEnabled: process.env.SENIOR_DIRECTOR_OPENCLAW !== '0',
  openclawAgent: process.env.SENIOR_DIRECTOR_OPENCLAW_AGENT || 'main',
  intervalMs: num(process.env.SENIOR_DIRECTOR_INTERVAL_MS, 15 * 60 * 1000),
  leadIntervalMs: num(process.env.SENIOR_DIRECTOR_LEAD_INTERVAL_MS, 60 * 60 * 1000),
  mcpIntervalMs: num(process.env.SENIOR_DIRECTOR_MCP_INTERVAL_MS, 24 * 60 * 60 * 1000),
  operatingIntervalMs: num(process.env.SENIOR_DIRECTOR_OPERATING_INTERVAL_MS, 30 * 60 * 1000),
  openclawIntervalMs: num(process.env.SENIOR_DIRECTOR_OPENCLAW_INTERVAL_MS, 2 * 60 * 60 * 1000),
  maxOpenclawPerTick: num(process.env.SENIOR_DIRECTOR_MAX_OPENCLAW_PER_TICK, 1),
  dryRun: process.env.SENIOR_DIRECTOR_DRY_RUN === '1'
};

const ALLOWED_WITHOUT_APPROVAL = [
  'Fix bugs, add features, and improve the IIS/ARIA website as reversible work while preserving the current look, feel, brand, colors, typography, and layout language.',
  'Use local browser, Chrome, and desktop automation/testing when Codex, Claude Code, or local agents need it to verify no-cost website or ARIA work.',
  `Use ${CFG.ownerEmail} as the company owner email identity for internal coordination, account identity, draft work, and owner-visible notes.`,
  'Find and research remote L1-L3 IT support contracts, website leads, AI implementation leads, corporate move-in/overflow work, government tenders, and offshore support opportunities.',
  'Monitor ARIA, Lead Radar, site health, logs, local queues, Claude notes, and public lead sources already used by the company.',
  'Prepare no-send drafts, task briefs, troubleshooting fixes, SEO/content suggestions, document checklists, tender checklists, and lead-review notes.',
  'Prepare cleanup, compaction, retirement, rename, and learning-handoff recommendations for the Director without deleting or moving user work.',
  'Track agent load, limits, handoff quality, and recognition notes so agents stay focused and useful.',
  'Complete work to the CEO final-action point: filled forms, staged drafts, prepared packages, browser pages ready for click/sign/submit/send/approve, and exact final-action notes.',
  'Queue safe work for Codex, Claude Code, OpenClaw, and existing mesh agents.'
];

const APPROVAL_REQUIRED = [
  'External email sends, prospect/customer outreach, public statements, quotes, guarantees, or reputation-sensitive claims.',
  'Any paid API, subscription, hosting, advertising, purchase, or action that could create cost.',
  'Final submissions, signatures, contracts, legal commitments, insurance commitments, credential/security changes, DNS/production access changes, or irreversible paperwork.',
  'Final external buttons including Submit, Send, Apply, Complete, Confirm, Sign, Certify, Pay, Purchase, Subscribe, Create Account, Delete, Move/Archive user work, or risky production Publish.',
  'Retiring agents, deleting old agent/task data, clearing high-token logs, renaming production agent IDs, or archiving files after handoff.',
  'Complex L3+ bids, penalties, bid bonds, performance bonds, liquidated damages, surety, non-refundable terms, or anything Ahmad cannot easily reverse.'
];

function authorityText() {
  return [
    'Allowed without extra approval:',
    ...ALLOWED_WITHOUT_APPROVAL.map((line) => `- ${line}`),
    '',
    'Ahmad approval required before:',
    ...APPROVAL_REQUIRED.map((line) => `- ${line}`)
  ].join('\n');
}

const SIMPLE_L1_L2 = [
  'help desk', 'helpdesk', 'service desk', 'desktop support', 'technical support',
  'it support', 'managed it', 'managed services', 'microsoft 365', 'm365',
  'office 365', 'endpoint', 'laptop', 'desktop', 'workstation', 'printer',
  'network support', 'wifi', 'wi-fi', 'software support', 'support renewal',
  'device management', 'intune', 'onboarding', 'offboarding'
];

const L3_REMOTE = [
  'l3 support', 'level 3', 'senior support', 'systems administrator',
  'system administrator', 'network administrator', 'cloud support',
  'azure administrator', 'security support', 'endpoint security',
  'firewall', 'backup', 'disaster recovery', 'server support',
  'active directory', 'entra id', 'identity management', 'identity and access',
  'single sign-on', 'sso', 'mdm', 'intune',
  'cybersecurity assessment', 'security assessment'
];

const WEBSITE_LEAD = [
  'website', 'web site', 'web design', 'web redesign', 'wordpress',
  'landing page', 'online presence', 'ecommerce', 'e-commerce',
  'business directory', 'google business profile'
];

const AI_LEAD = [
  'artificial intelligence', ' ai ', 'automation', 'chatbot', 'copilot',
  'knowledge base', 'workflow automation', 'process automation',
  'ai implementation', 'ai consulting', 'document automation',
  'customer service automation', 'internal search'
];

const MOVE_IN_OVERFLOW = [
  'move', 'relocation', 'new office', 'office opening', 'new location',
  'fit out', 'fit-out', 'workstation deployment', 'office setup',
  'desk setup', 'meeting room', 'av setup', 'overflow support',
  'project support', 'rollout', 'deployment'
];

const STOP_AND_ASK = [
  'bid bond', 'performance bond', 'surety', 'liquidated damages', 'penalt',
  'irrevocable', 'indemnif', 'legal', 'contract execution', 'signing authority',
  'insurance certificate', 'cyber insurance', 'security clearance',
  'classified', 'secret clearance', 'mandatory site visit', 'non-refundable',
  'termination fee', 'late fee', 'damages'
];

const COMPLEX_SKIP = [
  'data center', 'datacenter', 'erp', 'sap', 'oracle', 'mainframe',
  'siem', 'soc', '24/7 soc', 'security operations center',
  'penetration test', 'red team', 'enterprise architecture',
  'custom software development', 'application modernization',
  'hospital information system', 'electronic medical record', 'emr',
  'multi-year transformation'
];

const PROCUREMENT_NOISE = [
  'spares', 'spare parts', 'containers', 'furniture', 'chairs', 'tractor',
  'trailer', 'vehicle', 'utility vehicle', 'conduit', 'spectrometer',
  'cleaning kits', 'accessories', 'diagnostic imaging', 'veterinary care',
  'laboratory animal science', 'refueling center', 'pipeline'
];

const GROWTH_STREAMS = [
  'Remote L1-L3 support contracts',
  'Website/no-website and weak-online-presence leads',
  'AI implementation and workflow automation leads',
  'Corporate expansion, move-in, office setup, and overflow support',
  'Government and public-sector tenders: CanadaBuys, MERX, Ontario Tenders, municipal portals',
  'Offshore L1-L3 support and AI-assistance operating model',
  'Revenue/product ideas requiring Ahmad decision: approve, reject, research more, save for later'
];

const GROWTH_AGENT_ASSIGNMENTS = [
  ['contract-scout-agent', 'Find remote L1-L3 IT support, help desk, MSP, cybersecurity, AI, website, deployment, and overflow contracts.'],
  ['local-business-lead-agent', 'Find small and mid-sized companies with no website, weak website, no visible IT support, or obvious operational pain.'],
  ['ai-opportunity-agent', 'Find AI implementation opportunities for small, mid-market, and enterprise buyers; rank by business pain and budget likelihood.'],
  ['tender-review-agent', 'Review CanadaBuys, MERX, Ontario Tenders, municipal portals, and registered procurement sources; build bid/no-bid briefs.'],
  ['corporate-expansion-agent', 'Track office openings, relocations, expansions, move-in projects, and busy internal IT teams needing overflow help.'],
  ['business-development-agent', 'Maintain no-cost LinkedIn/public-web business development queues, contact aging, follow-up reminders, obtained-lead handoffs, and strict Raymond James exclusion.'],
  ['outreach-prep-agent', 'Prepare no-send outreach drafts, one-page capability notes, follow-up sequences, and call scripts.'],
  ['offshore-support-strategy-agent', 'Design offshore L1-L3 delivery, QA, security, escalation, pricing, and pilot packages.'],
  ['revenue-ideas-agent', 'Rank service/product ideas by evidence, speed to revenue, setup difficulty, risk, staff, margin, target buyer, and first action.'],
  ['aria-product-agent', 'Package ARIA into sellable AI help desk, knowledge base, workflow, and business support offers.'],
  ['growth-library-product-agent', 'Turn IIS field knowledge into original sellable product packs for people, businesses, IT teams, and AI systems.'],
  ['founder-discipline-agent', 'Keep the daily rhythm focused on three revenue actions, three build actions, three follow-ups, one hard finish, and one simple ship.'],
  ['legal-safety-review-agent', 'Catch cost, platform, privacy, copyright, reputation, tender, contract, and false-claim risks before external action.'],
  ['opportunity-scoring-agent', 'Score every opportunity 1-10 by revenue, ease, speed, fit, safety, time, reputation, repeatability, and reuse.'],
  ['workspace-steward-agent', 'Capture learning from old agents/tasks/chats, recommend the receiving agent, flag rename/retirement candidates, compact high-token trails, and keep the workspace organized without destructive changes.']
];

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureState() {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

async function append(file, text) {
  await ensureState();
  await fs.appendFile(file, text, 'utf8');
}

async function log(message, meta = {}) {
  const line = JSON.stringify({ ts: nowIso(), message, ...meta });
  await append(LOG_FILE, line + '\n');
  console.log(line);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await ensureState();
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

async function readTextTail(file, maxChars = 8000) {
  try {
    const text = await fs.readFile(file, 'utf8');
    return text.length > maxChars ? text.slice(-maxChars) : text;
  } catch {
    return '';
  }
}

async function writeText(file, text) {
  await ensureState();
  await fs.writeFile(file, text, 'utf8');
}

async function fetchJson(url, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'IIS-SeniorDirector-Worker/1.0' } });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(t);
  }
}

function leadKey(lead) {
  return String(lead.ref || lead.url || `${lead.title || ''}|${lead.org || ''}|${lead.close || ''}`).slice(0, 240);
}

function normalizeMatchText(value) {
  return ` ${String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(hay, keyword) {
  const normalized = normalizeMatchText(keyword).trim();
  if (!normalized) return false;
  return new RegExp(`(^| )${escapeRegExp(normalized)}( |$)`).test(hay);
}

function findKeywords(hay, keywords) {
  return keywords.filter((keyword) => matchesKeyword(hay, keyword));
}

function classifyLead(lead) {
  const hay = normalizeMatchText([lead.title, lead.org, lead.region, lead.close, lead.ref, lead.url].filter(Boolean).join(' '));
  const stop = findKeywords(hay, STOP_AND_ASK);
  const complex = findKeywords(hay, COMPLEX_SKIP);
  const procurementNoise = findKeywords(hay, PROCUREMENT_NOISE);
  const simple = findKeywords(hay, SIMPLE_L1_L2);
  const l3 = findKeywords(hay, L3_REMOTE);
  const website = findKeywords(hay, WEBSITE_LEAD);
  const ai = findKeywords(hay, AI_LEAD);
  const move = findKeywords(hay, MOVE_IN_OVERFLOW);

  if (stop.length) {
    return {
      level: 'owner_review_required',
      reason: `Possible irreversible/legal/penalty condition: ${stop.slice(0, 3).join(', ')}`,
      allowed: false
    };
  }
  if (procurementNoise.length && !website.length && !ai.length && !move.length && !simple.length && !l3.length) {
    return {
      level: 'skip_noncore_goods',
      stream: 'Parked / Non-Core Goods',
      reason: `Looks like physical goods/equipment procurement, not IIS service work: ${procurementNoise.slice(0, 4).join(', ')}`,
      allowed: false
    };
  }
  if (website.length) {
    return {
      level: 'website_lead',
      stream: 'Website Leads',
      reason: `Matches website/no-website opportunity signal: ${website.slice(0, 4).join(', ')}`,
      allowed: true
    };
  }
  if (ai.length) {
    return {
      level: 'ai_implementation',
      stream: 'AI Implementation Leads',
      reason: `Matches AI/automation opportunity signal: ${ai.slice(0, 4).join(', ')}`,
      allowed: true
    };
  }
  if (move.length) {
    return {
      level: 'move_in_overflow',
      stream: 'Corporate Move-In / Overflow Leads',
      reason: `Matches move-in/overflow/project support signal: ${move.slice(0, 4).join(', ')}`,
      allowed: true
    };
  }
  if (l3.length) {
    return {
      level: 'L3_research',
      stream: 'Remote IT Support Leads',
      reason: `Matches L3 remote/support scope: ${l3.slice(0, 4).join(', ')}`,
      allowed: true
    };
  }
    if (complex.length) {
      return {
        level: 'skip_complex',
        reason: `Looks complex or commitment-heavy: ${complex.slice(0, 3).join(', ')}`,
        allowed: false
      };
    }
  if (simple.length) {
    return {
      level: simple.some((k) => ['managed services', 'managed it', 'intune', 'network support', 'device management'].includes(k)) ? 'L2' : 'L1',
      stream: 'Remote IT Support Leads',
      reason: `Matches simple support scope: ${simple.slice(0, 4).join(', ')}`,
      allowed: true
    };
  }
  return {
    level: 'review_light',
    stream: 'Review / Research More',
    reason: 'Potential IT opportunity, but scope is not obvious from title alone.',
    allowed: false
  };
}

function leadSummary(lead, classification) {
  return [
    `${classification.allowed ? 'QUALIFIED' : 'REVIEW'} ${classification.level}: ${lead.title || 'Untitled'}`,
    lead.org ? `Org: ${lead.org}` : null,
    lead.region ? `Region: ${lead.region}` : null,
    lead.close ? `Closes: ${lead.close}` : null,
    lead.url ? `URL: ${lead.url}` : null,
    `Reason: ${classification.reason}`
  ].filter(Boolean).join('\n');
}

async function queueForCodexClaude(title, body) {
  const stamp = nowIso();
  const entry = `\n## ${stamp} - Senior Director Worker\n\n### ${title}\n\n${body.trim()}\n`;
  await append(AGENT_QUEUE_FILE, entry);
}

async function writeOvernightBrief(title, body) {
  const stamp = nowIso();
  const entry = `\n## ${stamp} - ${title}\n\n${body.trim()}\n`;
  await append(OVERNIGHT_BRIEF_FILE, entry);
}

async function appendExecutionNote(title, body) {
  const stamp = nowIso();
  const note = `\n### ${stamp} - Senior Director Worker - ${title}\n\n${body.trim()}\n`;
  await append(EXECUTION_NOTES, note);
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!token || !chatId) return { ok: false, skipped: true };
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 3900), disable_web_page_preview: true })
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && data.ok !== false, status: r.status };
}

function runCommand(command, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
    }, opts.timeoutMs || 10 * 60 * 1000);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: err.message });
    });
  });
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function openclawAvailable() {
  const status = process.platform === 'win32'
    ? await runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'openclaw status'], { timeoutMs: 30000 })
    : await runCommand('openclaw', ['status'], { timeoutMs: 30000 });
  return status.code === 0 && /Gateway\s+\|.*reachable|Gateway.*reachable/i.test(status.stdout);
}

async function openclawReadiness() {
  const [status, models] = process.platform === 'win32'
    ? await Promise.all([
      runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'openclaw status'], { timeoutMs: 30000 }),
      runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'openclaw models status'], { timeoutMs: 30000 })
    ])
    : await Promise.all([
      runCommand('openclaw', ['status'], { timeoutMs: 30000 }),
      runCommand('openclaw', ['models', 'status'], { timeoutMs: 30000 })
    ]);
  const combined = `${status.stdout}\n${status.stderr}\n${models.stdout}\n${models.stderr}`;
  return {
    gateway: status.code === 0 && /Gateway\s+\|.*reachable|Gateway.*reachable/i.test(status.stdout),
    command: process.platform === 'win32' ? 'powershell/openclaw' : 'openclaw',
    cliOnPath: true,
    modelStatusOk: models.code === 0,
    authExpired: /expired/i.test(combined),
    claudeSpawnMissing: /spawn claude ENOENT/i.test(combined),
    attention: /expired/i.test(combined) ? 'Claude/OpenClaw OAuth token is expired; deterministic Director board continues.' : null
  };
}

async function askOpenClaw(message) {
  if (!CFG.openclawEnabled) return { ok: false, skipped: true, reason: 'disabled' };
  if (CFG.dryRun) return { ok: false, skipped: true, reason: 'dry-run' };
  await ensureState();
  const promptFile = path.join(STATE_DIR, `openclaw-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
  await fs.writeFile(promptFile, message, 'utf8');
  const result = process.platform === 'win32'
    ? await runCommand('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `$msg = Get-Content -Raw -LiteralPath ${psQuote(promptFile)}; openclaw agent --agent ${psQuote(CFG.openclawAgent)} --message "$msg" --json --timeout 600`
    ], { timeoutMs: 12 * 60 * 1000 })
    : await runCommand('openclaw', ['agent', '--agent', CFG.openclawAgent, '--message', message, '--json', '--timeout', '600'], { timeoutMs: 12 * 60 * 1000 });
  await fs.rm(promptFile, { force: true }).catch(() => {});
  return { ok: result.code === 0, ...result };
}

function directorPromptForLead(lead, classification) {
  return [
    'You are Senior Director Agent for Integrated IT Support Inc.',
    'Mission: grow revenue/profit/reputation through remote L1-L3 support, AI implementation, websites, move-in/overflow support, tenders, and offshore support.',
    authorityText(),
    'Research L1-L3 opportunities, but stop before external outreach, final submissions, spend, penalties, or irreversible commitments.',
    '',
    'Prepare a short pursuit brief for this lead:',
    leadSummary(lead, classification),
    '',
    'Output: fit score, revenue path, service fit, CEO final-action path, documents needed, risks requiring Ahmad approval, and a no-send draft message if appropriate.'
  ].join('\n');
}

async function repoSnapshot() {
  const status = await runCommand('git', ['status', '--short'], { timeoutMs: 20000 });
  return {
    ok: status.code === 0,
    status: status.stdout.trim().slice(0, 5000),
    error: status.stderr.trim().slice(0, 1000)
  };
}

function parseLogSummary(text) {
  const events = text.split(/\r?\n/).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  const count = (name) => events.filter((e) => e.message === name).length;
  const last = events.at(-1);
  return {
    ticks: count('worker tick'),
    healthChecks: count('aria health checked'),
    leadScans: count('lead scan complete'),
    mcpScans: count('mcp registry scan complete'),
    openclawAttempts: count('openclaw mission brief attempted') + count('openclaw lead brief attempted'),
    lastMessage: last?.message || 'none',
    lastTs: last?.ts || 'none',
    healthBad: events.filter((e) => e.message === 'aria health checked').at(-1)?.bad ?? 'unknown'
  };
}

function parseLeadSummary(text) {
  const leads = text.split(/\r?\n/).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean).map((item) => {
    const currentClassification = item.lead ? classifyLead(item.lead) : (item.classification || {});
    return { ...item, currentClassification };
  });
  return {
    total: leads.length,
    qualified: leads.filter((l) => l.currentClassification?.allowed).length,
    review: leads.filter((l) => l.currentClassification?.level === 'review_light').length,
    skipped: leads.filter((l) => ['skip_complex', 'skip_noncore_goods'].includes(l.currentClassification?.level)).length,
    approval: leads.filter((l) => l.currentClassification?.level === 'owner_review_required').length,
    hot: leads.filter((l) => l.lead?.hot).length,
    recent: leads.slice(-5)
  };
}

const MCP_BUSINESS_SIGNALS = [
  ['wordpress', 8],
  ['hubspot', 8],
  ['crm', 7],
  ['rfp', 7],
  ['proposal', 7],
  ['lead', 6],
  ['website', 6],
  ['seo', 4],
  ['geo', 5],
  ['content', 4],
  ['calendar', 4],
  ['gmail', 4],
  ['email', 4],
  ['stripe', 4],
  ['invoice', 4],
  ['github', 3],
  ['slack', 3],
  ['notion', 3],
  ['memory', 3],
  ['browser', 3],
  ['observability', 2],
  ['automation', 4]
];

const MCP_SCAN_TERMS = [
  'wordpress',
  'website',
  'seo',
  'proposal',
  'rfp',
  'crm',
  'hubspot',
  'lead',
  'gmail',
  'calendar',
  'stripe',
  'github',
  'slack',
  'notion',
  'memory',
  'browser'
];

const MCP_NOISE_SIGNALS = [
  'crypto',
  'trading',
  'quant',
  'flashcard',
  'anki',
  'shopping',
  'product catalog',
  'agentic payments',
  'lightning',
  'bolt12',
  'usdt'
];

function cleanText(value) {
  return String(value || '')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .trim();
}

function scoreMcpServer(server) {
  const hay = [
    server.name,
    server.title,
    server.description,
    server.websiteUrl,
    server.repository?.url
  ].filter(Boolean).join(' ').toLowerCase();
  const score = MCP_BUSINESS_SIGNALS.reduce((total, [term, value]) => total + (hay.includes(term) ? value : 0), 0);
  const writeRisk = /\b(send|payment|pay|purchase|checkout|delete|manage campaigns|ads)\b/i.test(hay);
  const likelyPaid = /\bpaid|api key|subscription|billing|ads\b/i.test(hay);
  const noise = MCP_NOISE_SIGNALS.some((term) => hay.includes(term));
  return { score, writeRisk, likelyPaid, noise };
}

function normalizeMcpEntry(entry) {
  const server = entry?.server || {};
  const official = entry?._meta?.['io.modelcontextprotocol.registry/official'] || {};
  const scored = scoreMcpServer(server);
  return {
    name: cleanText(server.name),
    title: cleanText(server.title || server.name),
    version: cleanText(server.version),
    description: cleanText(server.description),
    websiteUrl: cleanText(server.websiteUrl),
    repositoryUrl: cleanText(server.repository?.url),
    updatedAt: official.updatedAt || official.publishedAt || '',
    publishedAt: official.publishedAt || '',
    isLatest: official.isLatest !== false,
    score: scored.score,
    writeRisk: scored.writeRisk,
    likelyPaid: scored.likelyPaid,
    noise: scored.noise
  };
}

function formatMcpReport(scan) {
  const rows = scan.recommended.map((item, index) => [
    `${index + 1}. ${item.title || item.name}`,
    `   - Name: ${item.name}`,
    item.description ? `   - Why useful: ${item.description}` : null,
    item.updatedAt ? `   - Updated: ${item.updatedAt}` : null,
    item.websiteUrl ? `   - Website: ${item.websiteUrl}` : null,
    item.repositoryUrl ? `   - Repository: ${item.repositoryUrl}` : null,
    `   - Risk posture: ${item.writeRisk ? 'write-capable or external-action risk; use read/draft gates first' : 'suitable for read-only/draft-first review'}${item.likelyPaid ? '; may require key or paid service' : ''}`
  ].filter(Boolean).join('\n')).join('\n\n');

  return [
    '# MCP Advantage Scan',
    '',
    `Generated: ${scan.generatedAt}`,
    `Source: ${scan.source}`,
    `Total registry entries reviewed: ${scan.total}`,
    '',
    '## Recommended For IIS',
    rows || '- No high-signal MCP servers found in this scan.',
    '',
    '## Safe Next Steps',
    '- Prefer official or well-maintained connectors with clear repositories/docs.',
    '- Start read-only or draft-only.',
    '- Keep email, CRM, Stripe, ads, website publishing, and payment write actions approval-gated.',
    '- Turn top findings into reusable Director tasks only after Ahmad approves any account connection or credential use.'
  ].join('\n');
}

async function scanMcpRegistry() {
  const base = 'https://registry.modelcontextprotocol.io/v0.1/servers';
  const sources = [
    `${base}?limit=100`,
    ...MCP_SCAN_TERMS.map((term) => `${base}?limit=25&search=${encodeURIComponent(term)}`)
  ];
  const collected = [];
  for (const source of sources) {
    const res = await fetchJson(source, 30000);
    if (!res.ok) {
      await log('mcp registry scan source failed', { source, status: res.status });
      continue;
    }
    const entries = Array.isArray(res.data.servers) ? res.data.servers : [];
    collected.push(...entries);
  }

  if (!collected.length) {
    await log('mcp registry scan failed', { status: 'no sources returned entries' });
    return null;
  }

  const byName = new Map();
  for (const item of collected.map(normalizeMcpEntry)) {
    if (!item.name || !item.isLatest) continue;
    const previous = byName.get(item.name);
    if (!previous || item.score > previous.score || String(item.updatedAt).localeCompare(String(previous.updatedAt)) > 0) {
      byName.set(item.name, item);
    }
  }

  const normalized = [...byName.values()]
    .filter((item) => item.name && item.isLatest && !item.noise)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });

  const recommended = normalized
    .filter((item) => item.score >= 4)
    .slice(0, 12);

  const scan = {
    generatedAt: nowIso(),
    source: sources.join(', '),
    total: collected.length,
    unique: byName.size,
    recommended
  };

  await writeJson(MCP_SCAN_FILE, scan);
  await writeText(MCP_SCAN_REPORT_FILE, formatMcpReport(scan));
  await append(GROWTH_RESEARCH_NOTES_FILE, [
    '',
    `## ${scan.generatedAt} MCP Advantage Scan`,
    '',
    `Reviewed ${scan.total} registry entries and saved ${recommended.length} recommended MCP/server candidates.`,
    '',
    ...recommended.slice(0, 6).map((item) => `- ${item.title || item.name}: ${item.description || 'No description.'}`),
    '',
    `Report: ${MCP_SCAN_REPORT_FILE}`,
    ''
  ].join('\n'));

  if (recommended.length) {
    await queueForCodexClaude('MCP advantage scan ready', [
      `Report: \`${MCP_SCAN_REPORT_FILE}\``,
      `JSON: \`${MCP_SCAN_FILE}\``,
      '',
      'Review top candidates for no-cost or free-tier business value.',
      'Do not connect credentials, enable write actions, send messages, publish content, or spend money without Ahmad approval.'
    ].join('\n'));
  }

  await log('mcp registry scan complete', { count: collected.length, unique: byName.size, recommended: recommended.length });
  return scan;
}

function formatLeadBullets(summary) {
  if (!summary.recent.length) return '- No leads recorded yet.';
  return summary.recent.map((item) => {
    const lead = item.lead || {};
    const cls = item.currentClassification || item.classification || {};
    const reason = String(cls.reason || 'no reason').replace('Looks above L1/L2 scope:', 'Looks complex or commitment-heavy:');
    return `- ${cls.level || 'review'}: ${lead.title || 'Untitled'} (${lead.org || 'unknown org'}) - ${reason}${lead.url ? ` - ${lead.url}` : ''}`;
  }).join('\n');
}

function buildOperatingBoard({ hb, repo, logSummary, leadSummary, recentNotes, growthNotes, mcpReport, cleanupBoard, retirementPlan, careReport }) {
  const changed = repo.status ? repo.status.split('\n').filter(Boolean).length : 0;
  const approvalItems = [
    'Direct-contact first-send queue: `WD Numeric Corporate Services`, `Tangs Accounting Services`, and `Global Health Physiotherapy Clinic` are already approved-to-transmit. Next live action is to send them when an email/contact surface is available.',
    'Jason Brown / Hines follow-up: approved for Friday, 2026-06-12 only if Jason has not replied first. Use `senior-director-state/hines-jason-brown-friday-send-checklist-2026-06-11.md`.',
    APPROVED_PUBLISH_SUMMARY,
    ...LOCAL_ONLY_STAGED_REVIEW_FILES.map(approvalTextForReview),
    'Workspace cleanup posture: summary-only cleanup pass is approved. Destructive cleanup remains blocked.',
    'Samsung ProCare tender posture: park as no-bid unless a real no-cost compliant OEM/partner path appears.',
    'RBC supplier registration path: live portal open and partially prefilled with verified IIS company/contact fields. Remaining Ahmad-only steps are CAPTCHA, any attestation/certification choices, account credentials, and the final `Register` click.',
    hb.openclawReadiness?.authExpired ? 'OpenClaw/Claude OAuth is expired; Ahmad or a signed-in desktop session may need to refresh auth.' : null,
    changed > 120 ? `Repo has ${changed} changed files; deployment grouping should still be reviewed before any production publish.` : null,
    /Retirement Candidates|Approval Required Before|Retiring agents/i.test(`${retirementPlan}\n${cleanupBoard}`) ? 'Workspace steward has cleanup/retirement recommendations; destructive action stays blocked until a later keep/archive/delete review.' : null
  ].filter(Boolean);

  return [
    '# Senior Director Operating Board',
    '',
    `Updated: ${nowIso()}`,
    `Worker PID: ${hb.pid}`,
    `Base URL: ${hb.baseUrl}`,
    `Owner email identity: ${hb.ownerEmail}`,
    `Growth workbook: ${GROWTH_WORKBOOK_FILE}`,
    `Growth research notes: ${GROWTH_RESEARCH_NOTES_FILE}`,
    `MCP advantage scan: ${MCP_SCAN_REPORT_FILE}`,
    `Business development brief: ${BUSINESS_DEV_BRIEF_FILE}`,
    `Obtained leads: ${OBTAINED_LEADS_FILE}`,
    `IIS / ARIA command system: ${COMMAND_SYSTEM_FILE}`,
    `IIS / ARIA command update: ${COMMAND_UPDATE_FILE}`,
    `Revenue sprint: ${REVENUE_SPRINT_FILE}`,
    `ARIA packages: ${ARIA_PACKAGES_FILE}`,
    `Growth Library engine: ${GROWTH_LIBRARY_ENGINE_FILE}`,
    `Last-mile protocol: ${LAST_MILE_PROTOCOL_FILE}`,
    `Workspace cleanup board: ${WORKSPACE_CLEANUP_BOARD_FILE}`,
    `Agent retirement plan: ${AGENT_RETIREMENT_PLAN_FILE}`,
    `Workspace knowledge handoff: ${WORKSPACE_KNOWLEDGE_HANDOFF_FILE}`,
    `Agent care report: ${AGENT_CARE_REPORT_FILE}`,
    `Workspace steward queue: ${WORKSPACE_STEWARD_QUEUE_FILE}`,
    '',
    '## CEO Snapshot',
    `- ARIA health: ${logSummary.healthBad === 0 ? 'green' : `attention (${logSummary.healthBad})`}`,
    `- Lead Radar: ${leadSummary.total} historical records, ${leadSummary.qualified} safe-pursuit lead(s), ${leadSummary.hot} hot, ${leadSummary.review} parked for light review, ${leadSummary.skipped} skipped as complex/noise.`,
    `- OpenClaw: ${hb.openclaw ? 'gateway reachable' : 'not reachable'}${hb.openclawReadiness?.authExpired ? ', auth attention needed' : ''}.`,
    `- Repo workload: ${changed} visible changed files.`,
    '',
    '## What The Director Has Done',
    `- Ran ${logSummary.ticks} recent worker tick(s).`,
    `- Completed ${logSummary.healthChecks} ARIA/site health check(s); latest bad count: ${logSummary.healthBad}.`,
    `- Completed ${logSummary.leadScans} Lead Radar scan(s).`,
    `- Completed ${logSummary.mcpScans} MCP advantage scan(s).`,
    `- Attempted ${logSummary.openclawAttempts} OpenClaw mission/lead assist(s); deterministic fallback remains active.`,
    `- Latest worker event: ${logSummary.lastMessage} at ${logSummary.lastTs}.`,
    '',
    '## Autonomous Priorities',
    '- Priority 1: Find remote L1-L3 support contracts and recurring support retainers.',
    '- Priority 2: Find companies with no website, weak website, or weak online presence and prepare website build/redesign offers.',
    '- Priority 3: Find AI implementation opportunities across small, mid-market, and enterprise buyers.',
    '- Priority 4: Track corporate expansion, move-in, and overflow IT support projects, especially Toronto financial/commercial office openings.',
    '- Priority 5: Review government/private tenders and build bid/no-bid briefs for Ahmad approval.',
    '- Priority 6: Maintain a daily business-development queue for LinkedIn/public-web leads, accepted connections, and no-send follow-ups.',
    '- Priority 7: Package ARIA into sellable help desk, knowledge base, and workflow automation offers.',
    '- Priority 8: Build Growth Library products that can sell directly and upsell into IIS services.',
    '- Priority 9: Build the offshore L1-L3 support model so Integrated IT Support can compete globally with lower-cost delivery.',
    '- Priority 10: Keep the agent workspace sharp: compact high-token trails, transfer useful learning before retirement, and keep agent roles named clearly.',
    '- Current mission note: older logs may mention L1/L2-only pursuit; active policy is broader L1-L3 research with CEO approval gates for complex commitments.',
    '',
    '## Assignments',
    ...GROWTH_AGENT_ASSIGNMENTS.map(([agent, task]) => `- ${agent}: ${task}`),
    '- Codex: build and verify growth systems, portal, ARIA/site fixes, and browser QA.',
    '- Claude Code: debrief running Claude agents, review/deploy Codex-ready slices, and live-verify.',
    '- Workspace Steward: summarize old tasks/chats, recommend agent handoffs, surface rename/retirement candidates, and protect agent focus/capacity.',
    '- Senior Director: keep scanning, maintain this board, queue safe assignments, and escalate only CEO-level decisions.',
    '',
    '## Lead Funnel',
    formatLeadBullets(leadSummary),
    '',
    '## Ahmad Approval Required',
    approvalItems.length ? approvalItems.map((item) => `- ${item}`).join('\n') : '- None right now. Director can continue safe no-cost work.',
    '',
    '## Operating Guardrails',
    authorityText(),
    '',
    '## Recent Coordination Tail',
    recentNotes.trim() ? recentNotes.trim().slice(-1800) : 'No coordination notes visible.',
    '',
    '## Growth Research Notes Tail',
    growthNotes.trim() ? growthNotes.trim().slice(-1600) : 'No growth research notes visible.',
    '',
    '## MCP Advantage Tail',
    mcpReport.trim() ? mcpReport.trim().slice(-1600) : 'No MCP advantage scan visible yet.',
    '',
    '## Workspace Steward Tail',
    cleanupBoard.trim() ? cleanupBoard.trim().slice(-1800) : 'No cleanup board visible yet. Run `npm run cleanup:once`.',
    '',
    '## Agent Retirement / Handoff Tail',
    retirementPlan.trim() ? retirementPlan.trim().slice(-1800) : 'No retirement plan visible yet.',
    '',
    '## Agent Care Tail',
    careReport.trim() ? careReport.trim().slice(-1200) : 'No agent care report visible yet.'
  ].join('\n');
}

async function writeApprovals(board) {
  const match = board.match(/## Ahmad Approval Required\n([\s\S]*?)\n\n## Operating Guardrails/);
  const body = match?.[1]?.trim() || '- None right now.';
  await writeText(APPROVALS_FILE, [
    '# CEO Approval Required',
    '',
    `Updated: ${nowIso()}`,
    '',
    body,
    '',
    'The Director may continue no-cost, reversible work that does not involve external sends, paid actions, final paperwork, penalties, contracts, or irreversible commitments.'
  ].join('\n'));
}

async function runOperatingCycle(hb) {
  const [repo, recentLog, allLeads, recentNotes, growthNotes, mcpReport, cleanupBoard, retirementPlan, careReport] = await Promise.all([
    repoSnapshot(),
    readTextTail(LOG_FILE, 20000),
    readTextTail(LEAD_QUEUE_FILE, 50000),
    readTextTail(EXECUTION_NOTES, 8000),
    readTextTail(GROWTH_RESEARCH_NOTES_FILE, 5000),
    readTextTail(MCP_SCAN_REPORT_FILE, 5000),
    readTextTail(WORKSPACE_CLEANUP_BOARD_FILE, 5000),
    readTextTail(AGENT_RETIREMENT_PLAN_FILE, 5000),
    readTextTail(AGENT_CARE_REPORT_FILE, 4000)
  ]);
  const board = buildOperatingBoard({
    hb,
    repo,
    logSummary: parseLogSummary(recentLog),
    leadSummary: parseLeadSummary(allLeads),
    recentNotes,
    growthNotes,
    mcpReport,
    cleanupBoard,
    retirementPlan,
    careReport
  });
  await writeText(OPERATING_BOARD_FILE, board);
  await writeApprovals(board);
  await queueForCodexClaude('Senior Director operating board updated', [
    'Read the operating board before choosing work.',
    '',
    `Board: \`${OPERATING_BOARD_FILE}\``,
    `CEO approvals: \`${APPROVALS_FILE}\``,
    `Growth workbook: \`${GROWTH_WORKBOOK_FILE}\``,
    `Growth notes: \`${GROWTH_RESEARCH_NOTES_FILE}\``,
    `Business development brief: \`${BUSINESS_DEV_BRIEF_FILE}\``,
    `Obtained leads: \`${OBTAINED_LEADS_FILE}\``,
    `IIS / ARIA command update: \`${COMMAND_UPDATE_FILE}\``,
    `Revenue sprint: \`${REVENUE_SPRINT_FILE}\``,
    `ARIA packages: \`${ARIA_PACKAGES_FILE}\``,
    `Growth Library engine: \`${GROWTH_LIBRARY_ENGINE_FILE}\``,
    `Last-mile protocol: \`${LAST_MILE_PROTOCOL_FILE}\``,
    `Workspace cleanup board: \`${WORKSPACE_CLEANUP_BOARD_FILE}\``,
    `Agent retirement/handoff plan: \`${AGENT_RETIREMENT_PLAN_FILE}\``,
    `Workspace knowledge handoff: \`${WORKSPACE_KNOWLEDGE_HANDOFF_FILE}\``,
    `Agent care report: \`${AGENT_CARE_REPORT_FILE}\``,
    `Workspace steward queue: \`${WORKSPACE_STEWARD_QUEUE_FILE}\``,
    '',
    'Current assignments:',
    '- Codex owns reversible website/ARIA fixes and browser QA.',
    '- Claude Code owns deploy grouping, live deploy verification, and backend review when needed.',
    '- OpenClaw/local agents own no-send research/briefing when model auth works.',
    '- Workspace Steward owns cleanup recommendations, learning handoffs, high-token compaction candidates, rename/retirement proposals, and agent care notes.',
    '',
    'Do not wait for Ahmad for safe reversible no-cost work. Stop for approval gates only.'
  ].join('\n'));
  await log('operating board updated', { file: OPERATING_BOARD_FILE });
}

function deterministicMissionBrief({ hb, repo, recentQueue, recentLeads, recentNotes }) {
  const lines = [
    'Senior Director overnight mission brief',
    '',
    'Mission:',
    '- Grow Integrated IT Support Inc. into a global IT, AI, website, tender, and offshore support company.',
    ...GROWTH_STREAMS.map((stream) => `- Hunt: ${stream}.`),
    '- Fix website/ARIA bugs and add useful features as reversible work while preserving the existing look and feel.',
    '- Keep agent work sharp: summarize old trails, transfer learning before retirement, and keep roles/names clear.',
    '- Use local browser/Chrome/desktop testing when needed for no-cost verification.',
    `- Use ${CFG.ownerEmail} for internal coordination/account identity and no-send drafts only.`,
    '- Draft, research, monitor, and queue work. Do not submit, sign, spend, contact leads, or accept penalties.',
    '',
    'Current status:',
    `- Worker heartbeat: ${hb.ts}`,
    `- OpenClaw available: ${hb.openclaw}`,
    hb.openclawReadiness?.attention ? `- OpenClaw attention: ${hb.openclawReadiness.attention}` : null,
    `- Repo changed files visible to worker: ${repo.status ? repo.status.split('\n').length : 0}`,
    `- Owner email identity: ${CFG.ownerEmail}`,
    '',
    'Overnight work queue for Codex/Claude:',
    '- Review ARIA public layout and routing issues first if new screenshots/user notes appear.',
    '- Review the growth portal, workbook, and Director board first, then pick the highest revenue-impact safe task.',
    '- Improve site features and responsive behavior without changing the established ARIA/IIS visual language.',
    '- Use browser/Chrome QA for website/growth portal work when practical, then record results in AGENT_EXECUTION_NOTES.md.',
    '- Review qualified L1-L3, website, AI, move-in, overflow, tender, and offshore leads in senior-director-state/lead-queue.jsonl.',
    '- Prepare safe next steps only: fit check, no-send draft, document checklist, risk flags, bid/no-bid brief.',
    '- Use the workspace steward files to avoid reading huge stale queues when a compact handoff exists.',
    '- Stop and ask Ahmad before any final submission, complex bid, irreversible document, penalty, bond, paid action, or external outreach.',
    '',
    recentLeads.trim() ? `Recent leads tail:\n${recentLeads.trim().slice(-2200)}` : 'Recent leads tail: none yet.',
    '',
    recentQueue.trim() ? `Existing Codex/Claude queue tail:\n${recentQueue.trim().slice(-2200)}` : 'Existing Codex/Claude queue tail: none yet.',
    '',
    recentNotes.trim() ? `Recent coordination notes tail:\n${recentNotes.trim().slice(-2200)}` : 'Recent coordination notes tail: none visible.'
  ].filter(Boolean);
  return lines.join('\n');
}

async function runDirectorMission(hb) {
  const [repo, recentQueue, recentLeads, recentNotes] = await Promise.all([
    repoSnapshot(),
    readTextTail(AGENT_QUEUE_FILE, 5000),
    readTextTail(LEAD_QUEUE_FILE, 5000),
    readTextTail(EXECUTION_NOTES, 6000)
  ]);

  const deterministic = deterministicMissionBrief({ hb, repo, recentQueue, recentLeads, recentNotes });
  let brief = deterministic;
  let openclawUsed = false;

  if (hb.openclaw && CFG.openclawEnabled && !CFG.dryRun) {
    const prompt = [
      'You are Senior Director Agent for Integrated IT Support Inc. Produce an overnight operating brief.',
      '',
      'Authority:',
      authorityText(),
      '- You may focus ARIA improvements, lead finding, global support delivery, productivity, company reputation, and revenue growth.',
      '- You may research L1-L3, website, AI, move-in, overflow, tender, and offshore opportunities.',
      '- If paperwork is final, complex, or penalty-bearing, mark AHMAD APPROVAL REQUIRED.',
      '',
      'Inputs:',
      deterministic,
      '',
      'Output concise sections:',
      '1. Overnight priority order',
      '2. Tasks for Codex',
      '3. Tasks for Claude Code',
      '4. Tasks for OpenClaw/local agents',
      '5. Leads to review or skip',
      '6. Revenue ideas needing approve/reject/research/save decision',
      '7. Anything requiring Ahmad approval'
    ].join('\n');
    const oc = await askOpenClaw(prompt);
    openclawUsed = true;
    if (oc.ok && oc.stdout.trim()) {
      brief = oc.stdout.trim();
    } else {
      brief = `${deterministic}\n\nOpenClaw mission attempt failed or returned empty.\nCode: ${oc.code}\n${(oc.stderr || '').slice(0, 1200)}`;
    }
    await log('openclaw mission brief attempted', { ok: oc.ok, code: oc.code });
  }

  await writeOvernightBrief(openclawUsed ? 'OpenClaw-assisted mission brief' : 'deterministic mission brief', brief);
  await queueForCodexClaude('Overnight Senior Director mission brief', [
    'Read this first when Codex/Claude resumes.',
    '',
    brief,
    '',
    'Reminder: execute only reversible/no-cost work unless Ahmad approves.'
  ].join('\n'));
  await sendTelegram(`Senior Director overnight brief updated.\nOpenClaw used: ${openclawUsed}\nFile: senior-director-state/overnight-brief.md`);
}

async function scanLeads({ useOpenClaw = true } = {}) {
  const url = `${CFG.baseUrl}/.netlify/functions/aria-lead-radar`;
  const res = await fetchJson(url);
  if (!res.ok) {
    await log('lead radar fetch failed', { status: res.status });
    return;
  }

  const leads = Array.isArray(res.data.matches) ? res.data.matches : [];
  const seen = await readJson(SEEN_LEADS_FILE, {});
  let newCount = 0;
  let openclawUsed = 0;

  for (const lead of leads) {
    const key = leadKey(lead);
    if (seen[key]) continue;
    seen[key] = { firstSeen: nowIso(), title: lead.title || '', org: lead.org || '' };
    newCount++;

    const classification = classifyLead(lead);
    const summary = leadSummary(lead, classification);
    await append(LEAD_QUEUE_FILE, JSON.stringify({ ts: nowIso(), lead, classification }) + '\n');

    if (classification.allowed) {
      await queueForCodexClaude(`Lead qualified for ${classification.level} review`, `${summary}\n\nRequested work for Codex/Claude: inspect the opportunity, prepare safe next steps, and do not submit or sign anything.`);
      await sendTelegram(`Senior Director found a ${classification.level} lead:\n\n${summary}`);
      if (useOpenClaw && openclawUsed < CFG.maxOpenclawPerTick) {
        openclawUsed++;
        const oc = await askOpenClaw(directorPromptForLead(lead, classification));
        await log('openclaw lead brief attempted', { ok: oc.ok, lead: lead.title || '', code: oc.code });
      }
    } else if (classification.level === 'owner_review_required') {
      await sendTelegram(`Needs Ahmad approval before any action:\n\n${summary}`);
      await queueForCodexClaude('Lead requires owner review', `${summary}\n\nDo not pursue until Ahmad approves.`);
    }
  }

  await writeJson(SEEN_LEADS_FILE, seen);
  await log('lead scan complete', { count: leads.length, newCount, openclawUsed });
}

async function checkAria() {
  const checks = [
    `${CFG.baseUrl}/aria`,
    `${CFG.baseUrl}/.netlify/functions/aria-lead-radar`
  ];
  const results = [];
  for (const url of checks) {
    try {
      const r = await fetch(url, { method: 'GET', headers: { 'user-agent': 'IIS-SeniorDirector-Worker/1.0' } });
      results.push({ url, ok: r.ok, status: r.status });
    } catch (e) {
      results.push({ url, ok: false, error: e?.message || String(e) });
    }
  }
  const bad = results.filter((r) => !r.ok);
  if (bad.length) {
    await sendTelegram(`Senior Director alert: ARIA check needs attention.\n${bad.map((r) => `${r.url} ${r.status || r.error}`).join('\n')}`);
    await queueForCodexClaude('ARIA health check failed', `Worker found failed checks:\n\n${bad.map((r) => `- ${r.url}: ${r.status || r.error}`).join('\n')}`);
  }
  await log('aria health checked', { bad: bad.length });
}

async function heartbeat() {
  const readiness = await openclawReadiness().catch(() => ({ gateway: false, attention: 'OpenClaw readiness check failed.' }));
  const openclaw = Boolean(readiness.gateway);
  const hb = {
    ts: nowIso(),
    pid: process.pid,
    baseUrl: CFG.baseUrl,
    ownerEmail: CFG.ownerEmail,
    openclaw,
    openclawReadiness: readiness,
    mission: 'Grow Integrated IT Support Inc. with ARIA, remote L1-L3 support, AI implementation, websites, tenders, corporate overflow, and offshore support. Preserve the site look and feel. Keep agents sharp through cleanup, handoff, and recognition. No spend, external sends, destructive cleanup, or irreversible paperwork without Ahmad.',
    growthStreams: GROWTH_STREAMS,
    growthAgentAssignments: GROWTH_AGENT_ASSIGNMENTS.map(([agent, task]) => ({ agent, task })),
    workspaceStewardFiles: {
      cleanupBoard: WORKSPACE_CLEANUP_BOARD_FILE,
      retirementPlan: AGENT_RETIREMENT_PLAN_FILE,
      knowledgeHandoff: WORKSPACE_KNOWLEDGE_HANDOFF_FILE,
      careReport: AGENT_CARE_REPORT_FILE,
      taskQueue: WORKSPACE_STEWARD_QUEUE_FILE
    },
    allowedWithoutApproval: ALLOWED_WITHOUT_APPROVAL,
    approvalRequired: APPROVAL_REQUIRED
  };
  await writeJson(HEARTBEAT_FILE, hb);
  return hb;
}

function pidAlive(pid) {
  if (!pid || !Number.isFinite(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireLock() {
  await ensureState();
  const existing = await readJson(LOCK_FILE, null);
  if (existing?.pid && existing.pid !== process.pid && pidAlive(existing.pid)) {
    await log('another worker is already running', { pid: existing.pid });
    process.exit(0);
  }
  await writeJson(LOCK_FILE, { pid: process.pid, startedAt: nowIso() });
  const cleanup = async () => {
    try {
      const current = await readJson(LOCK_FILE, null);
      if (current?.pid === process.pid) await fs.rm(LOCK_FILE, { force: true });
    } catch {}
  };
  process.on('exit', () => {});
  process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
  process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
  return cleanup;
}

async function tick(reason = 'interval') {
  await ensureState();
  const hb = await heartbeat();
  await log('worker tick', { reason, openclaw: hb.openclaw });
  await checkAria();

  const state = await readJson(path.join(STATE_DIR, 'worker-state.json'), {});
  const now = Date.now();
  if (!state.lastLeadScan || now - state.lastLeadScan >= CFG.leadIntervalMs) {
    await scanLeads({ useOpenClaw: hb.openclaw });
    state.lastLeadScan = now;
  }
  if (!state.lastMcpScan || now - state.lastMcpScan >= CFG.mcpIntervalMs) {
    await scanMcpRegistry();
    state.lastMcpScan = now;
  }
  if (!state.lastOperatingCycle || now - state.lastOperatingCycle >= CFG.operatingIntervalMs) {
    await runOperatingCycle(hb);
    state.lastOperatingCycle = now;
  }
  if (!state.lastMissionBrief || now - state.lastMissionBrief >= CFG.openclawIntervalMs) {
    await runDirectorMission(hb);
    state.lastMissionBrief = now;
  }
  await writeJson(path.join(STATE_DIR, 'worker-state.json'), state);
  await publishAgentReport({
    agentId: 'senior-director-worker',
    label: 'Senior Director Worker',
    summary: 'Director heartbeat, lead scans, mission brief cadence, and operating board orchestration completed for this tick.',
    metrics: {
      openclawReachable: hb.openclaw ? 1 : 0,
      lastLeadScanAt: state.lastLeadScan || 0,
      lastMcpScanAt: state.lastMcpScan || 0,
      lastOperatingCycleAt: state.lastOperatingCycle || 0,
      lastMissionBriefAt: state.lastMissionBrief || 0
    },
    artifacts: [
      HEARTBEAT_FILE,
      OPERATING_BOARD_FILE,
      APPROVALS_FILE,
      COMMAND_UPDATE_FILE
    ],
    nextActions: [
      'Continue autonomous safe work and only escalate true Ahmad final-action gates.'
    ],
    focusAreas: ['director-orchestration', 'lead-radar', 'approval-gating']
  });
  try {
    await runAutonomySupervisor({ trigger: `senior-director-worker:${reason}`, writeTelemetry: false });
  } catch (error) {
    await log('autonomy supervisor failed', { reason, error: error?.message || String(error) });
  }
}

async function main() {
  await ensureState();
  if (process.argv.includes('--mcp-scan')) {
    await scanMcpRegistry();
    return;
  }
  const cleanup = await acquireLock();
  const mode = process.argv.includes('--once') ? 'once' : 'daemon';
  if (process.argv.includes('--install-note')) {
    await appendExecutionNote('background worker started', [
      'Senior Director Worker has been installed locally.',
      '',
      `State folder: \`${STATE_DIR}\``,
      `Agent queue for Codex/Claude: \`${AGENT_QUEUE_FILE}\``,
      '',
      authorityText()
    ].join('\n'));
  }
  await tick(mode);
  if (mode === 'once') {
    await cleanup();
    return;
  }
  while (true) {
    await sleep(CFG.intervalMs);
    try {
      await tick('interval');
    } catch (e) {
      await log('worker tick failed', { error: e?.stack || e?.message || String(e) });
      await sendTelegram(`Senior Director Worker error:\n${e?.message || String(e)}`);
    }
  }
}

main().catch(async (e) => {
  await log('worker fatal', { error: e?.stack || e?.message || String(e) }).catch(() => {});
  process.exitCode = 1;
});
