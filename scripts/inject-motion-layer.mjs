#!/usr/bin/env node
/* ==========================================================================
   inject-motion-layer.mjs — wires /assets/iis-motion.{css,js} into every
   public-facing page of iisupp.net. Idempotent, additive-only (Rule 15).

   Usage:  node scripts/inject-motion-layer.mjs [--dry]

   Per file:
     · <link rel="stylesheet" href="/assets/iis-motion.css">  before </head>
     · <script src="/assets/iis-motion.js" defer></script>    before </body>
       (aria.html gets data-mode="bg" — ambience only, no section reveals)

   Guards:
     · skips any file already containing "iis-motion"
     · resolves the REAL </head> (must precede <body>) and the LAST </body>
     · light-theme detector — refuses pages whose body background is light
     · backs up originals to /tmp/iism-backup/<relpath> before writing
     · verifies byte math after every write
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const BACKUP_ROOT = '/tmp/iism-backup';

const LINK_TAG = '<link rel="stylesheet" href="/assets/iis-motion.css">';
const scriptTag = (mode) =>
  `<script src="/assets/iis-motion.js" defer${mode === 'bg' ? ' data-mode="bg"' : ''}></script>`;

/* ---------------- target sets ---------------- */
const FULL = [
  'index.html', 'services.html', 'shop.html', 'marketplace.html',
  'growth-library.html', 'ai-edge.html', 'about.html', 'product.html',
  'health-check.html', 'terms.html', 'copyright.html', 'purchase-tech.html',
  'refer.html', 'unlock.html', 'checkout-success.html', 'trust.html',
  'status.html', 'enterprise.html', 'government.html',
  'commercial-real-estate.html', 'webinar.html', 'cost-calculator.html',
  'insiders.html', 'scorecard.html', 'extension.html', 'start-here.html',
  'book.html',
  'plans/index.html', 'downloads/index.html', 'forums/index.html',
  'governance/index.html', 'governance/ai-use.html',
  'governance/anti-bribery.html', 'governance/code-of-conduct.html',
  'governance/environmental.html', 'governance/health-and-safety.html',
  'governance/human-rights.html', 'governance/incident-response.html',
  'governance/information-security.html', 'governance/modern-slavery.html',
  'governance/privacy.html', 'governance/responsible-sourcing.html',
  'governance/supplier-code-of-conduct.html',
  'verticals/index.html', 'verticals/finance.html',
  'verticals/healthcare.html', 'verticals/legal.html',
  'compare/index.html', 'compare/aria-vs-retell/index.html',
  'compare/aria-vs-vapi/index.html', 'compare/aria-vs-msp-x/index.html',
];
/* every Growth Library preview page */
for (const f of fs.readdirSync(path.join(ROOT, 'downloads/library'))) {
  if (f.endsWith('.html')) FULL.push('downloads/library/' + f);
}

const BG_ONLY = ['aria.html'];

/* known-light pages that must never receive the dark ambience */
const DENY = new Set(['security.html', 'offline.html']);

/* ---------------- helpers ---------------- */
function findRealHeadClose(html) {
  const bodyOpen = html.search(/<body[\s>]/i);
  let idx = html.indexOf('</head>');
  while (idx !== -1) {
    if (bodyOpen === -1 || idx < bodyOpen) return idx;
    idx = html.indexOf('</head>', idx + 1);
  }
  return -1;
}

function lastBodyClose(html) {
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return { idx, tailOk: false };
  const tail = html.slice(idx + 7);
  const tailOk = /^\s*(<\/html>)?\s*$/i.test(tail);
  return { idx, tailOk };
}

function looksLight(html) {
  const m = html.match(/body\s*\{[^}]*\}/s);
  if (!m) return false;
  const bgm = m[0].match(/background(?:-color)?\s*:\s*([^;}]+)/);
  if (!bgm) return false;
  const v = bgm[1].trim().toLowerCase();
  return /#(f|e[0-9a-f]|d[0-9a-f])/.test(v.slice(0, 8)) || /\bwhite\b/.test(v);
}

/* ---------------- run ---------------- */
const results = { injected: [], skippedAlready: [], flagged: [], missing: [] };

function processFile(rel, mode) {
  if (DENY.has(rel)) { results.flagged.push([rel, 'deny-listed (light theme)']); return; }
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { results.missing.push(rel); return; }

  let html = fs.readFileSync(abs, 'utf8');
  const origLen = Buffer.byteLength(html, 'utf8');

  if (html.includes('iis-motion')) { results.skippedAlready.push(rel); return; }
  if (looksLight(html)) { results.flagged.push([rel, 'light body background']); return; }

  const headIdx = findRealHeadClose(html);
  if (headIdx === -1) { results.flagged.push([rel, 'no real </head> before <body>']); return; }
  const { idx: bodyIdx, tailOk } = lastBodyClose(html);
  if (bodyIdx === -1) { results.flagged.push([rel, 'no </body>']); return; }
  if (!tailOk) { results.flagged.push([rel, 'unexpected content after last </body> — manual review']); return; }

  const cssInsert = '    ' + LINK_TAG + '\n';
  const jsInsert = '  ' + scriptTag(mode) + '\n';

  let out = html.slice(0, headIdx) + cssInsert + html.slice(headIdx);
  const bodyIdx2 = out.lastIndexOf('</body>');
  out = out.slice(0, bodyIdx2) + jsInsert + out.slice(bodyIdx2);

  /* byte math + occurrence verification */
  const expected = origLen + Buffer.byteLength(cssInsert + jsInsert, 'utf8');
  const actual = Buffer.byteLength(out, 'utf8');
  if (actual !== expected) { results.flagged.push([rel, `byte mismatch ${actual}!=${expected}`]); return; }
  if (out.split('iis-motion.css').length !== 2 || out.split('iis-motion.js').length !== 2) {
    results.flagged.push([rel, 'occurrence check failed']); return;
  }

  if (!DRY) {
    const bak = path.join(BACKUP_ROOT, rel);
    fs.mkdirSync(path.dirname(bak), { recursive: true });
    fs.writeFileSync(bak, html);
    fs.writeFileSync(abs, out);
  }
  results.injected.push(rel + (mode === 'bg' ? '  [bg]' : ''));
}

for (const rel of FULL) processFile(rel, 'full');
for (const rel of BG_ONLY) processFile(rel, 'bg');

/* ---------------- report ---------------- */
console.log(`\n=== IIS MOTION LAYER INJECTION ${DRY ? '(DRY RUN)' : ''} ===`);
console.log(`Injected  : ${results.injected.length}`);
results.injected.forEach((f) => console.log('   + ' + f));
console.log(`Already   : ${results.skippedAlready.length}`);
results.skippedAlready.forEach((f) => console.log('   = ' + f));
console.log(`Flagged   : ${results.flagged.length}`);
results.flagged.forEach(([f, why]) => console.log('   ! ' + f + ' — ' + why));
console.log(`Missing   : ${results.missing.length}`);
results.missing.forEach((f) => console.log('   ? ' + f));
process.exitCode = results.flagged.length || results.missing.length ? 1 : 0;
