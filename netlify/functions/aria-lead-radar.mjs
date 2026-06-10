// aria-lead-radar.mjs — automated lead finder for IIS (gov contracts + business roles).
// STANDING MISSION (Ahmad 2026-05-29): hunt gov/business IT opportunities from public
// procurement portals and surface the matches. Deterministic, ZERO LLM, ZERO new cost.
//
// Source of truth: CanadaBuys open data (official, public, refreshed ~every 2h) — the
// "new tender notices" CSV. MERX + Ontario Tenders + other portals are surfaced as
// one-click search shortcuts (reliable, no fragile scraping). Job boards likewise.
//
// Endpoints:
//   GET /.netlify/functions/aria-lead-radar           -> JSON digest
//   GET /.netlify/functions/aria-lead-radar?html=1     -> rendered HTML page
//   GET /.netlify/functions/aria-lead-radar?debug=1    -> JSON + diagnostics
// The daily validation cron lives in aria-lead-radar-cron.mjs (a Netlify function cannot be
// both an HTTP endpoint AND a scheduled function — the cron run has no Request, so new URL()
// would throw). This file is HTTP-only.

const CB_NEW_CSV = 'https://canadabuys.canada.ca/opendata/pub/newTenderNotice-nouvelAvisAppelOffres.csv';

// ---- IIS targeting: what counts as a lead -------------------------------------
const KEYWORDS = [
  'information technology', 'it services', 'it support', 'help desk', 'helpdesk',
  'managed services', 'managed service', 'technical support', 'service desk',
  'network', 'cybersecurity', 'cyber security', 'information security', 'cloud',
  'microsoft 365', 'm365', 'office 365', 'azure', 'endpoint', 'infrastructure',
  'server', 'backup', 'disaster recovery', 'help-desk', 'computer equipment',
  'hardware', 'software', 'saas', 'data center', 'datacenter', 'virtualization',
  'vmware', 'active directory', 'identity', 'sso', 'mdm', 'intune',
  'device management', 'laptop', 'desktop', 'workstation', 'printer', 'telephony',
  'voip', 'unified communications', 'managed it', 'systems integration',
  'system integration', 'integrator', 'it professional services',
  'artificial intelligence', 'ai solution', 'ai implementation', 'automation',
  'workflow automation', 'chatbot', 'knowledge base', 'document automation',
  'website', 'web design', 'web redesign', 'web development', 'wordpress',
  'office relocation', 'office move', 'move-in', 'workstation deployment',
  'meeting room', 'audio visual', 'av setup', 'user onboarding',
  'level 3 support', 'l3 support', 'systems administrator', 'network administrator',
  'overflow support', 'field services', 'deskside support', 'onsite support',
];

const HIGH_VALUE = [
  'managed services', 'managed service', 'cybersecurity', 'cyber security',
  'cloud', 'microsoft 365', 'm365', 'office 365', 'azure', 'infrastructure',
  'systems integration', 'managed it', 'disaster recovery',
  'artificial intelligence', 'ai implementation', 'workflow automation',
  'office relocation', 'workstation deployment', 'level 3 support',
  'l3 support', 'web redesign',
];

const STRONG_IT_SIGNALS = [
  'information technology', 'it services', 'it support', 'help desk', 'helpdesk',
  'managed services', 'technical support', 'service desk', 'cybersecurity',
  'cyber security', 'microsoft 365', 'm365', 'office 365', 'azure', 'endpoint',
  'active directory', 'identity', 'intune', 'managed it', 'systems integration',
  'it professional services', 'artificial intelligence', 'ai solution',
  'ai implementation', 'workflow automation', 'chatbot', 'website',
  'web design', 'web redesign', 'web development', 'office relocation',
  'office move', 'workstation deployment', 'level 3 support', 'l3 support',
  'deskside support', 'onsite support',
];

const NON_IT_NOISE = [
  'construction', 'renovation', 'repairs', 'repair work', 'garage',
  'parking lot', 'roofing', 'road', 'bridge', 'trail', 'paving',
  'building envelope', 'washroom', 'mechanical', 'electrical contractor',
  'spectrometer', 'laboratory equipment', 'lab equipment', 'scientific instrument',
  'research instrument',
];

const TITLE_EXCLUDE = ['spectrometer', 'chromatograph', 'microscope', 'analyzer'];

// ---- record-aware CSV reader -------------------------------------------------
// CanadaBuys quotes the description fields, which contain embedded newlines, so a single
// logical record spans many physical lines. We must track quote state across newlines and
// only end a record on a newline that occurs OUTSIDE quotes (splitting on \n first shreds
// every record so only column 0 survives — that was the "only title maps" bug).
function parseCSV(text) {
  text = text.replace(/^﻿/, ''); // strip BOM
  const records = [];
  let row = [], cur = '', inQ = false;
  const endField = () => { row.push(cur); cur = ''; };
  const endRow = () => { endField(); if (row.length > 1 || row[0] !== '') records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') { inQ = true; }
    else if (c === ',') { endField(); }
    else if (c === '\n') { endRow(); }
    else if (c === '\r') { if (text[i + 1] === '\n') i++; endRow(); }
    else cur += c;
  }
  if (cur !== '' || row.length) endRow();
  return records;
}

async function fetchText(url, ms = 45000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'IIS-LeadRadar/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

// ---- core: fetch + filter CanadaBuys ------------------------------------------
async function collectMatches() {
  const csv = await fetchText(CB_NEW_CSV);
  const records = parseCSV(csv);
  if (records.length < 2) return { matches: [], scanned: 0 };
  const header = records[0].map((h) => h.trim());
  const ci = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const pick = (...names) => { for (const n of names) { const a = ci(n); if (a >= 0) return a; } return -1; };

  // Real CanadaBuys header names (verified against the live feed during the 2026-05-29 audit).
  const idxTitle = pick('title-titre-eng', 'title-eng');
  const idxDesc = pick('tenderDescription-descriptionAppelOffres-eng', 'description-eng');
  const idxOrg = pick('contractingEntityName-nomEntitContractante-eng', 'endUserEntitiesName-nomEntitesUtilisateurFinal-eng');
  const idxClose = pick('tenderClosingDate-appelOffresDateCloture');
  const idxUrl = pick('noticeURL-URLavis-eng', 'url-eng');
  const idxRef = pick('referenceNumber-numeroReference', 'solicitationNumber-numeroSollicitation');
  const idxRegion = pick('regionsOfDelivery-regionsLivraison-eng', 'regionsOfOpportunity-regionAppelOffres-eng');
  const idxCity = pick('contractingEntityAddressCity-villeAdresseEntitContractante-eng');
  const idxProv = pick('contractingEntityAddressProvince-provinceAdresseEntitContractante-eng');

  const get = (cols, i) => (i >= 0 && i < cols.length ? (cols[i] || '').trim() : '');
  const fmtDate = (s) => (s ? String(s).split('T')[0] : ''); // ISO timestamp -> date

  const matches = [];
  for (let r = 1; r < records.length; r++) {
    const cols = records[r];
    if (cols.length < header.length) continue; // skip any malformed/short record
    const title = get(cols, idxTitle);
    const desc = get(cols, idxDesc);
    const hay = (title + ' ' + desc).toLowerCase();
    if (TITLE_EXCLUDE.some((k) => title.toLowerCase().includes(k))) continue;
    if (!KEYWORDS.some((k) => hay.includes(k))) continue;
    if (NON_IT_NOISE.some((k) => hay.includes(k)) && !STRONG_IT_SIGNALS.some((k) => hay.includes(k))) continue;
    const region = get(cols, idxRegion) || [get(cols, idxCity), get(cols, idxProv)].filter(Boolean).join(', ');
    const ref = get(cols, idxRef);
    // Most new-notice rows have no direct noticeURL; fall back to a CanadaBuys search on the
    // reference number so every lead is click-through-able (lands on the official portal).
    const url = get(cols, idxUrl) || (ref ? 'https://canadabuys.canada.ca/en/tender-opportunities?search_filter=' + encodeURIComponent(ref) : '');
    matches.push({
      title,
      org: get(cols, idxOrg),
      region,
      close: fmtDate(get(cols, idxClose)),
      ref,
      url,
      hot: HIGH_VALUE.some((k) => hay.includes(k)),
    });
  }

  // hot first, then soonest closing date
  matches.sort((a, b) => (b.hot - a.hot) || String(a.close).localeCompare(String(b.close)));
  return { matches, scanned: records.length - 1 };
}

// ---- static link sets ---------------------------------------------------------
const PORTALS = [
  { name: 'MERX (Canada-wide)', url: 'https://www.merx.com/public/solicitations/open?keywords=managed%20IT%20services' },
  { name: 'MERX - AI / automation', url: 'https://www.merx.com/public/solicitations/open?keywords=artificial%20intelligence%20automation' },
  { name: 'MERX - website redesign', url: 'https://www.merx.com/public/solicitations/open?keywords=website%20redesign' },
  { name: 'Ontario Tenders Portal', url: 'https://ontariotenders.app.jaggaer.com/esop/nac-host/public/web/login.html' },
  { name: 'CanadaBuys (federal)', url: 'https://canadabuys.canada.ca/en/tender-opportunities' },
  { name: 'CanadaBuys - help desk', url: 'https://canadabuys.canada.ca/en/tender-opportunities?search_filter=help%20desk' },
  { name: 'CanadaBuys - AI', url: 'https://canadabuys.canada.ca/en/tender-opportunities?search_filter=artificial%20intelligence' },
  { name: 'CanadaBuys - website', url: 'https://canadabuys.canada.ca/en/tender-opportunities?search_filter=website' },
  { name: 'BC Bid', url: 'https://www.bcbid.gov.bc.ca/' },
  { name: 'Biddingo (public sector)', url: 'https://www.biddingo.com/' },
];
const JOB_BOARDS = [
  { name: 'Indeed — IT manager / contract', url: 'https://ca.indeed.com/jobs?q=IT+manager+contract&l=Remote' },
  { name: 'Indeed - remote help desk contract', url: 'https://ca.indeed.com/jobs?q=remote+help+desk+contract' },
  { name: 'Indeed - L3 support contract', url: 'https://ca.indeed.com/jobs?q=L3+support+contract&l=Remote' },
  { name: 'Indeed — government IT', url: 'https://ca.indeed.com/jobs?q=information+technology+government' },
  { name: 'LinkedIn — IT gov contract', url: 'https://www.linkedin.com/jobs/search/?keywords=IT%20government%20contract' },
  { name: 'LinkedIn - office move IT support', url: 'https://www.linkedin.com/jobs/search/?keywords=office%20move%20IT%20support' },
];

// ---- HTML render --------------------------------------------------------------
function renderHTML(data) {
  const rows = data.matches.map((m) => `
      <tr class="${m.hot ? 'hot' : ''}">
        <td>${m.hot ? '<span class="badge">HOT</span> ' : ''}${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : esc(m.title)}</td>
        <td>${esc(m.org)}</td>
        <td>${esc(m.region)}</td>
        <td>${esc(m.close)}</td>
      </tr>`).join('');

  const portalLinks = PORTALS.map((p) => `<a class="chip" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>`).join('');
  const jobLinks = JOB_BOARDS.map((p) => `<a class="chip" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>`).join('');

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IIS Lead Radar</title>
<style>
  :root{--navy:#0b1f3a;--navy2:#13294b;--gold:#c8a046;--gold2:#e3c578;--ink:#0b1f3a;--paper:#f7f8fb;}
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--paper)}
  header{background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:28px 24px;border-bottom:3px solid var(--gold)}
  header h1{margin:0;font-size:22px;letter-spacing:.3px}
  header h1 .g{color:var(--gold2)}
  header p{margin:6px 0 0;opacity:.85;font-size:13px}
  .wrap{max-width:1080px;margin:0 auto;padding:22px 24px 60px}
  .meta{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 18px;font-size:13px;color:#445}
  .meta b{color:var(--navy)}
  .links{margin:0 0 22px}
  .links h2{font-size:13px;text-transform:uppercase;letter-spacing:.6px;color:#667;margin:18px 0 8px}
  .chip{display:inline-block;margin:0 8px 8px 0;padding:7px 12px;border:1px solid #d6dae3;border-radius:20px;background:#fff;color:var(--navy);text-decoration:none;font-size:13px}
  .chip:hover{border-color:var(--gold);color:var(--navy2)}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e3e6ec;border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:11px 13px;border-bottom:1px solid #eef0f4;font-size:13.5px;vertical-align:top}
  th{background:var(--navy);color:#fff;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  tr.hot td{background:#fffbf0}
  td a{color:#13294b;font-weight:600;text-decoration:none}
  td a:hover{text-decoration:underline;color:var(--gold)}
  .badge{display:inline-block;background:var(--gold);color:#3a2c06;font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;letter-spacing:.5px;vertical-align:middle}
  .empty{padding:30px;text-align:center;color:#778;background:#fff;border:1px solid #e3e6ec;border-radius:10px}
  footer{color:#889;font-size:12px;margin-top:18px}
</style></head><body>
<header>
  <h1>IIS <span class="g">Lead Radar</span></h1>
  <p>Gov &amp; business IT opportunities, pulled live from public procurement data. Zero-cost, auto-refreshed on load.</p>
</header>
<div class="wrap">
  <div class="meta">
    <span><b>${data.matches.length}</b> matching tenders</span>
    <span><b>${data.matches.filter((m) => m.hot).length}</b> high-value</span>
    <span><b>${data.scanned}</b> notices scanned (CanadaBuys, last ~24h)</span>
    ${data.error ? `<span style="color:#b00">feed error: ${esc(data.error)}</span>` : ''}
  </div>

  ${data.matches.length ? `<table>
    <thead><tr><th>Opportunity</th><th>Buyer / Org</th><th>Region</th><th>Closes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : `<div class="empty">No matching new federal tenders in the latest CanadaBuys batch. Use the portal shortcuts below — they cover MERX, Ontario, and the rest.</div>`}

  <div class="links">
    <h2>Tender portals (one-click search)</h2>
    ${portalLinks}
    <h2>High-pay IT &amp; gov roles</h2>
    ${jobLinks}
  </div>

  <footer>Source: CanadaBuys open data (official, public). MERX / Ontario / BC Bid / Biddingo surfaced as direct searches. Generated server-side, no LLM, no cost.</footer>
</div>
</body></html>`;
}

// ---- handler ------------------------------------------------------------------
export default async (req) => {
  const url = new URL(req.url);
  const wantHTML = url.searchParams.get('html') === '1';
  const debug = url.searchParams.get('debug') === '1';

  let result = { matches: [], scanned: 0 };
  let error = null;
  try {
    result = await collectMatches();
  } catch (e) {
    error = String((e && e.message) || e);
  }

  const data = {
    generatedAt: new Date().toISOString(),
    count: result.matches.length,
    hot: result.matches.filter((m) => m.hot).length,
    scanned: result.scanned,
    matches: result.matches,
    portals: PORTALS,
    jobBoards: JOB_BOARDS,
    error,
  };

  if (wantHTML) {
    return new Response(renderHTML(data), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=900' },
    });
  }
  return new Response(JSON.stringify(debug ? data : { ...data, matches: data.matches }, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900' },
  });
};
