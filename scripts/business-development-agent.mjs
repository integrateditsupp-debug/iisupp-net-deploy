#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishAgentReport } from './autonomy-supervisor-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const CRM_FILE = path.join(STATE_DIR, 'business-development-crm.json');
const DAILY_BRIEF_FILE = path.join(STATE_DIR, 'business-development-daily-brief.md');
const OBTAINED_MD_FILE = path.join(STATE_DIR, 'Obtained Leads - contact now.md');
const OBTAINED_CSV_FILE = path.join(STATE_DIR, 'obtained-leads-contact-now.csv');
const AGENT_SPEC_FILE = path.join(STATE_DIR, 'business-development-agent.md');
const AGENT_QUEUE_FILE = path.join(STATE_DIR, 'codex-claude-queue.md');
const LEAD_QUEUE_FILE = path.join(STATE_DIR, 'lead-queue.jsonl');
const REVENUE_SPRINT_FILE = path.join(STATE_DIR, 'revenue-generation-sprint.md');
const REVENUE_DRAFTS_FILE = path.join(STATE_DIR, 'revenue-outreach-drafts.md');
const COMMAND_SYSTEM_FILE = path.join(STATE_DIR, 'iis-aria-command-system.md');
const COMMAND_UPDATE_FILE = path.join(STATE_DIR, 'iis-aria-command-update.md');
const ARIA_PACKAGES_FILE = path.join(STATE_DIR, 'aria-monetization-packages.md');
const GROWTH_LIBRARY_ENGINE_FILE = path.join(STATE_DIR, 'growth-library-product-engine.md');
const LAST_MILE_PROTOCOL_FILE = path.join(STATE_DIR, 'last-mile-execution-protocol.md');
const EXECUTION_NOTES = path.join(ROOT, 'AGENT_EXECUTION_NOTES.md');

const HARD_EXCLUSIONS = [
  'Raymond James'
];

const TARGET_SECTORS = [
  'banks and credit unions',
  'government and public sector',
  'healthcare and clinics',
  'education and private schools',
  'law firms',
  'financial firms and accounting firms',
  'commercial real estate and property operations',
  'small and mid-sized businesses with weak IT process',
  'enterprise teams with overflow support needs'
];

const SEARCH_PLAYS = [
  {
    name: 'LinkedIn - IT directors with M365 and AI',
    query: 'IT Director Microsoft 365 Copilot AI automation small business',
    url: 'https://www.linkedin.com/search/results/people/?keywords=IT%20Director%20Microsoft%20365%20Copilot%20AI%20automation%20small%20business&origin=GLOBAL_SEARCH_HEADER'
  },
  {
    name: 'LinkedIn - operations directors and owners',
    query: 'operations director business owner workflow automation Microsoft 365',
    url: 'https://www.linkedin.com/search/results/people/?keywords=operations%20director%20business%20owner%20workflow%20automation%20Microsoft%20365&origin=GLOBAL_SEARCH_HEADER'
  },
  {
    name: 'LinkedIn - healthcare IT leaders',
    query: 'healthcare IT director Microsoft 365 cybersecurity automation',
    url: 'https://www.linkedin.com/search/results/people/?keywords=healthcare%20IT%20director%20Microsoft%20365%20cybersecurity%20automation&origin=GLOBAL_SEARCH_HEADER'
  },
  {
    name: 'LinkedIn - law firm IT and operations',
    query: 'law firm IT director operations manager Microsoft 365 cybersecurity',
    url: 'https://www.linkedin.com/search/results/people/?keywords=law%20firm%20IT%20director%20operations%20manager%20Microsoft%20365%20cybersecurity&origin=GLOBAL_SEARCH_HEADER'
  },
  {
    name: 'LinkedIn - education IT leaders',
    query: 'school IT director Microsoft 365 cybersecurity automation',
    url: 'https://www.linkedin.com/search/results/people/?keywords=school%20IT%20director%20Microsoft%20365%20cybersecurity%20automation&origin=GLOBAL_SEARCH_HEADER'
  },
  {
    name: 'Google - local businesses hiring IT help',
    query: 'site:linkedin.com/company Toronto small business Microsoft 365 IT support',
    url: 'https://www.google.com/search?q=site%3Alinkedin.com%2Fcompany%20Toronto%20small%20business%20Microsoft%20365%20IT%20support'
  },
  {
    name: 'Google - public expansion signals',
    query: 'new office opening IT support Microsoft 365 Toronto healthcare law firm financial services',
    url: 'https://www.google.com/search?q=new%20office%20opening%20IT%20support%20Microsoft%20365%20Toronto%20healthcare%20law%20firm%20financial%20services'
  },
  {
    name: 'Google - urgent SMB IT support signals',
    query: 'Toronto business hiring IT support Microsoft 365 migration cybersecurity helpdesk',
    url: 'https://www.google.com/search?q=Toronto%20business%20hiring%20IT%20support%20Microsoft%20365%20migration%20cybersecurity%20helpdesk'
  },
  {
    name: 'LinkedIn - office managers with IT pain',
    query: 'office manager operations manager Microsoft 365 onboarding Toronto law firm clinic',
    url: 'https://www.linkedin.com/search/results/people/?keywords=office%20manager%20operations%20manager%20Microsoft%20365%20onboarding%20Toronto%20law%20firm%20clinic&origin=GLOBAL_SEARCH_HEADER'
  },
  {
    name: 'LinkedIn - MSP partner overflow',
    query: 'MSP owner help desk overflow Microsoft 365 Canada',
    url: 'https://www.linkedin.com/search/results/people/?keywords=MSP%20owner%20help%20desk%20overflow%20Microsoft%20365%20Canada&origin=GLOBAL_SEARCH_HEADER'
  }
];

const REVENUE_OFFERS = [
  {
    name: 'Remote L1-L3 Overflow Support Pilot',
    speed: 'fastest-close',
    target: 'SMBs, MSPs, clinics, schools, law/accounting firms, and enterprise teams with ticket overflow',
    pain: 'tickets sit too long, onboarding/offboarding is messy, senior staff get pulled into simple issues',
    outcome: 'two-week pilot covering triage, M365/user support, escalation notes, and daily owner summary',
    firstAction: 'Ask for a 15-minute ticket-pressure call and offer to review one anonymized support queue/sample issue.'
  },
  {
    name: 'M365 Security and Productivity Tune-Up',
    speed: 'fast',
    target: 'companies already using Microsoft 365 without clean admin, MFA, device, or Teams governance',
    pain: 'security basics and productivity issues are known but nobody owns the cleanup',
    outcome: 'quick admin review, risk list, cleanup checklist, and prioritized fixes for identity, devices, Teams, SharePoint, and onboarding',
    firstAction: 'Offer a no-cost scoping conversation around three recurring M365 headaches.'
  },
  {
    name: 'AI Workflow Quick-Win Sprint',
    speed: 'fast',
    target: 'operations leaders, project managers, finance/admin teams, and owners drowning in repetitive work',
    pain: 'manual handoffs, scattered documents, repeated customer/internal questions, and slow reporting',
    outcome: 'one practical AI workflow or internal assistant prototype plus SOP and adoption plan',
    firstAction: 'Ask for one repetitive process that wastes 3+ hours per week and propose a small pilot.'
  },
  {
    name: 'Website + AI Intake Conversion Fix',
    speed: 'fast',
    target: 'small businesses with weak websites, poor contact flow, no booking path, or no clear services page',
    pain: 'traffic does not turn into calls, visitors cannot understand the offer, and intake is manual',
    outcome: 'tight service page, contact/booking path, AI intake assistant, and simple lead capture improvement list',
    firstAction: 'Send a short private teardown with 2-3 concrete fixes and offer a quick implementation sprint.'
  },
  {
    name: 'Office Move / Property IT Readiness',
    speed: 'medium',
    target: 'property managers, office managers, construction/project teams, and tenants moving into commercial space',
    pain: 'network, endpoints, Teams rooms, printers, access, and vendors are coordinated late',
    outcome: 'move-in IT checklist, vendor coordination tracker, day-one support plan, and escalation coverage',
    firstAction: 'Ask whether any tenants/projects need day-one IT readiness or overflow coordination.'
  }
];

const ARIA_PACKAGES = [
  {
    title: 'Starter AI Setup',
    buyer: 'Small business owner or operations manager',
    problem: 'They know AI could help but do not know where to start safely.',
    price: '$750-$2,500',
    includes: 'workflow discovery, one AI assistant/use-case setup, handoff guide, and adoption notes',
    delivery: 'scope call, select one process, build draft assistant/workflow, review, refine, handoff',
    hook: 'Get one practical AI workflow live without buying a complicated platform.',
    upsell: 'AI Workflow Audit or monthly AI support plan'
  },
  {
    title: 'AI Workflow Audit',
    buyer: 'Operations, finance, admin, project, clinic, law office, or MSP leaders',
    problem: 'Manual handoffs, repeated questions, and scattered documents waste staff time.',
    price: '$500-$1,500',
    includes: 'process interview, top automation opportunities, risk notes, quick-win roadmap, and pilot recommendation',
    delivery: 'intake, pain ranking, workflow map, opportunity scoring, executive summary',
    hook: 'Find the first AI use case that can save time without disrupting the business.',
    upsell: 'AI Automation Implementation'
  },
  {
    title: 'AI Help Desk Blueprint',
    buyer: 'IT managers, MSPs, schools, clinics, and internal support teams',
    problem: 'Support teams lose time to repeated L1 questions and weak ticket context.',
    price: '$1,500-$5,000',
    includes: 'ticket triage model, KB outline, escalation logic, summary templates, and ARIA-style support flow',
    delivery: 'support review, KB structure, triage blueprint, escalation design, implementation plan',
    hook: 'Reduce L1 noise and improve escalation quality before adding headcount.',
    upsell: 'ARIA Lite demo or monthly AI support plan'
  },
  {
    title: 'Small Business AI Agent Setup',
    buyer: 'Service businesses with intake, FAQ, booking, quoting, or internal admin bottlenecks',
    problem: 'Staff repeat the same answers and manually collect the same details.',
    price: '$1,000-$3,500',
    includes: 'website/client intake assistant concept, FAQ/KB prep, lead capture flow, and staff handoff script',
    delivery: 'use-case choice, content gathering, assistant flow, QA, launch checklist',
    hook: 'Turn repeated customer questions into clean intake and faster follow-up.',
    upsell: 'Website + AI Intake Conversion Fix'
  },
  {
    title: 'AI Knowledge Base Build',
    buyer: 'IT teams, MSPs, support desks, and growing businesses',
    problem: 'Knowledge is scattered across staff memory, old tickets, and inconsistent documents.',
    price: '$1,500-$6,000',
    includes: 'KB architecture, SOP templates, AI-readable version, escalation rules, and maintenance plan',
    delivery: 'source review, structure design, article creation, validation, handoff',
    hook: 'Make company knowledge usable by people and AI systems.',
    upsell: 'ARIA Pro business package'
  },
  {
    title: 'Monthly AI Support Plan',
    buyer: 'Businesses that want ongoing improvement without hiring an AI specialist',
    problem: 'AI ideas pile up but nobody owns maintenance, testing, or rollout.',
    price: '$500-$3,000/month',
    includes: 'monthly optimization, prompt/workflow updates, support docs, new quick-win backlog, and owner summary',
    delivery: 'monthly review, prioritized fixes, implementation support, KPI notes',
    hook: 'Keep AI useful, controlled, and improving every month.',
    upsell: 'Custom ARIA implementation or broader IT support retainer'
  }
];

const GROWTH_PRODUCTS = [
  ['Level 1 IT Support Troubleshooting Bible', 'new technicians, MSPs, small IT teams', 'L1 support confidence and repeatable troubleshooting', '$19-$79'],
  ['Microsoft 365 Help Desk KB Pack', 'help desks and SMB admins', 'common M365 tickets need fast, consistent answers', '$29-$149'],
  ['AI Agent Starter Kit for Small Business', 'owners and operators', 'businesses want useful AI without complexity', '$49-$199'],
  ['Windows 11 Troubleshooting KB', 'IT teams and power users', 'common Windows issues burn support time', '$19-$79'],
  ['Outlook Fix Guide', 'employees, admins, and help desks', 'Outlook problems are frequent and frustrating', '$9-$49'],
  ['AI Help Desk Automation Blueprint', 'IT leaders and MSPs', 'L1 noise reduction and ticket quality improvement', '$49-$249'],
  ['Cybersecurity Basics for Employees', 'SMBs, clinics, schools, law/accounting firms', 'human risk needs simple training', '$19-$99'],
  ['No-Code Automation Kit', 'operations teams and small businesses', 'manual admin work needs simple automation', '$29-$149'],
  ['Service Desk SOP Pack', 'MSPs and internal IT teams', 'support quality varies without SOPs', '$49-$199'],
  ['Ticket Triage Knowledge Pack', 'help desks and AI systems', 'tickets arrive messy and need better routing', '$49-$199'],
  ['AI-Readable IT Support KB Pack', 'AI builders and support teams', 'KBs need structure for humans and agents', '$79-$299'],
  ['Small Business Website Improvement Checklist', 'owners and web-service buyers', 'weak sites lose leads', '$9-$49']
].map(([title, buyer, problem, price]) => ({ title, buyer, problem, price }));

const SEED_CONTACTS = [
  ['Jason Brown', 'Hines', 'Senior Director at Hines; accepted connection; CIBC Square ecosystem.', 'commercial real estate / enterprise operations', 'accepted', '2026-06-09', 'linkedin', 'Hold until Friday, 2026-06-12 unless he replies first. Use the Friday-ready send checklist for the next send decision.'],
  ['Azim Lila', 'Financial services / digital strategy', 'AI, disruption, financial inclusion; past CIBC Director / Senior Manager Digital Strategy; free message sent.', 'financial services / AI transformation', 'message_sent', '2026-06-09', 'linkedin', 'Follow up in 7 days if no reply.'],
  ['Steve Lariviere', 'Hines', 'Operations Engineer at Hines; CIBC Square operations signal.', 'commercial real estate operations', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['David Hoffman', 'Hines', 'General Manager - CIBC SQUARE at Hines.', 'commercial real estate operations', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Adam F Clerici', 'Project / construction', 'Senior construction professional; projects include 81 Bay Street / CIBC Square.', 'commercial real estate projects', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Muhammad Bajwa', 'Program management', 'Program management, business operations, project delivery; projects include Hines CIBC Square.', 'project delivery / operations', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Avil Dsouza', 'IT leadership', 'Head of IT / Director IT; Azure and Microsoft 365 governance.', 'IT leadership / M365', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['John Bewley', 'Forward IT Thinking', 'SMB AI automation and IT service delivery founder.', 'SMB IT / AI automation partner', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['ABDULKERIM- CIO.D,CISSP,CCSP,MBA', 'Executive IT', 'CIO/CISO/cloud/AI executive IT leadership.', 'executive IT / cybersecurity', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Sean Banikin', 'Automate My Workflow', 'Operations expert, process architect, workflow automation owner.', 'workflow automation / SMB', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Jason Louth', 'Long View Systems', 'Microsoft 365, Copilot, AI and digital transformation.', 'M365 / Copilot / AI', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Rahoul R Dhopade', 'Powerex', 'Director, IT Infrastructure & Operations; senior infrastructure architect.', 'IT infrastructure / operations', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Olivier Perron', 'PMO / AI', 'AI-native PMO and AI executive.', 'AI PMO / operations', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Justin Anlund', 'ANLUND GROUP', 'Business and solution architecture owner; Microsoft/AWS/Google certified.', 'solution architecture / partner', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Clinton Boyda', 'Lantern', 'Enterprise automation and data platform architect; Microsoft 365.', 'M365 / automation architecture', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Kshitiz (Shi) Nayyar', 'KNAYYAR INC.', 'IT consultant, RPA practitioner, director/founder.', 'RPA / IT consulting partner', 'connection_requested', '2026-06-09', 'linkedin', 'Check acceptance before messaging.'],
  ['Genevieve Lucas', 'Microsoft', 'Microsoft National Strategic Initiatives Leader.', 'strategic Microsoft ecosystem', 'followed', '2026-06-09', 'linkedin', 'Look for future connect/message path only if natural and free.'],
  ['Pascale Cote', 'ERP / project leadership', 'Senior IT/project/change/ERP leadership; Dynamics 365/SAP signal.', 'ERP / transformation', 'followed', '2026-06-09', 'linkedin', 'Look for future connect/message path only if natural and free.'],
  ['Sridevi Palepu', 'Hyma LLC', 'Founder/owner; AI, ML, robotics, industrial automation.', 'AI / automation founder', 'followed', '2026-06-09', 'linkedin', 'Look for future connect/message path only if natural and free.'],
  ['Rod Trent', 'Microsoft', 'AI and security product development; Microsoft.', 'AI security / Microsoft ecosystem', 'followed', '2026-06-09', 'linkedin', 'Look for future connect/message path only if natural and free.'],
  ['Pulkit Arora', 'Dabadu', 'Founder/CEO of AI automotive platform.', 'AI platform founder', 'followed', '2026-06-09', 'linkedin', 'Look for future connect/message path only if natural and free.']
].map(([name, company, signal, segment, status, firstTouchedAt, source, nextAction]) => ({
  id: slug(`${name}-${company}`),
  name,
  company,
  signal,
  segment,
  source,
  status,
  firstTouchedAt,
  lastTouchedAt: firstTouchedAt,
  followUpStage: status === 'accepted' || status === 'message_sent' ? 0 : null,
  retired: false,
  nextAction
}));

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(startIso, endIso) {
  const start = new Date(`${startIso}T12:00:00Z`).getTime();
  const end = new Date(`${endIso}T12:00:00Z`).getTime();
  return Math.floor((end - start) / 86400000);
}

async function ensureState() {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function readJsonl(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

function mergeContacts(existing) {
  const byId = new Map((existing.contacts || []).map((c) => [c.id || slug(`${c.name}-${c.company}`), c]));
  for (const seed of SEED_CONTACTS) {
    if (HARD_EXCLUSIONS.some((term) => `${seed.name} ${seed.company} ${seed.signal}`.toLowerCase().includes(term.toLowerCase()))) {
      continue;
    }
    const current = byId.get(seed.id);
    byId.set(seed.id, current ? { ...seed, ...current, id: seed.id } : seed);
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    policy: {
      noCost: true,
      noAutonomousExternalSends: true,
      noLinkedInScraping: true,
      hardExclusions: HARD_EXCLUSIONS,
      targetSectors: TARGET_SECTORS
    },
    contacts: [...byId.values()].filter((c) => !HARD_EXCLUSIONS.some((term) => `${c.name} ${c.company} ${c.signal}`.toLowerCase().includes(term.toLowerCase())))
  };
}

function nextFollowUp(contact, today) {
  if (contact.retired) return null;
  if (!['accepted', 'message_sent', 'replied'].includes(contact.status)) return null;
  const base = contact.firstMessageAt || contact.lastMessageAt || contact.lastTouchedAt || contact.firstTouchedAt;
  const age = daysBetween(base, today);
  if ((contact.followUpStage || 0) <= 0 && age >= 7) {
    return {
      stage: 1,
      dueDate: addDays(base, 7),
      label: '7-day short follow-up',
      message: `Hi ${contact.name.split(' ')[0]}, quick follow-up. I thought there may be useful overlap around practical AI/M365 support, cleaner handoffs, and reducing day-to-day IT friction. Open to a short compare-notes chat if the timing makes sense.`
    };
  }
  if ((contact.followUpStage || 0) <= 1 && age >= 21) {
    return {
      stage: 2,
      dueDate: addDays(base, 21),
      label: '21-day final follow-up',
      message: `Hi ${contact.name.split(' ')[0]}, last quick note from me. If AI/M365 support, workflow cleanup, or overflow IT help becomes relevant, I would be glad to be useful. Either way, wishing you a strong month ahead.`
    };
  }
  return null;
}

function isObtained(contact, today) {
  if (contact.retired) return false;
  if (contact.status === 'replied') return true;
  if (contact.status === 'accepted') return true;
  const follow = nextFollowUp(contact, today);
  return Boolean(follow);
}

function formatStatusCounts(contacts) {
  const counts = {};
  for (const c of contacts) counts[c.status] = (counts[c.status] || 0) + 1;
  return Object.entries(counts).sort().map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- none';
}

function revenueScoreContact(contact) {
  const text = `${contact.name || ''} ${contact.company || ''} ${contact.signal || ''} ${contact.segment || ''}`.toLowerCase();
  let score = 0;
  if (['accepted', 'replied', 'message_sent'].includes(contact.status)) score += 35;
  if (contact.status === 'connection_requested') score += 18;
  if (/(owner|founder|director|vp|cio|cto|head|general manager|operations|office manager)/.test(text)) score += 20;
  if (/(microsoft 365|m365|copilot|ai|automation|infrastructure|cyber|security|support|help desk|service delivery)/.test(text)) score += 20;
  if (/(hines|cibc square|commercial real estate|property|tenant|move)/.test(text)) score += 12;
  if (/(smb|clinic|law|accounting|school|education|healthcare|financial)/.test(text)) score += 10;
  if (contact.status === 'followed') score -= 8;
  return score;
}

function nextMoveLabel(contact) {
  if (contact.name === 'Jason Brown' && contact.company === 'Hines' && contact.status === 'accepted') {
    return 'hold until Friday, 2026-06-12 unless he replies first; then use the Friday-ready send checklist';
  }
  if (contact.status === 'accepted') return 'prepare/send Ahmad-approved warm follow-up';
  if (contact.status === 'message_sent') return 'watch for reply, then 7-day follow-up';
  return 'check acceptance or use visible no-cost LinkedIn action';
}

function bestLeadNextText(contact) {
  if (contact.name === 'Jason Brown' && contact.company === 'Hines' && contact.status === 'accepted') {
    return 'hold until Friday, 2026-06-12 unless he replies first; Friday-ready send checklist is prepared';
  }
  if (contact.status === 'accepted') return 'Ahmad-approved warm follow-up';
  if (contact.status === 'message_sent') return 'watch for reply and prepare 7-day follow-up draft';
  return 'check acceptance or visible no-cost action only';
}

function pickOffer(contact) {
  const text = `${contact.company || ''} ${contact.signal || ''} ${contact.segment || ''}`.toLowerCase();
  if (/(hines|cibc square|property|commercial real estate|tenant|construction|move)/.test(text)) return REVENUE_OFFERS.find((offer) => offer.name.startsWith('Office Move'));
  if (/(microsoft 365|m365|copilot|teams|sharepoint|azure|identity|cyber|security)/.test(text)) return REVENUE_OFFERS.find((offer) => offer.name.startsWith('M365'));
  if (/(ai|automation|workflow|rpa|pmo|operations)/.test(text)) return REVENUE_OFFERS.find((offer) => offer.name.startsWith('AI Workflow'));
  if (/(msp|support|help desk|infrastructure|service delivery|overflow)/.test(text)) return REVENUE_OFFERS.find((offer) => offer.name.startsWith('Remote L1-L3'));
  return REVENUE_OFFERS[0];
}

function classifyTenderLead(entry) {
  const lead = entry.lead || {};
  const classification = entry.classification || {};
  const text = `${lead.title || ''} ${lead.org || ''} ${classification.stream || ''} ${classification.reason || ''}`.toLowerCase();
  let score = 0;
  if (classification.allowed) score += 30;
  if (lead.hot) score += 20;
  if (/(help desk|technical support|service desk|microsoft|m365|power platform|web architect|cyber|security|cloud|network|application|programmer|developer|tbips)/.test(text)) score += 25;
  if (/(furniture|veterinary|dental|tractor|fuel|construction|laboratory animal|imaging)/.test(text)) score -= 20;
  return score;
}

function latestUniqueTenderLeads(entries) {
  const byRef = new Map();
  for (const entry of entries) {
    const lead = entry.lead || {};
    const key = lead.ref || `${lead.title}-${lead.org}`;
    const current = byRef.get(key);
    if (!current || String(entry.ts || '') > String(current.ts || '')) byRef.set(key, entry);
  }
  return [...byRef.values()]
    .map((entry) => ({ ...entry, revenueScore: classifyTenderLead(entry) }))
    .filter((entry) => entry.revenueScore > 0)
    .sort((a, b) => b.revenueScore - a.revenueScore)
    .slice(0, 12);
}

function renderRevenueSprint(contacts, leadQueueEntries, today) {
  const topContacts = contacts
    .filter((c) => !c.retired && c.status !== 'premium_gated')
    .map((contact) => ({ contact, score: revenueScoreContact(contact), offer: pickOffer(contact) }))
    .filter((row) => row.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
  const tenderLeads = latestUniqueTenderLeads(leadQueueEntries);

  return [
    '# Revenue Generation Sprint',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Purpose: move IIS from general activity into near-term contract creation. This board is draft/no-send only until Ahmad approves external outreach or final submissions.',
    '',
    '## This Week Revenue Thesis',
    '- Stop selling broad IT. Lead with a narrow pain, a short pilot, and a clear business outcome.',
    '- Fastest cash paths are overflow support, M365 cleanup, AI workflow pilots, website/intake fixes, and office move IT readiness.',
    '- Every prospect should get one service angle and one next step. No rambling capability dump.',
    '',
    '## Offers To Push',
    ...REVENUE_OFFERS.map((offer, index) => [
      `${index + 1}. ${offer.name}`,
      `   - Speed: ${offer.speed}`,
      `   - Target: ${offer.target}`,
      `   - Pain: ${offer.pain}`,
      `   - Outcome: ${offer.outcome}`,
      `   - First action: ${offer.firstAction}`
    ].join('\n')),
    '',
    '## Top Warm / Near-Warm Contacts',
    topContacts.length ? topContacts.map(({ contact, score, offer }, index) => [
      `${index + 1}. ${contact.name}${contact.company ? ` - ${contact.company}` : ''}`,
      `   - Score: ${score}`,
      `   - Status: ${contact.status}`,
      `   - Best offer: ${offer.name}`,
      `   - Signal: ${contact.signal}`,
      `   - Next move: ${nextMoveLabel(contact)}`
    ].join('\n')).join('\n\n') : '- No near-warm contacts above threshold right now.',
    '',
    '## Public Tender / Bid Leads Worth Reviewing',
    tenderLeads.length ? tenderLeads.map((entry, index) => {
      const lead = entry.lead || {};
      const classification = entry.classification || {};
      return [
        `${index + 1}. ${lead.title || 'Untitled'} - ${lead.org || 'Unknown org'}`,
        `   - Close: ${lead.close || 'unknown'}`,
        `   - Score: ${entry.revenueScore}`,
        `   - Classification: ${classification.level || 'unknown'} / ${classification.stream || 'unknown'}`,
        `   - Action: ${classification.allowed ? 'prepare bid/no-bid brief and portal checklist' : 'light review only; do not commit until fit is confirmed'}`,
        `   - Link: ${lead.url || 'n/a'}`
      ].join('\n');
    }).join('\n\n') : '- No tender lead above threshold right now.',
    '',
    '## Daily Revenue Actions',
    '- Review accepted LinkedIn connections first; move any accepted buyer to Obtained Leads.',
    '- Open 25-50 high-fit LinkedIn/search results manually, skip Raymond James, and queue only buyers with role + pain + service angle.',
    '- Prepare 5 personalized no-send messages tied to one offer, not all offers.',
    '- Review top tender leads and only pursue low-complexity support/website/AI opportunities with realistic compliance burden.',
    '- Update CRM status immediately after every manual click/send/follow/skip.',
    '',
    '## Approval Gates',
    '- Ahmad approval is required before sending messages, emails, bids, quotes, public posts, or any paid action.',
    '- Hard no: Raymond James, paid InMail, scraping, mass automation, claims of partnership/customer status without confirmation.',
    ''
  ].join('\n');
}

function renderRevenueDrafts(contacts) {
  const topContacts = contacts
    .filter((c) => !c.retired && ['accepted', 'message_sent', 'connection_requested'].includes(c.status))
    .map((contact) => ({ contact, score: revenueScoreContact(contact), offer: pickOffer(contact) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const offerDrafts = REVENUE_OFFERS.map((offer) => [
    `## ${offer.name}`,
    '',
    'Short no-send opener:',
    '',
    'Hi [Name], I noticed your work around [specific role/company signal]. We help teams take pressure off day-to-day IT without turning every issue into a large project.',
    '',
    `The focused offer here is simple: ${offer.outcome}.`,
    '',
    `A practical starting point: ${offer.firstAction.replace(/\.$/, '')}.`,
    '',
    'If useful, I can send a short one-page outline tailored to your environment. No pressure either way.'
  ].join('\n'));

  const contactDrafts = topContacts.map(({ contact, offer }, index) => [
    `## ${index + 1}. ${contact.name}${contact.company ? ` - ${contact.company}` : ''}`,
    '',
    `Best angle: ${offer.name}`,
    '',
    `Hi ${contact.name.split(' ')[0]}, thanks for connecting. I was looking at your ${contact.segment || 'work'} background and thought there may be a practical overlap.`,
    '',
    'We help teams reduce day-to-day IT friction without turning every issue into a large project.',
    '',
    `A focused starting point could be ${offer.outcome}.`,
    '',
    'Open to a short compare-notes conversation? If easier, I can send a tight one-pager first.'
  ].join('\n'));

  return [
    '# Revenue Outreach Drafts',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'These are no-send drafts. Ahmad must approve before any external message is sent.',
    '',
    '# Offer Drafts',
    '',
    offerDrafts.join('\n\n'),
    '',
    '# Contact-Specific Drafts',
    '',
    contactDrafts.length ? contactDrafts.join('\n\n') : '- No contact-specific drafts available right now.',
    ''
  ].join('\n');
}

function scoreOpportunity({ revenue = 5, ease = 5, speed = 5, fit = 5, safety = 5, time = 5, reputation = 5, repeat = 5, reuse = 5 }) {
  const total = revenue + ease + speed + fit + safety + time + reputation + repeat + reuse;
  return Math.max(1, Math.min(10, Math.round((total / 90) * 10)));
}

function renderCommandSystem() {
  const subAgents = [
    ['Revenue Hunter Agent', 'Find fast-cash service opportunities and rank by close speed.', 'No outreach, no paid actions, no Raymond James.'],
    ['Contract Finder Agent', 'Find public/free-access contract opportunities for IT, AI, documentation, data, web, and automation work.', 'Prepare only; Ahmad approves before submission.'],
    ['Tender Scanner Agent', 'Review CanadaBuys, MERX, Ontario Tenders, municipal portals, and bid portals.', 'Flag legal/insurance/penalty/bond risks.'],
    ['Lead Research Agent', 'Find public business leads with role, pain signal, fit, and draft outreach.', 'Use public browsing only; no scraping or platform abuse.'],
    ['Proposal Writer Agent', 'Draft specific, calm, credible proposals and compliance checklists.', 'No fake claims; Ahmad approval required before sending.'],
    ['Outreach Writer Agent', 'Write short curiosity-driven messages tied to one offer.', 'Draft only unless Ahmad approves send.'],
    ['Website Conversion Agent', 'Improve iisupp.net clarity, packages, lead capture, Shop, Growth Library, and ARIA positioning.', 'Preserve existing features and checkout logic.'],
    ['ARIA Product Agent', 'Package ARIA into sellable AI support, KB, and workflow products.', 'No false partner/customer claims.'],
    ['Growth Library Product Agent', 'Turn IIS knowledge into original sellable packs for humans, businesses, IT teams, and AI systems.', 'No copying copyrighted products.'],
    ['Founder Discipline Agent', 'Create daily revenue/build/follow-up rhythm and prevent scatter.', 'Keep Ahmad focused on few high-value actions.'],
    ['Legal/Safety Review Agent', 'Catch cost, compliance, privacy, platform, reputation, and contract risks.', 'Escalate before external or irreversible action.'],
    ['Opportunity Scoring Agent', 'Score every opportunity 1-10 using revenue, speed, fit, safety, repeatability, and reuse.', 'Prioritize fast cash, repeatable service, product reuse, ARIA, long-term contracts.']
  ];

  return [
    '# IIS / ARIA Command System',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Mission: operate Integrated IT Support Inc. as a disciplined AI-powered IT support, automation, web, digital product, and contract-revenue company.',
    '',
    '## Operating Style',
    '- Direct, ambitious, practical, calm, revenue-focused.',
    '- Think big, but ship assets that can make money now.',
    '- Draft, organize, score, build, improve, and show Ahmad what is ready.',
    '- Default execution mode: complete the task to the CEO final-action point. Ahmad should only need to click, sign, submit, send, approve, accept, or reject.',
    '- Ask for approval only when action affects money, reputation, legal exposure, external contact, contracts, submissions, account creation, pricing commitments, or deletion.',
    '- Interpret short action words like `continue`, `proceed`, `do it`, and `keep going` as authority to continue under the standing IIS/ARIA mission, current queue, and memory without asking Ahmad to restate the vision.',
    '',
    '## Non-Negotiable Rules',
    '- No Raymond James contact, targeting, scraping, references, or lead sourcing.',
    '- No costs, subscriptions, paid APIs, ads, credits, contractors, or purchases without Ahmad approval.',
    '- No bids, proposals, contracts, applications, platform messages, legal documents, invoices, or offers submitted without Ahmad approval.',
    '- No deceptive impersonation. Draft and organize on Ahmad/IIS behalf, but require approval before external action.',
    '- No platform abuse, anti-spam violations, privacy violations, copyright misuse, or Canadian compliance shortcuts.',
    '- No fake partnerships or unsupported claims involving OpenAI, Anthropic, Microsoft, Google, schools, governments, banks, or any company.',
    '- Do not delete website features, products, checkout flows, AI logic, pages, backend functions, or hidden logic unless a backup exists and Ahmad approves.',
    '- Keep cost, approval, send, submit, account-creation, auth, and risky-publish blockers visible until Ahmad acts on them or explicitly parks them.',
    '- While waiting on Ahmad-only actions, keep building the next list: more revenue opportunities, more conversion improvements, more prep packets, more supplier-entry lanes, and more cleanup or handoff recommendations.',
    '',
    '## CEO Final-Action Protocol',
    '- Forms and portals: open the opportunity, read requirements, fill every known field that does not create cost/legal exposure, attach prepared files when appropriate, validate required fields, leave the browser on the final Submit/Send/Apply/Complete step, and record what Ahmad must click.',
    '- LinkedIn/outreach: find high-fit people, prepare tailored connection/message text, open the correct composer when appropriate, paste or stage the message if allowed by the platform, then stop at the final Send/Connect action for Ahmad.',
    '- Bids/proposals: complete bid/no-bid brief, compliance checklist, draft response, document package, portal checklist, and final-submit note. Stop before certification, signature, legal commitment, payment, or final upload submission.',
    '- Website/product work: implement, test, and prepare publish notes. Stop only before deleting features, changing checkout/payment behavior, or publishing if the change affects reputation, pricing, legal claims, or irreversible production state.',
    '- Cleanup: scan, group, summarize, and prepare archive/delete lists. Stop before deleting, moving, compressing, clearing logs, or changing Git history.',
    '- Escalate only with a clear CEO action: "Ahmad click Submit", "Ahmad click Send", "Ahmad approve/sign", "Ahmad accept/reject", or "Ahmad approve cleanup/delete list".',
    '- Mirror live approvals and blockers into the active handoff surface so another active agent can carry them forward without context loss.',
    '',
    '## Primary Revenue Lanes',
    '- Remote L1/L2/L3 overflow support and MSP help.',
    '- M365 cleanup, support documentation, onboarding/offboarding, and security basics.',
    '- AI workflow audits, AI agent setup, ARIA help desk systems, and AI knowledge bases.',
    '- Website updates, weak-site fixes, AI intake, and conversion cleanup.',
    '- Data entry, SOP writing, business writing, proposal writing, spreadsheet cleanup, and documentation contracts.',
    '- Government/private tenders with manageable scope and low legal/insurance burden.',
    '- Move-in, setup, configuration, deployment, and office technology readiness.',
    '',
    '## Sub-Agent Operating Model',
    ...subAgents.map(([name, purpose, limits]) => `- ${name}: ${purpose} Limits: ${limits}`),
    '',
    '## Daily Rhythm',
    '- Morning: what makes money today, what must ship today, who needs follow-up today.',
    '- Afternoon: what completed, what is stuck, what can be simplified.',
    '- Evening: what moved the business forward, what was learned, tomorrow first action.',
    '',
    '## Scoring Rule',
    '- Score every opportunity 1-10 by revenue potential, ease, speed to cash, IIS fit, legal/platform safety, time required, reputation value, repeat business, and ARIA/Growth Library reuse.',
    '- Priority order: fast cash, repeatable service, digital product reuse, ARIA productization, long-term contract value.',
    ''
  ].join('\n');
}

function renderAriaPackages() {
  return [
    '# ARIA Monetization Packages',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'ARIA should be sold as a practical business support system, not only as a website feature.',
    '',
    ...ARIA_PACKAGES.map((pkg, index) => [
      `## ${index + 1}. ${pkg.title}`,
      `- Problem solved: ${pkg.problem}`,
      `- Who buys it: ${pkg.buyer}`,
      `- Price range suggestion: ${pkg.price}`,
      `- Included: ${pkg.includes}`,
      `- Delivery steps: ${pkg.delivery}`,
      `- Sales hook: ${pkg.hook}`,
      `- Website copy: ${pkg.title} gives ${pkg.buyer.toLowerCase()} a practical way to address this problem: ${pkg.problem} IIS keeps the work scoped, useful, and ready for real operations.`,
      `- Outreach message: Hi [Name], I noticed [specific operational signal]. IIS is packaging ARIA-style AI support into a focused ${pkg.title}. It is built for teams dealing with this exact issue: ${pkg.problem} Open to a short compare-notes call?`,
      `- Upsell path: ${pkg.upsell}`
    ].join('\n')),
    ''
  ].join('\n\n');
}

function renderGrowthLibraryEngine() {
  return [
    '# Growth Library Product Engine',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Purpose: turn IIS field knowledge into original practical intelligence products for humans, businesses, IT teams, and AI systems. No copied courses or resale of copyrighted material.',
    '',
    ...GROWTH_PRODUCTS.map((product, index) => [
      `## ${index + 1}. ${product.title}`,
      `- Buyer: ${product.buyer}`,
      `- Problem: ${product.problem}`,
      '- Why it sells: it saves time, reduces uncertainty, and gives the buyer a practical working structure.',
      `- Price suggestion: ${product.price}`,
      `- Landing page copy: ${product.title} gives ${product.buyer} a practical, ready-to-use system for this problem: ${product.problem}.`,
      '- Table of contents: overview, common scenarios, step-by-step workflows, checklists, templates, examples, QA checklist, implementation notes.',
      '- PDF outline: cover, promise, who it is for, quick-start, core chapters, worksheets, final checklist.',
      '- AI-readable version outline: metadata, intents, symptoms/signals, decision tree, response templates, escalation rules, examples.',
      '- Checkout placement: Growth Library, Shop, related service page, ARIA/Growth bundle.',
      '- Bundle idea: combine with ARIA/AI workflow service, M365 cleanup, or support SOP pack.',
      '- Upsell to IIS: implementation help, customization, monthly support, ARIA setup, or knowledge base build.'
    ].join('\n')),
    ''
  ].join('\n\n');
}

function renderCommandUpdate(contacts, leadQueueEntries, today) {
  const topContacts = contacts
    .filter((c) => !c.retired && c.status !== 'premium_gated')
    .map((contact) => ({ contact, score: revenueScoreContact(contact), offer: pickOffer(contact) }))
    .sort((a, b) => b.score - a.score);
  const tenderLeads = latestUniqueTenderLeads(leadQueueEntries);
  const bestLead = topContacts[0];
  const bestTender = tenderLeads[0];
  const topProduct = GROWTH_PRODUCTS.find((p) => p.title === 'AI Help Desk Automation Blueprint') || GROWTH_PRODUCTS[0];
  const ariaMove = ARIA_PACKAGES.find((p) => p.title === 'AI Help Desk Blueprint') || ARIA_PACKAGES[0];
  const revenueOpps = REVENUE_OFFERS.map((offer) => {
    const score = scoreOpportunity({
      revenue: offer.name.includes('Overflow') ? 8 : 7,
      ease: offer.name.includes('Website') ? 8 : 7,
      speed: offer.speed === 'fastest-close' ? 9 : offer.speed === 'fast' ? 8 : 6,
      fit: 9,
      safety: 8,
      time: offer.speed === 'medium' ? 6 : 8,
      reputation: 8,
      repeat: offer.name.includes('Monthly') ? 9 : 7,
      reuse: /AI|Help Desk|M365/.test(offer.name) ? 9 : 6
    });
    return `- ${offer.name}: score ${score}/10 - ${offer.firstAction}`;
  });

  return [
    '# IIS / ARIA Command Update',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Revenue opportunities found',
    ...revenueOpps,
    '',
    '## 2. Best lead today',
    bestLead ? `- ${bestLead.contact.name} (${bestLead.contact.company}) - score ${bestLead.score}. Best offer: ${bestLead.offer.name}. Next: ${bestLeadNextText(bestLead.contact)}.` : '- No qualified lead above threshold.',
    '',
    '## 3. Best contract/tender today',
    bestTender ? `- ${bestTender.lead.title} - ${bestTender.lead.org}. Close: ${bestTender.lead.close || 'unknown'}. Score: ${bestTender.revenueScore}. Action: prepare bid/no-bid brief before any submission. ${bestTender.lead.url || ''}` : '- No tender lead above threshold.',
    '',
    '## 4. Best ARIA monetization move',
    `- Package ${ariaMove.title} as the first serious ARIA service. Price range: ${ariaMove.price}. Hook: ${ariaMove.hook}`,
    '',
    '## 5. Best Growth Library product to create next',
    `- ${topProduct.title}. Buyer: ${topProduct.buyer}. Price: ${topProduct.price}. Upsell into ARIA/support implementation.`,
    '',
    '## 6. Website improvement needed',
    '- Add clearer service package pathways from ARIA/Growth Library/Services into one action: book a scoping call, request AI workflow audit, or buy/download a practical pack. Preserve checkout and existing features.',
    '- Keep adding proof-first trust layers for the fastest-close offers. The newest local-only gate is the Overflow Support Pilot sample preview.',
    '',
    '## 7. Outreach drafts prepared',
    `- Draft file ready: ${REVENUE_DRAFTS_FILE}`,
    `- Contact-specific drafts generated for ${Math.min(10, topContacts.length)} current prospects.`,
    '- CEO final-action rule: drafts should be taken as close as possible to the final Send/Connect action, then left for Ahmad approval/click.',
    '',
    '## 8. Proposal drafts prepared',
    '- Not submitted. The Jason Brown / Hines Friday-ready follow-up packet is prepared. Next bid/proposal packaging should focus on the highest-fit tender after Ahmad reviews posture.',
    '',
    '## 9. Risks / approvals needed',
    '- Ahmad approval required before the final irreversible button: Send, Connect when it sends externally, Submit, Apply, Complete, signature/certification, pricing commitment, paid tool, public claim, account creation, production-risk publish, deletion, move, archive, or Git history change.',
    '- Hard exclusions preserved: Raymond James, scraping, spam, paid InMail, fake partnerships, and copied copyrighted products.',
    '',
    "## 10. Tomorrow's first 3 actions",
    '- Check LinkedIn accepted connections and move any accepted buyer into Obtained Leads.',
    '- If Jason Brown has not replied by Friday, 2026-06-12, use the prepared Hines send checklist for the CEO `Send` / `Hold` decision.',
    '- Review the staged Overflow Support Pilot preview slice and choose publish or hold local only.',
    ''
  ].join('\n');
}

function renderLastMileProtocol() {
  return [
    '# CEO Final-Action Protocol',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Ahmad should not need to babysit routine execution. The operating standard is: complete the task to the CEO final-action point, then stop only where Ahmad must click, sign, submit, send, approve, accept, reject, spend, publish-risk, or delete.',
    '',
    '## Default Behavior',
    '- Research the task fully enough to act.',
    '- Fill the form, draft and stage the message, prepare the files, build the package, test the page, or organize the cleanup list.',
    '- Leave the browser, file, portal, draft, or checklist at the exact place where Ahmad can make the CEO final action quickly.',
    '- Record the exact CEO action needed in plain language.',
    '- If Ahmad says `continue`, `proceed`, or `do it`, continue under the standing mission and current queue. Do not ask him to restate the objective.',
    '- Keep cost, approval, send, submit, account-creation, auth, and risky-publish blockers visible until Ahmad acts on them or explicitly parks them.',
    '- While waiting on Ahmad-only actions, keep adding the next revenue, conversion, supplier, tender, and cleanup opportunities.',
    '',
    '## CEO Final Actions',
    '- Submit',
    '- Send',
    '- Apply',
    '- Complete',
    '- Confirm',
    '- Sign',
    '- Certify',
    '- Pay',
    '- Purchase',
    '- Subscribe',
    '- Create account',
    '- Delete',
    '- Move/archive user work',
    '- Publish changes that affect legal claims, pricing, checkout, reputation, or irreversible production behavior',
    '',
    '## Work Type Rules',
    '- Bid portals: fill known fields, attach prepared documents when appropriate, validate, leave at final submit. If a requirement is unknown, write the exact question and field name.',
    '- LinkedIn/leads: identify high-fit target, tailor message, stage draft or provide copy-ready text, stop at the final external send/connect action for Ahmad.',
    '- Proposals: prepare cover note, compliance checklist, pricing placeholder if not approved, risk list, and final package checklist.',
    '- Website/ARIA/Growth Library: implement reversible safe improvements, test them, and prepare publish notes. Preserve features and checkout.',
    '- Cleanup: generate board and exact proposed actions. Never delete/move/archive without Ahmad approval.',
    '',
    '## Escalation Format',
    '- What is fully prepared.',
    '- Why it matters for revenue/profit.',
    '- The exact CEO final action Ahmad must take.',
    '- Any risk in one sentence.',
    '- Where the mirrored active handoff list lives so another active agent can pick it up immediately.',
    ''
  ].join('\n');
}

function renderObtained(contacts, today) {
  const obtained = contacts.filter((c) => isObtained(c, today));
  const rows = obtained.map((c, i) => {
    const follow = nextFollowUp(c, today);
    return [
      `${i + 1}. ${c.name}${c.company ? ` - ${c.company}` : ''}`,
      `   - Segment: ${c.segment || 'unknown'}`,
      `   - Status: ${c.status}`,
      `   - Signal: ${c.signal}`,
      `   - Action now: ${follow ? follow.label : c.nextAction}`,
      follow ? `   - Draft: ${follow.message}` : null
    ].filter(Boolean).join('\n');
  });
  return [
    '# Obtained Leads - contact now',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Use this list for warm/accepted/replied leads only. Do not send anything that mentions Raymond James. Do not use paid InMail or paid tools.',
    '',
    rows.length ? rows.join('\n\n') : '- No warm accepted/replied leads due right now.',
    ''
  ].join('\n');
}

function csvEscape(value) {
  const s = String(value || '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function renderObtainedCsv(contacts, today) {
  const header = ['name', 'company', 'segment', 'status', 'signal', 'action_now'];
  const rows = contacts.filter((c) => isObtained(c, today)).map((c) => {
    const follow = nextFollowUp(c, today);
    return [c.name, c.company, c.segment, c.status, c.signal, follow ? follow.label : c.nextAction].map(csvEscape).join(',');
  });
  return [header.join(','), ...rows].join('\n') + '\n';
}

function renderDailyBrief(contacts, today) {
  const pending = contacts.filter((c) => c.status === 'connection_requested' && !c.retired);
  const followed = contacts.filter((c) => c.status === 'followed' && !c.retired);
  const premiumSkipped = contacts.filter((c) => c.status === 'premium_gated' && !c.retired);
  const obtained = contacts.filter((c) => isObtained(c, today));
  const followDue = contacts.map((c) => ({ contact: c, follow: nextFollowUp(c, today) })).filter((x) => x.follow);

  return [
    '# Business Development Agent Daily Brief',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Hard Rules',
    '- No cost. No Premium. No paid APIs. No ads. No paid enrichment. No autonomous external sends.',
    '- Do not scrape LinkedIn or use mass-contact automation.',
    '- Do not contact anyone connected to Raymond James. If Raymond James appears anywhere, skip.',
    '- Draft, queue, rank, and remind. Ahmad manually approves/sends external outreach.',
    '',
    '## Today Snapshot',
    formatStatusCounts(contacts),
    `- warm/obtained leads needing Ahmad action: ${obtained.length}`,
    `- follow-ups due by cadence: ${followDue.length}`,
    `- pending connection requests to review for acceptance: ${pending.length}`,
    `- followed strategic profiles to revisit later: ${followed.length}`,
    `- premium-gated skips preserved: ${premiumSkipped.length}`,
    `- revenue sprint board: ${REVENUE_SPRINT_FILE}`,
    `- revenue outreach drafts: ${REVENUE_DRAFTS_FILE}`,
    `- IIS / ARIA command update: ${COMMAND_UPDATE_FILE}`,
    '',
    '## Revenue Focus Today',
    '- Primary: convert accepted/warm contacts into short calls around one narrow offer.',
    '- Secondary: find buyers with immediate operational pain: ticket overflow, M365 cleanup, AI workflow waste, weak website/intake, or office move IT readiness.',
    '- Avoid low-intent activity. A follow/connect only counts if the role, company signal, service angle, and next action are logged.',
    '',
    '## Obtained Leads',
    obtained.length ? obtained.map((c) => `- ${c.name}${c.company ? ` (${c.company})` : ''}: ${c.status} - ${c.nextAction}`).join('\n') : '- None due right now.',
    '',
    '## Follow-Ups Due',
    followDue.length ? followDue.map(({ contact, follow }) => `- ${contact.name}: ${follow.label} - ${follow.message}`).join('\n') : '- None due today.',
    '',
    '## Acceptance Review Queue',
    pending.slice(0, 30).map((c) => `- ${c.name}${c.company ? ` (${c.company})` : ''}: ${c.segment} - check if accepted; if accepted, move status to accepted and add to obtained leads.`).join('\n') || '- No pending connection requests.',
    '',
    '## Search Plays For Today',
    ...SEARCH_PLAYS.map((play) => `- ${play.name}: ${play.url}`),
    '',
    '## Qualification Instructions',
    '- Strong fit: owner/founder, IT Director, Operations Director, VP Operations, VP IT, CIO, CTO, PMO leader, facilities/property operations leader, office manager with technology responsibility.',
    '- Service angles: L1 help desk, L2 endpoint/M365, L3 identity/network/server/cloud escalation, AI knowledge base, Copilot/M365 workflow cleanup, onboarding/offboarding, security basics, overflow support.',
    '- Prioritize sectors: banks, government, healthcare, education, law firms, financial/accounting firms, SMBs, and enterprise overflow teams.',
    '- Lead with one revenue offer: Remote L1-L3 Overflow Support Pilot, M365 Security/Productivity Tune-Up, AI Workflow Quick-Win Sprint, Website + AI Intake Conversion Fix, or Office Move / Property IT Readiness.',
    '- Warm tone: patient, practical, specific to their role, and low pressure.',
    '- Retire after the 21-day final follow-up unless the person replies or asks to reconnect later.',
    ''
  ].join('\n');
}

function renderSpec() {
  return [
    '# Business Development Agent',
    '',
    'Mission: build a disciplined daily pipeline for Integrated IT Support Inc. across LinkedIn, Google, public company pages, procurement signals, and business directories without cost or platform-abusive automation.',
    '',
    '## Authority',
    '- Can discover public leads, rank prospects, maintain CRM status, write no-send drafts, prepare morning briefs, and create follow-up reminders.',
    '- Can add warm accepted/replied prospects to `Obtained Leads - contact now` for Ahmad.',
    '- Must complete work to the CEO final-action point: completed forms, staged drafts, prepared packages, and exact click/sign/submit/send/approve instructions.',
    '- Cannot send, post, comment, DM, email, use InMail, buy tools, scrape LinkedIn, bypass platform limits, or contact excluded companies.',
    '',
    '## Hard Stop Rules',
    '- No cost of any kind.',
    '- No autonomous external outreach.',
    '- No Raymond James contact, no exceptions.',
    '- No scraping or bulk automation.',
    '- No claims that IIS is approved by, partnered with, or already serving a company unless Ahmad confirms.',
    '- Stop at final irreversible buttons: Submit, Send, Apply, Complete, Confirm, Sign, Certify, Pay, Purchase, Subscribe, Create Account, Delete, Move/Archive user work, or risky Publish.',
    '',
    '## Skills To Apply',
    '- Sales: qualify pain, budget likelihood, timing, authority, and service fit before writing.',
    '- Customer service: be patient, warm, and useful; avoid pressure language.',
    '- Profiling: identify likely buyer role, sector, company size, trigger event, and potential service angle.',
    '- Technical: understand L1 password/M365/device/user support, L2 endpoint/Intune/network/app support, and L3 identity/cloud/server/security escalation.',
    '- Negotiation: open with value and curiosity, then move toward a short call or direct handoff only when there is signal.',
    '- Revenue discipline: package every action under one closeable offer, one buyer pain, and one next step.',
    '',
    '## Revenue Offers',
    ...REVENUE_OFFERS.map((offer) => `- ${offer.name}: ${offer.outcome}`),
    '',
    '## Cadence',
    '- Every morning: compile touched contacts, due follow-ups, accepted/replied leads, and new search plays.',
    '- After 7 days: short follow-up for accepted/messaged contacts if no reply.',
    '- After 21 days: final polite follow-up, then retire unless they respond.',
    '- Nonstop means daily queue maintenance and discovery, not nonstop external sending.',
    ''
  ].join('\n');
}

async function appendQueue(title, body) {
  await fs.appendFile(AGENT_QUEUE_FILE, [
    '',
    `## ${new Date().toISOString()} - Business Development Agent`,
    '',
    `### ${title}`,
    '',
    body,
    ''
  ].join('\n'), 'utf8');
}

async function appendExecutionNote(summary) {
  await fs.appendFile(EXECUTION_NOTES, [
    '',
    `### ${todayIso()} - Codex - business development agent run`,
    '',
    summary,
    ''
  ].join('\n'), 'utf8');
}

async function run() {
  await ensureState();
  const today = todayIso();
  const existing = await readJson(CRM_FILE, { contacts: [] });
  const leadQueueEntries = await readJsonl(LEAD_QUEUE_FILE);
  const crm = mergeContacts(existing);

  await writeJson(CRM_FILE, crm);
  await fs.writeFile(AGENT_SPEC_FILE, renderSpec(), 'utf8');
  await fs.writeFile(OBTAINED_MD_FILE, renderObtained(crm.contacts, today), 'utf8');
  await fs.writeFile(OBTAINED_CSV_FILE, renderObtainedCsv(crm.contacts, today), 'utf8');
  await fs.writeFile(DAILY_BRIEF_FILE, renderDailyBrief(crm.contacts, today), 'utf8');
  await fs.writeFile(REVENUE_SPRINT_FILE, renderRevenueSprint(crm.contacts, leadQueueEntries, today), 'utf8');
  await fs.writeFile(REVENUE_DRAFTS_FILE, renderRevenueDrafts(crm.contacts), 'utf8');
  await fs.writeFile(COMMAND_SYSTEM_FILE, renderCommandSystem(), 'utf8');
  await fs.writeFile(COMMAND_UPDATE_FILE, renderCommandUpdate(crm.contacts, leadQueueEntries, today), 'utf8');
  await fs.writeFile(ARIA_PACKAGES_FILE, renderAriaPackages(), 'utf8');
  await fs.writeFile(GROWTH_LIBRARY_ENGINE_FILE, renderGrowthLibraryEngine(), 'utf8');
  await fs.writeFile(LAST_MILE_PROTOCOL_FILE, renderLastMileProtocol(), 'utf8');

  const obtainedCount = crm.contacts.filter((c) => isObtained(c, today)).length;
  const pendingCount = crm.contacts.filter((c) => c.status === 'connection_requested' && !c.retired).length;
  const followedCount = crm.contacts.filter((c) => c.status === 'followed' && !c.retired).length;
  const tenderLeadCount = latestUniqueTenderLeads(leadQueueEntries).length;
  const summary = [
    `Generated daily no-send business-development queue for ${crm.contacts.length} tracked contacts.`,
    '',
    `Obtained leads needing Ahmad action: ${obtainedCount}`,
    `Pending connection requests to check: ${pendingCount}`,
    `Strategic follows to revisit: ${followedCount}`,
    `Tender/public leads worth review: ${tenderLeadCount}`,
    '',
    `Daily brief: \`${DAILY_BRIEF_FILE}\``,
    `Command update: \`${COMMAND_UPDATE_FILE}\``,
    `Command system: \`${COMMAND_SYSTEM_FILE}\``,
    `Revenue sprint: \`${REVENUE_SPRINT_FILE}\``,
    `Revenue drafts: \`${REVENUE_DRAFTS_FILE}\``,
    `ARIA packages: \`${ARIA_PACKAGES_FILE}\``,
    `Growth Library engine: \`${GROWTH_LIBRARY_ENGINE_FILE}\``,
    `Last-mile protocol: \`${LAST_MILE_PROTOCOL_FILE}\``,
    `Obtained leads: \`${OBTAINED_MD_FILE}\``,
    `CRM: \`${CRM_FILE}\``,
    '',
    'Hard rules preserved: no cost, no autonomous external sends, no scraping, no Raymond James.'
  ].join('\n');

  await appendQueue('Daily business-development queue ready', summary);
  await appendExecutionNote(summary);
  await publishAgentReport({
    agentId: 'business-development-agent',
    label: 'Business Development Agent',
    summary: 'Daily no-send business-development queue refreshed and routed into the autonomous board.',
    metrics: {
      trackedContacts: crm.contacts.length,
      obtainedLeads: obtainedCount,
      pendingConnections: pendingCount,
      strategicFollows: followedCount,
      tenderLeadCount
    },
    artifacts: [
      CRM_FILE,
      DAILY_BRIEF_FILE,
      OBTAINED_MD_FILE,
      REVENUE_SPRINT_FILE,
      REVENUE_DRAFTS_FILE,
      COMMAND_UPDATE_FILE,
      ARIA_PACKAGES_FILE,
      GROWTH_LIBRARY_ENGINE_FILE,
      LAST_MILE_PROTOCOL_FILE
    ],
    readyActions: [
      obtainedCount ? `${obtainedCount} warm lead(s) are staged for Ahmad-only send/hold review.` : null
    ].filter(Boolean),
    nextActions: [
      pendingCount ? `Check ${pendingCount} pending connection request(s) for acceptance.` : null,
      followedCount ? `Revisit ${followedCount} strategic follow(s) on cadence.` : null,
      tenderLeadCount ? `Review ${tenderLeadCount} tender/public lead(s) for bid/no-bid posture.` : null
    ].filter(Boolean),
    focusAreas: [
      'warm-lead follow-up',
      'remote-l1-l3-overflow-support',
      'ai-workflow-audit',
      'website-conversion'
    ]
  });
  console.log(summary);
}

run().catch((e) => {
  console.error(e?.stack || e?.message || String(e));
  process.exitCode = 1;
});
