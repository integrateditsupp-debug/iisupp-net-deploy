// global-bid-research-agent.mjs — the Global Bid, Contract & Whitelisting agent.
//
// Three jobs, one loop:
//   1. DISCOVER  — sweep public global tender feeds (UN family, EU/TED, UK, AU, NZ, CA, MDBs) for
//                  work Integrated IT Support can actually deliver: remote-first IT/MSP scope, with
//                  onsite covered by hiring local resource when a contract needs boots on the ground.
//   2. WHITELIST — drive the registration queue: every country/province/state/city portal where a
//                  supplier account puts IIS on the invited/notified list. Registration is FREE on
//                  every portal in the seed. The agent prepares each one to its final gate; the
//                  account-creation click, the password and the submit are Ahmad's (an agent must
//                  never create an account or type a credential).
//   3. MARKET    — a free-only global visibility queue (directories, marketplaces, partner locators,
//                  open-data registries) so IIS is findable worldwide without ad spend.
//
// And one rule on top of all three: THE BAR RATCHETS. Every cycle is scored against the previous
// cycle and the agent raises its own minimum — fit threshold, source weights, keyword vocabulary,
// dead-source pruning. A cycle that does not beat the standing bar is recorded as a regression with
// the reason, so the next cycle starts from the failure instead of repeating it. See rungCycle().
//
// Output for the AXIS Overview "Global" panel: senior-director-state/global-engine/global-panel.json
// (the panel in assets/axis-app.js renders an embedded copy so it works with no backend; this file is
// the machine-readable source of truth the sync agent copies into the snapshot.)
//
// Network: read-only GETs against public feeds. No writes, no logins, no credentials, ever.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { publishAgentReport } from './autonomy-supervisor-core.mjs';

const root = process.cwd();
const engineDir = path.join(root, 'senior-director-state', 'global-engine');
const P = {
  registry: path.join(engineDir, 'portal-registry.json'),
  opps: path.join(engineDir, 'global-opportunities.json'),
  marketing: path.join(engineDir, 'marketing-channels.json'),
  cycles: path.join(engineDir, 'cycles.json'),
  panel: path.join(engineDir, 'global-panel.json'),
};
const nowIso = () => new Date().toISOString();
const today = () => nowIso().slice(0, 10);

// ── Company facts used to fill every registration ───────────────────────────
export const COMPANY = {
  legalName: 'INTEGRATED IT SUPPORT INC.',
  corpNumber: '1496740-2',
  bn: '717468540 RC0001',
  address: '30 Fothergill Court, Whitby, Ontario, L1P 1L4, Canada',
  country: 'Canada',
  contact: 'Ahmad Wasee, Director',
  email: 'integrateditsupp@gmail.com',
  phone: '+1 647 581 3182',
  web: 'https://iisupp.net',
  structure: 'Federal corporation (CBCA), incorporated 2023',
  size: '1-10',
  currency: 'CAD',
  languages: ['English'],
  unspsc: ['81111500', '81111800', '81112000', '81112200', '81161500', '81161700', '43230000'],
  naics: ['541512', '541519', '541511', '811210'],
  gsin: ['D302', 'D399'],
  delivery: 'Remote delivery worldwide; onsite delivered by locally hired/contracted resource in-region.',
};

// ── 1. PORTAL REGISTRY — the whitelisting map ───────────────────────────────
// status: registered | in_progress | queued | gated  (gated = needs a credential/ID only Ahmad can create)
// tier:   1 = free + we qualify today, 2 = free + remote-eligible international, 3 = co-op / standing offer
const SEED_PORTALS = [
  // ── Canada: federal + every province/territory ──
  { id: 'canadabuys', name: 'CanadaBuys (Government of Canada)', region: 'Canada · Federal', tier: 1, status: 'in_progress', url: 'https://canadabuys.canada.ca/en/registration', note: 'All federal departments. Supplier account + GSIN D302/D399 alerts.' },
  { id: 'ontario_jaggaer', name: 'Ontario Tenders Portal (Jaggaer)', region: 'Canada · Ontario', tier: 1, status: 'registered', url: 'https://ontariotenders.app.jaggaer.com/', note: '36 commodity codes live. Province + universities, colleges, school boards.' },
  { id: 'bidsandtenders', name: 'bids&tenders (Sovra) — ALL agencies', region: 'Canada · Ontario municipal', tier: 1, status: 'registered', url: 'https://richmondhill.bidsandtenders.ca/Module/Tenders/en/Vendor/Dashboard/21a1fe27-61f3-4ebb-8993-b9f5ce962704', note: '~90% of Ontario municipalities. IT + IT Consulting on, every agency notified.' },
  { id: 'toronto_ariba', name: 'City of Toronto (SAP Ariba)', region: 'Canada · Toronto', tier: 1, status: 'registered', url: 'https://www.toronto.ca/business-economy/doing-business-with-the-city/searching-bidding-on-city-contracts/how-to-register-as-a-supplier-with-the-city/', note: 'Supplier registration submitted · Category 8116 IT Service Delivery.' },
  { id: 'bcbid', name: 'BC Bid', region: 'Canada · British Columbia', tier: 1, status: 'gated', url: 'https://www.bcbid.gov.bc.ca/', gate: 'Business BCeID must be created first (account + password = Ahmad).', note: 'Province of BC + broader public sector.' },
  { id: 'alberta_apc', name: 'Alberta Purchasing Connection', region: 'Canada · Alberta', tier: 1, status: 'queued', url: 'https://purchasing.alberta.ca/', note: 'Province + AB municipalities and health.' },
  { id: 'sasktenders', name: 'SaskTenders', region: 'Canada · Saskatchewan', tier: 1, status: 'queued', url: 'https://sasktenders.ca/', note: 'Province, health authority, Crown corps.' },
  { id: 'merx_mb', name: 'MERX (Manitoba + national private)', region: 'Canada · Manitoba', tier: 1, status: 'queued', url: 'https://www.merx.com/', note: 'Manitoba public sector plus a wide national feed.' },
  { id: 'seao', name: 'SEAO — Système électronique d’appels d’offres', region: 'Canada · Québec', tier: 1, status: 'queued', url: 'https://www.seao.ca/', note: 'All Québec public bodies. French UI; bilingual response needed.' },
  { id: 'ns_tenders', name: 'Nova Scotia Tenders', region: 'Canada · Nova Scotia', tier: 1, status: 'queued', url: 'https://novascotia.ca/tenders/', note: 'Province + NS municipalities; Invest NS already runs on Bonfire.' },
  { id: 'nbon', name: 'New Brunswick Opportunities Network (NBON)', region: 'Canada · New Brunswick', tier: 1, status: 'queued', url: 'https://nbon-rpanb.gnb.ca/', note: 'Province + NB public bodies.' },
  { id: 'pei_tenders', name: 'PEI Tenders', region: 'Canada · Prince Edward Island', tier: 1, status: 'queued', url: 'https://www.princeedwardisland.ca/en/topic/tenders', note: 'Small volume, low competition.' },
  { id: 'nl_ppa', name: 'Newfoundland & Labrador Procurement (PPA)', region: 'Canada · NL', tier: 1, status: 'queued', url: 'https://www.gov.nl.ca/ppa/', note: 'Province + regional health.' },
  { id: 'civicinfo_bc', name: 'CivicInfo BC — municipal bids', region: 'Canada · BC municipal', tier: 1, status: 'queued', url: 'https://www.civicinfo.bc.ca/bids', note: 'Aggregates BC city/regional-district postings.' },
  { id: 'biddingo', name: 'Biddingo', region: 'Canada · MASH sector', tier: 1, status: 'queued', url: 'https://www.biddingo.com/', note: 'Municipal, academic, school, hospital buyers across Canada.' },
  { id: 'bonfire', name: 'Bonfire / Euna (multi-buyer)', region: 'Canada + USA', tier: 1, status: 'registered', url: 'https://gobonfire.com/', note: 'Account live; used for Carleton RFSQ 2026-P-04.' },

  // ── UN family + multilateral development banks: the true global tier ──
  { id: 'ungm', name: 'UNGM — UN Global Marketplace ★', region: 'Global · UN system', tier: 2, status: 'gated', url: 'https://www.ungm.org/Account/Registration/Company', gate: 'Form filled to the final step. Password + Register button = Ahmad.', note: 'One account = supplier visibility to 40+ UN agencies worldwide. Best single global entry point.' },
  { id: 'undp_quantum', name: 'UNDP Quantum Supplier Portal', region: 'Global · UNDP', tier: 2, status: 'queued', url: 'https://www.undp.org/procurement/business', note: 'UNDP country offices in 170 countries. Profile + UNSPSC categories.' },
  { id: 'undp_notices', name: 'UNDP Procurement Notices', region: 'Global · UNDP', tier: 2, status: 'queued', url: 'https://procurement-notices.undp.org/', note: 'Open notice feed; feeds discovery even before the portal account exists.' },
  { id: 'worldbank', name: 'World Bank — WBGeProcure / corporate consulting', region: 'Global · MDB', tier: 2, status: 'queued', url: 'https://wbnpf.procurementinet.org/login', note: 'Corporate + operational consulting. Foreign suppliers eligible.' },
  { id: 'unops', name: 'UNOPS eSourcing', region: 'Global · UNOPS', tier: 2, status: 'queued', url: 'https://esourcing.unops.org/', note: 'Infrastructure/IT delivery arm of the UN; links to UNGM identity.' },

  // ── International national portals (foreign/remote suppliers permitted) ──
  { id: 'uk_fts', name: 'UK — Find a Tender Service', region: 'United Kingdom', tier: 2, status: 'queued', url: 'https://www.find-tender.service.gov.uk/', note: 'Above-threshold UK public contracts. Overseas suppliers may bid.' },
  { id: 'uk_cf', name: 'UK — Contracts Finder', region: 'United Kingdom', tier: 2, status: 'queued', url: 'https://www.contractsfinder.service.gov.uk/', note: 'Below-threshold + subcontract opportunities. Free account.' },
  { id: 'eu_ted', name: 'EU — TED (Tenders Electronic Daily)', region: 'European Union', tier: 2, status: 'queued', url: 'https://ted.europa.eu/en/', note: '700k+ notices/yr across 27 member states. Free alerts; each award runs on the member state’s own e-tendering system.' },
  { id: 'ie_etenders', name: 'Ireland — eTenders (EU-Supply)', region: 'Ireland', tier: 2, status: 'queued', url: 'https://irl.eu-supply.com/ctm/company/companyregistration/registercompany', note: 'English-language EU entry point. Free supplier registration.' },
  { id: 'au_tenders', name: 'Australia — AusTender', region: 'Australia', tier: 2, status: 'queued', url: 'https://www.tenders.gov.au/', note: 'Commonwealth entities. Remote-deliverable ICT services eligible.' },
  { id: 'nz_gets', name: 'New Zealand — GETS', region: 'New Zealand', tier: 2, status: 'queued', url: 'https://www.gets.govt.nz/', note: 'All NZ government tenders. Free supplier account, open to overseas suppliers.' },
  { id: 'sg_gebiz', name: 'Singapore — GeBIZ', region: 'Singapore', tier: 2, status: 'queued', url: 'https://www.gebiz.gov.sg/ptn/gtpregistration/signup.xhtml', note: 'GeBIZ Trading Partner registration; foreign suppliers accepted.' },
  { id: 'za_etenders', name: 'South Africa — eTender Portal', region: 'South Africa', tier: 2, status: 'queued', url: 'https://www.etenders.gov.za/', note: 'National + provincial. CSD supplier number needed for award.' },
  { id: 'us_sam', name: 'USA — SAM.gov (Federal)', region: 'United States', tier: 2, status: 'gated', url: 'https://sam.gov/', gate: 'Foreign entity needs a UEI + NCAGE code before registration completes.', note: 'US federal. Highest friction, highest ceiling.' },
  { id: 'in_gem', name: 'India — GeM (Government e-Marketplace)', region: 'India', tier: 3, status: 'queued', url: 'https://gem.gov.in/', note: 'Largely restricted to Indian-registered sellers; revisit only with a local partner.' },

  // ── Co-ops / standing offers: qualify once, sell to many ──
  { id: 'sourcewell', name: 'Sourcewell', region: 'Canada + USA co-op', tier: 3, status: 'queued', url: 'https://www.sourcewell-mn.gov/become-supplier', note: 'One award → thousands of member agencies in CA + US.' },
  { id: 'oecm', name: 'OECM', region: 'Canada · education sector', tier: 3, status: 'queued', url: 'https://oecm.ca/suppliers', note: 'Universities, colleges, school boards. Standing agreements.' },
  { id: 'tbips', name: 'TBIPS / SBIPS (PSPC supply arrangement)', region: 'Canada · Federal', tier: 3, status: 'queued', url: 'https://canadabuys.canada.ca/', note: 'Task/solutions-based informatics professional services. Security clearance may apply.' },
];

// ── 2. FREE GLOBAL MARKETING — visibility with zero ad spend ────────────────
// Every entry is free to list. Ranked by (reach × buyer-intent) ÷ effort.
const SEED_MARKETING = [
  { id: 'gbp', name: 'Google Business Profile', kind: 'Local search', url: 'https://business.google.com/', impact: 'high', note: 'Ranks IIS in Maps + local pack for "IT support near me" across every service city.' },
  { id: 'bing_places', name: 'Bing Places for Business', kind: 'Local search', url: 'https://www.bingplaces.com/', impact: 'med', note: 'Feeds Copilot and Bing AI answers — cheap incremental reach.' },
  { id: 'msft_partner', name: 'Microsoft Partner Center → Solutions Partner directory', kind: 'Vendor marketplace', url: 'https://partner.microsoft.com/', impact: 'high', note: 'Free listing in the Microsoft find-a-partner directory. Buyer intent is extremely high.' },
  { id: 'azure_mkt', name: 'Azure Marketplace — consulting service listing', kind: 'Vendor marketplace', url: 'https://azuremarketplace.microsoft.com/', impact: 'high', note: 'List a fixed-scope M365/Azure assessment as a free consulting offer. Global distribution, no fee.' },
  { id: 'aws_mkt', name: 'AWS Partner Network + Marketplace', kind: 'Vendor marketplace', url: 'https://aws.amazon.com/partners/', impact: 'med', note: 'Partner locator listing; adds credibility for cloud RFPs.' },
  { id: 'clutch', name: 'Clutch', kind: 'B2B directory', url: 'https://clutch.co/', impact: 'high', note: 'Buyers shortlist MSPs here. Verified reviews compound; free profile.' },
  { id: 'g2', name: 'G2 — service provider profile', kind: 'B2B directory', url: 'https://www.g2.com/', impact: 'med', note: 'Free vendor profile; reviews carry into AI search results.' },
  { id: 'goodfirms', name: 'GoodFirms / The Manifest / DesignRush', kind: 'B2B directory', url: 'https://www.goodfirms.co/', impact: 'med', note: 'Three free listings, one capability blurb. Backlinks + referral traffic.' },
  { id: 'cloudtango', name: 'Cloudtango — MSP directory', kind: 'MSP directory', url: 'https://www.cloudtango.net/', impact: 'med', note: 'MSP-specific, global, free. Buyers filter by country + service.' },
  { id: 'upcity', name: 'UpCity + Expertise.com', kind: 'B2B directory', url: 'https://upcity.com/', impact: 'low', note: 'Free listings; local SEO value in each metro.' },
  { id: 'linkedin', name: 'LinkedIn Company Page + Services tab', kind: 'Social', url: 'https://www.linkedin.com/company/', impact: 'high', note: 'Services tab makes IIS appear in LinkedIn service-provider search. Free and under-used.' },
  { id: 'crunchbase', name: 'Crunchbase + Owler company profiles', kind: 'Data graph', url: 'https://www.crunchbase.com/', impact: 'low', note: 'Feeds enrichment tools and AI models; makes IIS resolvable as an entity.' },
  { id: 'ised_ccc', name: 'Canadian Company Capabilities (ISED)', kind: 'Government directory', url: 'https://ised-isde.canada.ca/site/canadian-company-capabilities/en', impact: 'med', note: 'Free federal directory; Trade Commissioner Service pulls leads from it for export matchmaking.' },
  { id: 'tcs', name: 'Trade Commissioner Service (Canada)', kind: 'Government export', url: 'https://www.tradecommissioner.gc.ca/', impact: 'high', note: 'Free introductions to foreign buyers + local partners in 160 cities. This is the onsite-resource pipeline.' },
  { id: 'wikidata', name: 'Wikidata + schema.org Organization markup on iisupp.net', kind: 'AI/entity SEO', url: 'https://www.wikidata.org/', impact: 'med', note: 'Makes IIS a known entity to LLM answer engines — the new front page.' },
  { id: 'github', name: 'GitHub org — publish free IT tooling/scripts', kind: 'Developer reach', url: 'https://github.com/', impact: 'med', note: 'Open-source a few genuinely useful admin scripts. Free authority, inbound developer traffic.' },
  { id: 'youtube', name: 'YouTube + short-form: one fix, one video', kind: 'Content', url: 'https://www.youtube.com/', impact: 'med', note: 'Every support ticket resolved is a 90-second video. Evergreen inbound, zero cost.' },
  { id: 'trustpilot', name: 'Trustpilot', kind: 'Reviews', url: 'https://www.trustpilot.com/', impact: 'low', note: 'Free profile; review velocity is the cheapest conversion lift available.' },
];

// ── 3. DISCOVERY SOURCES — public machine-readable endpoints, read-only ─────
// Each source declares the ADAPTER that reads it. RSS was the obvious first guess and it was wrong:
// every one of the six government RSS URLs tried on 2026-08-06 returned 404/403 or served HTML. The
// four below were probed live and return real structured data, so the agent reads the formats these
// governments actually publish (OCDS JSON, open-data CSV, TED's v3 search API) instead of the format
// that was convenient to parse. `rss` stays in the adapter table for sources that genuinely offer it.
const SEED_SOURCES = [
  { id: 'uk_cf_ocds', name: 'UK Contracts Finder (OCDS)', region: 'United Kingdom', adapter: 'ocds', weight: 1.0,
    url: 'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?stages=tender&limit=100' },
  { id: 'uk_fts_ocds', name: 'UK Find a Tender (OCDS)', region: 'United Kingdom', adapter: 'ocds', weight: 1.0,
    noticeBase: 'https://www.find-tender.service.gov.uk/Notice/',
    url: 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100' },
  { id: 'canadabuys_csv', name: 'CanadaBuys new tender notices', region: 'Canada', adapter: 'canadabuys', weight: 1.0,
    url: 'https://canadabuys.canada.ca/opendata/pub/newTenderNotice-nouvelAvisAppelOffres.csv' },
  { id: 'eu_ted_api', name: 'EU TED — CPV 72/48 (IT services & software)', region: 'European Union', adapter: 'ted', weight: 0.9,
    url: 'https://api.ted.europa.eu/v3/notices/search' },
];

// ── Fit scoring ─────────────────────────────────────────────────────────────
// Positive vocabulary starts here and GROWS from the titles of items that survive the gate.
const BASE_POSITIVE = [
  'managed service', 'msp', 'it support', 'help desk', 'service desk', 'end user support',
  'information technology', 'ict', 'network', 'infrastructure', 'cloud', 'azure', 'microsoft 365',
  'm365', 'cyber', 'security operation', 'endpoint', 'backup', 'disaster recovery', 'migration',
  'server', 'virtualisation', 'virtualization', 'sharepoint', 'identity', 'sso', 'mdm', 'intune',
  'software', 'saas', 'application support', 'system integration', 'digital transformation',
  'data centre', 'data center', 'monitoring', 'automation', 'ai', 'artificial intelligence',
  'technical support', 'maintenance and support', 'licens', 'devops', 'web', 'database',
];
// Hard blockers: scope IIS cannot deliver even with locally hired onsite resource.
const BASE_NEGATIVE = [
  'construction', 'roofing', 'paving', 'catering', 'janitorial', 'landscap', 'demolition', 'plumbing',
  'concrete', 'asphalt', 'vehicle', 'fleet lease', 'uniform', 'furniture', 'food service', 'medical supply',
  'pharmaceutical', 'ammunition', 'firearm', 'insurance broker', 'legal counsel', 'audit of financial',
  'staffing of nurses', 'security guard', 'armed', 'cleaning',
];

// Two-tier scoring. BASE terms are hand-picked IT anchors and count as a full hit. LEARNED terms
// (grown from surviving titles) count as half a hit and can never fire on their own — an item with
// only learned-term matches scores 0. Without that rule the agent poisons itself: it learns buyer
// names and generic procurement words, those inflate scores on non-IT notices, volume goes up, and
// the ratchet misreads the flood as improvement. Anchors gate, learned terms only break ties.
function scoreItem(text, vocab) {
  const t = String(text || '').toLowerCase();
  if (vocab.negative.some(n => t.includes(n))) return 0;
  let anchors = 0;
  for (const p of vocab.positive) if (t.includes(p)) anchors += 1;
  if (!anchors) return 0;
  let soft = 0;
  for (const p of vocab.learned || []) if (t.includes(p)) soft += 0.5;
  const hits = anchors + Math.min(soft, 1.5); // learned terms add at most 3 half-hits
  // Diminishing returns: 1 hit = 0.45, 2 = 0.65, 3 = 0.78, 5 = 0.9, caps below 1.
  return Math.min(0.96, 1 - Math.pow(0.62, hits));
}

// ── Feed parsing (RSS/Atom, no dependency) ──────────────────────────────────
const strip = (s = '') => String(s)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? strip(m[1]) : '';
};
const pickLink = (block) => {
  const direct = pick(block, 'link');
  if (direct) return direct;
  const href = block.match(/<link[^>]*href="([^"]+)"/i);
  return href ? href[1] : '';
};

function parseFeed(xml) {
  const blocks = String(xml).match(/<(item|entry)[\s\S]*?<\/\1>/gi) || [];
  return blocks.map(b => ({
    title: pick(b, 'title'),
    link: pickLink(b),
    summary: pick(b, 'description') || pick(b, 'summary') || pick(b, 'content'),
    published: pick(b, 'pubDate') || pick(b, 'published') || pick(b, 'updated'),
  })).filter(x => x.title);
}

const UA = 'IIS Global Bid Research Agent/1.0 (+https://iisupp.net; public feeds only)';

async function fetchText(url, ms = 20000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: {
        'user-agent': UA,
        accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml,application/json,text/csv,text/html;q=0.8',
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

// ── Source adapters ─────────────────────────────────────────────────────────
// One function per publishing format. Each returns the same normalised shape as parseFeed():
// { title, link, summary, published }. Adding a country later means adding one adapter here and
// one row to SEED_SOURCES — nothing else in the loop changes.

async function fetchJson(url, ms = 25000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { 'user-agent': UA, accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function postJson(url, body, ms = 25000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      method: 'POST', signal: c.signal,
      headers: { 'user-agent': UA, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// OCDS (Open Contracting Data Standard) — what the UK actually publishes. A release package holds
// releases[]; each release carries tender.title / tender.description and the buyer name. Both UK
// endpoints return the same envelope, so one adapter covers Contracts Finder and Find a Tender.
function parseOcds(json, src = {}) {
  const releases = json.releases || (json.packages ? [] : []) ||[];
  const out = [];
  for (const r of releases) {
    const t = r.tender || {};
    const title = t.title || r.title || '';
    if (!title) continue;
    const buyer = (r.buyer && r.buyer.name) || (t.procuringEntity && t.procuringEntity.name) || '';
    const cls = [t.classification, ...(t.additionalClassifications || [])]
      .filter(Boolean).map(c => `${c.id || ''} ${c.description || ''}`).join(' ');
    // The real notice URL is a document, but documents[0] is often a stub with no url at all
    // (e.g. an unpublished conflictOfInterest record). Prefer the notice document that HAS a url,
    // then any document with one, and only then fall back to the source's own notice base.
    const docs = [...(t.documents || []), ...(r.documents || [])].filter(d => d && d.url);
    const notice = docs.find(d => /notice/i.test(d.documentType || '')) || docs[0];
    let link = notice ? notice.url : '';
    if (!link && (r.id || r.ocid)) {
      const base = src.noticeBase || 'https://www.contractsfinder.service.gov.uk/Notice/';
      link = base + encodeURIComponent(r.id || r.ocid);
    }
    out.push({
      title,
      link,
      summary: [t.description || '', buyer, cls].filter(Boolean).join(' · '),
      published: (t.tenderPeriod && t.tenderPeriod.endDate) || r.date || '',
    });
  }
  return out;
}

// Minimal RFC4180 CSV reader — CanadaBuys ships quoted fields containing commas and newlines,
// so a naive split(',') loses rows. Returns array-of-arrays.
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1);
}

// CanadaBuys open data. Headers are bilingual ("title-titre-eng"), so columns are matched by
// prefix rather than exact name — the suffix changes between releases and has broken parsers before.
function parseCanadaBuys(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const hdr = rows[0].map(h => h.toLowerCase().trim());
  const col = (...prefixes) => {
    for (const p of prefixes) { const i = hdr.findIndex(h => h.startsWith(p)); if (i >= 0) return i; }
    return -1;
  };
  const iTitle = col('title-titre-eng', 'title-titre', 'title');
  const iDesc = col('tendersdescription-descriptionappelsdoffres-eng', 'tendersdescription', 'description');
  const iUrl = col('noticeurl-urlavis-eng', 'noticeurl', 'tenderurl');
  const iClose = col('tenderclosingdate-appeldoffresdatecloture', 'tenderclosingdate', 'closingdate');
  const iEntity = col('contractingentityname-nomentitecontractante-eng', 'contractingentityname', 'endusername');
  const iUnspsc = col('unspsc', 'gsin');
  if (iTitle < 0) return [];
  return rows.slice(1).filter(r => r[iTitle]).map(r => ({
    title: r[iTitle],
    link: iUrl >= 0 ? r[iUrl] : 'https://canadabuys.canada.ca/en/tender-opportunities',
    summary: [iDesc >= 0 ? r[iDesc] : '', iEntity >= 0 ? r[iEntity] : '', iUnspsc >= 0 ? r[iUnspsc] : '']
      .filter(Boolean).join(' · ').slice(0, 600),
    published: iClose >= 0 ? r[iClose] : '',
  }));
}

// EU TED v3 — POST-only search API. The query filters to IT services (CPV 72*) and software
// (CPV 48*) at the source so the agent is not scoring thousands of road-resurfacing notices.
async function fetchTed(url) {
  const json = await postJson(url, {
    query: 'classification-cpv IN (72000000 48000000)',
    fields: ['publication-number', 'notice-title', 'buyer-name', 'deadline-receipt-request', 'links'],
    limit: 100, page: 1, scope: 'ACTIVE',
  });
  const notices = json.notices || json.results || [];
  const text = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(text).filter(Boolean).join(' ');
    if (typeof v === 'object') return text(v.eng || v.ENG || Object.values(v)[0]);
    return String(v);
  };
  return notices.map(n => {
    const num = text(n['publication-number']);
    return {
      title: text(n['notice-title']),
      link: num ? `https://ted.europa.eu/en/notice/-/detail/${num}` : 'https://ted.europa.eu/',
      summary: text(n['buyer-name']),
      published: text(n['deadline-receipt-request']),
    };
  }).filter(x => x.title);
}

// Dispatch. An unknown adapter falls back to RSS rather than throwing, so a half-added source
// degrades to "zero items" instead of killing the whole cycle.
async function loadSource(src) {
  switch (src.adapter) {
    case 'ocds': return parseOcds(await fetchJson(src.url), src);
    case 'canadabuys': return parseCanadaBuys(await fetchText(src.url, 45000));
    case 'ted': return await fetchTed(src.url);
    case 'json': return parseOcds(await fetchJson(src.url), src);
    default: return parseFeed(await fetchText(src.url));
  }
}

// ── Persistence helpers ─────────────────────────────────────────────────────
const readJson = async (f, fb) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return fb; } };
const writeJson = (f, v) => writeFile(f, JSON.stringify(v, null, 2) + '\n');
const idOf = (s) => String(s).toLowerCase().replace(/https?:\/\//g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150);

// ── THE RATCHET ─────────────────────────────────────────────────────────────
// The self-improvement loop. Each cycle is graded against the standing bar and the bar only ever
// goes up. Three levers move automatically:
//   • threshold  — the minimum fit score an item must clear to reach Ahmad. Rises when precision is
//                  high (we can afford to be pickier), never falls below the standing floor.
//   • weights    — per-source multipliers. A source that keeps producing survivors gains weight; a
//                  source that produces nothing for 3 consecutive cycles is muted, not deleted.
//   • vocabulary — winning titles donate their distinctive terms back into the positive list, so the
//                  agent recognises next month's phrasing of this month's win.
function rungCycle(prev, run) {
  const bar = prev.bar || { threshold: 0.45, floor: 0.45, bestYield: 0, bestPrecision: 0, cycle: 0 };
  const yieldNow = run.kept;
  const precision = run.scanned ? run.kept / run.scanned : 0;

  const beatYield = yieldNow > bar.bestYield;
  const beatPrecision = precision > bar.bestPrecision;
  let threshold = bar.threshold;
  const learned = [];

  if (precision > 0.35 && yieldNow >= 8) {
    threshold = Math.min(0.8, +(threshold + 0.03).toFixed(3));
    learned.push(`Precision ${(precision * 100).toFixed(0)}% at volume — raised fit threshold to ${threshold}.`);
  } else if (yieldNow < 3 && threshold > bar.floor) {
    threshold = Math.max(bar.floor, +(threshold - 0.02).toFixed(3));
    learned.push(`Thin yield (${yieldNow}) — eased threshold to ${threshold} but held the ${bar.floor} floor.`);
  } else {
    learned.push(`Held threshold at ${threshold}: ${yieldNow} kept from ${run.scanned} scanned.`);
  }

  for (const s of run.perSource) {
    if (s.kept > 0) { s.weight = Math.min(1.5, +(s.weight + 0.05).toFixed(2)); s.dry = 0; }
    else { s.dry = (s.dry || 0) + 1; if (s.dry >= 3) { s.weight = Math.max(0.2, +(s.weight - 0.15).toFixed(2)); learned.push(`Muted ${s.name}: 3 dry cycles, weight → ${s.weight}.`); } }
  }

  const verdict = beatYield || beatPrecision ? 'improved' : 'regression';
  if (verdict === 'regression') {
    learned.push(`Did not beat the standing bar (best yield ${bar.bestYield}, best precision ${(bar.bestPrecision * 100).toFixed(0)}%). Next cycle starts by widening source coverage, not by lowering the bar.`);
  }

  return {
    bar: {
      threshold,
      floor: bar.floor,
      bestYield: Math.max(bar.bestYield, yieldNow),
      bestPrecision: Math.max(bar.bestPrecision, precision),
      cycle: bar.cycle + 1,
    },
    entry: { at: nowIso(), cycle: bar.cycle + 1, scanned: run.scanned, kept: yieldNow, precision: +precision.toFixed(3), threshold, verdict, learned },
  };
}

// Vocabulary growth — deliberately hard to pass. Cycle 1 of the naive version learned "royal",
// "marsden", "council", "temporary" and "preferred" inside two cycles; every one of those is a buyer
// name or boilerplate that would have dragged in non-IT work forever. Four gates now apply:
//   1. only titles that already scored ≥0.6 on ANCHORS alone can teach (confident IT, not marginal);
//   2. the term must appear in ≥2 different sources (buyer names cluster in one country's feed);
//   3. it needs 4 sightings, not 3;
//   4. total learned vocabulary is capped, and learned terms are only ever half-weight (scoreItem).
const STOP = new Set(('the and for of to in a an with on at by from services service provision supply '
  + 'request proposal tender notice contract contracts framework agreement rfp rfi rfq itt new open call '
  + 'north south east west city county council borough district region regional national trust royal '
  + 'school college university hospital authority department ministry office limited group holdings '
  + 'temporary interim preferred supplier suppliers listing status existing various annual multiple '
  + 'provider providers works package packages lot lots stage phase project projects programme programmes '
  + 'january february march april june july august september october november december').split(/\s+/));
const LEARNED_CAP = 40;
function growVocabulary(vocab, kept) {
  vocab.learned = vocab.learned || [];
  const added = [];
  for (const it of kept) {
    if ((it.anchorScore || 0) < 0.6) continue; // gate 1
    for (const w of String(it.title).toLowerCase().match(/[a-z][a-z0-9-]{4,}/g) || []) {
      if (STOP.has(w) || vocab.positive.includes(w) || vocab.learned.includes(w) || added.includes(w)) continue;
      const c = vocab.candidates[w] || { n: 0, sources: [] };
      c.n += 1;
      if (it.source && !c.sources.includes(it.source)) c.sources.push(it.source);
      vocab.candidates[w] = c;
      if (c.n >= 4 && c.sources.length >= 2 && vocab.learned.length + added.length < LEARNED_CAP) { // gates 2–4
        vocab.learned.push(w); added.push(w);
      }
    }
  }
  return added;
}

// ── Panel export ────────────────────────────────────────────────────────────
// Shape mirrors the PROCUREMENT object in assets/axis-app.js so the Global panel renders with the
// exact same procRow()/KPI treatment as the Procurement panel.
function buildPanel(registry, opps, marketing, cycles) {
  const reg = registry.portals;
  const registered = reg.filter(p => p.status === 'registered');
  const gated = reg.filter(p => p.status === 'gated');
  const queued = reg.filter(p => p.status === 'queued' || p.status === 'in_progress');
  const live = opps.items.filter(i => i.status !== 'closed').sort((a, b) => (b.score || 0) - (a.score || 0));
  const last = cycles.entries[cycles.entries.length - 1] || {};
  return {
    updated: today(),
    cycle: last.cycle || 0,
    verdict: last.verdict || 'seeded',
    counts: {
      countries: new Set(reg.map(p => p.region.split('·')[0].trim())).size,
      portals: reg.length,
      registered: registered.length,
      queued: queued.length,
      gated: gated.length,
      opportunities: live.length,
      channels: marketing.channels.length,
    },
    attention: gated.map(p => ({ tag: 'GATE', title: p.name, meta: p.gate, href: p.url, cta: 'Finish it →' })),
    queue: queued.map(p => ({ tag: 'T' + p.tier, title: p.name, meta: `${p.region} · ${p.note}`, href: p.url, cta: 'Register →' })),
    registered: registered.map(p => ({ tag: 'LIVE', title: p.name, meta: `${p.region} · ${p.note}`, href: p.url, cta: 'Account →' })),
    opportunities: live.slice(0, 25).map(i => ({ code: i.region, title: i.title, meta: i.source, href: i.link, cta: 'Open notice →' })),
    marketing: marketing.channels.map(m => ({ tag: m.impact.toUpperCase(), title: m.name, meta: `${m.kind} · ${m.note}`, href: m.url, cta: 'List us →' })),
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const offline = process.argv.includes('--offline') || process.env.IIS_AGENT_OFFLINE === '1';
  await mkdir(engineDir, { recursive: true });

  const registry = await readJson(P.registry, null) || { version: 1, updated: nowIso(), company: COMPANY, portals: SEED_PORTALS };
  // Merge new seed portals into an existing registry without clobbering hand-set statuses.
  const known = new Set(registry.portals.map(p => p.id));
  for (const p of SEED_PORTALS) if (!known.has(p.id)) registry.portals.push(p);
  registry.company = COMPANY;

  const marketing = await readJson(P.marketing, null) || { version: 1, channels: SEED_MARKETING };
  const knownCh = new Set(marketing.channels.map(c => c.id));
  for (const c of SEED_MARKETING) if (!knownCh.has(c.id)) marketing.channels.push(c);

  const opps = await readJson(P.opps, null) || { version: 1, updated: nowIso(), items: [] };
  const cycles = await readJson(P.cycles, null) || {
    version: 1, entries: [],
    bar: { threshold: 0.45, floor: 0.45, bestYield: 0, bestPrecision: 0, cycle: 0 },
    vocab: { positive: [...BASE_POSITIVE], negative: [...BASE_NEGATIVE], learned: [], candidates: {} },
    sources: SEED_SOURCES.map(s => ({ ...s, dry: 0 })),
  };
  const knownSrc = new Set(cycles.sources.map(s => s.id));
  for (const s of SEED_SOURCES) if (!knownSrc.has(s.id)) cycles.sources.push({ ...s, dry: 0 });

  const vocab = cycles.vocab;
  // Migration: earlier cycles stored candidates as bare counts and merged learned terms straight into
  // `positive`. Both are unsafe under the new gating, so any pre-gate state is rebuilt from the base.
  if (!Array.isArray(vocab.learned)) vocab.learned = [];
  const firstCand = Object.values(vocab.candidates || {})[0];
  if (typeof firstCand === 'number') {
    vocab.candidates = {};
    vocab.positive = [...BASE_POSITIVE];
    vocab.learned = [];
  }
  const threshold = cycles.bar.threshold;
  let scanned = 0;
  const kept = [];
  const errors = [];
  const perSource = [];

  for (const src of cycles.sources) {
    const rec = { ...src, kept: 0 };
    if (offline) { perSource.push(rec); continue; }
    try {
      const items = await loadSource(src);
      scanned += items.length;
      for (const it of items) {
        const blob = `${it.title} ${it.summary}`;
        const raw = scoreItem(blob, vocab);
        const score = +(raw * (src.weight || 1)).toFixed(3);
        if (score < threshold) continue;
        // Anchor-only score decides whether this item is allowed to teach the vocabulary.
        const anchorScore = scoreItem(blob, { positive: vocab.positive, negative: vocab.negative, learned: [] });
        kept.push({
          id: idOf(`${src.id}|${it.title}`), title: it.title, link: it.link, anchorScore,
          source: src.name, region: src.region, score,
          published: it.published || '', firstSeen: nowIso(), status: 'open',
        });
        rec.kept += 1;
      }
    } catch (e) {
      errors.push({ source: src.name, error: e.message });
    }
    perSource.push(rec);
  }

  // Merge — first-seen wins, score refreshes.
  const byId = new Map((opps.items || []).map(i => [i.id, i]));
  let fresh = 0;
  for (const k of kept) {
    if (byId.has(k.id)) { const e = byId.get(k.id); e.score = k.score; e.lastSeen = nowIso(); }
    else { byId.set(k.id, { ...k, lastSeen: nowIso() }); fresh += 1; }
  }
  opps.items = [...byId.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
  opps.updated = nowIso();

  const grown = growVocabulary(vocab, kept);
  const { bar, entry } = rungCycle(cycles, { scanned, kept: kept.length, perSource });
  if (grown.length) entry.learned.push(`Vocabulary grew by ${grown.length} term(s): ${grown.slice(0, 8).join(', ')}.`);
  cycles.bar = bar;
  cycles.sources = perSource.map(({ kept: _k, ...s }) => s);
  cycles.entries = [...cycles.entries, entry].slice(-200);
  registry.updated = nowIso();

  const panel = buildPanel(registry, opps, marketing, cycles);

  await writeJson(P.registry, registry);
  await writeJson(P.marketing, marketing);
  await writeJson(P.opps, opps);
  await writeJson(P.cycles, cycles);
  await writeJson(P.panel, panel);

  const gatedNames = registry.portals.filter(p => p.status === 'gated').map(p => p.name);
  await publishAgentReport({
    agentId: 'global-bid-research-agent',
    label: 'Global Bid, Contract & Whitelisting Agent',
    status: entry.verdict === 'regression' ? 'attention' : 'ready',
    summary: `Cycle ${entry.cycle}: scanned ${scanned} global notices, kept ${kept.length} (${fresh} new) at threshold ${entry.threshold}. `
      + `${panel.counts.registered} portals live, ${panel.counts.queued} queued, ${panel.counts.gated} waiting on Ahmad across ${panel.counts.countries} regions.`,
    metrics: { cycle: entry.cycle, scanned, kept: kept.length, fresh, threshold: entry.threshold, precision: entry.precision, ...panel.counts, feedErrors: errors.length },
    artifacts: Object.values(P),
    nextActions: [
      gatedNames.length ? `Finish the gated registrations: ${gatedNames.join('; ')}.` : null,
      panel.counts.queued ? `Drive ${panel.counts.queued} queued portal registration(s) to their final gate.` : null,
      fresh ? `Review ${fresh} newly discovered global opportunity/opportunities in the AXIS Global panel.` : null,
      errors.length ? `Re-check ${errors.length} feed(s) that errored: ${errors.map(e => e.source).join(', ')}.` : null,
      'Publish one free-channel listing from the marketing queue (highest impact first).',
    ].filter(Boolean),
    focusAreas: ['global-tender-discovery', 'worldwide-whitelisting', 'zero-cost-visibility', 'self-improving-bar'],
    metadata: { verdict: entry.verdict, learned: entry.learned },
  });

  console.log(JSON.stringify({ ok: true, cycle: entry.cycle, verdict: entry.verdict, scanned, kept: kept.length, fresh, threshold: entry.threshold, counts: panel.counts, learned: entry.learned, errors }, null, 2));
}

// Only run when invoked directly. Importing this file (for tests or from another agent) must not
// fire a live cycle — an accidental import once burned a real cycle and polluted the ratchet state.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main().catch((e) => { console.error(e); process.exitCode = 1; });

export { main, scoreItem, growVocabulary, parseOcds, parseCanadaBuys, parseCsv, loadSource };
