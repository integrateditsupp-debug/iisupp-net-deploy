#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishAgentReport, logBootstrapHeader } from './autonomy-supervisor-core.mjs';

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

// RUN-CV / CV5 (2026-10-09) — THE IT/MSP FIT FILTER (missed request A22).
//
// Measured on the operator's digest: "Flight Deck Lighting", "Water Supply", "Tree Inventory",
// "Lightning Protection" and "LiDAR (deadline 2040)" sat at priority 10/10 in the revenue top list.
// The research agent admits any notice carrying a broad word ("data", "system", "support", "digital"),
// the scorer above rewards the tender type (+3) and the public-sector buyer (+1), and nothing ever
// asked the one question that matters: is this the work an MSP does? Integrated IT Support Inc. sells
// managed IT, help desk L1-L3, Microsoft 365 / Entra / Intune, endpoints, networks, cybersecurity
// basics, cloud, AI/automation workflows, IT assessments/audits, website + AI intake and office-move
// IT readiness. A lighting retrofit is not a scope-down of any of those.
//
// The filter is DOMAIN fit only. It never parks for a compliance, certification, bond or clearance
// reason — that is the smart qualifier's territory (sub-prime, scope-down, cert-on-award,
// value-justifies-spend) and stays with the human. Three verdicts plus an honest abstention:
//   it        — the notice names MSP work; untouched.
//   adjacent  — AV, telecom, cameras/access control, GIS/business software, cabling, print, IoT/OT:
//               work an MSP can sub-prime or scope down. Kept, labelled, score capped BELOW the
//               needs_review line so it never outranks a strong fit.
//   non-it    — civil, lighting, water, trees, HVAC, fleet, paving, survey, goods, guards...: parked
//               (the `ignored` status this file already uses), `manualReason` carries the reason.
//   unknown   — no domain signal either way; the filter abstains and the scorer decides as before.
// A human verdict (a manual override rule, or a manualDisposition already on the item) beats every
// keyword: the filter still labels the item but never changes its score or status.
//
// Evidence: title + organization + summary/description + whyRelevant for the POSITIVE side; the
// buyer's name is deliberately NOT evidence of a non-IT domain (IIS sells IT to water agencies too),
// and whyRelevant is derived text (the research agent writes "IT support fit" for any notice
// containing "support"), so a non-IT TITLE with no IT term in it is parked whatever whyRelevant says.
// Each entry is [regex, label]; longer phrases come first inside an alternation so the hit reads well.
export const IT_FIT_TERMS = Object.freeze([
  [/\bmanaged (it|services?|service provider|security|detection|cloud|network|endpoints?|print(?! services))\b/gi, 'managed services'],
  [/\bmsp\b/gi, 'MSP'],
  [/\bi\.?t\.?\s+(managed|services?|support|help ?desk|service desk|assessments?|audits?|consult\w*|infrastructure|security|operations?|outsourc\w*|staff\w*|moderni[sz]\w*|strategy|systems?|solutions?|advisory|governance|department|assets?|roadmap|review|health check|procurement|equipment|hardware|network\w*|project|transformation|training|readiness|environment)\b/gi, 'IT services'],
  [/\binformation (technology|systems?|security)\b/gi, 'information technology'],
  [/\bict\b/gi, 'ICT'],
  [/\b(help ?desk|service desk|technical support|tech support|desktop support|end[- ]?user support|deskside|level [123] support|l[123] support|tier [123] support|l1[-–/]l3)\b/gi, 'help desk'],
  [/\b(microsoft 365|m365|office 365|o365|azure|entra|intune|active directory|exchange online|sharepoint|microsoft teams|onedrive|power platform|power automate|dynamics 365|copilot|microsoft licensing|windows 1[01])\b/gi, 'Microsoft 365'],
  [/\b(endpoints?|workstations?|laptops?|device management|mdm|patch(ing| management)|rmm|remote monitoring)\b/gi, 'endpoints'],
  [/\b(network(ing| infrastructure| services| security| upgrade| refresh| switch\w*| equipment| assessment| design| support| cabling| monitoring)|computer network|data network|lan\/wan|wi-?fi|wireless (network|infrastructure|lan)|firewalls?|vpn|sd-wan)\b/gi, 'networks'],
  [/\b(cyber\s?security|cybersecurity|cyber|infosec|security awareness|phishing|mfa|multi-?factor|zero trust|siem|edr|mdr|xdr|vulnerabilit(y|ies)|penetration test\w*|pen test\w*|security assessment|incident response|ransomware|data backup|backup (and|&) (recovery|disaster recovery|restore)|backup solution|cloud backup|offsite backup|immutable backup|disaster recovery|business continuity|identity (and|&) access|iam|endpoint protection|antivirus|anti-virus|security operations)\b/gi, 'cybersecurity'],
  [/\b(technology|security|cyber\s?security|cybersecurity|network|infrastructure|systems?|digital|cloud|microsoft 365|m365)\s+(assessment|audit|review|roadmap|health check|strategy|moderni[sz]ation)\b/gi, 'IT assessment'],
  [/\b(cloud (services?|migration|hosting|infrastructure|computing|platform|storage|backup|strategy|readiness)|saas|iaas|paas|web hosting|data ?cent(er|re)|servers?(?! room)|virtuali[sz]ation|vmware|hyper-v|storage area network|nas)\b/gi, 'cloud/servers'],
  [/\b(artificial intelligence|a\.?i\.?|machine learning|llm|large language|chatbots?|generative|gen ?ai|rpa|intelligent automation|workflow automation|process automation|automation)\b/gi, 'AI/automation'],
  [/\b(software|applications? (development|support|moderni[sz]ation|services)|app development|web (development|design|application|portal)|websites?|web ?site redesign|intake (form|system|portal)|online intake|crm|databases?|data (analytics|platform|warehouse|migration|integration|governance)|business intelligence|power bi|dashboards?|portal)\b/gi, 'software/web'],
  [/\b(learning management system|lms|e-?learning platform)\b/gi, 'LMS'],
  [/\b(digital transformation|digital services|systems? integrat(ion|or)|devops|site reliability|sysadmin|systems? administrat(or|ion)|computer(s|ing)?|hardware (maintenance|support|refresh|procurement)|printers? and computers)\b/gi, 'IT operations'],
  [/\b(office (move|relocation) it|technology readiness|it readiness)\b/gi, 'office-move IT readiness']
]);

export const IT_ADJACENT_TERMS = Object.freeze([
  [/\b(audio[- ]?visual|a\/v|av (system|equipment|integration|upgrade|services|solution)s?|video ?conferenc\w*|boardroom|digital signage|projectors?|broadcast)\b/gi, 'audio-visual'],
  [/\b(telecom\w*|telephony|voip|phone system|pbx|unified communications|ucaas|sip trunk\w*|contact cent(er|re)|call cent(er|re)|two-way radio|radio system|p25|cellular|mobile devices?|smartphones?|cell phones?)\b/gi, 'telecom'],
  [/\b(security cameras?|cctv|video surveillance|surveillance (system|cameras?)|access control|card access|door access|intercom|intrusion (detection|alarm)|alarm monitoring|security system)\b/gi, 'physical security systems'],
  [/\b(gis|geographic information system|esri|arcgis|mapping software|asset management (system|software)|cmms|eam|work order system|permitting software|records management system|document management|edms|ecm|electronic (health|medical) records?|ehr|emr|erp|hris|payroll system|financial system|student information system|library system|point of sale|pos|kiosks?|e-?commerce|ticketing system|scheduling software|data collection software)\b/gi, 'business/GIS software'],
  [/\b(structured cabling|cabling|fib(er|re)( optic)?|low[- ]voltage|cable plant|data (drops|jacks)|wiring closet)\b/gi, 'cabling'],
  [/\b(managed print services|printers?|copiers?|multifunction|mfps?|print services)\b/gi, 'print'],
  [/\b(iot|sensors?|smart (building|city|meters?)|building automation|bas|bms|scada|operational technology|ot security|telematics|meter reading|ami)\b/gi, 'IoT/OT'],
  [/\b(office (move|relocation)|relocation services|moving services)\b/gi, 'office move'],
  [/\b(digiti[sz]ation|scanning services|document imaging|microfilm)\b/gi, 'digitization']
]);

export const NON_IT_TERMS = Object.freeze([
  [/\b(civil (works|engineering|construction)|construction|roads?|roadway|paving|asphalt|pavement|sidewalks?|curbs?|bridges?|culverts?|sewers?|sewage|water ?mains?|water supply|water treatment|wastewater|storm ?water|drainage|drinking water|water|well drilling|dams?|reservoirs?|pumping station|lift station|force main|pipelines?|trenching|excavation|grading|concrete|masonry|demolition|renovations?|roofing|roof (replacement|repair)|flooring|painting|drywall|window replacement|fencing|guardrails?|retaining wall|playgrounds?|sports? fields?|artificial turf|arena|swimming pool|aquatic|parking lot|line painting|traffic signals?|crosswalks?|bike lanes?)\b/gi, 'civil/construction'],
  [/\b(lightning (protection|arrest\w*|rods?)|lightning|lighting|light fixtures?|luminaires?|street ?lights?|electrical (contractor|services|upgrade|work|panel|distribution)|generators?|transformers?|switchgear|hvac|heating|ventilation|air conditioning|boilers?|chillers?|furnaces?|plumbing|mechanical (systems?|contractor|services|upgrade)|elevators?|escalators?|fire suppression|sprinklers?|solar panels?|battery storage|ev chargers?|charging stations?)\b/gi, 'electrical/mechanical trades'],
  [/\b(tree inventory|tree (removal|planting|pruning|trimming)|trees?|arborist\w*|forestry|urban forest|landscap\w*|grounds (maintenance|keeping)|lawn|mowing|snow (removal|plowing|clearing)|winter maintenance|de-?icing|road salt|horticultur\w*|pest control|invasive species|wildlife|fisher(y|ies)|environmental (assessment|monitoring|remediation)|soil|geotechnical|hydrogeolog\w*|water quality|turbidity|waste (collection|management|disposal)|garbage|recycling|landfill|compost\w*|hazardous (waste|materials))\b/gi, 'environment/grounds'],
  [/\b(lidar|aerial (survey|imagery|photography|mapping)|orthophoto\w*|photogrammetry|topographic survey|land survey\w*|bathymetr\w*|hydrographic|drone survey|legal survey)\b/gi, 'survey/mapping'],
  [/\b(fleet|vehicles?|trucks?|buses|bus|ambulances?|fire (trucks?|apparatus)|tires?|tyres?|fuel\w*|automotive|auto parts|towing|snow ?plows?|plow\w*|tractors?|mowers?|forklifts?|heavy equipment|equipment rental|loaders?|excavators?)\b/gi, 'fleet/vehicles'],
  [/\b(furniture|chairs?|office supplies|stationery|uniforms?|apparel|clothing|footwear|janitorial|custodial|cleaning (services?|supplies)|laundry|food services?|catering|groceries|cafeteria|vending|beverages?|chemicals?|medical (supplies|equipment|devices)|pharmaceutical\w*|laboratory (equipment|supplies|services)|ppe|personal protective|(?<!digital )signage|printing services|print and mail|promotional (items|products)|textbooks?|library books|musical instruments)\b/gi, 'goods/facilities'],
  [/\b(security guards?|guard services|crossing guards?|nursing|physicians?|dental|legal (services|counsel)|financial audit|external audit|accounting services|actuarial|insurance (broker|services|coverage)|banking services|investment management|appraisal|translation services|interpret(er|ation) services|courier|mail services|moving services|transportation services|transit|shipping|freight|warehousing|marine|vessels?|boats?|dredging|flight deck|aircraft|runway|airfield|hangar|armou?red|weapons?|ammunition|firearms?|parking (enforcement|management)|elections? (services|supplies))\b/gi, 'non-IT services'],
  [/\b(armoured sports utility vehicles|marine fuel|flare station|water purification|negotiator services|generator rental|spare parts?|containers?|conduit|placard holder|spectrometer)\b/gi, 'goods (weak-fit list)']
]);

// Below the `q >= 3` needs_review line in newStatus(): an adjacent item is kept and queued, never promoted
// over a strong fit, and the ranking comparator puts every strong fit ahead of it regardless of score.
export const ADJACENT_QUALITY_CAP = 2;

const FIT_RANK = Object.freeze({ it: 2, unknown: 1, adjacent: 1, 'non-it': 0 });

const MSP_SCOPE = 'managed IT, help desk L1-L3, Microsoft 365 / Entra / Intune, endpoints, networks, cybersecurity, cloud, AI/automation, IT assessments, website + AI intake, office-move IT readiness';

function asText(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(asText).join(' ');
  if (typeof value === 'object') return '';
  return String(value);
}

/** Distinct hits of a term table in a text: [{ label, match }], one per distinct matched phrase. */
export function collectHits(terms, text) {
  const hits = [];
  const seen = new Set();
  const haystack = asText(text);
  if (!haystack) return hits;
  for (const [pattern, label] of terms) {
    pattern.lastIndex = 0;
    for (const m of haystack.matchAll(pattern)) {
      const match = String(m[0]).toLowerCase().replace(/\s+/g, ' ').trim();
      if (!match || seen.has(match)) continue;
      seen.add(match);
      hits.push({ label, match });
    }
  }
  return hits;
}

const quoted = (hits, max = 4) => hits.slice(0, max).map((h) => `"${h.match}"`).join(', ') + (hits.length > max ? ` (+${hits.length - max})` : '');

// The research agent's makeWhyRelevant() writes a fixed vocabulary from substring checks on the same
// title/summary this filter already reads ("IT support fit" for any notice containing "support",
// "AI automation fit" for any containing "ai" — "maintenance" qualifies). Those labels are derived,
// not evidence, so they are stripped before whyRelevant is matched; anything a human wrote there stays.
const DERIVED_WHY_LABELS = /\b(ai automation fit|it support fit|cybersecurity fit|remote-friendly|public-sector credibility and contract potential|enterprise\/vendor access path|personal career growth and income potential|possible business or career growth fit)\b/gi;
export function humanWhyRelevant(why) {
  return asText(why).replace(DERIVED_WHY_LABELS, ' ').replace(/[,;]\s*(?=[,;]|$)/g, ' ').trim();
}

/**
 * IT/MSP domain fit. Pure, total (never throws — a missing or malformed field is an empty string).
 * @returns {{ fit: 'it'|'adjacent'|'non-it'|'unknown', hits: Array<{side:string,label:string,match:string}>, reason: string }}
 */
export function itFit(item) {
  const it = item && typeof item === 'object' ? item : {};
  const title = asText(it.title);
  const organization = asText(it.organization);
  const facts = [asText(it.summary), asText(it.description)].filter(Boolean).join(' ');
  const why = humanWhyRelevant(it.whyRelevant);
  const positiveText = [title, organization, facts, why].join(' \n ');
  const domainText = [title, facts].join(' \n ');
  const itHits = collectHits(IT_FIT_TERMS, positiveText);
  const adjacentHits = collectHits(IT_ADJACENT_TERMS, positiveText);
  const nonItHits = collectHits(NON_IT_TERMS, domainText);
  const itTitle = collectHits(IT_FIT_TERMS, title);
  const adjacentTitle = collectHits(IT_ADJACENT_TERMS, title);
  const nonItTitle = collectHits(NON_IT_TERMS, title);
  const hits = [
    ...itHits.map((h) => ({ side: 'it', ...h })),
    ...adjacentHits.map((h) => ({ side: 'adjacent', ...h })),
    ...nonItHits.map((h) => ({ side: 'non-it', ...h }))
  ];
  const parked = (why2) => ({
    fit: 'non-it',
    hits,
    reason: `Parked by the IT/MSP fit filter — non-IT domain (${quoted(nonItHits)}); ${why2}. IIS scope: ${MSP_SCOPE}.`
  });
  const adjacent = (why2) => ({
    fit: 'adjacent',
    hits,
    reason: `IT-adjacent (${quoted(adjacentHits.length ? adjacentHits : itHits)}${nonItHits.length ? `; non-IT: ${quoted(nonItHits)}` : ''}) — ${why2}; kept, score capped at ${ADJACENT_QUALITY_CAP}, ranked below strong IT fits.`
  });

  if (nonItTitle.length && !itTitle.length) {
    if (adjacentTitle.length >= nonItTitle.length) return adjacent('the title pairs a non-IT trade with work an MSP can sub-prime or scope down');
    return parked('the title names the work and no IT/MSP scope is in it to sub-prime or scope down');
  }
  if (itHits.length) {
    if (nonItHits.length >= itHits.length) return adjacent('the IT scope is paired with as much non-IT work; a scope-down or sub-prime path, not a straight bid');
    return { fit: 'it', hits, reason: `IT/MSP fit (${quoted(itHits)}).` };
  }
  if (adjacentHits.length) {
    if (nonItHits.length > adjacentHits.length) return parked('the adjacent scope is a sliver of a non-IT notice');
    return adjacent('an MSP can sub-prime or scope down this work');
  }
  if (nonItHits.length) return parked('nothing in the notice names IT/MSP or IT-adjacent work');
  return { fit: 'unknown', hits, reason: 'No domain signal either way; the fit filter abstains and the quality score decides.' };
}

function fitRank(item) {
  if (!item || item.fitFilterApplied === false) return FIT_RANK.it;
  return FIT_RANK[item.itFit] ?? FIT_RANK.unknown;
}

/** The ranking comparator main() sorts with: type weight, then strong fit ahead of the rest, then the scores. */
export function rankItems(a, b) {
  if (businessWeight(b) !== businessWeight(a)) return businessWeight(b) - businessWeight(a);
  if (fitRank(b) !== fitRank(a)) return fitRank(b) - fitRank(a);
  if ((b.qualityScore || 0) !== (a.qualityScore || 0)) return (b.qualityScore || 0) - (a.qualityScore || 0);
  if ((b.priorityScore || 0) !== (a.priorityScore || 0)) return (b.priorityScore || 0) - (a.priorityScore || 0);
  return (a.difficultyScore || 99) - (b.difficultyScore || 99);
}

export function factText(item) {
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

export function findOverride(item, overrides) {
  return (Array.isArray(overrides) ? overrides : []).find((rule) => matchesOverride(item, rule)) || null;
}

// RUN-CV / CV5: both noise heuristics below pre-date the fit filter and could only recognise IT work
// through `digitalTenderSignals`, which has no word for "IT managed services", "IT assessment" or
// "M365". A notice the fit filter judges `it` is therefore exempt from them — additive: nothing
// that was exempt before stops being exempt, and the filter's own verdict parks real non-IT work.
function isGoodsTenderNoise(item) {
  if (!['tender', 'contract'].includes(item.type)) return false;
  const text = factText(item);
  return goodsTenderNoise.test(text) && !digitalTenderSignals.test(text) && itFit(item).fit !== 'it';
}

function isCategoryFeedFalsePositive(item) {
  if (!['tender', 'contract'].includes(item.type)) return false;
  const feed = `${item.sourceName || ''} ${item.organization || ''}`.toLowerCase();
  if (!/(ai opportunities|cybersecurity opportunities|it opportunities)/i.test(feed)) return false;
  const title = `${item.title || ''}`.toLowerCase();
  return !digitalTenderSignals.test(title) && itFit(item).fit !== 'it';
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

// RUN-CV / CV5: `fit` is the itFit() verdict to apply, or null to score exactly as before (a human
// verdict in play). non-it → the score can never be positive, so the parked status also follows from
// the existing `q <= 0` rule; adjacent → capped under the needs_review line; it/unknown → untouched.
export function quality(item, fit = null) {
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
  if (fit && fit.fit === 'non-it') score = Math.min(score, 0);
  if (fit && fit.fit === 'adjacent') score = Math.min(score, ADJACENT_QUALITY_CAP);
  return score;
}

export function newStatus(item, q, fit = null) {
  if (item.status === 'submitted' || item.status === 'ignored') return item.status;
  if (fit && fit.fit === 'non-it') return 'ignored';
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

/**
 * RUN-CV / CV5: one item's gate verdict, pure. The order of precedence is the whole point:
 *   1. a human verdict (a matching override rule, or a manualDisposition already on the item) wins —
 *      the fit filter only LABELS such an item (`fitFilterApplied: false`), it changes nothing;
 *   2. otherwise the fit filter decides the domain, and the quality score + status follow as before.
 * Returns the fields main() merges onto the item plus the decision row for the report.
 */
export function gateDecision(item, overrides = []) {
  const it = item && typeof item === 'object' ? item : {};
  const override = findOverride(it, overrides);
  const fit = itFit(it);
  const humanVerdict = Boolean(override) || Boolean(it.manualDisposition);
  const effectiveFit = humanVerdict ? null : fit;
  const q = quality(it, effectiveFit);
  const status = override?.action === 'ignore' ? 'ignored' : newStatus(it, q, effectiveFit);
  const parkedByFilter = !humanVerdict && fit.fit === 'non-it' && status === 'ignored';
  return {
    override,
    fit,
    q,
    status,
    parkedByFilter,
    fields: {
      qualityScore: q,
      status,
      manualDisposition: override?.disposition || null,
      manualReason: override?.reason || (parkedByFilter ? fit.reason : null),
      manualReference: override?.reference || null,
      itFit: fit.fit,
      itFitReason: fit.reason,
      itFitHits: fit.hits.map((h) => `${h.side}:${h.match}`),
      fitFilterApplied: !humanVerdict
    }
  };
}

async function main() {
  const db = await readJson(DB_FILE, { version: 1, items: [] });
  const overrideDb = await readJson(OVERRIDES_FILE, { overrides: [] });
  const overrides = Array.isArray(overrideDb.overrides) ? overrideDb.overrides : [];
  let parked = 0;
  let promoted = 0;
  let manualParked = 0;
  let fitParked = 0;
  const decisions = [];

  const items = (db.items || []).map((item) => {
    const decision = gateDecision(item, overrides);
    const { override, fit, q, status } = decision;
    const next = {
      ...item,
      ...decision.fields,
      qualityGateAt: nowIso
    };
    if (status === 'ignored' && item.status !== 'ignored') parked += 1;
    if (override?.action === 'ignore' && item.status !== 'ignored') manualParked += 1;
    if (decision.parkedByFilter && item.status !== 'ignored') fitParked += 1;
    if (status === 'needs_review' && item.status !== 'needs_review') promoted += 1;
    decisions.push({
      title: item.title,
      organization: item.organization,
      type: item.type,
      oldStatus: item.status,
      status,
      q,
      fit: fit.fit,
      overrideReason: override?.reason || null,
      fitReason: decision.parkedByFilter ? fit.reason : null
    });
    return next;
  }).sort(rankItems);

  await fs.writeFile(DB_FILE, JSON.stringify({ ...db, updated: nowIso, items }, null, 2), 'utf8');

  const active = items.filter((item) => item.status !== 'ignored');
  const revenueTop = active.filter((item) => item.type !== 'job').slice(0, 15);
  const careerTop = active.filter((item) => item.type === 'job').slice(0, 8);
  const adjacentActive = active.filter((item) => item.itFit === 'adjacent').length;
  const fitLabel = (item) => (item.itFit && item.itFit !== 'it' ? `, fit ${item.itFit}` : '');
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
- Parked by the IT/MSP fit filter this run: ${fitParked}
- IT-adjacent items still active (labelled, capped below strong fits): ${adjacentActive}
- Promoted to needs review this run: ${promoted}

## Top Revenue / Company Items
${revenueTop.map((item, index) => `${index + 1}. ${item.title} - ${item.organization} (${item.type}, quality ${item.qualityScore}, priority ${item.priorityScore}, status ${item.status}${fitLabel(item)})`).join('\n') || '- None'}

## Top Career Items
${careerTop.map((item, index) => `${index + 1}. ${item.title} - ${item.organization} (${item.type}, quality ${item.qualityScore}, priority ${item.priorityScore}, status ${item.status}${fitLabel(item)})`).join('\n') || '- None'}

## Parked This Run
${decisions.filter((d) => d.oldStatus !== 'ignored' && d.status === 'ignored').slice(0, 40).map((d) => `- ${d.title} - ${d.organization} (${d.type}, quality ${d.q})${d.overrideReason ? ` | ${d.overrideReason}` : ''}${d.fitReason ? ` | ${d.fitReason}` : ''}`).join('\n') || '- None'}
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
      fitParkedItems: fitParked,
      adjacentActiveItems: adjacentActive,
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

  console.log(JSON.stringify({ ok: true, total: items.length, active: active.length, parked, fitParked, report: REPORT_FILE }, null, 2));
}

// RUN-CV / CV5 (2026-10-09): the worker only runs when this file IS the entry point. Importing it
// (tests/opportunity-fit-filter.test.mjs exercises the pure functions above) must write nothing —
// a worker run inside a clean clone creates the operator-record witness file and turns 57 NOT-TAKEN
// readings into failures (docs/AGENT-BOOTSTRAP.md §5, "Trap"). Same guard shape as
// scripts/agent-preflight.mjs; the basename fallback keeps the Windows task (`node scripts\...`)
// running when drive-letter case differs between argv and the module URL.
const isMain = Boolean(process.argv[1]) && (() => {
  try {
    const self = fileURLToPath(import.meta.url);
    const entry = path.resolve(process.argv[1]);
    return entry === self || path.basename(entry) === path.basename(self);
  } catch {
    return false;
  }
})();

if (isMain) {
  // RUN-CU 2026-10-08: name the current-state file this run started from, so a run that acted on
  // stale state can be told apart from one that never read any. Guarded: a missing note is a log
  // line, never a dead worker.
  await logBootstrapHeader('opportunity-quality-gate-agent');

  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
