#!/usr/bin/env node
/* ==========================================================================
   apply-site-upgrades.mjs v1 — wires the IIS upgrade bundle into main.
   Runs AFTER scripts/inject-motion-layer.mjs in a fresh clone. Idempotent.

   1. /assets/iis-upgrades.js  → injected before the last </body> on the
      pages that carry the Road Ahead roadmap, the Background-I scroll-morph,
      or the Growth Library shelf:
        index.html, services.html, about.html, purchase-tech.html,
        growth-library.html
   2. /assets/legal-suite.css  → injected before the real </head> on the
      assurance/legal surfaces: trust.html, copyright.html
   3. Service-worker cache bump (v10→v11 / 20260707a→20260707b) so returning
      visitors pick up the new assets immediately.

   Guards: idempotent markers, real-head/last-body resolution, byte math.
   Exit code 1 only on flagged files.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = globalThis.process.cwd();
const DRY = globalThis.process.argv.includes('--dry');

const UPGRADE_TAG = '<script src="/assets/iis-upgrades.js" defer></script>';
const LEGAL_TAG = '<link rel="stylesheet" href="/assets/legal-suite.css">';

const UPGRADE_PAGES = [
  'index.html', 'services.html', 'about.html', 'purchase-tech.html',
  'growth-library.html',
];
const LEGAL_PAGES = ['trust.html', 'copyright.html'];

const results = { done: [], already: [], flagged: [], missing: [] };

function findRealHeadClose(html) {
  const bodyOpen = html.search(/<body[\s>]/i);
  let idx = html.indexOf('</head>');
  while (idx !== -1) {
    if (bodyOpen === -1 || idx < bodyOpen) return idx;
    idx = html.indexOf('</head>', idx + 1);
  }
  return -1;
}

function injectBeforeLastBody(rel, tag, marker) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { results.missing.push(rel); return; }
  let html = fs.readFileSync(abs, 'utf8');
  if (html.includes(marker)) { results.already.push(rel + ' (' + marker + ')'); return; }
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) { results.flagged.push([rel, 'no body close']); return; }
  const insert = '  ' + tag + '\n';
  const out = html.slice(0, idx) + insert + html.slice(idx);
  if (Buffer.byteLength(out, 'utf8') !== Buffer.byteLength(html, 'utf8') + Buffer.byteLength(insert, 'utf8')) {
    results.flagged.push([rel, 'byte mismatch']); return;
  }
  if (!DRY) fs.writeFileSync(abs, out);
  results.done.push(rel + ' + ' + marker);
}

function injectBeforeHead(rel, tag, marker) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { results.missing.push(rel); return; }
  let html = fs.readFileSync(abs, 'utf8');
  if (html.includes(marker)) { results.already.push(rel + ' (' + marker + ')'); return; }
  const idx = findRealHeadClose(html);
  if (idx === -1) { results.flagged.push([rel, 'no real head close']); return; }
  const insert = '    ' + tag + '\n';
  const out = html.slice(0, idx) + insert + html.slice(idx);
  if (Buffer.byteLength(out, 'utf8') !== Buffer.byteLength(html, 'utf8') + Buffer.byteLength(insert, 'utf8')) {
    results.flagged.push([rel, 'byte mismatch']); return;
  }
  if (!DRY) fs.writeFileSync(abs, out);
  results.done.push(rel + ' + ' + marker);
}

for (const rel of UPGRADE_PAGES) injectBeforeLastBody(rel, UPGRADE_TAG, 'iis-upgrades.js');
for (const rel of LEGAL_PAGES) injectBeforeHead(rel, LEGAL_TAG, 'legal-suite.css');

/* ---------------- service-worker bumps ---------------- */
const swBumps = [];
try {
  const p1 = path.join(ROOT, 'sw.js');
  if (fs.existsSync(p1)) {
    const s1 = fs.readFileSync(p1, 'utf8');
    const o1 = s1.replace(/const CACHE_NAME = "iisupport-v\d+";/, 'const CACHE_NAME = "iisupport-v11";');
    if (o1 !== s1) { if (!DRY) fs.writeFileSync(p1, o1); swBumps.push('sw.js -> v11'); }
    else if (/iisupport-v11/.test(s1)) swBumps.push('sw.js already v11');
  }
} catch (e) { results.flagged.push(['sw.js', String(e.message)]); }
try {
  const p2 = path.join(ROOT, 'service-worker.js');
  if (fs.existsSync(p2)) {
    const s2 = fs.readFileSync(p2, 'utf8');
    const o2 = s2.replace(/const CACHE_VERSION = 'iis-cache-v[^']*';/, "const CACHE_VERSION = 'iis-cache-v1.20260707b';");
    if (o2 !== s2) { if (!DRY) fs.writeFileSync(p2, o2); swBumps.push('service-worker.js -> 20260707b'); }
    else if (/20260707b/.test(s2)) swBumps.push('service-worker.js already 20260707b');
  }
} catch (e) { results.flagged.push(['service-worker.js', String(e.message)]); }

/* ---------------- sanity: required assets exist ---------------- */
for (const a of ['assets/iis-upgrades.js', 'assets/legal-suite.css', 'assets/iis-motion.css', 'assets/iis-motion.js', 'forums/index.html']) {
  if (!fs.existsSync(path.join(ROOT, a))) results.flagged.push([a, 'REQUIRED FILE MISSING']);
}
try {
  const motionCss = fs.readFileSync(path.join(ROOT, 'assets/iis-motion.css'), 'utf8');
  if (!motionCss.includes('bg-i-stage')) results.flagged.push(['assets/iis-motion.css', 'v1.1 morph fix missing — stale file?']);
  if (!motionCss.includes('z-index:-4')) results.flagged.push(['assets/iis-motion.css', 'v1.1 z-order fix missing — stale file?']);
  const forums = fs.readFileSync(path.join(ROOT, 'forums/index.html'), 'utf8');
  if (!forums.includes('Knowledge Commons')) results.flagged.push(['forums/index.html', 'new Commons page missing — stale file?']);
} catch (e) { results.flagged.push(['sanity', String(e.message)]); }

/* ---------------- report ---------------- */
console.log('');
console.log('=== IIS SITE UPGRADES ' + (DRY ? '(DRY RUN)' : '') + ' ===');
console.log('Done      : ' + results.done.length);
results.done.forEach(function (f) { console.log('   + ' + f); });
console.log('Already   : ' + results.already.length);
results.already.forEach(function (f) { console.log('   = ' + f); });
console.log('SW bumps  : ' + (swBumps.join(' | ') || 'none'));
console.log('Flagged   : ' + results.flagged.length);
results.flagged.forEach(function (r) { console.log('   ! ' + r[0] + ' — ' + r[1]); });
console.log('Missing   : ' + results.missing.length);
results.missing.forEach(function (f) { console.log('   ? ' + f); });
console.log(results.flagged.length ? 'RESULT: FLAGGED — do not ship' : 'RESULT: CLEAN');
globalThis.process.exitCode = results.flagged.length ? 1 : 0;
