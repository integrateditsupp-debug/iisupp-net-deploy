#!/usr/bin/env node
/**
 * bid-sweep.mjs — Headless sweep of Ontario municipal bids&tenders portals.
 *
 *  Companion to netlify/functions/bid-radar-cron.mjs. That cron covers CanadaBuys
 *  (federal + participating provincial), which is a clean machine-readable CSV.
 *  Municipal bids&tenders portals render their grids client-side and expose no
 *  public feed, so they need a real browser — which Netlify Functions cannot run.
 *  This script does, unattended, in the Cowork container.
 *
 *  Usage:
 *    node scripts/bid-sweep.mjs                 # sweep all portals, print JSON
 *    node scripts/bid-sweep.mjs --email         # also email new hits via Resend
 *    node scripts/bid-sweep.mjs whitby ajax     # sweep specific portals only
 *
 *  Env: RESEND_API_KEY, RESEND_FROM, FOUNDER_EMAIL (only needed for --email)
 *  State: .bid-sweep-seen.json in cwd — de-dupes so you only ever see new bids.
 *
 *  Notes for future maintainers:
 *   - Chromium cannot reach the container's egress proxy directly (ERR_CONNECTION_RESET).
 *     Every request is routed through Node's fetch, which can. Do not remove ctx.route.
 *   - A real bid row has exactly 4 cells: [name, status, closing date, days left].
 *     1-cell rows are the action-button row; 7-cell numeric rows are the date picker.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/* Playwright lives in the global npm prefix in this container, not in the repo's
   node_modules, so a bare ESM specifier resolves only when cwd happens to be right.
   Try the bare import first, fall back to the global path. */
const pickChromium = m => m?.chromium || m?.default?.chromium;
let chromium;
for (const spec of ['playwright',
  process.env.PLAYWRIGHT_PKG || '/home/claude/.npm-global/lib/node_modules/playwright/index.js']) {
  try { chromium = pickChromium(await import(spec)); } catch { /* try next */ }
  if (chromium) break;
}
if (!chromium) {
  console.error('playwright not resolvable. Set PLAYWRIGHT_PKG to its index.js, or npm i -g playwright.');
  process.exit(1);
}

/* Ontario municipal + regional bids&tenders subdomains, confirmed reachable by a full
   sweep on 2026-07-29. Adding a speculative subdomain is cheap — unreachable ones are
   reported and skipped — but each dead host costs ~40s of timeout, so prune after testing. */
const ALL_PORTALS = [
  // Durham Region + lower tier (home turf)
  'durham', 'whitby', 'ajax', 'pickering', 'oshawa', 'clarington', 'scugog', 'uxbridge',
  // York Region + lower tier
  'york', 'markham', 'richmondhill', 'vaughan', 'newmarket', 'aurora', 'georgina',
  'eastgwillimbury', 'king',
  // Peel / Halton / Toronto area
  'peelregion', 'brampton', 'caledon', 'burlington', 'oakville', 'milton', 'haltonhills',
  // Simcoe / Kawartha / Northumberland
  'barrie', 'orillia', 'innisfil', 'kawarthalakes', 'cobourg', 'porthope',
  // Waterloo / Wellington / Niagara corridor
  'guelph', 'wellington', 'kitchener', 'waterloo', 'niagararegion', 'stcatharines',
  // Eastern Ontario
  'belleville', 'quintewest', 'brockville', 'cornwall',
  // Education / other public bodies
  'ddsb', 'dcdsb'
];

/* Confirmed NOT on bids&tenders as of 2026-07-29 — they use Bonfire, Ariba, Merx or
   their own portal. Do not re-add without checking first; each costs a 40s timeout.
   brock, whitchurchstouffville, halton, bradfordwestgwillimbury, simcoe, peterborough,
   northumberland, cambridge, kingston, durhamcollege, ontariotechu                     */

/* Title-level relevance. Deliberately broader than the CanadaBuys filter because
   municipal bid titles are terse ("Network Switch Replacement", not a full description).
   Bare 'consult' and bare 'system' were tested and pulled in land surveyors, hydraulic
   modelling and job-evaluation studies — both are now qualified. */
const IT_MATCH = new RegExp([
  'managed (it|service)', 'help ?desk', 'service desk', '\\bit\\b', 'information technolog',
  'end.?user', 'desktop', 'cyber ?security', 'microsoft 365', 'office 365', '\\bm365\\b',
  'cloud', 'server', 'technical support', 'network', 'backup',
  'disaster recovery', 'business continuity', '\\bvoip\\b', 'telephon', 'phone system',
  '\\bsiem\\b', 'penetration test', 'vulnerability', 'audio ?visual', '\\bav\\b',
  'structured cabling', 'cabling', 'fibre optic', 'fiber optic', 'wi-?fi', 'wireless',
  'endpoint', 'firewall', 'workstation', 'laptop', 'computer', 'hardware', 'software',
  'licens', 'saas', 'digital', 'website', 'web site', 'data cent',
  'print (manage|fleet|servic)', 'security (system|camera|assess|audit)',
  'access control', 'surveillance', 'telecom', 'internet servic', 'connectivity',
  '\\bgis\\b', '\\berp\\b', '\\bcrm\\b', 'asset management (system|software|solution)',
  '(it|technolog|technology|digital|cyber|network|software|systems?|data) consult',
  '(management|integration|integrator|migration|implementation) (system|solution|services)',
  'systems? (integrat|administrat|implement)'
].join('|'), 'i');

/* Things that match the keywords but are never an MSP opportunity. Each entry here was
   added because it actually showed up as a false positive in a live sweep. */
const EXCLUDE = new RegExp([
  'snow', 'salt', 'sidewalk', '\\broad\\b', 'sewer', 'watermain', 'paving', 'asphalt',
  'arena', '\\bpark\\b', '\\btree\\b', 'turf', 'fleet vehicle', 'pickup truck', 'garbage',
  'waste collection', 'catch basin', 'culvert', 'bridge', 'streetlight', 'traffic signal',
  'playground', '\\bpool\\b', 'zamboni', 'fire truck', 'ambulance', 'uniform', 'janitorial',
  'cleaning servic', 'landscap', 'grass', 'fuel suppl',
  // false positives observed 2026-07-29
  'irrigation', '\\bgolf\\b', 'waterproofing', 'generator', 'solar', 'ice resurfac',
  'hydraulic', 'geotechnical', 'geo-technical', 'environmental', 'land surveyor',
  'job evaluation', 'urban design', 'boulevard', 'backflow', 'fire life', 'cot fastener',
  'master plan', 'peer review', 'whistle cessation', 'affordable housing'
].join('|'), 'i');

const STATE_FILE = '.bid-sweep-seen.json';
const RETENTION_DAYS = 180;

const args = process.argv.slice(2);
const doEmail = args.includes('--email');
const picked = args.filter(a => !a.startsWith('--'));
const PORTALS = picked.length ? picked : ALL_PORTALS;

const esc = s => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
});

/* Route every browser request through Node's fetch — Chromium cannot reach the proxy. */
await ctx.route('**/*', async route => {
  const req = route.request();
  try {
    const headers = { ...req.headers() };
    delete headers['accept-encoding'];
    const res = await fetch(req.url(), {
      method: req.method(),
      headers,
      body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer(),
      redirect: 'follow'
    });
    const body = Buffer.from(await res.arrayBuffer());
    const h = {};
    res.headers.forEach((v, k) => {
      if (!/^(content-encoding|content-length|transfer-encoding)$/i.test(k)) h[k] = v;
    });
    await route.fulfill({ status: res.status, headers: h, body });
  } catch { await route.abort(); }
});

const portalResults = [];
const allBids = [];

for (const p of PORTALS) {
  const page = await ctx.newPage();
  const r = { portal: p, reachable: false, bids: 0 };
  try {
    await page.goto(`https://${p}.bidsandtenders.ca/Module/Tenders/en`, {
      waitUntil: 'domcontentloaded', timeout: 40000
    });
    await page.waitForTimeout(5000);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('table tbody tr')].map(tr =>
        [...tr.querySelectorAll('td')].map(td => td.innerText.trim().replace(/\s+/g, ' '))));
    r.reachable = rows.length > 0;
    for (const c of rows) {
      // Real bid row: 4 cells, cell[1] is a status word, cell[2] is a date.
      if (c.length < 4) continue;
      if (!/^(open|closed|awarded|cancelled|pending|upcoming)/i.test(c[1] || '')) continue;
      if (!/20\d\d/.test(c[2] || '')) continue;
      r.bids++;
      allBids.push({ portal: p, name: c[0], status: c[1], closes: c[2], days_left: c[3] });
    }
  } catch (e) { r.error = e.message.split('\n')[0].slice(0, 70); }
  await page.close();
  portalResults.push(r);
  process.stderr.write(`${r.reachable ? 'OK  ' : '--  '}${p.padEnd(24)} bids=${r.bids}${r.error ? '  ' + r.error : ''}\n`);
}
await browser.close();

const relevant = allBids.filter(b =>
  /^open/i.test(b.status) && IT_MATCH.test(b.name) && !EXCLUDE.test(b.name));

/* De-dupe against previous runs. */
const now = Date.now();
let seen = {};
try { seen = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { seen = {}; }
const keyOf = b => `${b.portal}::${b.name}`;
const fresh = relevant.filter(b => !seen[keyOf(b)]);
const nextSeen = {};
for (const [k, v] of Object.entries(seen)) if (v > now - RETENTION_DAYS * 86400000) nextSeen[k] = v;
for (const b of relevant) nextSeen[keyOf(b)] = seen[keyOf(b)] || now;
try { writeFileSync(STATE_FILE, JSON.stringify(nextSeen)); } catch {}

const summary = {
  ran_at: new Date().toISOString(),
  portals_tried: PORTALS.length,
  portals_reachable: portalResults.filter(r => r.reachable).length,
  unreachable: portalResults.filter(r => !r.reachable).map(r => r.portal),
  total_open_bids: allBids.filter(b => /^open/i.test(b.status)).length,
  it_relevant: relevant.length,
  new_since_last_run: fresh.length,
  emailed: false,
  new_bids: fresh,
  all_it_relevant: relevant
};

if (doEmail && fresh.length && process.env.RESEND_API_KEY) {
  const html = `
    <div style="max-width:680px;margin:0 auto;font-family:system-ui,sans-serif">
      <h2 style="font-size:17px;margin:0 0 4px">Municipal Bid Sweep — ${fresh.length} new</h2>
      <p style="font-size:12px;color:#777;margin:0 0 18px">
        ${summary.portals_reachable}/${summary.portals_tried} Ontario portals swept &middot;
        ${summary.total_open_bids} open bids &middot; ${relevant.length} IT-relevant &middot;
        ${fresh.length} not seen before.
      </p>
      ${fresh.map(b => `
        <div style="border-left:3px solid #c8a24a;padding:8px 12px;margin:0 0 14px">
          <div style="font:600 15px/1.35 system-ui,sans-serif">${esc(b.name)}</div>
          <div style="font:13px system-ui,sans-serif;color:#555;margin:3px 0">
            ${esc(b.portal)} &middot; closes <b>${esc(b.closes)}</b>
            ${b.days_left ? ` (${esc(b.days_left)} days left)` : ''}
          </div>
          <div style="font:12px system-ui,sans-serif;margin-top:4px">
            <a href="https://${esc(b.portal)}.bidsandtenders.ca/Module/Tenders/en">Open portal</a>
          </div>
        </div>`).join('')}
      <p style="font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px;margin-top:20px">
        bid-sweep &middot; ${summary.ran_at} &middot; you only get this email when something new appears.
      </p>
    </div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
        to: [process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net'],
        subject: `[Bid Sweep] ${fresh.length} new municipal IT opportunit${fresh.length === 1 ? 'y' : 'ies'}`,
        html
      })
    });
    summary.emailed = res.ok;
    if (!res.ok) summary.email_error = 'HTTP ' + res.status;
  } catch (e) { summary.email_error = e.message; }
}

console.log(JSON.stringify(summary, null, 1));
