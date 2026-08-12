// axis-app.js — AXIS Command Center v2 shell. Vanilla ESM, no framework/bundler.
// Auth gate → poll /api/axis/snapshot → render modules. The page holds NO prospect data; everything comes
// from the authed endpoint. Writes go through /api/axis/intent (optimistic UI; the worker executes behind
// rails — the client NEVER sends/approves/pays). Laws enforced here: Badge Law (2) + side-effects (4).
import { SNAPSHOT_MODULES } from './axis-constants.js';
// Shared primitives now live in axis-dom.js so the sibling screen modules (composer, charts, fleet,
// reports, director) use the SAME el()/toast()/postIntent() rather than each carrying a copy that
// could drift. initDom() below injects the auth/logout closures they cannot see from here.
import { $, el, fmtMoney, ago, toast, postIntent, head, downloadText, initDom } from './axis-dom.js';
import { barChart, funnelChart } from './axis-charts.js';
import { openComposer } from './axis-composer.js';
import { renderFleet } from './axis-fleet.js';
import { renderReports } from './axis-reports.js';
import { renderDirector } from './axis-director-screen.js';
import { renderPriorities, collectPriorities, dueLabel, localAnswer } from './axis-priorities.js';
import { mountGlobes } from './axis-globe.js';
import { toggleHologram } from './axis-hologram.js';
// AXIS persona + turn grammar (the JARVIS flow). Additive: the voice machinery below is unchanged;
// this only decides who AXIS sounds like and how a spoken turn is shaped.
import { axisPersonaBonus, AXIS_PROSODY, ackLine, greetLine, routeTail,
  isWake, isStop, isConfirm, isDeny, stripWake,
  voiceProfile, voiceFamily, polishForSpeech, phraseChunks,
  splitForTurns, isContinue, isReferential, detectOp } from './axis-persona.js';

const TOKEN_KEY = 'aperture_jwt';

const ACTIONABLE = ['reply_to_outreach', 'new_inbound_request'];
const state = { token: localStorage.getItem(TOKEN_KEY) || '', snap: {}, version: null, module: 'overview', programStatus: null,
  ui: { inboxFilter: 'all', thread: null, apTab: 'pending', apOpen: null, apSel: new Set(), apCursor: 0, crmTab: 'contact', crmFilter: '', crmDrawer: null,
    prospect: null, prospectFilter: '', realOnly: false, pipeView: 'kanban', fuView: 'due_today', doc: null, anTab: 'research' } };
const authHeaders = (extra = {}) => ({ Authorization: 'Bearer ' + state.token, ...extra });
const data = (mod) => (state.snap[mod] && state.snap[mod].data) || {};

// Hand axis-dom.js the two things it cannot reach from a module of its own: how to sign a request,
// and what to do when the session has expired. Everything downstream of here shares one write path.
initDom({ authHeaders, onUnauthorized: () => logout() });

// ── Nav ──
const NAV = [
  { group: 'Sales', items: [
    { id: 'overview', label: 'Overview', glyph: 'OV' }, { id: 'inbox', label: 'Action Inbox', glyph: 'IN' },
    { id: 'pipeline', label: 'Pipeline', glyph: 'PL' }, { id: 'crm', label: 'CRM', glyph: 'CR' },
    { id: 'prospects', label: 'Prospects', glyph: 'PR' }, { id: 'outreach', label: 'Outreach Studio', glyph: 'OS' },
    { id: 'approvals', label: 'Approvals', glyph: 'AP' }, { id: 'waiting_reply', label: 'Waiting Reply', glyph: 'WR' },
    { id: 'followups', label: 'Follow-ups', glyph: 'FU' },
  ] },
  { group: 'Workspace', items: [
    { id: 'priorities', label: 'Priorities', glyph: 'PY' },
    { id: 'documents', label: 'Documents', glyph: 'DO' }, { id: 'analytics', label: 'Analytics', glyph: 'AN' },
    { id: 'products', label: 'Product Discovery', glyph: 'PD' },
  ] },
  { group: 'System', items: [
    { id: 'fleet', label: 'Fleet', glyph: 'FL' }, { id: 'axis-agent-director', label: 'AXIS Agent Director', glyph: 'AX' },
    { id: 'reports', label: 'Reports', glyph: 'RE' }, { id: 'settings', label: 'Settings', glyph: 'SE' },
  ] },
];
const navItem = (id) => NAV.flatMap(g => g.items).find(i => i.id === id);

// Badge Law (2): red inbox badge ONLY when open actionable > 0; approvals neutral when pending > 0. No others.
function inboxBadgeCount() { const rows = (data('inbox').rows) || []; return rows.filter(m => ACTIONABLE.includes(m.classification) && !m.actioned && !m.snoozed_until).length; }
function approvalsPending() { const rows = (data('approvals').rows) || []; return rows.filter(r => r.status === 'pending').length; }
function waitingReplyCount() { return (data('waiting_reply').count) || 0; }

function renderNav() {
  const nav = $('nav'); nav.innerHTML = '';
  const ib = inboxBadgeCount(), ap = approvalsPending(), wr = waitingReplyCount(), wrd = (data('waiting_reply').needs_delegation) || 0;
  for (const grp of NAV) {
    nav.append(el('div', { class: 'nav-group' }, grp.group));
    for (const it of grp.items) {
      const kids = [el('span', { class: 'nav-glyph' }, it.glyph), el('span', { class: 'nav-label' }, it.label)];
      if (it.id === 'inbox' && ib > 0) kids.push(el('span', { class: 'badge badge-red' }, ib));
      if (it.id === 'approvals' && ap > 0) kids.push(el('span', { class: 'badge badge-neutral' }, ap));
      if (it.id === 'waiting_reply' && wr > 0) kids.push(el('span', { class: 'badge ' + (wrd > 0 ? 'badge-red' : 'badge-neutral') }, wr));
      nav.append(el('button', { class: 'nav-item', 'aria-current': state.module === it.id ? 'true' : 'false',
        onclick: () => go(it.id) }, kids));
    }
  }
}
function go(mod) { state.module = mod; state.ui.thread = null; state.ui.crmDrawer = null; renderNav(); renderModule(); }

// The Director tab IS the command channel — it carries its own orb, transcript, mic and input. Leaving
// the floating dock up there puts two AXIS inputs on one screen, and the dock physically covers the
// tab's own composer. Hide the dock (and its fab) on that tab only; restore whatever the operator had
// when they leave, so closing the dock elsewhere still sticks.
let dockHiddenForDirector = false;
function syncDockVisibility() {
  const onDirector = state.module === 'axis-agent-director';
  const dock = $('axisDock'), fab = $('axisFab');
  if (!dock || !fab) return;
  if (onDirector) {
    if (!dockHiddenForDirector) { dockHiddenForDirector = !dock.hidden; dock.hidden = true; }
    fab.hidden = true;
  } else if (dockHiddenForDirector) {
    dockHiddenForDirector = false; dock.hidden = false; fab.hidden = true; renderDock();
  } else if (dock.hidden) {
    fab.hidden = false;
  }
}

// ── Screens ──
const SCREENS = {};

// ── Procurement & Whitelisting (Overview panel) ─────────────────────────────
// Self-contained live status of bids/contracts + portal whitelisting so the Overview tab shows,
// at a glance, what is filed and what needs Ahmad. Every row is a real link: attention items go to
// where the action is completed; expressed-interest items go to the portal where the response is
// filed; whitelisting rows go to the account. Data is embedded (last swept 2026-08-05) so it renders
// even when the backend snapshot has no bids feed. Update the arrays below as status changes.
const PROC_LINKS = {
  bt: 'https://richmondhill.bidsandtenders.ca/Module/Tenders/en/Vendor/Dashboard/21a1fe27-61f3-4ebb-8993-b9f5ce962704',
  ontario: 'https://ontariotenders.app.jaggaer.com/',
  toronto: 'https://www.toronto.ca/business-economy/doing-business-with-the-city/searching-bidding-on-city-contracts/how-to-register-as-a-supplier-with-the-city/',
  carleton: 'https://carleton.bonfirehub.ca/opportunities/108232',
  richmondhill: 'https://richmondhill.bidsandtenders.ca/Module/Tenders/en/Tender/Register/ef2d40c6-4e55-4ea6-bb44-536f15e0c358',
  insurance: 'https://www.zensurance.com/',
};
const PROC_C = { green: '#39c07a', blue: '#4d9fe8', red: '#e8615f', dim: '#8ea0b5' };
const PROCUREMENT = {
  updated: '2026-08-05',
  attention: [
    { tag: 'ACT', title: 'Get a broker insurance quote', meta: 'Zensurance / APOLLO / TruShield — unblocks submission on all 10 opportunities below', cta: 'Start quote →', href: PROC_LINKS.insurance },
    { tag: 'SIGN', title: 'Carleton RFSQ 2026-P-04 (MSP)', meta: 'Package ready · needs your signature + 1 reference project + upload 7 PDFs · closes Sep 8', due: 'Sep 8', cta: 'Open Bonfire →', href: PROC_LINKS.carleton },
    { tag: 'PAY', title: 'Richmond Hill RFRC-2610203 — IT Staffing', meta: 'bids&tenders paywall · plan or Pay-Per-Bid (~$130) needed to register/submit', cta: 'Open bid →', href: PROC_LINKS.richmondhill },
  ],
  whitelisted: [
    { title: 'bids&tenders — ALL agencies', meta: 'IT + IT Consulting categories, every agency on. ~90% of Ontario municipalities auto-email IT bids.', cta: 'Account →', href: PROC_LINKS.bt },
    { title: 'Ontario Tenders (Jaggaer)', meta: 'Profile fixed · 36 commodity codes · province + universities/colleges/school boards · alerts live.', cta: 'Portal →', href: PROC_LINKS.ontario },
    { title: 'City of Toronto (SAP Ariba)', meta: 'Supplier registration submitted · Category 8116 IT Service Delivery.', cta: 'Details →', href: PROC_LINKS.toronto },
  ],
  interest: [
    { code: 'rfx_20313', title: 'Emergency Notification Solution', meta: 'Ontario Health · SaaS / cloud / mass-comm', due: 'Sep 8' },
    { code: 'rfx_20318', title: 'OPP Dictation & Transcription Software', meta: '$850K · business / system-management software', due: 'Aug 26' },
    { code: 'rfx_19733', title: 'Primary Care Medical Records (PCMR) — Stream 1', meta: 'EMR digital-transformation multi-lot', due: 'Aug 27' },
    { code: 'rfx_19657', title: 'OSAP Remediation of Legacy Applications', meta: 'Dev / software engineering / MIS', due: 'Aug 31' },
    { code: 'rfx_20285', title: 'SAS Language Application (3 yr)', meta: 'COTS enterprise software license', due: 'Aug 7', soon: true },
    { code: 'rfi_1991', title: 'Continuity & Emergency Management System (CEMS)', meta: 'RFI · full software/cloud category set', due: 'Aug 9' },
    { code: 'rfi_1996', title: 'Contract Lifecycle & Vendor Management Solution', meta: 'RFI · ERP / enterprise software', due: 'Aug 14' },
    { code: 'rfi_1992', title: 'Human Capital Management (HCM) Cloud Solution', meta: 'RFI · cloud / HR software', due: 'Aug 14' },
    { code: 'rfi_1997', title: 'Automated Redaction Software', meta: 'RFI · dev / cloud software (PII/PHI)', due: 'Aug 25' },
    { code: 'rfi_2000', title: 'Historical Medical Records Digitization / Repository', meta: 'RFI · MIS / data services / cloud · EMR integration', due: 'Aug 7', soon: true },
  ],
};
function procRow(item, color) {
  const kids = [
    el('span', { class: 'stage-tag', style: `border:1px solid ${color};color:${color};background:transparent` }, item.tag || item.code || '•'),
    el('div', { style: 'flex:1;min-width:0' }, [
      el('div', { style: 'font-weight:600' }, item.title),
      item.meta ? el('div', { class: 'eyebrow', style: 'margin-top:2px;white-space:normal' }, item.meta) : null,
    ]),
  ];
  if (item.due) kids.push(el('span', { class: 'mono', style: `font-size:11px;margin-right:8px;color:${item.soon ? PROC_C.red : PROC_C.dim}` }, 'closes ' + item.due));
  kids.push(el('span', { class: 'chip' }, item.cta || 'View in portal →'));
  return el('a', { class: 'row', href: item.href || PROC_LINKS.ontario, target: '_blank', rel: 'noopener',
    style: `text-decoration:none;color:inherit;cursor:pointer;border-left:3px solid ${color}` }, kids);
}
function procurementSection() {
  const p = PROCUREMENT;
  const wrap = el('div', {});
  wrap.append(head('Procurement & Whitelisting', 'live bid + contract status · ' + p.updated, 'margin-top:26px'));
  const kpis = [
    ['Portals whitelisted', p.whitelisted.length, PROC_C.green],
    ['Interest expressed', p.interest.length, PROC_C.blue],
    ['Needs you now', p.attention.length, PROC_C.red],
    ['ON commodity codes', 36, PROC_C.dim],
  ];
  wrap.append(el('div', { class: 'kpi-grid' }, kpis.map(([l, v, col]) =>
    el('div', { class: 'kpi' }, [el('div', { class: 'value', style: 'color:' + col }, v), el('div', { class: 'label' }, l)]))));

  wrap.append(head('Needs you now', 'click to go complete it', 'margin-top:20px'));
  const a = el('div', { class: 'card', style: 'padding:0' });
  p.attention.forEach(it => a.append(procRow(it, PROC_C.red)));
  wrap.append(a);

  wrap.append(head('Expressed interest', 'response & submit pending you · opens the portal', 'margin-top:20px'));
  const i = el('div', { class: 'card', style: 'padding:0' });
  p.interest.forEach(it => i.append(procRow({ ...it, href: PROC_LINKS.ontario }, PROC_C.blue)));
  wrap.append(i);

  wrap.append(head('Whitelisting — live', 'auto-alerts active', 'margin-top:20px'));
  const w = el('div', { class: 'card', style: 'padding:0' });
  p.whitelisted.forEach(it => w.append(procRow(it, PROC_C.green)));
  wrap.append(w);
  return wrap;
}

const GLOBAL_C = { gold: '#d4af37', amber: '#e0a33e' };
const GLOBAL = {
  "updated": "2026-08-06",
  "cycle": 3,
  "counts": {
    "countries": 13,
    "portals": 34,
    "registered": 4,
    "queued": 27,
    "gated": 3,
    "opportunities": 106,
    "channels": 18
  },
  "attention": [
    {
      "tag": "GATE",
      "title": "BC Bid",
      "meta": "Business BCeID must be created first (account + password = Ahmad).",
      "href": "https://www.bcbid.gov.bc.ca/",
      "cta": "Finish it →"
    },
    {
      "tag": "GATE",
      "title": "UNGM — UN Global Marketplace ★",
      "meta": "Form filled to the final step. Password + Register button = Ahmad.",
      "href": "https://www.ungm.org/Account/Registration/Company",
      "cta": "Finish it →"
    },
    {
      "tag": "GATE",
      "title": "USA — SAM.gov (Federal)",
      "meta": "Foreign entity needs a UEI + NCAGE code before registration completes.",
      "href": "https://sam.gov/",
      "cta": "Finish it →"
    }
  ],
  "queue": [
    {
      "tag": "T1",
      "title": "CanadaBuys (Government of Canada)",
      "meta": "Canada · Federal · All federal departments. Supplier account + GSIN D302/D399 alerts.",
      "href": "https://canadabuys.canada.ca/en/registration",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "Alberta Purchasing Connection",
      "meta": "Canada · Alberta · Province + AB municipalities and health.",
      "href": "https://purchasing.alberta.ca/",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "SaskTenders",
      "meta": "Canada · Saskatchewan · Province, health authority, Crown corps.",
      "href": "https://sasktenders.ca/",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "MERX (Manitoba + national private)",
      "meta": "Canada · Manitoba · Manitoba public sector plus a wide national feed.",
      "href": "https://www.merx.com/",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "SEAO — Système électronique d’appels d’offres",
      "meta": "Canada · Québec · All Québec public bodies. French UI; bilingual response needed.",
      "href": "https://www.seao.ca/",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "Nova Scotia Tenders",
      "meta": "Canada · Nova Scotia · Province + NS municipalities; Invest NS already runs on Bonfire.",
      "href": "https://novascotia.ca/tenders/",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "New Brunswick Opportunities Network (NBON)",
      "meta": "Canada · New Brunswick · Province + NB public bodies.",
      "href": "https://nbon-rpanb.gnb.ca/",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "PEI Tenders",
      "meta": "Canada · Prince Edward Island · Small volume, low competition.",
      "href": "https://www.princeedwardisland.ca/en/topic/tenders",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "Newfoundland & Labrador Procurement (PPA)",
      "meta": "Canada · NL · Province + regional health.",
      "href": "https://www.gov.nl.ca/ppa/",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "CivicInfo BC — municipal bids",
      "meta": "Canada · BC municipal · Aggregates BC city/regional-district postings.",
      "href": "https://www.civicinfo.bc.ca/bids",
      "cta": "Register →"
    },
    {
      "tag": "T1",
      "title": "Biddingo",
      "meta": "Canada · MASH sector · Municipal, academic, school, hospital buyers across Canada.",
      "href": "https://www.biddingo.com/",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "UNDP Quantum Supplier Portal",
      "meta": "Global · UNDP · UNDP country offices in 170 countries. Profile + UNSPSC categories.",
      "href": "https://www.undp.org/procurement/business",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "UNDP Procurement Notices",
      "meta": "Global · UNDP · Open notice feed; feeds discovery even before the portal account exists.",
      "href": "https://procurement-notices.undp.org/",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "World Bank — WBGeProcure / corporate consulting",
      "meta": "Global · MDB · Corporate + operational consulting. Foreign suppliers eligible.",
      "href": "https://wbnpf.procurementinet.org/login",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "UNOPS eSourcing",
      "meta": "Global · UNOPS · Infrastructure/IT delivery arm of the UN; links to UNGM identity.",
      "href": "https://esourcing.unops.org/",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "UK — Find a Tender Service",
      "meta": "United Kingdom · Above-threshold UK public contracts. Overseas suppliers may bid.",
      "href": "https://www.find-tender.service.gov.uk/",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "UK — Contracts Finder",
      "meta": "United Kingdom · Below-threshold + subcontract opportunities. Free account.",
      "href": "https://www.contractsfinder.service.gov.uk/",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "EU — TED (Tenders Electronic Daily)",
      "meta": "European Union · 700k+ notices/yr across 27 member states. Free alerts; each award runs on the member state’s own e-tendering system.",
      "href": "https://ted.europa.eu/en/",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "Ireland — eTenders (EU-Supply)",
      "meta": "Ireland · English-language EU entry point. Free supplier registration.",
      "href": "https://irl.eu-supply.com/ctm/company/companyregistration/registercompany",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "Australia — AusTender",
      "meta": "Australia · Commonwealth entities. Remote-deliverable ICT services eligible.",
      "href": "https://www.tenders.gov.au/",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "New Zealand — GETS",
      "meta": "New Zealand · All NZ government tenders. Free supplier account, open to overseas suppliers.",
      "href": "https://www.gets.govt.nz/",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "Singapore — GeBIZ",
      "meta": "Singapore · GeBIZ Trading Partner registration; foreign suppliers accepted.",
      "href": "https://www.gebiz.gov.sg/ptn/gtpregistration/signup.xhtml",
      "cta": "Register →"
    },
    {
      "tag": "T2",
      "title": "South Africa — eTender Portal",
      "meta": "South Africa · National + provincial. CSD supplier number needed for award.",
      "href": "https://www.etenders.gov.za/",
      "cta": "Register →"
    },
    {
      "tag": "T3",
      "title": "India — GeM (Government e-Marketplace)",
      "meta": "India · Largely restricted to Indian-registered sellers; revisit only with a local partner.",
      "href": "https://gem.gov.in/",
      "cta": "Register →"
    },
    {
      "tag": "T3",
      "title": "Sourcewell",
      "meta": "Canada + USA co-op · One award → thousands of member agencies in CA + US.",
      "href": "https://www.sourcewell-mn.gov/become-supplier",
      "cta": "Register →"
    },
    {
      "tag": "T3",
      "title": "OECM",
      "meta": "Canada · education sector · Universities, colleges, school boards. Standing agreements.",
      "href": "https://oecm.ca/suppliers",
      "cta": "Register →"
    },
    {
      "tag": "T3",
      "title": "TBIPS / SBIPS (PSPC supply arrangement)",
      "meta": "Canada · Federal · Task/solutions-based informatics professional services. Security clearance may apply.",
      "href": "https://canadabuys.canada.ca/",
      "cta": "Register →"
    }
  ],
  "registered": [
    {
      "tag": "LIVE",
      "title": "Ontario Tenders Portal (Jaggaer)",
      "meta": "Canada · Ontario · 36 commodity codes live. Province + universities, colleges, school boards.",
      "href": "https://ontariotenders.app.jaggaer.com/",
      "cta": "Account →"
    },
    {
      "tag": "LIVE",
      "title": "bids&tenders (Sovra) — ALL agencies",
      "meta": "Canada · Ontario municipal · ~90% of Ontario municipalities. IT + IT Consulting on, every agency notified.",
      "href": "https://richmondhill.bidsandtenders.ca/Module/Tenders/en/Vendor/Dashboard/21a1fe27-61f3-4ebb-8993-b9f5ce962704",
      "cta": "Account →"
    },
    {
      "tag": "LIVE",
      "title": "City of Toronto (SAP Ariba)",
      "meta": "Canada · Toronto · Supplier registration submitted · Category 8116 IT Service Delivery.",
      "href": "https://www.toronto.ca/business-economy/doing-business-with-the-city/searching-bidding-on-city-contracts/how-to-register-as-a-supplier-with-the-city/",
      "cta": "Account →"
    },
    {
      "tag": "LIVE",
      "title": "Bonfire / Euna (multi-buyer)",
      "meta": "Canada + USA · Account live; used for Carleton RFSQ 2026-P-04.",
      "href": "https://gobonfire.com/",
      "cta": "Account →"
    }
  ],
  "opportunities": [
    {
      "code": "United Kingdom",
      "title": "The Operational Telephone System for HS2",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/3abc9982-6f43-4d46-aa0e-2ac399599e7a",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Electronic Rostering System for Reablement",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/c668d3e5-8574-47be-9263-a3d2bc2faac0",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Leakage Management System",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074371-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "DBT Business Support Service",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074344-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "CA18311 - Tender 46/2026 - UNESCO Together Project - Integrated Facilitation, Residential Coordination, Accommodation, Transport and Strategic Reporting Services",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/509093ab-08e0-457e-accb-bd7680006663",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Supply of Airborne Operations Equipment",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/6a65bff7-4f23-438a-ab0e-e8d04ea1bc45",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "ITT for Hot Cell",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074354-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Sustainability and Climate Data Services",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074405-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Leicester College Call for Turing Scheme Partners 2026/27",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/67b781d1-0586-4c2b-ae9f-86c4926da9f4",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "FSCS580 Risk Management System",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074428-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "CA18290 - Security Equipment & Associated Services",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/443869d1-39d9-4b2e-b3af-7ef4ec2a6995",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Supply of S Stock Seat repairs",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074424-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Enterprise Resource Platform (ERP) System software solution",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074389-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Trend BEMS Comprehensive Maintenance, Replacement and Upgrade Works",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074377-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Further Competition for Enforcement Camera Refresh Programme",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074358-2026",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "CA18326 - HR & Payroll Software and Managed Payroll Services - Tyne Coast College",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/8a7b5fd8-cc6b-49db-9bcd-3ea0a9376cac",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Dynamic Purchasing System (\"DPS\") of Temporary Worker Agencies, and Interim Contractors/Consultants for Preferred Supplier Listing (\"PSL\") Status for Dudley Metropolitan Borough Council - Y23017",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/6c341d6f-f1d8-4d76-bdc2-abe4454d45d5",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Invitation to join a Dynamic Purchasing System (DPS) of Temporary Agency, Contractor and Interim Agencies for Preferred Supplier Listing (PSL) Status for Halton Borough Council - Y25002",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/129aeb78-f510-4371-af40-1bf7c38d8955",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Dynamic Purchasing System (DPS) of Temporary Agency, Contractor and Interim Agencies for Preferred Supplier Listing (PSL) Status for Hackney Borough Council - Y25013",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/8d9604ec-55df-4061-8ea4-58c7385a2cc1",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Y22019 - Connect2Surrey - Dynamic Purchasing System of Temporary Worker Agencies and Interim Contractors/Consultants for Preferred Provider Listing status",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/ae75726d-c79e-4079-9c2c-78f8389206b0",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "CA18298 - HR & Payroll Software & Managed Payroll Services - Tyne Coast College",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/ee7fdfed-45a1-45a4-9a9a-77f081bf1cdf",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Master Vendor Solution for Clinical Workers",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/26ab63f3-dae5-40cf-b3c6-f235a74a907e",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "HR & Payroll Software and Managed Payroll Services - Tyne Coast College",
      "meta": "UK Find a Tender (OCDS)",
      "href": "https://www.find-tender.service.gov.uk/Notice/074391-2026",
      "cta": "Open notice →"
    },
    {
      "code": "European Union",
      "title": "United Kingdom-London: Information technology services",
      "meta": "EU TED — CPV 72/48 (IT services & software)",
      "href": "https://ted.europa.eu/en/notice/-/detail/207540-2018",
      "cta": "Open notice →"
    },
    {
      "code": "United Kingdom",
      "title": "Fertility EPR System",
      "meta": "UK Contracts Finder (OCDS)",
      "href": "https://www.contractsfinder.service.gov.uk/Notice/01b3ada9-c0d0-48dc-9e44-93ad3c3a7995",
      "cta": "Open notice →"
    }
  ],
  "marketing": [
    {
      "tag": "HIGH",
      "title": "Google Business Profile",
      "meta": "Local search · Ranks IIS in Maps + local pack for \"IT support near me\" across every service city.",
      "href": "https://business.google.com/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "Bing Places for Business",
      "meta": "Local search · Feeds Copilot and Bing AI answers — cheap incremental reach.",
      "href": "https://www.bingplaces.com/",
      "cta": "List us →"
    },
    {
      "tag": "HIGH",
      "title": "Microsoft Partner Center → Solutions Partner directory",
      "meta": "Vendor marketplace · Free listing in the Microsoft find-a-partner directory. Buyer intent is extremely high.",
      "href": "https://partner.microsoft.com/",
      "cta": "List us →"
    },
    {
      "tag": "HIGH",
      "title": "Azure Marketplace — consulting service listing",
      "meta": "Vendor marketplace · List a fixed-scope M365/Azure assessment as a free consulting offer. Global distribution, no fee.",
      "href": "https://azuremarketplace.microsoft.com/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "AWS Partner Network + Marketplace",
      "meta": "Vendor marketplace · Partner locator listing; adds credibility for cloud RFPs.",
      "href": "https://aws.amazon.com/partners/",
      "cta": "List us →"
    },
    {
      "tag": "HIGH",
      "title": "Clutch",
      "meta": "B2B directory · Buyers shortlist MSPs here. Verified reviews compound; free profile.",
      "href": "https://clutch.co/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "G2 — service provider profile",
      "meta": "B2B directory · Free vendor profile; reviews carry into AI search results.",
      "href": "https://www.g2.com/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "GoodFirms / The Manifest / DesignRush",
      "meta": "B2B directory · Three free listings, one capability blurb. Backlinks + referral traffic.",
      "href": "https://www.goodfirms.co/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "Cloudtango — MSP directory",
      "meta": "MSP directory · MSP-specific, global, free. Buyers filter by country + service.",
      "href": "https://www.cloudtango.net/",
      "cta": "List us →"
    },
    {
      "tag": "LOW",
      "title": "UpCity + Expertise.com",
      "meta": "B2B directory · Free listings; local SEO value in each metro.",
      "href": "https://upcity.com/",
      "cta": "List us →"
    },
    {
      "tag": "HIGH",
      "title": "LinkedIn Company Page + Services tab",
      "meta": "Social · Services tab makes IIS appear in LinkedIn service-provider search. Free and under-used.",
      "href": "https://www.linkedin.com/company/",
      "cta": "List us →"
    },
    {
      "tag": "LOW",
      "title": "Crunchbase + Owler company profiles",
      "meta": "Data graph · Feeds enrichment tools and AI models; makes IIS resolvable as an entity.",
      "href": "https://www.crunchbase.com/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "Canadian Company Capabilities (ISED)",
      "meta": "Government directory · Free federal directory; Trade Commissioner Service pulls leads from it for export matchmaking.",
      "href": "https://ised-isde.canada.ca/site/canadian-company-capabilities/en",
      "cta": "List us →"
    },
    {
      "tag": "HIGH",
      "title": "Trade Commissioner Service (Canada)",
      "meta": "Government export · Free introductions to foreign buyers + local partners in 160 cities. This is the onsite-resource pipeline.",
      "href": "https://www.tradecommissioner.gc.ca/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "Wikidata + schema.org Organization markup on iisupp.net",
      "meta": "AI/entity SEO · Makes IIS a known entity to LLM answer engines — the new front page.",
      "href": "https://www.wikidata.org/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "GitHub org — publish free IT tooling/scripts",
      "meta": "Developer reach · Open-source a few genuinely useful admin scripts. Free authority, inbound developer traffic.",
      "href": "https://github.com/",
      "cta": "List us →"
    },
    {
      "tag": "MED",
      "title": "YouTube + short-form: one fix, one video",
      "meta": "Content · Every support ticket resolved is a 90-second video. Evergreen inbound, zero cost.",
      "href": "https://www.youtube.com/",
      "cta": "List us →"
    },
    {
      "tag": "LOW",
      "title": "Trustpilot",
      "meta": "Reviews · Free profile; review velocity is the cheapest conversion lift available.",
      "href": "https://www.trustpilot.com/",
      "cta": "List us →"
    }
  ]
}
function globalSection() {
  // data('global') is the agent's global-panel.json once the sync agent lands it in the snapshot.
  // Merge rather than replace so a partial feed can never blank a section that has embedded content.
  const live = data('global') || {};
  const g = { ...GLOBAL, ...live, counts: { ...GLOBAL.counts, ...(live.counts || {}) } };
  const wrap = el('div', {});
  wrap.append(head('Global — bids, contracts & whitelisting', `worldwide reach · agent cycle ${g.cycle} · ${g.updated}`, 'margin-top:26px'));
  const kpis = [
    ['Countries / regions', g.counts.countries, GLOBAL_C.gold],
    ['Portals mapped', g.counts.portals, PROC_C.dim],
    ['Registered', g.counts.registered, PROC_C.green],
    ['Registration queue', g.counts.queued, GLOBAL_C.amber],
    ['Waiting on you', g.counts.gated, PROC_C.red],
    ['Free channels', g.counts.channels, PROC_C.blue],
  ];
  wrap.append(el('div', { class: 'kpi-grid' }, kpis.map(([l, v, col]) =>
    el('div', { class: 'kpi' }, [el('div', { class: 'value', style: 'color:' + col }, v), el('div', { class: 'label' }, l)]))));

  const block = (title, eyebrow, rows, color) => {
    if (!rows || !rows.length) return;
    wrap.append(head(title, eyebrow, 'margin-top:20px'));
    const card = el('div', { class: 'card', style: 'padding:0' });
    rows.forEach(it => card.append(procRow(it, color)));
    wrap.append(card);
  };
  block('Global — waiting on you', 'account, password or ID only you can create · click to finish it', g.attention, PROC_C.red);
  block('Live global opportunities', 'found by the global research agent · click to open the notice', g.opportunities, PROC_C.blue);
  block('Whitelisting queue — worldwide', 'free registrations, highest leverage first · click to register', g.queue, GLOBAL_C.amber);
  block('Registered globally', 'alerts and invitations already flowing', g.registered, PROC_C.green);
  block('Free global visibility', 'zero ad spend · every listing below is free', g.marketing, GLOBAL_C.gold);
  return wrap;
}

SCREENS.overview = (c) => {
  const d = data('overview'); const k = d.kpis || {};
  c.append(axisStrip(k)); // AXIS front-and-center: command strip above everything (R3)
  c.append(head('Overview', 'command deck'));
  const kpis = [['Pipeline value', fmtMoney(k.pipeline_value)], ['Awaiting approval', k.awaiting_approval ?? 0],
    ['Client messages waiting', k.messages_waiting ?? 0], ['Follow-ups due', k.followups_due ?? 0],
    ['Meetings this week', k.meetings_week ?? 0], ['MRR', fmtMoney(k.mrr)]];
  c.append(el('div', { class: 'kpi-grid' }, kpis.map(([l, v]) => el('div', { class: 'kpi' }, [el('div', { class: 'label' }, l), el('div', { class: 'value' }, v)]))));
  c.append(procurementSection()); // live bid/contract + whitelisting status (2026-08-05)
  c.append(globalSection());      // global bids, worldwide whitelisting + free-channel queue (2026-08-06)
  c.append(head('Needs You Now', 'top by revenue impact', 'margin-top:22px'));
  const needs = d.needs_you_now || [];
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!needs.length) card.append(el('div', { class: 'empty' }, 'Nothing waiting. AXIS is watching.'));
  else needs.forEach(n => card.append(el('div', { class: 'row' }, [
    el('span', { class: 'stage-tag' }, n.kind || 'item'), el('div', { style: 'flex:1' }, n.subject || '(no subject)'),
    el('button', { class: 'chip', onclick: () => go('approvals') }, 'Review')])));
  c.append(card);
  // Fleet strip
  const fleet = (data('fleet').agents) || [];
  if (fleet.length) {
    c.append(head('Fleet', 'agents reporting', 'margin-top:22px'));
    c.append(el('div', { class: 'card', style: 'display:flex;gap:16px;flex-wrap:wrap' }, fleet.slice(0, 8).map(a =>
      el('div', { style: 'display:flex;align-items:center;gap:7px' }, [el('span', { class: 'dot ' + (a.status === 'ok' ? 'dot-ok' : 'dot-warn') }), el('span', { class: 'mono', style: 'font-size:11px' }, a.agent)]))));
  }
};

SCREENS['axis-agent-director'] = (c) => {
  // The Director screen lives in axis-director-screen.js. Voice is NOT reimplemented there — the v1
  // machinery restored in 642251ad is passed in, so the tab, the fab dock and the public panel all
  // drive one orb state machine and one transcript.
  renderDirector(c, {
    data: { overview: data('overview'), approvals: data('approvals'), fleet: data('fleet'),
            settings: data('settings'), inbox: data('inbox'), analytics: data('analytics'),
            // RUN-AM / AM2 — the published program figures WITH the age of each read. Authed-only
            // (/api/axis-status, same Aperture gate); null until it lands, which the section renders
            // as "not loaded" rather than as an empty set of figures.
            program_status: state.programStatus,
            version: state.version },
    voice: {
      send: () => axisSend('axisDirectorInput'),
      micToggle: () => axisMicToggle('axisDirectorMic', 'axisDirectorInput', () => axisSend('axisDirectorInput')),
      voiceToggle: axisVoiceToggle,
      handsFreeToggle: axisHandsFreeToggle,
      mountOrbs, setState: setAxisState, renderLog: renderDock,
      get voiceOn() { return axisVoiceOn; },
      get handsFree() { return axisHandsFree; },
    },
    onIntent: (type, payload) => postIntent(type, payload),
    openComposer,
  });
};

// ── S2 Action Inbox ──
SCREENS.inbox = (c) => {
  if (state.ui.thread) return renderThread(c, state.ui.thread);
  const d = data('inbox'); const rows = d.rows || []; const co = d.counts || {};
  c.append(head('Action Inbox', 'client replies + new requests only'));
  const filters = [['all', 'All', rows.length], ['replies', 'Replies', co.replies], ['new_requests', 'New Requests', co.new_requests], ['snoozed', 'Snoozed', co.snoozed], ['handled', 'Handled', co.handled]];
  c.append(el('div', { class: 'thread-bar' }, filters.map(([id, lbl, n]) => el('button', { class: 'chip', 'aria-selected': state.ui.inboxFilter === id, onclick: () => { state.ui.inboxFilter = id; renderModule(); } }, [lbl, el('span', { class: 'count' }, n || 0)]))));
  const shown = rows.filter(m => {
    const actionable = ACTIONABLE.includes(m.classification);
    if (state.ui.inboxFilter === 'all') return actionable && !m.actioned;
    if (state.ui.inboxFilter === 'replies') return m.classification === 'reply_to_outreach';
    if (state.ui.inboxFilter === 'new_requests') return m.classification === 'new_inbound_request';
    if (state.ui.inboxFilter === 'snoozed') return m.snoozed_until;
    if (state.ui.inboxFilter === 'handled') return m.actioned;
    return actionable;
  });
  const list = el('div', { class: 'card', style: 'padding:0' });
  if (!shown.length) list.append(el('div', { class: 'empty' }, 'Inbox clear. AXIS is watching — you’ll see a number the moment a client writes.'));
  else shown.forEach(m => list.append(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { openThread(m); } }, [
    el('span', { class: 'dot ' + (m.unread ? 'dot-ok' : ''), style: m.unread ? '' : 'background:var(--line-2)' }),
    el('span', { class: 'stage-tag' }, m.classification === 'reply_to_outreach' ? 'Reply' : 'New Request'),
    el('div', { style: 'flex:1;min-width:0' }, [el('div', { style: 'font-weight:600' }, m.subject || '(no subject)'), el('div', { style: 'color:var(--txt-3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, m.snippet || '')]),
    el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3)' }, ago(m.received_at))])));
  c.append(list);
  // Filtered drawer (audit)
  const filtered = rows.filter(m => !ACTIONABLE.includes(m.classification));
  const dr = el('details', { class: 'filtered-drawer' });
  dr.append(el('summary', {}, `▸ Filtered (${filtered.length}) — never counted`));
  filtered.forEach(m => dr.append(el('div', { class: 'row' }, [el('span', { class: 'stage-tag' }, m.classification), el('div', { style: 'flex:1' }, m.subject)])));
  c.append(dr);
};
function openThread(m) { m.unread = false; state.ui.thread = m; renderNav(); renderModule(); }
function prospectById(id) { return ((data('prospects').rows) || []).find(x => x.id === id); }
function businessName(id) { const p = prospectById(id); return p ? (p.name || p.handle) : null; }
function renderThread(c, m) {
  c.append(el('div', { class: 'thread-bar' }, [el('button', { class: 'chip', onclick: () => { state.ui.thread = null; renderModule(); } }, '← Inbox'),
    el('div', { style: 'flex:1' }), el('span', { class: 'stage-tag' }, m.classification === 'reply_to_outreach' ? 'Reply' : 'New Request')]));
  const actions = [['draft_reply', 'Draft AI Reply'], ['open_gmail', 'Open in Gmail'], ['schedule_followup', 'Schedule Follow-up'], ['book_meeting', 'Book Meeting'], ['advance_stage', 'Advance Stage'], ['mark_handled', 'Mark Handled'], ['snooze', 'Snooze'], ['suppress', 'Suppress']];
  const bar = el('div', { class: 'thread-bar', style: 'position:sticky;top:0;background:var(--bg);z-index:2' }, actions.map(([t, lbl]) => el('button', { class: 'chip', onclick: () => inboxAction(t, m) }, lbl)));
  const left = el('div', {}, [
    el('div', { class: 'thread-msg' }, [
      el('div', { class: 'eyebrow' }, `${m.classification === 'reply_to_outreach' ? 'client reply' : 'new inbound'} · from ${m.from_email || 'unknown'}`),
      el('div', { style: 'font-weight:600;margin:6px 0' }, m.subject),
      el('div', { style: 'color:var(--txt-2);white-space:pre-line' }, m.body || m.snippet)]),
    m.sysnote ? el('div', { class: 'sysnote' }, m.sysnote) : null,
    bar,
  ]);
  // Right rail: company · pipeline stage · outreach history · notes
  const p = prospectById(m.business_id);
  const history = ((data('outreach').drafts) || []).filter(d => d.business_id === m.business_id);
  const rail = el('aside', { class: 'rail' }, [
    el('div', { class: 'eyebrow' }, 'company'),
    el('div', { style: 'font-weight:600;margin:4px 0 6px' }, p ? p.name : (m.from_email || 'Unlinked')),
    p ? el('div', { style: 'margin-bottom:12px' }, [el('span', { class: 'stage-tag' }, p.stage), p.est_monthly_value ? el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3);margin-left:8px' }, '$' + p.est_monthly_value.toLocaleString() + '/mo') : null]) : null,
    el('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'outreach history'),
    history.length ? el('div', {}, history.map(hh => el('div', { style: 'font-size:11px;color:var(--txt-2);padding:3px 0;border-bottom:1px solid var(--line)' }, [el('span', { class: 'stage-tag', style: 'margin-right:6px' }, hh.kind), hh.status]))) : el('div', { class: 'unknown', style: 'font-size:11px' }, 'No prior outreach on file'),
    el('div', { class: 'eyebrow', style: 'margin:12px 0 6px' }, 'notes'),
    el('div', { style: 'font-size:11px;color:var(--txt-3)' }, m.classify_reason ? 'Classified: ' + m.classify_reason : '—'),
  ]);
  c.append(el('div', { class: 'thread-wrap' }, [left, rail]));
}
async function inboxAction(type, m) {
  if (type === 'open_gmail') { // real deep link to the exact Gmail thread
    window.open(`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(m.thread_id || '')}`, '_blank');
    toast('Opening Gmail thread'); return;
  }
  if (type === 'draft_reply') {
    // CC-BRIEF §2A: this used to queue an intent and send the operator to Approvals to wait — two tab
    // changes and the task never actually completed. The reply text now rides the snapshot
    // (inbox.rows[].suggested_reply, produced by the worker), so the composer opens instantly, in
    // place, over this very thread. Nothing navigates.
    const draft = m.suggested_reply;
    openComposer({
      mode: 'reply',
      to: m.from_email,
      subject: draft ? draft.subject : (/^re:/i.test(m.subject || '') ? m.subject : 'Re: ' + (m.subject || '')),
      body: draft ? draft.body : '',
      templateId: draft && draft.template_id,
      messageId: m.id,
      businessId: m.business_id,
      contactName: m.from_email,
      companyName: businessName(m.business_id),
      rails: data('settings'),
      onSent: () => { m.actioned = true; state.ui.thread = null; renderNav(); renderModule(); },
    });
    return;
  }
  const irreversibleUI = ['mark_handled', 'snooze', 'suppress'];
  if (irreversibleUI.includes(type)) { // optimistic side-effect (Law 4): decrement badge same tick
    if (type === 'snooze') m.snoozed_until = Date.now() + 864e5; else m.actioned = true;
    toast(labelFor(type)); renderNav();
    // after handling, drop back to the list so the (now smaller) badge is visible
    if (type !== 'snooze') { state.ui.thread = null; }
    renderModule();
  } else { toast(labelFor(type) + ' → queued'); }
  postIntent(type, { message_id: m.id, thread_id: m.thread_id });
}
const labelFor = (t) => ({ draft_reply: 'Draft reply (→ Approvals)', open_gmail: 'Opening Gmail', schedule_followup: 'Follow-up scheduled', book_meeting: 'Meeting request', advance_stage: 'Stage advanced', mark_handled: 'Marked handled', snooze: 'Snoozed', suppress: 'Sender suppressed' }[t] || t);

// ── S3 Approval Center ──
SCREENS.approvals = (c) => {
  const d = data('approvals'); const rows = d.rows || [];
  c.append(head('Approval Center', 'nothing sends without you'));
  const tabs = [['pending', 'Pending'], ['outbound', 'Outbound'], ['rejected', 'Rejected'], ['skipped', 'Skipped']];
  const tabRows = (t) => rows.filter(r => t === 'outbound' ? (r.status === 'approved' || r.status === 'outbound') : r.status === t);
  c.append(el('div', { class: 'thread-bar' }, tabs.map(([id, lbl]) => el('button', { class: 'chip', 'aria-selected': state.ui.apTab === id, onclick: () => { state.ui.apTab = id; state.ui.apCursor = 0; renderModule(); } }, [lbl, el('span', { class: 'count' }, tabRows(id).length)]))));
  const list = tabRows(state.ui.apTab);
  if (state.ui.apTab === 'pending' && list.length) {
    c.append(el('div', { class: 'bulkbar' }, [
      el('span', { class: 'eyebrow' }, state.ui.apSel.size ? state.ui.apSel.size + ' selected' : 'J/K move · A approve · X reject · S skip'),
      el('div', { style: 'flex:1' }),
      el('button', { class: 'chip', onclick: () => { list.forEach(r => bulkApprove(r)); } }, 'Approve all'),
      el('button', { class: 'chip', onclick: () => { state.ui.apSel.clear(); renderModule(); } }, 'Clear')]));
  }
  if (!list.length) { c.append(el('div', { class: 'empty' }, 'Nothing here.')); return; }
  list.forEach((r, i) => {
    const open = state.ui.apOpen === r.id;
    const card = el('div', { class: 'appr', 'aria-selected': (state.ui.apTab === 'pending' && i === state.ui.apCursor) });
    const cb = el('span', { class: 'checkbox', 'aria-checked': state.ui.apSel.has(r.id), onclick: (e) => { e.stopPropagation(); state.ui.apSel.has(r.id) ? state.ui.apSel.delete(r.id) : state.ui.apSel.add(r.id); renderModule(); } }, state.ui.apSel.has(r.id) ? '✓' : '');
    card.append(el('div', { class: 'appr-head', onclick: () => { state.ui.apOpen = open ? null : r.id; renderModule(); } }, [
      state.ui.apTab === 'pending' ? cb : el('span', { class: 'stage-tag' }, (r.channel || 'email').toUpperCase()),
      el('div', { style: 'flex:1' }, [el('div', { style: 'font-weight:600' }, r.subject), el('div', { style: 'font-size:12px;color:var(--txt-3)' }, [businessName(r.business_id) || 'prospect', ' · ', el('span', { style: 'color:var(--gold)' }, 'Pitch')])]),
      el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3)' }, ago(r.created_at))]));
    if (open) {
      const facts = (r.facts || []).map(f => el('span', { class: 'footnote', style: 'margin-right:6px' }, [f.c, ' — ', el('span', { class: 'src' }, (f.s || 'source') + ' ✓')]));
      const acts = state.ui.apTab === 'pending' ? [
        el('button', { class: 'chip', onclick: () => act('approve', r) }, 'Approve'), el('button', { class: 'chip', onclick: () => toast('Inline editor — opens in Outreach Studio') }, 'Edit'),
        el('button', { class: 'chip', onclick: () => { const ins = prompt('Rewrite instruction for AXIS:'); if (ins) { toast('Rewrite → AXIS'); postIntent('rewrite', { item_id: r.id, instruction: ins }); } } }, 'Rewrite'),
        el('button', { class: 'chip', onclick: () => act('reject', r) }, 'Reject'), el('button', { class: 'chip', onclick: () => act('skip', r) }, 'Skip'),
        el('button', { class: 'chip', onclick: () => { const nt = prompt('Note:'); if (nt) { toast('Note added'); postIntent('note', { item_id: r.id, note: nt }); } } }, 'Note')] : [];
      card.append(el('div', { class: 'appr-body' }, [
        el('div', { style: 'padding:12px 0;color:var(--txt-2);white-space:pre-line' }, '(draft preview — full body renders from the outreach record)'),
        facts.length ? el('div', { style: 'margin:8px 0' }, facts) : el('div', { class: 'unknown' }, 'No sourced facts — never guessed'),
        acts.length ? el('div', { class: 'appr-actions' }, acts) : null]));
    }
    c.append(card);
  });
};
function setStatus(r, status) { r.status = status; }
function act(kind, r) {
  const map = { approve: 'approved', reject: 'rejected', skip: 'skipped' };
  if (kind === 'reject') { const reason = prompt('Reason (off-target / bad timing / tone / factual error / compliance / duplicate / other):', 'bad timing'); postIntent('reject', { item_id: r.id, reason }); }
  else postIntent(kind, { item_id: r.id });
  setStatus(r, map[kind]); state.ui.apSel.delete(r.id); toast('Approval ' + map[kind]); renderNav(); renderModule();
}
function bulkApprove(r) { postIntent('approve', { item_id: r.id }); setStatus(r, 'approved'); state.ui.apSel.delete(r.id); renderNav(); renderModule(); toast('Bulk approved'); }

// ── S14 CRM ──
SCREENS.crm = (c) => {
  if (state.ui.crmDrawer) renderCrmDrawer();
  const d = data('crm'); const recs = d.records || []; const co = d.counts || {};
  c.append(head('CRM', 'single source of truth'));
  const tabs = [['contact', 'Contacts', co.contacts], ['company', 'Companies', co.companies], ['deal', 'Deals', co.deals], ['activity', 'Activities', co.activities]];
  c.append(el('div', { class: 'thread-bar' }, [
    ...tabs.map(([id, lbl, n]) => el('button', { class: 'chip', 'aria-selected': state.ui.crmTab === id, onclick: () => { state.ui.crmTab = id; renderModule(); } }, [lbl, el('span', { class: 'count' }, n || 0)])),
    el('div', { style: 'flex:1' }),
    el('input', { class: 'search', style: 'max-width:200px;color:var(--txt)', placeholder: 'filter…', value: state.ui.crmFilter, oninput: (e) => { state.ui.crmFilter = e.target.value; renderCrmList(); } }),
    el('button', { class: 'chip', onclick: () => toast('Add record — opens form (→ vault via Mesh, anonymized)') }, '+ Add'),
    el('button', { class: 'chip', onclick: () => { toast('CSV export queued'); postIntent('csv_export', { tab: state.ui.crmTab }); } }, 'Export')]));
  c.append(el('div', { class: 'card', id: 'crmList', style: 'padding:0' }));
  renderCrmList();
};
function renderCrmList() {
  const wrap = $('crmList'); if (!wrap) return; wrap.innerHTML = '';
  const recs = ((data('crm').records) || []).filter(r => r.type === state.ui.crmTab);
  const q = state.ui.crmFilter.toLowerCase();
  const shown = recs.filter(r => !q || JSON.stringify(r.fields).toLowerCase().includes(q));
  if (!shown.length) { wrap.append(el('div', { class: 'empty' }, 'No records.')); return; }
  shown.forEach(r => {
    const f = r.fields || {}; const cells = Object.values(f).slice(0, 4).map(v => el('div', {}, String(v)));
    const noDrawer = state.ui.crmTab === 'activity';
    wrap.append(el('div', { class: 'tbl-row', style: `grid-template-columns:repeat(${cells.length},1fr);cursor:${noDrawer ? 'default' : 'pointer'}`, onclick: () => { if (!noDrawer) { state.ui.crmDrawer = r; renderModule(); } } }, cells));
  });
}
function renderCrmDrawer() {
  const r = state.ui.crmDrawer; if (!r) return;
  const close = () => { state.ui.crmDrawer = null; renderModule(); };
  document.body.append(el('div', { class: 'drawer-bg', onclick: close }));
  const f = r.fields || {};
  document.body.append(el('aside', { class: 'drawer' }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px' }, [el('span', { class: 'eyebrow' }, r.type), el('button', { class: 'iconbtn', onclick: close }, '✕')]),
    ...Object.entries(f).map(([k, v]) => el('div', { style: 'padding:8px 0;border-bottom:1px solid var(--line)' }, [el('div', { class: 'eyebrow' }, k), el('div', {}, String(v))])),
    el('div', { class: 'appr-actions', style: 'margin-top:14px' }, [
      el('button', { class: 'chip', onclick: () => { toast('Draft email → Approvals'); postIntent('draft_email', { record_id: r.id }); } }, 'Draft email'),
      el('button', { class: 'chip', onclick: () => { const n = prompt('Note (anonymized to vault):'); if (n) { toast('Note → vault (Lead handle)'); postIntent('add_note', { record_id: r.id, note: n }); } } }, 'Add note')])]));
}

// ── S6 Prospect Database ──
SCREENS.prospects = (c) => {
  if (state.ui.prospect != null) return renderProspectProfile(c, state.ui.prospect);
  const d = data('prospects'); let rows = d.rows || [];
  c.append(head('Prospect Database', `${d.real_count || 0} researched · ${rows.length} total · Toronto → GTA → ON → CA`));
  c.append(el('div', { class: 'thread-bar' }, [
    el('button', { class: 'chip', 'aria-selected': state.ui.realOnly, onclick: () => { state.ui.realOnly = !state.ui.realOnly; renderModule(); } }, 'Researched only'),
    el('div', { style: 'flex:1' }),
    el('input', { class: 'search', style: 'max-width:220px;color:var(--txt)', placeholder: 'filter name / city / industry…', value: state.ui.prospectFilter, oninput: (e) => { state.ui.prospectFilter = e.target.value; renderProspectRows(); } }),
    el('button', { class: 'chip', onclick: () => { toast('CSV export queued'); postIntent('csv_export', { module: 'prospects' }); } }, 'Export'),
  ]));
  c.append(el('div', { class: 'card', id: 'prospectRows', style: 'padding:0' }));
  renderProspectRows();
};
function renderProspectRows() {
  const wrap = $('prospectRows'); if (!wrap) return; wrap.innerHTML = '';
  let rows = (data('prospects').rows) || [];
  if (state.ui.realOnly) rows = rows.filter(r => r.is_real);
  const q = state.ui.prospectFilter.toLowerCase();
  if (q) rows = rows.filter(r => `${r.name} ${r.handle} ${r.city} ${r.industry}`.toLowerCase().includes(q));
  wrap.append(el('div', { class: 'row', style: 'font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--txt-3)' }, [
    el('div', { style: 'width:70px' }, 'Handle'), el('div', { style: 'flex:1' }, 'Company'), el('div', { style: 'width:110px' }, 'Industry'),
    el('div', { style: 'width:70px' }, 'City'), el('div', { style: 'width:120px' }, 'Maturity IT/CY/CL/AI'), el('div', { style: 'width:80px;text-align:right' }, 'Est/mo')]));
  if (!rows.length) { wrap.append(el('div', { class: 'empty' }, 'No prospects.')); return; }
  rows.forEach(r => wrap.append(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { state.ui.prospect = r.id; renderModule(); } }, [
    el('div', { style: 'width:70px' }, [el('span', { class: 'stage-tag' }, r.handle)]),
    el('div', { style: 'flex:1;font-weight:600' }, [r.is_real ? el('span', { style: 'color:var(--ok);margin-right:6px', title: 'researched with provenance' }, '●') : el('span', { style: 'color:var(--txt-3);margin-right:6px', title: 'sample data' }, '○'), r.name || r.handle]),
    el('div', { style: 'width:110px;color:var(--txt-2);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, (r.industry || '—').split('(')[0]),
    el('div', { style: 'width:70px;color:var(--txt-2)' }, r.city ? r.city.split(' ')[0] : '—'),
    el('div', { style: 'width:120px' }, maturityMini(r.maturity)),
    el('div', { style: 'width:80px;text-align:right;font-variant-numeric:tabular-nums' }, r.est_monthly_value ? '$' + r.est_monthly_value.toLocaleString() : '—')])));
}
function maturityMini(m) {
  m = m || {}; const dims = [['IT', m.it], ['CY', m.cyber], ['CL', m.cloud], ['AI', m.ai]];
  return el('div', { style: 'display:flex;gap:6px' }, dims.map(([k, v]) =>
    el('span', { class: 'mono', style: 'font-size:9px;color:' + (v >= 4 ? 'var(--ok)' : v <= 2 ? 'var(--crit)' : 'var(--txt-2)') }, k + (v || '—'))));
}

// ── S5 Prospect Profile (provenance-first, Law 3) ──
function renderProspectProfile(c, id) {
  const p = ((data('prospects').rows) || []).find(x => x.id === id);
  if (!p) { c.append(el('div', { class: 'empty' }, 'Not found.')); return; }
  c.append(el('div', { class: 'thread-bar' }, [el('button', { class: 'chip', onclick: () => { state.ui.prospect = null; renderModule(); } }, '← Prospects'),
    el('div', { style: 'flex:1' }), p.is_real ? el('span', { class: 'footnote' }, [el('span', { class: 'src' }, '● researched'), ' · provenance below']) : el('span', { class: 'stage-tag' }, 'sample')]));
  // Header
  c.append(el('div', { style: 'display:flex;align-items:baseline;gap:12px;margin-bottom:4px' }, [
    el('div', { class: 'screen-title' }, p.name || p.handle), el('span', { class: 'stage-tag' }, p.handle), el('span', { class: 'stage-tag' }, p.stage)]));
  const links = [['Website', pv(p, 'website')], ['LinkedIn', pv(p, 'linkedin_url')]].filter(x => x[1]);
  c.append(el('div', { style: 'margin-bottom:14px' }, links.map(([l, u]) => el('a', { href: u, target: '_blank', style: 'margin-right:12px;font-size:12px' }, l + ' ↗'))));

  // Company details grid — every field with provenance footnote or the honest unknown
  c.append(el('div', { class: 'kpi-grid' }, [
    provField(p, 'industry', 'Industry'), provField(p, 'city', 'Location'), provField(p, 'size', 'Size'),
    provField(p, 'address', 'Address'), provField(p, 'phone', 'Phone'), provField(p, 'public_email', 'Public email'),
    provField(p, 'revenue', 'Revenue'), provField(p, 'founded', 'Founded'), provField(p, 'maps_url', 'Google Maps'),
  ]));

  // Maturity meters (1–5 + basis)
  c.append(head('IT / Cyber / Cloud / AI maturity', 'assessment — basis on hover', 'margin-top:20px'));
  const md = p.maturity_detail || {};
  c.append(el('div', { class: 'card', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px' },
    [['IT', 'it'], ['Cyber', 'cyber'], ['Cloud', 'cloud'], ['AI', 'ai']].map(([lbl, k]) => meter(lbl, p.maturity?.[k], md[k]?.basis))));

  // Opportunity assessments
  c.append(head('Opportunities', `est. $${(p.est_monthly_value || 0).toLocaleString()}/mo total — assessment`, 'margin-top:20px'));
  const opps = p.opportunities || [];
  c.append(el('div', { class: 'card', style: 'display:flex;gap:8px;flex-wrap:wrap' }, opps.length ? opps.map(o =>
    el('span', { class: 'chip', title: o.basis + ' (confidence ' + Math.round((o.confidence || 0) * 100) + '%)' }, [o.service, el('span', { class: 'count', style: 'color:var(--gold)' }, '$' + (o.est_mrr || 0).toLocaleString() + '/mo')])) : [el('span', { class: 'unknown' }, 'No opportunities assessed')]));

  // Public decision makers
  c.append(head('Public decision makers', 'sourced — emails require enrichment', 'margin-top:20px'));
  const cts = p.contacts || [];
  const cc = el('div', { class: 'card', style: 'padding:0' });
  if (!cts.length) cc.append(el('div', { class: 'empty' }, 'Not found — never guessed'));
  else cts.forEach(ct => {
    // CC-BRIEF §2B: a decision maker used to be dead text. Now the address is exposed and the SAME
    // composer opens inline on this profile, pre-filled with the LOCKED template the worker generated
    // (p.outreach_draft) — the copy is never retyped here.
    const to = ct.public_email || p.public_email || null;
    const draft = p.outreach_draft;
    const act = to && draft
      ? el('div', { style: 'display:flex;gap:6px' }, [
        el('button', {
          class: 'chip', style: 'border-color:var(--gold);color:var(--gold)',
          onclick: () => openComposer({
            mode: 'outreach', to, subject: draft.subject, body: draft.body, templateId: draft.template_id,
            businessId: p.id, contactName: ct.name || to, companyName: p.name || p.handle,
            rails: data('settings'),
            onSent: () => toast('Queued for send behind the rails — logged to CRM on delivery'),
          }),
        }, 'Draft AI Email'),
        el('a', { class: 'chip', href: 'mailto:' + to, title: 'Open in your own mail client instead' }, 'Email'),
      ])
      : el('span', { class: 'unknown', style: 'font-size:11px' }, to ? 'No approved template for this prospect' : 'No address — cannot send');
    cc.append(el('div', { class: 'row' }, [
      el('div', { style: 'flex:1;min-width:0' }, [el('div', { style: 'font-weight:600' }, ct.name), el('div', { style: 'font-size:12px;color:var(--txt-3)' }, ct.title)]),
      el('div', { style: 'width:210px;overflow:hidden;text-overflow:ellipsis' }, to ? el('span', { class: 'mono', style: 'font-size:11.5px' }, to) : el('span', { class: 'unknown' }, 'email: Not found — never guessed')),
      act,
      ct.source_url ? el('span', { class: 'footnote' }, ['src', ' — ', el('span', { class: 'src' }, (ct.source_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] + ' ✓')]) : el('span', { class: 'footnote' }, 'src — unrecorded'),
    ]));
  });
  c.append(cc);

  // Stage control (manual override always available; auto-transitions logged)
  c.append(head('Pipeline stage', 'manual override always available', 'margin-top:20px'));
  c.append(el('div', { class: 'card' }, [stagePicker(p)]));
}
const pv = (p, key) => p.provenance?.[key]?.value ?? null;
function provField(p, key, label) {
  const f = p.provenance?.[key];
  const box = el('div', { class: 'kpi' }, [el('div', { class: 'label' }, label)]);
  if (!f || f.value == null) { box.append(el('div', { class: 'unknown', style: 'margin-top:6px;font-size:12px' }, 'Not found — never guessed')); return box; }
  box.append(el('div', { style: 'margin-top:6px;font-size:13px;font-weight:500' }, String(f.value)));
  const src = (f.source_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'source';
  box.append(el('div', { class: 'footnote', style: 'margin-top:8px' }, [src, ' · ', el('span', { class: 'src' }, Math.round((f.confidence || 0) * 100) + '% ✓'), ' · ', f.last_verified || '—']));
  return box;
}
function meter(label, score, basis) {
  const wrap = el('div', { title: basis || '' });
  wrap.append(el('div', { style: 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px' }, [el('span', {}, label), el('span', { class: 'mono', style: 'color:var(--gold)' }, (score || '—') + '/5')]));
  const bar = el('div', { style: 'display:flex;gap:3px' });
  for (let i = 1; i <= 5; i++) bar.append(el('span', { style: `flex:1;height:6px;border-radius:3px;background:${i <= (score || 0) ? 'var(--gold)' : 'var(--surface-3)'}` }));
  wrap.append(bar);
  if (basis) wrap.append(el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:6px' }, basis));
  return wrap;
}
function stagePicker(p) {
  const sel = el('select', { class: 'chip', style: 'padding:6px 10px', onchange: (e) => { toast('Stage override → ' + e.target.value); postIntent('stage_override', { business_id: p.id, to_stage: e.target.value }); } });
  PIPE_STAGES.forEach(s => sel.append(el('option', { value: s, selected: s === p.stage }, s)));
  return el('div', { style: 'display:flex;align-items:center;gap:10px' }, [el('span', { class: 'eyebrow' }, 'current:'), el('span', { class: 'stage-tag' }, p.stage), sel]);
}

// ── S4 Sales Pipeline (kanban + table) ──
const PIPE_PHASES = [
  { label: 'Research', stages: ['Researching', 'Profile Completed'] },
  { label: 'Outreach', stages: ['Email Generated', 'Waiting Approval', 'Approved', 'Ready to Send', 'Sent', 'Delivered', 'Opened'] },
  { label: 'Engaged', stages: ['Replied', 'Follow-up Required', 'Meeting Scheduled'] },
  { label: 'Deal', stages: ['Proposal Sent', 'Negotiation'] },
  { label: 'Closed', stages: ['Won', 'Lost', 'Archived'] },
];
const PIPE_STAGES = PIPE_PHASES.flatMap(p => p.stages);
SCREENS.pipeline = (c) => {
  const d = data('pipeline'); const cards = d.cards || [];
  c.append(el('div', { class: 'screen-head' }, [el('div', { class: 'screen-title' }, 'Sales Pipeline'),
    el('div', { style: 'display:flex;gap:8px' }, [
      el('button', { class: 'chip', 'aria-selected': state.ui.pipeView === 'kanban', onclick: () => { state.ui.pipeView = 'kanban'; renderModule(); } }, 'Kanban'),
      el('button', { class: 'chip', 'aria-selected': state.ui.pipeView === 'table', onclick: () => { state.ui.pipeView = 'table'; renderModule(); } }, 'Table')])]));
  if (state.ui.pipeView === 'table') {
    const wrap = el('div', { class: 'card', style: 'padding:0' });
    cards.forEach(card => wrap.append(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { state.module = 'prospects'; state.ui.prospect = card.id; renderNav(); renderModule(); } }, [
      el('span', { class: 'stage-tag' }, card.handle), el('div', { style: 'flex:1;font-weight:600' }, card.name || card.handle),
      el('span', { class: 'stage-tag' }, card.stage), el('div', { style: 'width:90px;text-align:right' }, card.est_monthly_value ? '$' + card.est_monthly_value.toLocaleString() : '—')])));
    c.append(wrap); return;
  }
  // Kanban: columns per stage that has cards (dense) grouped by phase colour
  const board = el('div', { style: 'display:flex;gap:12px;overflow-x:auto;padding-bottom:8px' });
  PIPE_STAGES.forEach(stage => {
    const inStage = cards.filter(c2 => c2.stage === stage);
    if (!inStage.length) return; // dense: only show stages with cards
    const col = el('div', { style: 'min-width:220px;flex:0 0 220px' }, [
      el('div', { class: 'eyebrow', style: 'margin-bottom:8px' }, [stage, el('span', { style: 'color:var(--gold);margin-left:6px' }, inStage.length)])]);
    inStage.forEach(card => {
      const auto = card.auto ? el('span', { title: 'auto-moved', style: 'color:var(--gold);font-size:10px' }, '↻') : null;
      col.append(el('div', { class: 'card', style: 'margin-bottom:8px;padding:11px;cursor:pointer', draggable: 'true',
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', card.id); },
        onclick: () => { state.module = 'prospects'; state.ui.prospect = card.id; renderNav(); renderModule(); } }, [
        el('div', { style: 'display:flex;justify-content:space-between' }, [el('span', { style: 'font-weight:600;font-size:12.5px' }, card.name || card.handle), auto]),
        el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:4px' }, [(card.city || '').split(' ')[0], ' · ', card.est_monthly_value ? '$' + card.est_monthly_value.toLocaleString() + '/mo' : '—'])]));
    });
    // drop target → stage_override
    col.addEventListener('dragover', (e) => e.preventDefault());
    col.addEventListener('drop', (e) => { e.preventDefault(); const id = +e.dataTransfer.getData('text/plain'); toast('Stage → ' + stage); postIntent('stage_override', { business_id: id, to_stage: stage }); const card = cards.find(x => x.id === id); if (card) { card.stage = stage; renderModule(); } });
    board.append(col);
  });
  c.append(board);
};

// ── S7 Outreach Studio (generation only — NO send button exists; every exit → Approvals) ──
SCREENS.outreach = (c) => {
  const d = data('outreach'); const drafts = d.drafts || [];
  c.append(head('Outreach Studio', `${d.identity?.from || 'ahmad.wasee@iisupp.net'} · drafts only`));
  c.append(el('div', { class: 'card', style: 'border-color:var(--gold);background:var(--gold-dim);margin-bottom:14px;padding:11px 14px;font-size:12.5px' },
    ['🔒 No send button exists here. Every draft routes through ', el('b', {}, 'Approvals'), ' — nothing leaves without your per-item approval and a passing rails check at send time.']));
  if (!drafts.length) { c.append(el('div', { class: 'empty' }, 'No drafts yet. Generate outreach from a prospect profile.')); return; }
  drafts.forEach(dr => {
    const b = ((data('prospects').rows) || []).find(x => x.id === dr.business_id);
    const lint = dr.lint || {};
    const noIssue = (re) => (lint.issues || []).every(i => !re.test(i));
    const checklist = [
      ['Personalized (no {name})', noIssue(/placeholder|personalized/)],
      ['Approved template intact', noIssue(/approved element|drift|greeting/)],
      ['No banned filler', noIssue(/filler/)],
      [`CASL footer + unsubscribe`, /unsubscribe/i.test(dr.body || '')],
    ];
    const card = el('div', { class: 'card', style: 'margin-bottom:12px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px' }, [
        el('div', {}, [el('span', { style: 'font-weight:600' }, (b?.name || 'Prospect')), el('span', { class: 'stage-tag', style: 'margin-left:8px' }, dr.to_email)]),
        el('span', { class: 'stage-tag', style: dr.status === 'pending' ? 'color:var(--gold)' : '' }, dr.status)]),
      el('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'subject'),
      el('div', { style: 'font-weight:500;margin-bottom:8px' }, dr.subject),
      el('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'body (edit in place — saves to draft, still needs approval)'),
      el('textarea', { style: 'width:100%;min-height:150px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:12.5px;padding:10px;white-space:pre-wrap',
        onblur: (e) => { toast('Draft saved — still needs approval'); postIntent('edit_draft', { item_id: dr.id, body: e.target.value }); } }, dr.body),
      // human-sounding checklist
      el('div', { style: 'display:flex;gap:14px;flex-wrap:wrap;margin:10px 0' }, checklist.map(([lbl, ok]) =>
        el('span', { style: `font-size:12px;color:${ok ? 'var(--ok)' : 'var(--crit)'}` }, `${ok ? '✓' : '✗'} ${lbl}`))),
      el('div', { class: 'footnote', style: 'display:inline-block' }, ['CASL consent: ', el('span', { class: 'src' }, dr.consent_basis || '—'), ' · ', dr.consent_evidence || '']),
      // tone controls + route-to-approvals (NO send)
      el('div', { class: 'appr-actions', style: 'margin-top:12px' }, [
        ...['professional', 'friendly', 'brief'].map(t => el('button', { class: 'chip', onclick: () => { toast('Regenerate (' + t + ') → AXIS'); postIntent('regen', { item_id: dr.id, tone: t }); } }, t)),
        el('div', { style: 'flex:1' }),
        el('button', { class: 'chip', style: 'border-color:var(--gold);color:var(--gold)', onclick: () => go('approvals') }, 'Review in Approvals →')]),
    ]);
    c.append(card);
  });
};

// ── S8 Follow-ups ──
SCREENS.followups = (c) => {
  const d = data('followups');
  c.append(head('Follow-ups', `cadence day ${(d.cadence || [3, 7, 14]).join('/')} · max ${d.max_touches || 3} touches then stop · queued through Approvals`));
  const views = [['due_today', 'Due today'], ['overdue', 'Overdue'], ['upcoming', 'Upcoming'], ['auto_cancelled', 'Auto-cancelled']];
  c.append(el('div', { class: 'thread-bar' }, views.map(([id, lbl]) => el('button', { class: 'chip', 'aria-selected': state.ui.fuView === id, onclick: () => { state.ui.fuView = id; renderModule(); } }, [lbl, el('span', { class: 'count' }, (d[id] || []).length)]))));
  const rows = d[state.ui.fuView] || [];
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!rows.length) card.append(el('div', { class: 'empty' }, state.ui.fuView === 'auto_cancelled' ? 'None auto-cancelled.' : 'Nothing here.'));
  else rows.forEach(f => {
    const overdue = state.ui.fuView === 'overdue';
    card.append(el('div', { class: 'row' }, [
      el('div', { style: 'flex:1;font-weight:600' }, f.company || 'Prospect'),
      el('span', { class: 'mono', style: `font-size:11px;color:${overdue ? 'var(--crit)' : 'var(--txt-3)'}` }, new Date(f.due_at).toISOString().slice(0, 10)),
      state.ui.fuView === 'auto_cancelled'
        ? el('span', { class: 'stage-tag', style: 'color:var(--gold)' }, 'auto-cancelled (reply)')
        : el('span', { class: 'stage-tag' }, 'queued → Approvals'),
    ]));
  });
  c.append(card);
  c.append(el('div', { class: 'card', style: 'margin-top:12px;display:flex;gap:8px;align-items:center' }, [
    el('span', { class: 'eyebrow' }, 'cadence editor'),
    ...(d.cadence || [3, 7, 14]).map(day => el('span', { class: 'stage-tag' }, 'day ' + day)),
    el('button', { class: 'chip', onclick: () => { const v = prompt('Cadence days (comma-separated, max 3):', (d.cadence || [3, 7, 14]).join(',')); if (v) { toast('Cadence updated'); postIntent('cadence_edit', { days: v.split(',').map(x => +x.trim()).filter(Boolean).slice(0, 3) }); } } }, 'Edit'),
  ]));
};

SCREENS.waiting_reply = (c) => {
  const d = data('waiting_reply');
  const rows = d.rows || [];
  c.append(head('Waiting Reply', `${d.count || 0} sent · awaiting a human reply · a reply clears the row automatically · cadence day ${(d.cadence || [3, 7, 14]).join('/')}`));
  if ((d.needs_delegation || 0) > 0) {
    c.append(el('div', { class: 'card', style: 'border-left:3px solid var(--crit);margin-bottom:12px;display:flex;gap:10px;align-items:center' }, [
      el('span', { class: 'stage-tag', style: 'color:var(--crit)' }, `${d.needs_delegation} silent past cadence`),
      el('div', { style: 'flex:1;font-size:13px' }, 'These have gone cold with no reply and no scheduled touch left — hand to the Director to delegate follow-up.'),
      el('button', { class: 'chip', onclick: () => { rows.filter(r => r.delegate).forEach(r => postIntent('delegate_followup', { business_id: r.business_id, outreach_item_id: r.id })); toast('Handed to Director → follow-up agent'); } }, 'Delegate all'),
    ]));
  }
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!rows.length) card.append(el('div', { class: 'empty' }, 'Nothing waiting — no sent outreach is unanswered.'));
  else rows.forEach(r => {
    const hot = r.delegate || r.next_action === 'follow-up due';
    card.append(el('div', { class: 'row', style: 'gap:10px' }, [
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { style: 'font-weight:600' }, r.company),
        el('div', { class: 'mono', style: 'font-size:11px;color:var(--txt-3)' }, r.to_email),
      ]),
      el('span', { class: 'mono', style: `font-size:11px;color:${r.days_waiting >= 7 ? 'var(--crit)' : 'var(--txt-3)'}` }, `${r.days_waiting}d silent`),
      el('span', { class: 'stage-tag', style: 'font-size:11px;color:var(--txt-3)' }, r.touches_done ? `${r.touches_done} touch${r.touches_done === 1 ? '' : 'es'}` : 'no touch yet'),
      el('span', { class: 'stage-tag', style: `color:${hot ? 'var(--crit)' : 'var(--gold)'}` }, r.next_action),
      r.delegate
        ? el('button', { class: 'chip', onclick: () => { postIntent('delegate_followup', { business_id: r.business_id, outreach_item_id: r.id }); toast('Handed to Director → follow-up agent'); } }, 'Delegate')
        : el('button', { class: 'chip', onclick: () => go('followups') }, 'Follow-ups'),
    ]));
  });
  c.append(card);
};

// ── S9 Documents & Contracts ──
SCREENS.documents = (c) => {
  if (state.ui.doc != null) return renderDoc(c, state.ui.doc);
  const d = data('documents'); const rows = d.rows || [];
  c.append(head('Documents & Contracts', `${rows.length} Ontario DRAFT templates · merge → Approvals · e-sign future-ready`));
  const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px' });
  rows.forEach(dc => grid.append(el('div', { class: 'card', style: 'cursor:pointer', onclick: () => { state.ui.doc = dc.id; renderModule(); } }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, [el('div', { style: 'font-weight:600;font-size:13px' }, dc.type), el('span', { class: 'stage-tag', style: dc.status === 'Ready' ? 'color:var(--ok)' : '' }, dc.status)]),
    el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:6px' }, `v${(dc.versions || []).length} · ${(dc.versions || []).length} version${(dc.versions || []).length === 1 ? '' : 's'}`),
    el('div', { style: 'font-size:11px;color:var(--txt-2);margin-top:8px;max-height:44px;overflow:hidden' }, (dc.body || '').split('\n').filter(Boolean)[2] || 'DRAFT template'),
  ])));
  c.append(grid);
};
function renderDoc(c, id) {
  const dc = ((data('documents').rows) || []).find(x => x.id === id);
  if (!dc) { c.append(el('div', { class: 'empty' }, 'Not found.')); return; }
  c.append(el('div', { class: 'thread-bar' }, [el('button', { class: 'chip', onclick: () => { state.ui.doc = null; renderModule(); } }, '← Documents'),
    el('div', { style: 'flex:1' }), el('span', { class: 'stage-tag' }, dc.status)]));
  c.append(el('div', { style: 'display:flex;align-items:baseline;gap:12px;margin-bottom:10px' }, [el('div', { class: 'screen-title' }, dc.type), el('span', { class: 'eyebrow' }, dc.title)]));
  // actions
  c.append(el('div', { class: 'appr-actions', style: 'margin-bottom:12px' }, [
    el('button', { class: 'chip', style: 'border-color:var(--gold);color:var(--gold)', onclick: () => {
      const list = ((data('prospects').rows) || []).filter(p => p.is_real);
      const name = prompt('Prepare for which prospect? (type part of the name)\n' + list.slice(0, 8).map(p => '· ' + p.name).join('\n'));
      if (!name) return; const m = list.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
      if (!m) { toast('No match'); return; }
      toast(`Preparing ${dc.type} for ${m.name} → Approvals`); postIntent('prepare_for_client', { doc_id: dc.id, business_id: m.id });
    } }, 'Prepare for client'),
    el('button', { class: 'chip', onclick: () => { toast('Duplicated'); postIntent('duplicate', { doc_id: dc.id }); } }, 'Duplicate'),
    el('button', { class: 'chip', onclick: () => { toast('Downloaded (DRAFT)'); downloadText(dc.title + '.md', dc.body); } }, 'Download'),
  ]));
  // merge-fields hint
  const fields = (dc.body.match(/\{\{(\w+)\}\}/g) || []).filter((v, i, a) => a.indexOf(v) === i);
  if (fields.length) c.append(el('div', { class: 'card', style: 'margin-bottom:12px;padding:10px 14px' }, [el('span', { class: 'eyebrow' }, 'merge fields: '), el('span', { class: 'mono', style: 'font-size:11px;color:var(--gold)' }, fields.join('  '))]));
  // body (editable → new version)
  c.append(el('div', { class: 'thread-wrap' }, [
    el('textarea', { style: 'width:100%;min-height:420px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;color:var(--txt);font:inherit;font-size:12px;padding:14px;white-space:pre-wrap',
      onblur: (e) => { if (e.target.value !== dc.body) { toast('Saved as new version (old retained)'); postIntent('new_version', { doc_id: dc.id, body: e.target.value }); } } }, dc.body),
    el('aside', { class: 'rail' }, [
      el('div', { class: 'eyebrow', style: 'margin-bottom:8px' }, 'version history (append-only)'),
      ...((dc.versions || []).slice().reverse().map(v => el('div', { style: 'font-size:12px;padding:6px 0;border-bottom:1px solid var(--line)' }, [el('span', { class: 'stage-tag', style: 'margin-right:8px' }, 'v' + v.version), new Date(v.created_at).toISOString().slice(0, 10)]))),
      el('div', { class: 'eyebrow', style: 'margin:12px 0 6px' }, 'e-signature'),
      el('div', { class: 'unknown', style: 'font-size:11px' }, 'Future-ready (status only — not enabled)'),
    ]),
  ]));
}
// downloadText + the local SVG chart helpers moved to axis-dom.js / axis-charts.js — the chart
// versions there keep the same visual language but add hover, keyboard focus and drill-down.

// ── S10 Analytics ──
SCREENS.analytics = (c) => {
  const a = data('analytics');
  c.append(head('Analytics', 'computed by the worker · reconciles to SQLite'));
  const tabs = [['research', 'Research progress'], ['sales', 'Sales activity'], ['insights', 'Business insights']];
  c.append(el('div', { class: 'thread-bar' }, tabs.map(([id, lbl]) => el('button', { class: 'chip', 'aria-selected': state.ui.anTab === id, onclick: () => { state.ui.anTab = id; renderModule(); } }, lbl))));
  if (state.ui.anTab === 'research') {
    const g = a.research || {}; const geo = g.geo_coverage || {};
    c.append(kpiRow([['Total', g.total], ['Researched', g.researched], ['Toronto', geo.Toronto], ['GTA', geo.GTA]]));
    c.append(head('Geo coverage · Toronto → GTA → Ontario → Canada', '', 'margin-top:18px'));
    c.append(el('div', { class: 'card' }, [barChart(Object.entries(geo).map(([k, v]) => ({ label: k, value: v })), { colorVar: '--c2' })]));
    c.append(head('By city', '', 'margin-top:16px'));
    c.append(el('div', { class: 'card' }, [barChart(Object.entries(g.by_city || {}).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => ({ label: k, value: v })), { colorVar: '--c3' })]));
  } else if (state.ui.anTab === 'sales') {
    const s = a.sales || {};
    c.append(kpiRow([['Generated', s.generated], ['Sent', s.sent], ['Replies', s.replies], ['New req', s.new_requests], ['Meetings', s.meetings], ['Won', s.won]]));
    c.append(head('Funnel · Generated → Won', '', 'margin-top:18px'));
    c.append(el('div', { class: 'card' }, [funnelChart(s.funnel || [])]));
    c.append(head('Activity', '', 'margin-top:16px'));
    c.append(el('div', { class: 'card' }, [barChart([['Generated', s.generated], ['Follow-ups', s.followups], ['Approved', s.approved], ['Rejected', s.rejected], ['Opportunities', s.opportunities]].map(([label, value]) => ({ label, value: value || 0 })), { colorVar: '--c1' })]));
  } else {
    const ins = a.insights || {};
    c.append(kpiRow([['Pipeline $/mo', '$' + (ins.pipeline_value || 0).toLocaleString()], ['Opp MRR $/mo', '$' + (ins.opportunity_mrr || 0).toLocaleString()]]));
    c.append(head('Top prospects by est. value', '', 'margin-top:18px'));
    c.append(el('div', { class: 'card' }, [barChart((ins.top_value || []).map(t => ({ label: t.name, value: t.value })), { colorVar: '--c1', money: true })]));
    c.append(head('By industry', '', 'margin-top:16px'));
    c.append(el('div', { class: 'card' }, [barChart(Object.entries(ins.by_industry || {}).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => ({ label: k, value: v })), { colorVar: '--c5' })]));
  }
  c.append(el('div', { class: 'appr-actions', style: 'margin-top:16px' }, ['png', 'csv', 'pdf'].map(f => el('button', { class: 'chip', onclick: () => { toast('Export ' + f.toUpperCase() + ' queued'); postIntent('export', { format: f, module: 'analytics' }); } }, 'Export ' + f.toUpperCase()))));
};
function kpiRow(pairs) { return el('div', { class: 'kpi-grid' }, pairs.map(([l, v]) => el('div', { class: 'kpi' }, [el('div', { class: 'label' }, l), el('div', { class: 'value' }, v ?? 0)]))); }

// ── S13 Reports & Settings ──
SCREENS.reports = (c) => {
  const st = data('settings');
  // Reports half (S13) — charts, quarterly roll-up of daily agent work, summary→detail drill-down and
  // worker-side .xlsx export — lives in axis-reports.js. The Settings half below is unchanged, and
  // SCREENS.settings still aliases this whole screen so BOTH nav tabs keep working exactly as before.
  renderReports(c, {
    data: data('reports'), settings: st, analytics: data('analytics'),
    onIntent: (type, payload) => postIntent(type, payload),
  });
  // Settings — rails
  const rails = st.rails || {};
  c.append(head('Safety rails', '', 'margin-top:6px'));
  c.append(el('div', { class: 'card', style: 'display:flex;gap:20px;flex-wrap:wrap' }, [
    settingBox('Daily cap', rails.daily_cap), settingBox('Quiet hours', `${rails.quiet_hours?.start ?? 21}:00–${rails.quiet_hours?.end ?? 8}:00 ET`),
    settingBox('Follow-up cadence', (rails.followup_days || [3, 7, 14]).join('/') + ' d'), settingBox('Max touches', rails.max_followups ?? 3),
    settingBox('Suppression list', st.suppression_count ?? 0),
  ]));
  // Integrations
  c.append(head('Integrations', '', 'margin-top:16px'));
  const dot = (s) => s === 'ok' ? 'dot-ok' : s === 'error' ? 'dot-crit' : 'dot-warn';
  c.append(el('div', { class: 'card', style: 'padding:0' }, (st.integrations || []).map(ig => el('div', { class: 'row' }, [
    el('span', { class: 'dot ' + dot(ig.status) }), el('div', { style: 'width:120px;font-weight:600' }, ig.name),
    el('div', { style: 'flex:1;color:var(--txt-3);font-size:12px' }, ig.detail), el('span', { class: 'stage-tag' }, ig.status)]))));
  // Data & backups
  c.append(head('Data & backups', '', 'margin-top:16px'));
  c.append(el('div', { class: 'card' }, [el('div', { style: 'font-size:12px;color:var(--txt-2)' }, `System of record: ${st.data?.db || 'data/axis-sales.db'} (SQLite, local, gitignored). Last backup: ${st.data?.last_backup || '—'}.`)]));
};
function settingBox(label, value) { return el('div', {}, [el('div', { class: 'eyebrow' }, label), el('div', { style: 'font-size:16px;font-weight:600;margin-top:4px' }, value ?? '—')]); }
SCREENS.settings = SCREENS.reports; // Reports & Settings share the screen (spec S13)

// ── Fleet — the live agent floor. Was the only NAV entry with no SCREENS handler at all, so it fell
// through to placeholder() and rendered raw snapshot JSON. agent_runs is genuinely empty until the
// worker records runs, and the screen is built to look correct in that state rather than fake one.
// S15 Priorities — one queue of everything open, ordered by due date. Reads only existing snapshot
// modules; no new endpoint, no new field, nothing invented (see assets/axis-priorities.js).
SCREENS.priorities = (c) => renderPriorities(c, { snap: state.snap, go, head });

SCREENS.fleet = (c) => {
  renderFleet(c, { data: data('fleet'), onIntent: (type, payload) => postIntent(type, payload) });
};

// ── S11 Product Discovery (Miner) ──
SCREENS.products = (c) => {
  const d = data('products'); const rows = d.rows || [];
  c.append(head('Product Discovery', `${rows.length} opportunities · scored 1–5 · weighted rank · → AXIS review`));
  if (!rows.length) { c.append(el('div', { class: 'empty' }, 'Miner has not run yet.')); return; }
  const axes = [['demand', 'Demand'], ['ease', 'Ease'], ['profitability', 'Profit'], ['scalability', 'Scale'], ['advantage', 'Edge']];
  rows.forEach((p, i) => {
    const card = el('div', { class: 'card', style: 'margin-bottom:12px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, [
        el('div', {}, [el('span', { class: 'mono', style: 'color:var(--gold);margin-right:8px' }, '#' + (i + 1)), el('span', { style: 'font-weight:600' }, p.name)]),
        el('div', { style: 'display:flex;gap:8px;align-items:center' }, [el('span', { class: 'mono', style: 'color:var(--gold);font-size:15px' }, (p.weighted_score ?? 0).toFixed(1)), el('span', { class: 'stage-tag', style: p.status === 'Recommended' ? 'color:var(--ok)' : '' }, p.status)])]),
      el('div', { style: 'font-size:11px;color:var(--txt-3);margin:4px 0 10px' }, p.category),
      // 5-axis mini-meters
      el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px' }, axes.map(([k, lbl]) => el('div', { style: 'min-width:90px' }, [
        el('div', { style: 'display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px' }, [el('span', { style: 'color:var(--txt-3)' }, lbl), el('span', { class: 'mono', style: 'color:var(--gold)' }, (p.axes?.[k] ?? '—') + '/5')]),
        el('div', { style: 'display:flex;gap:2px' }, [1, 2, 3, 4, 5].map(n => el('span', { style: `width:12px;height:5px;border-radius:2px;background:${n <= (p.axes?.[k] || 0) ? 'var(--gold)' : 'var(--surface-3)'}` }))),
      ]))),
      // evidence + action
      el('div', { class: 'footnote', style: 'display:inline-block;margin-bottom:10px' }, ['evidence: ', el('span', { class: 'src' }, evidenceText(p.evidence))]),
      el('div', { class: 'appr-actions' }, [el('button', { class: 'chip', style: 'border-color:var(--gold);color:var(--gold)', onclick: () => { toast('Sent to AXIS review'); postIntent('send_to_axis_review', { product_id: p.id }); } }, 'Send to AXIS review')]),
    ]);
    c.append(card);
  });
};
function evidenceText(e) {
  if (!e) return '—';
  if (e.need_count != null) return `${e.need_count} of ${e.of_prospects} researched prospects need this${e.sample ? ' (e.g. ' + e.sample.slice(0, 2).join(', ') + ')' : ''}`;
  return e.market_signal || JSON.stringify(e).slice(0, 80);
}

function placeholder(label) {
  return (c) => {
    c.append(head(label, 'live data bound · full UI in a later phase'));
    const d = state.snap[state.module] && state.snap[state.module].data;
    c.append(el('div', { class: 'card' }, [el('div', { class: 'eyebrow', style: 'margin-bottom:8px' }, 'snapshot payload (real, from /api/axis/snapshot)'),
      el('pre', { class: 'mono', style: 'font-size:11px;white-space:pre-wrap;color:var(--txt-2);margin:0;max-height:340px;overflow:auto' }, d ? JSON.stringify(d, null, 2) : '(empty)')]));
  };
}
function renderModule() {
  clearOverlays();
  const c = $('content'); c.innerHTML = '';
  const screen = el('div', { class: 'screen' }); c.append(screen);
  (SCREENS[state.module] || placeholder(navItem(state.module)?.label || state.module))(screen);
  syncDockVisibility();
}
function clearOverlays() { document.querySelectorAll('.drawer, .drawer-bg').forEach(n => n.remove()); }

// ── Snapshot loop ──
function renderTick() { $('tick').textContent = state.source === 'seed' ? 'seed data · worker idle' : (state.version && state.version.tick ? 'last worker tick ' + state.version.tick.slice(11, 16) : 'live'); }
// An open composer holds text the operator is typing. renderModule() rebuilds the whole content area
// and clearOverlays() sweeps drawers, so re-rendering underneath a modal is how a half-written email
// gets destroyed by a background tick — the same class of bug already fixed once for the AXIS strip
// input. Take the fresh data, but defer the repaint until the overlay closes.
const overlayOpen = () => !!document.querySelector('.axis-overlay-bg');
document.addEventListener('axis:overlay-closed', () => {
  if (state.ui.repaintPending) { state.ui.repaintPending = false; renderModule(); }
});
// AM2 — the published program figures and their evidence stamps. Authed-only; a failure leaves
// state.programStatus null, and the Director section says "not loaded" rather than showing an empty
// figure set. Never fetched unauthenticated: this payload is operator-internal by design.
async function fetchProgramStatus() {
  try {
    const r = await fetch('/api/axis-status', { headers: authHeaders(), cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.ok) { state.programStatus = j; if (state.module === 'axis-agent-director' && !overlayOpen()) renderModule(); }
  } catch {}
}
async function fetchSnapshots() {
  fetchProgramStatus();
  const r = await fetch('/api/axis/snapshot?module=all', { headers: authHeaders(), cache: 'no-store' });
  if (r.status === 401) return logout();
  const j = await r.json();
  if (j && j.ok) {
    state.snap = j.snapshots || {}; state.version = j.version; state.source = j.source;
    renderTick(); renderNav(); renderAxisPri();   // the console rail tracks the snapshot, not the dock
    if (overlayOpen()) { state.ui.repaintPending = true; return; }
    renderModule();
  }
}
async function pollVersion() {
  try { const r = await fetch('/api/axis/snapshot', { headers: authHeaders(), cache: 'no-store' }); if (r.status === 401) return logout();
    const j = await r.json(); if (j && j.ok && (!state.version || j.version.v !== state.version.v)) fetchSnapshots(); } catch {}
}

// ── AXIS dock ──
const dockLog = [];
function renderAxisLog(log) {
  log.innerHTML = '';
  if (!dockLog.length) log.append(el('div', { class: 'empty', style: 'padding:20px' }, 'Talk to AXIS. Blunt. Important-only.'));
  dockLog.forEach(m => {
    const node = (m.role === 'axis' && m.text === '…')
      ? el('div', { class: 'axis-msg axis axis-thinking', role: 'status', 'aria-label': 'AXIS is thinking' }, [el('span'), el('span'), el('span')])
      : el('div', { class: 'axis-msg ' + m.role }, m.text);
    if (m.chips) node.append(el('div', { class: 'chips' }, m.chips.map(ch => el('button', { class: 'chip', onclick: ch.onclick }, ch.label))));
    log.append(node);
  });
  log.scrollTop = log.scrollHeight;
}
function renderDock() {
  for (const id of ['axisLog', 'axisDirectorLog']) {
    const log = $(id);
    if (log) renderAxisLog(log);
  }
  renderAxisPri();
}

// Poll the tier-3 queue until the Max plan answer lands, then swap it into the message that is
// already on screen. Bounded so a dead worker can never leave the console polling forever.
async function axisCollect(jobId, msg, tries = 0) {
  if (tries > 30) {                                   // ~60s ceiling
    msg.text = 'The Max plan did not answer in time. Ask again — it may already be banked.';
    renderDock(); return;
  }
  await new Promise(r => setTimeout(r, 2000));
  try {
    const r = await fetch('/.netlify/functions/axis-brain-queue', {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'poll', id: jobId }),
    });
    const p = await r.json();
    if (p && p.ready && p.answer) {
      msg.text = String(p.answer);
      renderDock();
      if (axisSpeak(msg.text)) __turnDone = axisTurnDone;
      return;
    }
    if (p && p.ready && p.error) { msg.text = 'The Max plan hit an error on that one.'; renderDock(); return; }
  } catch { /* transient — keep polling until the ceiling */ }
  return axisCollect(jobId, msg, tries + 1);
}



// Queue a real task for the worker on Ahmad's machine (build a video, upload a batch, self-fix).
// READ-ONLY kinds run immediately; anything that spends, edits or publishes has already been
// confirmed out loud by the time it gets here.
async function axisRunOp(op) {
  try {
    const r = await fetch('/.netlify/functions/axis-brain-queue', {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'task', kind: op.kind, arg: op.arg || '', confirmed: true }),
    });
    const j = await r.json();
    if (!j || !j.ok) { const m = 'Could not queue that.'; dockLog.push({ role: 'axis', text: m }); renderDock(); axisSpeakTurn(m); return; }
    const ack = op.kind === 'self.fix' ? 'On it — Claude Code is working on that now. I will tell you when it lands.'
      : op.kind === 'video.upload' ? 'Uploading now. I will report back.'
      : 'On it.';
    dockLog.push({ role: 'axis', text: ack }); renderDock(); axisSpeakTurn(ack);
    axisCollect(j.id, { role: 'axis', text: ack });   // the worker's result replaces this line
  } catch {
    const m = 'I could not reach the worker.'; dockLog.push({ role: 'axis', text: m }); renderDock(); axisSpeakTurn(m);
  }
}

// Speak a reply the way a person would: the useful part now, the rest on request. The full text is
// always in the transcript — chunking shapes the SPOKEN turn only, so nothing is ever lost.
function axisSpeakTurn(text) {
  const { say, rest, offer } = splitForTurns(text);
  axisHeldRest = rest || '';
  const spoken = offer ? say + '\n' + offer : say;
  if (axisSpeak(spoken)) __turnDone = axisTurnDone; else { setAxisState('idle'); axisTurnDone(); }
}

// The conversation as the brain must see it — BOTH sides of it.
//
// This used to send `dockLog.filter(m => m.role === 'user')`: AXIS's own replies were stripped out
// before the request left the browser, so the model never saw a single word it had said. That is
// why "do what you just mentioned" drew a blank — not a memory bug, a transcript that had been
// censored down to half a conversation. The screen showed the full exchange the whole time, which
// is exactly what made it look like forgetting.
//
// Shaping rules the Messages API enforces: roles must alternate, the first message must be from the
// user, and the last must be too. Consecutive same-role lines (AXIS often pushes two in a row) are
// joined rather than dropped, so nothing it said is lost.
function axisHistory(exclude) {
  const turns = [];
  for (const m of dockLog) {
    if (m === exclude) continue;                       // our own '…' placeholder is not a turn
    const text = String(m.text || '').trim();
    if (!text || text === '…') continue;
    const role = m.role === 'axis' ? 'assistant' : 'user';
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content += '\n' + text;
    else turns.push({ role, content: text });
  }
  const recent = turns.slice(-16);                     // the server caps at 16; trim here too
  while (recent.length && recent[0].role !== 'user') recent.shift();  // must OPEN on a user turn
  return recent;
}

// Board questions are answered from the snapshot already in memory — no function call, no network,
// no model. Ahmad, 2026-08-11: "it takes long to think." For "what needs me" that wait was pure
// latency for data sitting in the page. Anything this cannot answer falls through untouched.
function axisInstantAnswer(text) {
  try { return localAnswer(text, state.snap); } catch { return null; }
}

// ── AXIS console furniture (2026-08-11 redesign) ─────────────────────────────
const HEAR_IDLE = 'Press the mic, or type. Say “AXIS stop” to stand me down.';
// The live line under the orb. While listening it mirrors the interim transcript, so there is always
// visible proof AXIS is hearing you — the old silent mic was indistinguishable from a broken one.
function axisSetHear(msg, live) {
  const h = $('axisHear'); if (!h) return;
  h.textContent = msg || HEAR_IDLE;
  h.classList.toggle('live', !!(live && msg));
}

// Top 3 of what is actually due, shown without leaving the conversation. Same source as the
// Priorities screen, so the two can never disagree.
const PRI_TONE = { over: 'var(--crit)', today: 'var(--gold)', soon: 'var(--txt-2)', later: 'var(--txt-3)', none: 'var(--txt-3)' };
function renderAxisPri() {
  const box = $('axisPri'); if (!box) return;
  let items = [];
  try { items = collectPriorities(state.snap).slice(0, 3); } catch { items = []; }
  box.innerHTML = '';
  if (!items.length) { box.hidden = true; return; }   // nothing due → no rail at all, never a "0"
  box.hidden = false;
  box.append(el('div', { class: 'axis-pri-head' }, [
    el('span', { class: 'eyebrow' }, 'Top priorities'),
    el('button', { class: 'chip', onclick: () => go('priorities') }, 'All'),
  ]));
  for (const it of items) {
    const d = dueLabel(it.dueAt); const col = PRI_TONE[d.tone];
    box.append(el('button', { class: 'axis-pri-item', title: it.title + ' — ' + d.text, onclick: () => go(it.screen) }, [
      el('span', { class: 'axis-pri-dot', style: 'background:' + col }),
      el('span', { class: 'axis-pri-t' }, it.title),
      el('span', { class: 'axis-pri-d', style: 'color:' + col }, d.text),
    ]));
  }
}

// Voice picker. Edge ships the "Online (Natural)" neural set, Chrome ships Google's network voices —
// so the same page genuinely sounds different per browser and no code can make them identical for
// free. What this does is show the inventory THIS browser has, ranked best-first, and let a choice
// be pinned (same localStorage key the v1 console used).
function axisShortVoice(n) {
  return String(n || '').replace(/^Microsoft\s+/i, '').replace(/\s*Online\s*\(Natural\)\s*/i, ' ')
    .replace(/\s*-\s*English.*$/i, '').replace(/\s+/g, ' ').trim();
}
function axisPopulateVoices() {
  const sel = $('axisVoicePick'); if (!sel) return;
  const all = ((window.speechSynthesis && speechSynthesis.getVoices()) || []).filter(v => /^en/i.test(v.lang || ''));
  if (!all.length) return;                       // Chrome loads voices async — onvoiceschanged retries
  let cur = ''; try { cur = localStorage.getItem('axis-voice-name') || ''; } catch {}
  const auto = axisPickVoice();
  sel.innerHTML = '';
  sel.append(el('option', { value: '' }, 'Voice · automatic' + (auto ? ' — ' + axisShortVoice(auto.name) : '')));
  for (const v of all.slice().sort((a, b) => axisScoreVoice(b) - axisScoreVoice(a)))
    sel.append(el('option', { value: v.name }, axisShortVoice(v.name) + ' · ' + v.lang + ' · ' + voiceFamily(v.name)));
  sel.value = cur;
}
const AXIS_VOICE_SAMPLE = 'Axis here, Ahmad. This is how I sound in this browser.';

// Persistent brain-state badge. An outage that only shows in one chat line scrolls away; this keeps
// "answering from the board, reasoning is down" visible for as long as it is true.
const BRAIN_LABEL = { no_credit: 'brain: out of credit', auth: 'brain: key rejected', no_key: 'brain: no key',
  permission: 'brain: no access', bad_model: 'brain: bad model', rate_limit: 'brain: rate limited',
  overloaded: 'brain: overloaded', unreachable: 'brain: unreachable' };
function axisBrainDown(reason) {
  const el0 = $('axisBrain'); if (!el0) return;
  if (!reason) { el0.hidden = true; return; }
  el0.hidden = false;
  el0.textContent = BRAIN_LABEL[reason] || 'brain: degraded';
  el0.title = 'AXIS is answering from the snapshot only — reasoning is unavailable.';
}
async function axisSend(inputId = 'axisInput') {
  const inp = $(inputId); const raw = inp?.value.trim(); if (!raw) return; inp.value = '';
  // JARVIS turn grammar, applied before the director ever sees the utterance:
  //   1. "AXIS stop" is the spoken kill-switch — it aborts, it never routes.
  //   2. A pending route can be confirmed or cancelled by voice (routes only; hard-stops stay clicks).
  //   3. A leading wake phrase is stripped so "AXIS, what's going on" asks "what's going on".
  if (isStop(raw)) {
    dockLog.push({ role: 'user', text: raw }); axisStandDown();
    // Stop silences the voice. It does NOT wipe the conversation's place — the parked proposal and
    // the un-spoken tail both survive, so "do what you just mentioned" still has an antecedent.
    // Saying what is still held is the difference between interrupting a person and resetting a
    // machine: you cut them off, they stop talking, and the thing they offered is still on the table.
    const held = axisPendingOp ? axisPendingOp.confirm.replace(/\.\s*Say confirm.*$/i, '')
      : axisHeldRest ? 'the rest of that list' : '';
    const line = held ? 'Stood down. Still holding: ' + held + '.' : 'Stood down.';
    dockLog.push({ role: 'axis', text: line }); renderDock(); return;
  }
  const text = stripWake(raw) || raw;
  if (axisPendingRoute) {
    const pr = axisPendingRoute; axisPendingRoute = null;
    if (isConfirm(text) || isDeny(text)) {
      dockLog.push({ role: 'user', text: raw });
      let line;
      if (isConfirm(text)) { postIntent('approve', { intent: pr.intent, agent: pr.agent }); toast('Routed to ' + pr.agent); line = 'Confirmed. Routed to ' + pr.agent + '.'; }
      else line = 'Cancelled. Nothing queued.';
      dockLog.push({ role: 'axis', text: line }); renderDock();
      if (axisSpeak(line)) __turnDone = axisTurnDone; else { setAxisState('idle'); axisTurnDone(); }
      return;
    }
    // Anything else is simply a new question — the unconfirmed route expires, nothing is queued.
  }
  // "go on" releases the held tail of the last answer — no round trip.
  if (axisHeldRest && (isContinue(text) || isReferential(text))) {
    dockLog.push({ role: 'user', text: raw });
    const rest = axisHeldRest; axisHeldRest = '';
    dockLog.push({ role: 'axis', text: rest }); renderDock();
    axisSpeakTurn(rest);
    return;
  }
  dockLog.push({ role: 'user', text }); renderDock();

  // A task AXIS read back is confirmed, cancelled — or simply left parked.
  //
  // It used to be consumed after exactly one turn: whatever you said next, the proposal was gone.
  // Say "stop" in between and it vanished silently, so "do the thing you just mentioned" had no
  // antecedent left to point at. A proposal now survives an interruption and an aside; it expires on
  // a timer instead, because a stale "go ahead" must never fire something offered ten minutes ago.
  if (axisPendingOp && Date.now() - (axisPendingOp.t || 0) > 5 * 60 * 1000) axisPendingOp = null;
  if (axisPendingOp) {
    const op = axisPendingOp;
    if (isConfirm(text) || isReferential(text)) { axisPendingOp = null; await axisRunOp(op); return; }
    if (isDeny(text)) { axisPendingOp = null; const m = 'Cancelled.'; dockLog.push({ role: 'axis', text: m }); renderDock(); axisSpeakTurn(m); return; }
    // Anything else is a new request. The proposal stays parked rather than being thrown away —
    // it is still the antecedent for a later "do that", and detectOp below replaces it outright if
    // you ask for something different.
  }

  // Does this ask AXIS to DO something? Read it back and wait, except for read-only checks.
  const op = detectOp(text);
  if (op) {
    if (op.kind === 'video.status') { await axisRunOp(op); return; }
    axisPendingOp = { ...op, t: Date.now() };
    dockLog.push({ role: 'axis', text: op.confirm }); renderDock();
    axisSpeakTurn(op.confirm);
    return;
  }

  // Instant path: anything the board can answer needs no network at all.
  const instant = axisInstantAnswer(text);
  if (instant) {
    dockLog.push({ role: 'axis', text: instant }); renderDock();
    axisSpeakTurn(instant);
    return;
  }
  // Remove OUR placeholder by reference, never the array tail — concurrent sends must not eat
  // each other's replies or orphan a fake thinking row (gate-review finding, 2026-07-21).
  const pending = { role: 'axis', text: '…' };
  const dropPending = () => { const i = dockLog.indexOf(pending); if (i >= 0) dockLog.splice(i, 1); };
  dockLog.push(pending); renderDock();
  setAxisState('thinking'); // orb + state word: awaiting the director brain
  // No dead air on a spoken turn: acknowledge instantly while the director round-trips. Typed turns
  // already show the thinking dots and stay silent — this is not chatter added to keyboard use.
  if (axisSpokenTurn || axisHandsFree) axisSpeak(ackLine());
  try {
    const r = await fetch('/.netlify/functions/axis-director', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ action: 'chat', messages: axisHistory(pending) }) });
    const j = await r.json(); dropPending();
    const reply = { role: 'axis', text: (j && j.text) || 'Heard you.' };
    // Brain unavailable (no credit / bad key / network): answer from the board instead of going
    // mute. The outage is reported ONCE per session so it is visible but not repeated every turn.
    if (j && j.degraded) {
      const local = localAnswer(text, state.snap);
      if (local) {
        reply.text = local;
        let told = false; try { told = sessionStorage.getItem('axisBrainNoted') === '1'; } catch {}
        if (!told) { try { sessionStorage.setItem('axisBrainNoted', '1'); } catch {} toast(j.text); dockLog.push({ role: 'axis', text: j.text }); }
      }
      axisBrainDown(j.reason || 'degraded');
    } else axisBrainDown(null);
    if (j && j.routedAgent && j.intent) {
      reply.chips = [{ label: 'Approve route', onclick: () => { postIntent('approve', { intent: j.intent, agent: j.routedAgent }); toast('Routed to ' + j.routedAgent); } }];
      // Hard-stops stay hard-stops, spoken (spec §SAFETY RAILS). A route the worker runs behind its
      // rails may be confirmed by voice; anything flagged needsApproval is click-only and AXIS
      // says so out loud rather than quietly self-authorizing because a voice flow feels fast.
      if (!j.needsApproval) axisPendingRoute = { intent: j.intent, agent: j.routedAgent };
      reply.text += ' ' + routeTail(j.routedAgent, j.needsApproval);
    }
    dockLog.push(reply); renderDock();
    axisSpeakTurn(reply.text);
    // The Max plan needs ~17s for a real answer; the function returns in ~10s and hands back a job
    // id. Collect it here and replace the placeholder in place, so the answer arrives on its own
    // rather than the user having to ask a second time.
    if (j && j.pending && j.jobId) axisCollect(j.jobId, reply);
  } catch { dropPending(); dockLog.push({ role: 'axis', text: 'Brain unreachable.' }); renderDock(); if (!axisSpeak('Brain unreachable.')) setAxisState('idle'); axisSpokenTurn = false; }
}

// ── AXIS voice (restored from the v1 console, full behavior) — mic push-to-talk + spoken replies,
// free browser Web Speech API; no paid API, no LLM. Ported from assets/aperture-learning.js
// (4ee1b883 push-to-talk, 0e17c2ca humanized voice — Ahmad: "sounds robotic" fix). Voice defaults ON
// (Ahmad: "I want to talk, it's faster"); a manual voice override persists in localStorage and is the
// SAME key the v1 console used, so a voice picked there carries over here.
let axisVoiceOn = true, axisRec = null, axisListening = false;

// Rank the most HUMAN English voice the OS/browser offers: Neural/Natural (Edge online) > Google
// (Chrome online) > Premium/Enhanced (macOS) > male-leaning names (AXIS persona) > any en-US/CA.
function axisScoreVoice(v) {
  try {
    const n = (v.name || '') + ' ' + (v.voiceURI || '');
    let s = 0;
    if (/natural|neural/i.test(n)) s += 100;
    if (/google/i.test(n)) s += 60;
    if (/premium|enhanced|siri/i.test(n)) s += 50;
    if (/online/i.test(n)) s += 20;
    if (/(guy|davis|andrew|brian|christopher|eric|roger|steffan|ryan|thomas|daniel|alex|arthur|george|james|mark)/i.test(n)) s += 12;
    if (/^en(-|_)?(US|CA)/i.test(v.lang || '')) s += 8; else if (/^en/i.test(v.lang || '')) s += 4; else s -= 50;
    if (/david|zira|sam\b/i.test(n) && !/natural|neural|online/i.test(n)) s -= 15; // legacy SAPI = the robotic sound
    // AXIS persona overlay (2026-08-11, Ahmad: "a unique woman's voice"). Applied LAST so it decides:
    // +en-GB register, +named AXIS voices, −ARIA's own voices (no confusion with the customer orb),
    // −male (the +12 line above is superseded by −60, kept only so no prior behavior is deleted).
    s += axisPersonaBonus(n, v.lang);
    return s;
  } catch { return -1; }
}
function axisPickVoice() {
  try {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    if (!vs.length) return null;
    let wanted = ''; try { wanted = localStorage.getItem('axis-voice-name') || ''; } catch {}
    if (wanted) { const hit = vs.find(v => v.name === wanted); if (hit) return hit; }
    return vs.slice().sort((a, b) => axisScoreVoice(b) - axisScoreVoice(a))[0] || null;
  } catch { return null; }
}
// Manual controls (DevTools or console): cycle voices / set a specific one. Persisted.
window.axisVoiceNext = function () {
  try {
    const vs = ((window.speechSynthesis && speechSynthesis.getVoices()) || []).filter(v => /^en/i.test(v.lang || ''));
    if (!vs.length) return null;
    const cur = axisPickVoice();
    const i = Math.max(0, vs.findIndex(v => cur && v.name === cur.name));
    const nxt = vs[(i + 1) % vs.length];
    try { localStorage.setItem('axis-voice-name', nxt.name); } catch {}
    axisSpeak('Now speaking with ' + nxt.name.replace(/microsoft|google|online|\(|\)/gi, ' ').replace(/\s+/g, ' ').trim() + '.');
    return nxt.name;
  } catch { return null; }
};
window.axisSetVoice = function (name) { try { localStorage.setItem('axis-voice-name', String(name || '')); } catch {} return name; };

// Make text sound like a person, not a screen reader: strip glyphs/markdown, speak symbols naturally.
function axisHumanizeForSpeech(text) {
  let t = String(text || '');
  t = t.replace(/[•·▪◦●⚠🔊🔇🎙✅❌→]/g, ' ')
       .replace(/[*_`#>\[\]]/g, ' ')
       .replace(/https?:\/\/([^\s\/]+)[^\s]*/gi, '$1')
       .replace(/\b24\s*\/\s*7\b/g, 'twenty-four seven')
       .replace(/\bw\//gi, 'with ')
       .replace(/\be\.g\.\s*/gi, 'for example, ')
       .replace(/\bi\.e\.\s*/gi, 'that is, ')
       .replace(/(\d+)\s*%/g, '$1 percent')
       .replace(/\s[-–—]\s/g, ', ')
       .replace(/\s*\n+\s*/g, '. ')
       .replace(/\.\s*\./g, '.')
       .replace(/\s+/g, ' ').trim();
  return t;
}
let __speakGen = 0; // generation guard: a stale utterance's onend must never clobber a newer state
// Set just before a reply is spoken; fired when that reply finishes NATURALLY. This is the hand-back
// point for hands-free turn-taking. Kept as a module flag (not a axisSpeak argument) so every
// existing axisSpeak(...) call site stays byte-identical.
let __turnDone = null;
function axisSpeak(text) {
  try {
    if (!axisVoiceOn || !window.speechSynthesis) return false;
    const clean = axisHumanizeForSpeech(text);
    if (!clean) return false;
    speechSynthesis.cancel(); // barge-in: a new reply always interrupts the old one
    const gen = ++__speakGen;
    const v = axisPickVoice();
    const natural = !!(v && /natural|neural|google|premium|enhanced/i.test(v.name || ''));
    // Clause-aware chunking so delivery breathes at commas, not only full stops — and still caps at
    // 180 chars to avoid Chrome's long-utterance cutoff. polishForSpeech says jargon like a person
    // ("KB" → "knowledge base") instead of spelling it out.
    const queue = phraseChunks(polishForSpeech(clean), 180);
    setAxisState('speaking');
    // Deafen the wake listener while AXIS talks, or it hears its own voice say "Axis" and wakes
    // itself in a loop. The mic comes back in axisTurnDone / restMic.
    axisWakePause();
    queue.forEach((part, qi) => {
      const u = new SpeechSynthesisUtterance(part);
      if (v) { u.voice = v; u.lang = v.lang; }
      // Cross-engine parity: each voice family is rate/pitch-corrected toward Edge's Sonia, so AXIS
      // sounds like the same character in Chrome and Edge even though the two ship different voices.
      // Still deliberately apart from ARIA's en-US .95/1.05.
      const prof = voiceProfile(v);
      u.rate = prof.rate; u.pitch = prof.pitch; u.volume = 1;
      // cancel() fires 'error' (interrupted/canceled), not 'end' — without onerror the machine
      // would stick on 'speaking' forever (gate-review finding). Every chunk resets, gen-guarded.
      const settle = () => { if (gen === __speakGen && document.documentElement.dataset.axisState === 'speaking') setAxisState('idle'); axisWakeResume(); };
      // A natural finish on the last chunk ends AXIS's turn and hands the floor back (hands-free).
      // onerror must NOT: that is a barge-in, and the mic is already opening on its own.
      if (qi === queue.length - 1) u.onend = () => { settle(); const done = __turnDone; __turnDone = null; if (gen === __speakGen && done) { try { done(); } catch {} } };
      u.onerror = settle;
      speechSynthesis.speak(u);
    });
    const b = $('axisVoice'); if (b && v) b.title = 'Voice: ' + v.name + ' — cycle: axisVoiceNext()';
    return true;
  } catch { return false; }
}
function axisSyncVoiceBtn() {
  for (const id of ['axisVoice', 'axisPubVoice', 'axisDirectorVoice']) {
    const b = $(id);
    if (b) { b.setAttribute('aria-pressed', axisVoiceOn ? 'true' : 'false'); b.style.color = axisVoiceOn ? 'var(--gold)' : ''; b.style.borderColor = axisVoiceOn ? 'var(--gold)' : ''; b.title = axisVoiceOn ? 'Spoken replies ON' : 'Toggle spoken replies'; }
  }
}
function axisVoiceToggle() {
  axisVoiceOn = !axisVoiceOn;
  axisSyncVoiceBtn();
  if (axisVoiceOn) axisSpeak('Voice on. Ask me for a status update.');
  else if ('speechSynthesis' in window) { speechSynthesis.cancel(); if (document.documentElement.dataset.axisState === 'speaking') setAxisState('idle'); }
  toast('AXIS voice ' + (axisVoiceOn ? 'on' : 'off'));
}
// Collect interim + final text out of a recognition event. Interim is what makes the mic feel alive:
// Ahmad sees his words land in the box as he speaks, so "is it even listening?" never comes up.
function axisReadTranscript(ev) {
  let interim = '', final = '';
  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    const r = ev.results[i];
    if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
  }
  return { interim: interim.trim(), final: final.trim() };
}
function axisFill(inputId, t) {
  const box = $(inputId); if (box) box.value = t.final || t.interim;
  axisSetHear(t.interim || t.final, true);   // live proof AXIS is hearing you
}

// Every way the mic can fail, said in plain language with the fix. Silence was the old behavior and
// it read as "AXIS is broken" (Ahmad: "it does not hear me or respond").
function axisMicNote(msg) {
  dockLog.push({ role: 'axis', text: msg }); renderDock(); toast(msg); axisSetHear(msg, false);
}
function axisMicError(e) {
  const code = (e && e.error) || '';
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    axisMicNote('Microphone is blocked. Click the padlock in the address bar, allow the mic, then reload.');
    axisHandsFree = false; axisWakePause(); axisSyncWakeBtn();
  } else if (code === 'no-speech') axisMicNote('I did not hear anything. Try again, a little closer to the mic.');
  else if (code === 'audio-capture') axisMicNote('No microphone found. Check your input device.');
  else if (code === 'network') axisMicNote('Speech recognition needs the network and it is not reachable right now.');
  else if (code !== 'aborted') axisMicNote('Microphone error: ' + (code || 'unknown') + '.');
}

// Push-to-talk, shared by the dock and the public panel (one mic at a time).
function axisMicToggle(micId = 'axisMic', inputId = 'axisInput', send = axisSend) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { axisMicNote('Voice input needs Chrome or Edge — this browser has no speech recognition.'); return; }
  if (axisListening) { try { axisRec && axisRec.stop(); } catch {} return; }
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch {} // barge-in: talking over AXIS stops it
  axisWakePause(); // one SpeechRecognition at a time — the wake listener yields to push-to-talk
  const mic = $(micId);
  let heard = '';
  const restMic = () => { axisListening = false; if (mic) { mic.style.color = ''; mic.style.borderColor = ''; mic.textContent = '🎙'; } if (document.documentElement.dataset.axisState === 'listening') setAxisState('idle'); if (!heard) axisSetHear('', false); axisWakeResume(); };
  axisRec = new SR(); axisRec.lang = 'en-CA'; axisRec.interimResults = true; axisRec.maxAlternatives = 1;
  axisRec.onstart = () => { axisListening = true; setAxisState('listening'); axisSetHear('Listening…', false); if (mic) { mic.style.color = 'var(--gold)'; mic.style.borderColor = 'var(--gold)'; mic.textContent = '⏺'; } };
  // A silent close is the single most confusing outcome — always say something.
  axisRec.onend = () => { restMic(); if (!heard) axisMicNote('I did not catch that — press the mic and say it again.'); };
  axisRec.onerror = (e) => { restMic(); axisMicError(e); };
  axisRec.onresult = (ev) => { const t = axisReadTranscript(ev); axisFill(inputId, t); if (t.final) { heard = t.final; axisSpokenTurn = true; send(); } };
  try { axisRec.start(); } catch { axisMicNote('Microphone is busy — another tab or app may be using it.'); restMic(); }
}

// ── AXIS hands-free flow (JARVIS) ────────────────────────────────────────────
// Wake word → capture → instant ack → spoken answer → the floor comes straight back to Ahmad, no
// button. Opt-in and OFF by default: it holds the microphone open, so it is never switched on for
// someone without them asking. State persists per browser.
// Kill-switch, per spec: say "AXIS stop" or press Ctrl+Alt+K. Both abort speech, mic, and any
// unconfirmed route. Nothing here can send, approve, or pay — it only shapes the conversation.
let axisHandsFree = false;      // wake word + auto turn-taking
let axisWakeRec = null;         // the background continuous recognizer
let axisWakeArmed = false;      // wanted-running (survives the browser's own auto-stops)
let axisSpokenTurn = false;     // this turn came in by voice → answer with voice manners
let axisPendingRoute = null;    // {intent, agent} awaiting a spoken confirm — routes only
let axisHeldRest = '';          // the un-spoken tail of a chunked answer, released on "go on"
let axisPendingOp = null;       // an operational task read back and awaiting a spoken confirm

// Which surface a hands-free turn belongs to. The Agent Director tab has its own command channel and
// openDock() deliberately refuses to cover it, so a wake there must drive ITS input, not the hidden
// dock's. One transcript either way — renderDock() fills both logs.
function axisSurface() {
  return state.module === 'axis-agent-director' && $('axisDirectorInput')
    ? { inputId: 'axisDirectorInput', micId: 'axisDirectorMic' }
    : { inputId: 'axisInput', micId: 'axisMic' };
}

function axisWakeStart() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Hands-free needs Chrome or Edge'); return false; }
  try { axisWakeRec && axisWakeRec.abort(); } catch {}
  const rec = new SR();
  rec.lang = 'en-CA'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
  rec.onresult = (ev) => {
    const r = ev.results[ev.results.length - 1];
    if (!r || !r.isFinal) return;
    const said = String(r[0] && r[0].transcript || '').trim();
    if (!said) return;
    if (isStop(said)) { axisStandDown(); return; }           // stand-down wins over everything
    if (!isWake(said)) return;                                // not addressed to AXIS — ignore it
    const rest = stripWake(said);
    const s = axisSurface();
    if (s.inputId === 'axisInput' && $('axisDock') && $('axisDock').hidden) openDock();
    if (rest) { const i = $(s.inputId); if (i) { i.value = rest; axisSpokenTurn = true; axisSend(s.inputId); } }
    else axisMicToggle(s.micId, s.inputId, () => axisSend(s.inputId)); // bare "AXIS" → open the mic
  };
  // Browsers stop a continuous recognizer on their own schedule; re-arm unless we deliberately paused.
  rec.onend = () => { if (axisHandsFree && axisWakeArmed && !axisListening) { try { rec.start(); } catch {} } };
  // 'no-speech' is normal for a listener that sits open — never report it. Everything else gets the
  // same plain-language treatment as push-to-talk.
  rec.onerror = (e) => { if (e && e.error && e.error !== 'no-speech' && e.error !== 'aborted') axisMicError(e); };
  axisWakeRec = rec; axisWakeArmed = true;
  try { rec.start(); } catch {}
  return true;
}
function axisWakePause() { axisWakeArmed = false; try { axisWakeRec && axisWakeRec.abort(); } catch {} axisWakeRec = null; }
// ALWAYS build a fresh recognizer. Calling .start() on an abort()ed SpeechRecognition throws
// InvalidStateError in Chrome, and the old catch{} swallowed it — so after AXIS spoke its
// "hands-free on" confirmation (which pauses the listener), the wake word was dead until a manual
// mic press created a new instance. That is exactly the "does not listen until I press record" bug.
function axisWakeResume() { if (axisHandsFree && !axisWakeArmed && !axisListening) axisWakeStart(); }

// Self-heal: browsers stop a continuous recognizer on their own schedule, and a dropped one used to
// stay dropped. This re-arms whenever hands-free is on but nothing is listening.
setInterval(() => {
  if (!axisHandsFree || axisWakeArmed || axisListening) return;
  if (document.documentElement.dataset.axisState === 'speaking') return;
  axisWakeStart();
}, 4000);

// End of an AXIS turn: hand the floor back so Ahmad can just keep talking.
function axisTurnDone() {
  axisSpokenTurn = false;
  if (!axisHandsFree || axisListening) return;
  if ($('axisDock') && $('axisDock').hidden && state.module !== 'axis-agent-director') return;
  setTimeout(() => {
    if (!axisHandsFree || axisListening) return;
    const s = axisSurface();
    axisMicToggle(s.micId, s.inputId, () => axisSend(s.inputId));
  }, 350);
}

// Spoken + keyboard kill-switch. Aborts speech, the mic, the pending turn, and any unconfirmed route.
function axisStandDown() {
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch {}
  try { axisRec && axisRec.abort(); } catch {}
  __turnDone = null; axisPendingRoute = null; axisSpokenTurn = false;
  if (document.documentElement.dataset.axisState !== 'idle') setAxisState('idle');
  toast('AXIS stood down');
}
// Mirrors axisSyncVoiceBtn: the dock and the Agent Director tab each carry their own control, and
// both must reflect one state — the recognizer is global, not per-surface.
function axisSyncWakeBtn() {
  for (const id of ['axisWake', 'axisDirectorWake']) {
    const b = $(id); if (!b) continue;
    b.setAttribute('aria-pressed', axisHandsFree ? 'true' : 'false');
    b.style.color = axisHandsFree ? 'var(--gold)' : ''; b.style.borderColor = axisHandsFree ? 'var(--gold)' : '';
    b.title = axisHandsFree ? 'Hands-free ON — say “AXIS …”. Stop: say “AXIS stop” or Ctrl+Alt+K' : 'Hands-free: wake word “AXIS”';
  }
}
function axisHandsFreeToggle() {
  if (!axisHandsFree) {
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) { axisMicNote('Hands-free needs Chrome or Edge — this browser has no speech recognition.'); return; }
    // Flip the flag FIRST: the recognizer's own onend/resume paths check it, and starting before it
    // was set meant the listener never re-armed after the spoken confirmation.
    axisHandsFree = true; axisSyncWakeBtn();
    toast('Hands-free on — say “AXIS”');
    // Speaking pauses the listener (so AXIS can't hear itself). settle() re-arms when the sentence
    // ends; if voice is off there is no sentence, so arm right now. The watchdog covers both.
    if (!axisSpeak('Hands-free on. Say AXIS when you need me.')) axisWakeStart();
  } else {
    axisHandsFree = false; axisWakePause(); axisSyncWakeBtn(); toast('Hands-free off');
  }
  try { localStorage.setItem('axis-hands-free', axisHandsFree ? '1' : '0'); } catch {}
}

// Warm up the async voice list (Chrome loads voices lazily) + reflect the default-ON state on the button.
// The picker is repopulated on every voiceschanged because Chrome reports an EMPTY list on first call.
try { if (window.speechSynthesis) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { speechSynthesis.getVoices(); axisPopulateVoices(); }; } } catch {}

// ── AXIS orb + state machine (R-series) ──────────────────────────────────────
// One SVG identity, mounted into every [data-orb] slot (fab, dock header, strip, public panel).
// Ported from the design-handoff AnimatedGlobe contract: hairline lat/long ellipses, stronger
// equator, radial gold core, glowing A. Motion lives in CSS, keyed off :root[data-axis-state].
let __orbN = 0;
const orbSVG = (uid) => '<svg viewBox="0 0 60 60" aria-hidden="true">'
  + '<defs><radialGradient id="' + uid + '" cx="0.5" cy="0.42" r="0.62">'
  + '<stop offset="0%" stop-color="var(--gold-2)" stop-opacity=".8"/>'
  + '<stop offset="55%" stop-color="var(--gold)" stop-opacity=".28"/>'
  + '<stop offset="100%" stop-color="var(--gold)" stop-opacity="0"/></radialGradient></defs>'
  + '<circle cx="30" cy="30" r="28" fill="none" stroke="var(--gold)" stroke-width=".5" stroke-dasharray="1.5 4" opacity=".5"/>'
  + '<g class="orb-spin">'
  + '<ellipse cx="30" cy="30" rx="26" ry="9" fill="none" stroke="var(--gold)" stroke-width=".55" opacity=".5"/>'
  + '<ellipse cx="30" cy="30" rx="26" ry="17" fill="none" stroke="var(--gold)" stroke-width=".35" opacity=".28"/>'
  + '</g><g class="orb-spin-rev">'
  + '<ellipse cx="30" cy="30" rx="9" ry="26" fill="none" stroke="var(--gold)" stroke-width=".4" opacity=".34"/>'
  + '<ellipse cx="30" cy="30" rx="17" ry="26" fill="none" stroke="var(--gold)" stroke-width=".3" opacity=".2"/>'
  + '</g>'
  + '<circle class="orb-pulse" cx="30" cy="30" r="20" fill="none" stroke="var(--gold)" stroke-width=".9"/>'
  + '<circle class="orb-core" cx="30" cy="30" r="17" fill="url(#' + uid + ')"/>'
  + '<text x="30" y="35.5" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="15" font-weight="650" fill="var(--gold)">A</text></svg>';
function mountOrbs(scope = document) {
  scope.querySelectorAll('[data-orb]:not([data-orb-live])').forEach(n => {
    n.setAttribute('data-orb-live', '1'); n.innerHTML = orbSVG('axisOrbFade' + (++__orbN)); // unique gradient id per mount
  });
}
// idle | listening | thinking | speaking — drives every orb + the aria-live state words.
function setAxisState(s) {
  document.documentElement.dataset.axisState = s;
  document.querySelectorAll('[data-axis-state-word]').forEach(w => { w.textContent = s; });
  const w = $('axisStateWord'); if (w) w.textContent = s;
  const p = $('axisPubState'); if (p) p.textContent = s;
}

// ── AXIS command strip (R3) — Overview, above everything ──
function askAxis(text) {
  if ($('axisDock').hidden) openDock();
  const inp = $('axisInput'); inp.value = text; axisSend();
}
function axisStrip(k) {
  // Honest counts only — straight from the snapshot KPIs the cards below already show.
  const n1 = k.awaiting_approval ?? 0, n2 = k.messages_waiting ?? 0, n3 = k.followups_due ?? 0;
  const bits = [];
  if (n1) bits.push(n1 + (n1 === 1 ? ' approval' : ' approvals') + ' waiting');
  if (n2) bits.push(n2 + (n2 === 1 ? ' client reply' : ' client replies') + ' waiting');
  if (n3) bits.push(n3 + (n3 === 1 ? ' follow-up' : ' follow-ups') + ' due');
  const line = bits.length ? bits.join(' · ') : 'All quiet. AXIS is watching.';
  const input = el('input', { placeholder: 'Tell AXIS…', 'aria-label': 'Tell AXIS', autocomplete: 'off' });
  // The 15s snapshot tick re-renders Overview; a draft mid-sentence must survive it (gate-review finding).
  input.value = state.ui.stripDraft || '';
  input.addEventListener('input', () => { state.ui.stripDraft = input.value; });
  input.addEventListener('focus', () => { state.ui.stripFocus = true; });
  input.addEventListener('blur', () => { state.ui.stripFocus = false; });
  if (state.ui.stripFocus) requestAnimationFrame(() => { input.focus(); const n = input.value.length; try { input.setSelectionRange(n, n); } catch {} });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) { const t = input.value.trim(); input.value = ''; state.ui.stripDraft = ''; askAxis(t); } });
  const chips = [['Status', 'status'], ['Needs me', 'what needs me now'], ['Next', 'what is next'], ['Approvals', 'approvals']]
    .map(([lbl, q]) => el('button', { class: 'chip', onclick: () => askAxis(q) }, lbl));
  const s = el('section', { class: 'axis-strip', 'aria-label': 'AXIS command strip' }, [
    el('span', { class: 'axis-orb', 'data-orb': '' }),
    el('div', {}, [el('div', { class: 'eyebrow', style: 'color:var(--gold)' }, 'AXIS · Director'),
      el('div', { class: 'axis-strip-status' }, line)]),
    input, ...chips]);
  mountOrbs(s);
  return s;
}

// ── Public AXIS (R4, pre-auth) ────────────────────────────────────────────────
// Deterministic + $0: answers come ONLY from the emitter-guaranteed HEADLINE-ONLY public feed
// (/.well-known/axis/status.json) plus canned strings. Never authed endpoints, never prospect
// data, never counts from private state. axis-director stays fully JWT-gated (P1a) — an unauthed
// LLM branch would let anonymous callers burn the API key, so public mode is served client-side.
let __pubFeed = null;
async function pubFeed() {
  if (__pubFeed) return __pubFeed;
  try { const r = await fetch('/.well-known/axis/status.json', { cache: 'no-store' }); if (r.ok) __pubFeed = await r.json(); } catch {}
  return __pubFeed;
}
const PUB_SIGNIN = ' Sign in for the director view.';
async function pubAnswer(q) {
  const s = String(q).toLowerCase();
  if (/help|what can|how do/.test(s)) return 'Public mode. I can share the general program status only — try "status" or "next". Approvals, pipeline, and the fleet are behind sign-in.';
  const f = await pubFeed();
  if (/next|milestone|plan|roadmap|coming|ready/.test(s))
    return f && (f.milestone || f.readiness) ? [f.milestone, f.readiness].filter(Boolean).join(' ') + PUB_SIGNIN
      : 'The build is moving. I cannot reach the public status feed right now.' + PUB_SIGNIN;
  if (/status|live|now|state|running|revenue|up\b/.test(s))
    return f && f.headline ? f.headline + PUB_SIGNIN
      : 'Hub is live. The worker runs on schedule. All sending stays approval-gated.' + PUB_SIGNIN;
  return 'Public mode — I only share the general status here, never client or pipeline detail. Ask "status" or "next".' + PUB_SIGNIN;
}
async function pubAsk(q) {
  q = String(q || '').trim(); if (!q) return;
  const log = $('axisPubLog'); if (!log) return;
  log.hidden = false;
  log.append(el('div', { class: 'axis-msg user' }, q));
  setAxisState('thinking');
  const a = await pubAnswer(q);
  log.append(el('div', { class: 'axis-msg axis' }, a));
  log.scrollTop = log.scrollHeight;
  if (!axisSpeak(a)) setAxisState('idle');
}

// ── Command palette ──
let palSel = 0;
function paletteItems() {
  const nav = NAV.flatMap(g => g.items).map(i => ({ label: 'Go to ' + i.label, run: () => go(i.id) }));
  return nav.concat([
    { label: 'Approve all pending', run: () => { go('approvals'); (data('approvals').rows || []).filter(r => r.status === 'pending').forEach(bulkApprove); } },
    { label: 'Open Action Inbox', run: () => go('inbox') },
    { label: 'Talk to AXIS', run: () => openDock() },
  ]);
}
function openPalette() { $('palette').hidden = false; $('paletteInput').value = ''; palSel = 0; renderPalette(); $('paletteInput').focus(); }
function renderPalette() {
  const q = $('paletteInput').value.toLowerCase(); const items = paletteItems().filter(i => i.label.toLowerCase().includes(q));
  const list = $('paletteList'); list.innerHTML = ''; palSel = Math.min(palSel, items.length - 1);
  items.forEach((it, i) => list.append(el('div', { class: 'palette-item', 'aria-selected': i === palSel, onclick: () => { it.run(); $('palette').hidden = true; } }, it.label)));
  list._items = items;
}

// ── Auth ──
function showApp() { $('login').style.display = 'none'; $('app').style.display = 'grid'; renderNav(); renderModule(); fetchSnapshots();
  clearInterval(window.__axisPoll); window.__axisPoll = setInterval(() => { if (!document.hidden) pollVersion(); }, 15000);
  // The orbit (globe + one-line bar, bottom centre) is the resting presence — the transcript no
  // longer auto-opens. Ahmad, 2026-08-11: "without a chat field unless I press a button."
  // The spoken boot briefing below still runs; it just does not force the panel open.
  axisBootBriefing();
}

// Spoken boot briefing — the JARVIS "good morning" — once per authed session, from the real snapshot.
// Rule 14: it waits for the snapshot rather than guessing, and if the board never lands it says so
// instead of reporting "all quiet", which would be a claim about data it does not have.
function axisBootBriefing() {
  try { if (sessionStorage.getItem('axisBriefed') === '1') return; } catch {}
  let tries = 0;
  const tick = setInterval(() => {
    const k = data('overview').kpis;
    const ready = k && ['awaiting_approval', 'messages_waiting', 'followups_due'].some(f => typeof k[f] === 'number');
    if (!ready && ++tries < 12) return;         // ~6s grace for the first snapshot
    clearInterval(tick);
    try { sessionStorage.setItem('axisBriefed', '1'); } catch {}
    const line = greetLine(ready ? k : null);
    dockLog.push({ role: 'axis', text: line }); renderDock();
    if (axisSpeak(line)) __turnDone = axisTurnDone;
  }, 500);
}
function logout() { localStorage.removeItem(TOKEN_KEY); state.token = ''; $('app').style.display = 'none'; $('login').style.display = 'grid'; clearInterval(window.__axisPoll); }
async function doLogin() {
  $('loginErr').textContent = '';
  try {
    const r = await fetch('/.netlify/functions/aperture-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('email').value.trim(), password: $('pass').value }) });
    const j = await r.json();
    if (j && j.ok && j.token) { state.token = j.token; localStorage.setItem(TOKEN_KEY, j.token); showApp(); } else $('loginErr').textContent = j.error || 'invalid credentials';
  } catch { $('loginErr').textContent = 'login failed — check connection'; }
}

// ── Theme + dock + wiring ──
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('axis_theme', t); }
function openDock() {
  // On the Director tab the dock would cover that screen's own command channel — send there instead.
  if (state.module === 'axis-agent-director') { const i = $('axisDirectorInput'); if (i) i.focus(); return; }
  $('axisDock').hidden = false; $('axisFab').hidden = true;
  document.documentElement.dataset.axisDock = 'open';   // content pane yields the console's width
  renderDock(); $('axisInput').focus();
}
function closeDock() { $('axisDock').hidden = true; $('axisFab').hidden = false; delete document.documentElement.dataset.axisDock; try { sessionStorage.setItem('axisDockDismissed', '1'); } catch {} }
$('themeBtn').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
applyTheme(localStorage.getItem('axis_theme') || 'dark');
$('loginBtn').addEventListener('click', doLogin);
$('pass').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
$('logoutBtn').addEventListener('click', logout);
$('axisFab').addEventListener('click', openDock);
$('axisClose').addEventListener('click', axisCloseConsole);
// Must be wrapped: addEventListener passes the MouseEvent as the first argument, which would land
// in axisSend's `inputId` parameter — $(MouseEvent) resolves to null and the send silently no-ops.
// The Send button never worked; only the Enter key did (found by boot harness, 2026-08-11).
$('axisSend').addEventListener('click', () => axisSend());
$('axisMic')?.addEventListener('click', () => axisMicToggle());
$('axisVoice')?.addEventListener('click', axisVoiceToggle);
$('axisWake')?.addEventListener('click', axisHandsFreeToggle);

// ── AXIS orbit: the resting presence ─────────────────────────────────────────
// Globe floats bottom-centre with a one-line bar. Typing there sends immediately and only THEN
// opens the transcript, so a quick question never requires opening a panel first.
function axisOpenConsole() {
  document.documentElement.dataset.axisOpen = '1';
  try { sessionStorage.removeItem('axisDockDismissed'); } catch {}
  openDock();
}
function axisCloseConsole() { delete document.documentElement.dataset.axisOpen; closeDock(); }
$('axisOrbGlobe')?.addEventListener('click', axisOpenConsole);
$('axisOrbGlobe')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); axisOpenConsole(); } });
$('axisQuickOpen')?.addEventListener('click', axisOpenConsole);
$('axisQuickWake')?.addEventListener('click', axisHandsFreeToggle);
// Full-screen AXIS presence. Ctrl+Alt+A anywhere, or the ⛶ control on the orbit bar.
$('axisQuickHolo')?.addEventListener('click', () => toggleHologram());
$('axisQuick')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const v = e.target.value.trim(); if (!v) return;
  e.target.value = '';
  axisOpenConsole();
  const box = $('axisInput'); if (box) { box.value = v; axisSend(); }
});
// The wake button exists in two places now; keep both lit in step.
const __syncWake = axisSyncWakeBtn;
axisSyncWakeBtn = function () {
  __syncWake();
  const q = $('axisQuickWake');
  if (q) { q.setAttribute('aria-pressed', axisHandsFree ? 'true' : 'false');
    q.style.color = axisHandsFree ? 'var(--gold)' : ''; }
};
// Voice picker: pinning a voice writes the SAME localStorage key the v1 console used, and speaking a
// sample immediately is the whole point — you pick by ear, not by reading a device name.
$('axisVoicePick')?.addEventListener('change', (e) => {
  const name = e.target.value || '';
  axisSetVoice(name);
  const label = name ? axisShortVoice(name) : 'automatic';
  toast('AXIS voice: ' + label);
  if (!axisVoiceOn) { axisVoiceOn = true; axisSyncVoiceBtn(); }   // picking a voice implies wanting to hear it
  axisSpeak(AXIS_VOICE_SAMPLE);
  axisPopulateVoices();
});
$('axisVoiceTest')?.addEventListener('click', () => {
  if (!axisVoiceOn) { axisVoiceOn = true; axisSyncVoiceBtn(); }
  axisSpeak(AXIS_VOICE_SAMPLE);
});
axisPopulateVoices();      // may be empty on first paint in Chrome — onvoiceschanged fills it in
axisSetHear('', false);
// Public panel (pre-auth): same voice machinery, canned public-safe answers only.
const pubSubmit = () => { const i = $('axisPubInput'); const q = i.value; i.value = ''; pubAsk(q); };
$('axisPubSend')?.addEventListener('click', pubSubmit);
$('axisPubInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') pubSubmit(); });
$('axisPubMic')?.addEventListener('click', () => axisMicToggle('axisPubMic', 'axisPubInput', pubSubmit));
$('axisPubVoice')?.addEventListener('click', axisVoiceToggle);
document.querySelectorAll('[data-pub-q]').forEach(b => b.addEventListener('click', () => pubAsk(b.dataset.pubQ)));
mountOrbs();          // fill every static [data-orb] slot (fab, dock header, public panel)
mountGlobes();        // the console head gets the real 3-D globe; every other slot keeps its orb
setAxisState('idle'); // orb state machine baseline
axisSyncVoiceBtn(); // voice defaults ON — show it
axisSyncWakeBtn();  // hands-free defaults OFF (it holds the mic open) — reflect the stored choice
// Restore a previously chosen hands-free session. Deliberately does NOT auto-start the recognizer:
// browsers require a user gesture for mic access, so the button shows OFF until Ahmad clicks it.
try { if (localStorage.getItem('axis-hands-free') === '1') { const b = $('axisWake'); if (b) b.title = 'Hands-free was on — click to resume'; } } catch {}
$('axisInput').addEventListener('keydown', (e) => e.key === 'Enter' && axisSend());
$('search').addEventListener('click', openPalette);
$('paletteInput')?.addEventListener('input', renderPalette);

// Keyboard: ⌘K palette, Esc close, and Approvals J/K/A/X/S/E/R/N (ignored in inputs)
document.addEventListener('keydown', (e) => {
  const inField = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
  // Kill-switch (spec): Ctrl+Alt+K aborts AXIS everywhere. Checked BEFORE ⌘K so it never opens the
  // palette instead — and it works from inside a text field, because that is the point of a kill-switch.
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (axisHandsFree) { axisHandsFree = false; axisWakePause(); axisSyncWakeBtn(); }
    return axisStandDown();
  }
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); return void toggleHologram(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return openPalette(); }
  if (e.key === 'Escape') { $('palette').hidden = true; if (!$('axisDock').hidden) closeDock(); if (state.ui.thread) { state.ui.thread = null; renderModule(); } if (state.ui.crmDrawer) { state.ui.crmDrawer = null; renderModule(); } return; }
  if (!$('palette').hidden) {
    const items = $('paletteList')._items || [];
    if (e.key === 'ArrowDown') { palSel = Math.min(palSel + 1, items.length - 1); renderPalette(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { palSel = Math.max(palSel - 1, 0); renderPalette(); e.preventDefault(); }
    if (e.key === 'Enter' && items[palSel]) { items[palSel].run(); $('palette').hidden = true; }
    return;
  }
  if (inField) return;
  if (state.module === 'approvals' && state.ui.apTab === 'pending') {
    const rows = (data('approvals').rows || []).filter(r => r.status === 'pending');
    const cur = rows[state.ui.apCursor];
    if (e.key === 'j' || e.key === 'ArrowDown') { state.ui.apCursor = Math.min(state.ui.apCursor + 1, rows.length - 1); renderModule(); }
    else if (e.key === 'k' || e.key === 'ArrowUp') { state.ui.apCursor = Math.max(state.ui.apCursor - 1, 0); renderModule(); }
    else if (e.key === 'a' && cur) act('approve', cur);
    else if (e.key === 'x' && cur) act('reject', cur);
    else if (e.key === 's' && cur) act('skip', cur);
    else if ((e.key === 'e' || e.key === 'r' || e.key === 'n') && cur) toast({ e: 'Edit', r: 'Rewrite', n: 'Note' }[e.key] + ' — open the card');
  }
});

if (state.token) showApp();
