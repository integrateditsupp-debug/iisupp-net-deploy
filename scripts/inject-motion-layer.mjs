#!/usr/bin/env node
/* ==========================================================================
   inject-motion-layer.mjs v2 — wires /assets/iis-motion.{css,js} into every
   public-facing page of iisupp.net. Idempotent, additive-only (Rule 15).
   Designed to run against ANY checkout (working tree or a fresh main clone).

   Usage:  node scripts/inject-motion-layer.mjs [--dry]

   Pipeline per run:
     0. html,body background split — pages that paint an opaque background on
        BOTH html and body get the background moved to html{} only (pixel-
        identical render; required so the fixed z-index:-1 layer is visible).
     1. Tag injection:
          link  /assets/iis-motion.css   before the real closing head tag
          script /assets/iis-motion.js   before the last closing body tag
          (aria.html gets data-mode="bg" — ambience only, no reveals)
     2. Service-worker cache bumps (sw.js to iisupport-v10,
        service-worker.js to iis-cache-v1.20260707a) — idempotent.

   Guards:
     · skips any file already containing "iis-motion"
     · resolves the REAL head close (must precede body open) + LAST body close
     · light-theme detector — refuses pages whose body background is light
     · byte-math + occurrence verification on every write
     · exit code 1 only on FLAGGED files (missing files reported, not fatal)
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = globalThis.process.cwd();
const DRY = globalThis.process.argv.includes('--dry');

const LINK_TAG = '<link rel="stylesheet" href="/assets/iis-motion.css">';
const scriptTag = (mode) =>
  `<script src="/assets/iis-motion.js" defer${mode === 'bg' ? ' data-mode="bg"' : ''}></script>`;

/* ---------------- target sets ---------------- */
const FULL = [
  'index.html', 'm.html', 'services.html', 'shop.html', 'marketplace.html',
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
/* every Growth Library preview page present in this checkout */
try {
  for (const f of fs.readdirSync(path.join(ROOT, 'downloads/library'))) {
    if (f.endsWith('.html')) FULL.push('downloads/library/' + f);
  }
} catch (e) { /* directory may not exist on this branch */ }

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
  if (idx === -1) return { idx: idx, tailOk: false };
  const tail = html.slice(idx + 7);
  const tailOk = /^\s*(<\/html>)?\s*$/i.test(tail);
  return { idx: idx, tailOk: tailOk };
}

function looksLight(html) {
  const m = html.match(/body\s*\{[^}]*\}/s);
  if (!m) return false;
  const bgm = m[0].match(/background(?:-color)?\s*:\s*([^;}]+)/);
  if (!bgm) return false;
  const v = bgm[1].trim().toLowerCase();
  return /#(f|e[0-9a-f]|d[0-9a-f])/.test(v.slice(0, 8)) || /\bwhite\b/.test(v);
}

/* Split "html,body{...background...}" into "html{bg}" + "html,body{rest}" so
   the fixed z:-1 ambient layer is not covered by the body's own background.
   Pixel-identical: the background still paints (via html, to the canvas). */
function fixHtmlBodyBackground(html) {
  const re = /(html\s*,\s*body|body\s*,\s*html)\s*\{([^}]*)\}/ms;
  const m = html.match(re);
  if (!m) return { html: html, changed: false };
  const decls = m[2].split(';').map(function (d) { return d.trim(); }).filter(Boolean);
  const bg = decls.filter(function (d) { return /^background\b/i.test(d); });
  const rest = decls.filter(function (d) { return !/^background\b/i.test(d); });
  if (!bg.length) return { html: html, changed: false };
  const replacement = 'html{' + bg.join(';') + '}\n  html,body{' + rest.join(';') + '}';
  return { html: html.replace(re, replacement), changed: true };
}

/* ---------------- run ---------------- */
const results = { injected: [], skippedAlready: [], flagged: [], missing: [], bgSplit: [] };

function processFile(rel, mode) {
  if (DENY.has(rel)) { results.flagged.push([rel, 'deny-listed (light theme)']); return; }
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { results.missing.push(rel); return; }

  let html = fs.readFileSync(abs, 'utf8');

  if (html.includes('iis-motion')) { results.skippedAlready.push(rel); return; }
  if (looksLight(html)) { results.flagged.push([rel, 'light body background']); return; }

  /* step 0 — make the ambience visible where html+body both paint */
  const split = fixHtmlBodyBackground(html);
  html = split.html;
  if (split.changed) results.bgSplit.push(rel);

  const origLen = Buffer.byteLength(html, 'utf8');

  const headIdx = findRealHeadClose(html);
  if (headIdx === -1) { results.flagged.push([rel, 'no real head close before body']); return; }
  const bc = lastBodyClose(html);
  if (bc.idx === -1) { results.flagged.push([rel, 'no body close']); return; }
  if (!bc.tailOk) { results.flagged.push([rel, 'unexpected content after last body close — manual review']); return; }

  const cssInsert = '    ' + LINK_TAG + '\n';
  const jsInsert = '  ' + scriptTag(mode) + '\n';

  let out = html.slice(0, headIdx) + cssInsert + html.slice(headIdx);
  const bodyIdx2 = out.lastIndexOf('</body>');
  out = out.slice(0, bodyIdx2) + jsInsert + out.slice(bodyIdx2);

  /* byte math + occurrence verification */
  const expected = origLen + Buffer.byteLength(cssInsert + jsInsert, 'utf8');
  const actual = Buffer.byteLength(out, 'utf8');
  if (actual !== expected) { results.flagged.push([rel, 'byte mismatch ' + actual + '!=' + expected]); return; }
  if (out.split('iis-motion.css').length !== 2 || out.split('iis-motion.js').length !== 2) {
    results.flagged.push([rel, 'occurrence check failed']); return;
  }

  if (!DRY) fs.writeFileSync(abs, out);
  results.injected.push(rel + (mode === 'bg' ? '  [bg]' : ''));
}

for (const rel of FULL) processFile(rel, 'full');
for (const rel of BG_ONLY) processFile(rel, 'bg');

/* ---------------- service-worker cache bumps (idempotent) ---------------- */
const swBumps = [];
try {
  const p1 = path.join(ROOT, 'sw.js');
  if (fs.existsSync(p1)) {
    const s1 = fs.readFileSync(p1, 'utf8');
    const o1 = s1.replace(/const CACHE_NAME = "iisupport-v\d+";/, 'const CACHE_NAME = "iisupport-v10";');
    if (o1 !== s1) { if (!DRY) fs.writeFileSync(p1, o1); swBumps.push('sw.js -> iisupport-v10'); }
    else if (/iisupport-v10/.test(s1)) swBumps.push('sw.js already v10');
  }
} catch (e) { results.flagged.push(['sw.js', String(e.message)]); }
try {
  const p2 = path.join(ROOT, 'service-worker.js');
  if (fs.existsSync(p2)) {
    const s2 = fs.readFileSync(p2, 'utf8');
    const o2 = s2.replace(/const CACHE_VERSION = 'iis-cache-v[^']*';/, "const CACHE_VERSION = 'iis-cache-v1.20260707a';");
    if (o2 !== s2) { if (!DRY) fs.writeFileSync(p2, o2); swBumps.push('service-worker.js -> v1.20260707a'); }
    else if (/20260707a/.test(s2)) swBumps.push('service-worker.js already 20260707a');
  }
} catch (e) { results.flagged.push(['service-worker.js', String(e.message)]); }

/* ---------------- report ---------------- */
console.log('');
console.log('=== IIS MOTION LAYER INJECTION v2 ' + (DRY ? '(DRY RUN)' : '') + ' ===');
console.log('Injected  : ' + results.injected.length);
results.injected.forEach(function (f) { console.log('   + ' + f); });
console.log('bg-split  : ' + results.bgSplit.length + '  (' + results.bgSplit.join(', ') + ')');
console.log('Already   : ' + results.skippedAlready.length);
results.skippedAlready.forEach(function (f) { console.log('   = ' + f); });
console.log('SW bumps  : ' + (swBumps.join(' | ') || 'none'));
console.log('Flagged   : ' + results.flagged.length);
results.flagged.forEach(function (r) { console.log('   ! ' + r[0] + ' — ' + r[1]); });
console.log('Missing   : ' + results.missing.length);
results.missing.forEach(function (f) { console.log('   ? ' + f); });
console.log(results.flagged.length ? 'RESULT: FLAGGED — review before shipping' : 'RESULT: CLEAN');
globalThis.process.exitCode = results.flagged.length ? 1 : 0;
