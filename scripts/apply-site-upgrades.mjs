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

/* ---------------- Content Assurance (exists on main only) ----------------
   /services/content-assurance — the legality + QA service flow. Give it the
   motion layer (it was born after the v1.0 injection list) AND the counsel-
   grade legal suite. Detect whichever file shape the route uses. */
const CA_CANDIDATES = [
  'services/content-assurance.html',
  'services/content-assurance/index.html',
  'content-assurance.html',
];
const MOTION_LINK = '<link rel="stylesheet" href="/assets/iis-motion.css">';
const MOTION_SCRIPT = '<script src="/assets/iis-motion.js" defer></script>';
let caFound = false;
for (const rel of CA_CANDIDATES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  caFound = true;
  let html = fs.readFileSync(abs, 'utf8');
  if (!html.includes('iis-motion.css')) {
    const hIdx = findRealHeadClose(html);
    if (hIdx !== -1) html = html.slice(0, hIdx) + '    ' + MOTION_LINK + '\n' + html.slice(hIdx);
    else results.flagged.push([rel, 'no real head close for motion link']);
  }
  if (!html.includes('iis-motion.js')) {
    const bIdx = html.lastIndexOf('</body>');
    if (bIdx !== -1) html = html.slice(0, bIdx) + '  ' + MOTION_SCRIPT + '\n' + html.slice(bIdx);
    else results.flagged.push([rel, 'no body close for motion script']);
  }
  if (!html.includes('legal-suite.css')) {
    const hIdx2 = findRealHeadClose(html);
    if (hIdx2 !== -1) html = html.slice(0, hIdx2) + '    ' + LEGAL_TAG + '\n' + html.slice(hIdx2);
    else results.flagged.push([rel, 'no real head close for legal suite']);
  }
  if (!DRY) fs.writeFileSync(abs, html);
  results.done.push(rel + ' + motion + legal-suite (Content Assurance)');
  break;
}
if (!caFound) results.missing.push('content-assurance page (searched ' + CA_CANDIDATES.join(', ') + ')');

/* Catch-all: any other services/*.html born on main without the motion layer */
try {
  const svcDir = path.join(ROOT, 'services');
  if (fs.existsSync(svcDir) && fs.statSync(svcDir).isDirectory()) {
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const p2 = path.join(dir, f);
        const st = fs.statSync(p2);
        if (st.isDirectory()) { walk(p2); continue; }
        if (!f.endsWith('.html')) continue;
        const rel = path.relative(ROOT, p2).split(path.sep).join('/');
        let html = fs.readFileSync(p2, 'utf8');
        if (html.includes('iis-motion')) continue;
        const bodyM = html.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*([^;}]+)/s);
        if (bodyM && /#(f|e[0-9a-f]|d[0-9a-f])/.test(bodyM[1].trim().toLowerCase().slice(0, 8))) continue; /* light page */
        const hIdx = findRealHeadClose(html);
        const bIdx = html.lastIndexOf('</body>');
        if (hIdx === -1 || bIdx === -1) continue;
        html = html.slice(0, hIdx) + '    ' + MOTION_LINK + '\n' + html.slice(hIdx);
        const bIdx2 = html.lastIndexOf('</body>');
        html = html.slice(0, bIdx2) + '  ' + MOTION_SCRIPT + '\n' + html.slice(bIdx2);
        if (!DRY) fs.writeFileSync(p2, html);
        results.done.push(rel + ' + motion (services catch-all)');
      }
    };
    walk(svcDir);
  }
} catch (e) { results.flagged.push(['services catch-all', String(e.message)]); }

/* ---------------- asset cache-busting version stamps ----------------
   /assets/* is served with a 7-day browser cache (max-age=604800), so asset
   CHANGES must ship under a new URL. Stamp every reference to our four
   assets with ?v=TOKEN. Re-runs replace older tokens (idempotent). */
const TOKEN = '20260707c';
const STAMP_ASSETS = ['iis-motion.css', 'iis-motion.js', 'iis-upgrades.js', 'legal-suite.css'];
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.netlify', 'backups', 'archive', 'apps', 'tests',
  'docs', 'scripts', 'senior-director-state', '_shipped-src', '_branch-src',
  'aria-vault', 'aria_memory', 'aria_brain_pack', 'outputs', 'tmp', 'sdk',
  'openclaw', 'extension', 'email', 'loops', 'tools', 'strategic-reference',
  'knowledge-base', 'sample-scenarios', 'case-study-templates', 'design-handoff',
]);
let stamped = 0;
function stampWalk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p2 = path.join(dir, f);
    let st;
    try { st = fs.statSync(p2); } catch (e) { continue; }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(f) && !f.startsWith('.')) stampWalk(p2);
      continue;
    }
    if (!f.endsWith('.html')) continue;
    let html;
    try { html = fs.readFileSync(p2, 'utf8'); } catch (e) { continue; }
    let out = html;
    for (const asset of STAMP_ASSETS) {
      const re = new RegExp('(/assets/' + asset.replace('.', '\\.') + ')(\\?v=[\\w.\\-]*)?', 'g');
      out = out.replace(re, '$1?v=' + TOKEN);
    }
    if (out !== html) {
      if (!DRY) fs.writeFileSync(p2, out);
      stamped++;
    }
  }
}
try { stampWalk(ROOT); } catch (e) { results.flagged.push(['asset stamping', String(e.message)]); }

/* ---------------- service-worker bumps ---------------- */
const swBumps = [];
try {
  const p1 = path.join(ROOT, 'sw.js');
  if (fs.existsSync(p1)) {
    const s1 = fs.readFileSync(p1, 'utf8');
    const o1 = s1.replace(/const CACHE_NAME = "iisupport-v\d+";/, 'const CACHE_NAME = "iisupport-v12";');
    if (o1 !== s1) { if (!DRY) fs.writeFileSync(p1, o1); swBumps.push('sw.js -> v12'); }
    else if (/iisupport-v12/.test(s1)) swBumps.push('sw.js already v12');
  }
} catch (e) { results.flagged.push(['sw.js', String(e.message)]); }
try {
  const p2 = path.join(ROOT, 'service-worker.js');
  if (fs.existsSync(p2)) {
    const s2 = fs.readFileSync(p2, 'utf8');
    const o2 = s2.replace(/const CACHE_VERSION = 'iis-cache-v[^']*';/, "const CACHE_VERSION = 'iis-cache-v1.20260707c';");
    if (o2 !== s2) { if (!DRY) fs.writeFileSync(p2, o2); swBumps.push('service-worker.js -> 20260707c'); }
    else if (/20260707c/.test(s2)) swBumps.push('service-worker.js already 20260707c');
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
  if (!motionCss.includes('rm-flip')) results.flagged.push(['assets/iis-motion.css', 'roadmap flip enrichment missing — stale file?']);
  const upg = fs.readFileSync(path.join(ROOT, 'assets/iis-upgrades.js'), 'utf8');
  if (upg.includes('flipify')) results.flagged.push(['assets/iis-upgrades.js', 'stale v1.0 DOM flip wrapper still present']);
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
console.log('Stamped   : ' + stamped + ' pages -> ?v=' + TOKEN);
console.log('SW bumps  : ' + (swBumps.join(' | ') || 'none'));
console.log('Flagged   : ' + results.flagged.length);
results.flagged.forEach(function (r) { console.log('   ! ' + r[0] + ' — ' + r[1]); });
console.log('Missing   : ' + results.missing.length);
results.missing.forEach(function (f) { console.log('   ? ' + f); });
console.log(results.flagged.length ? 'RESULT: FLAGGED — do not ship' : 'RESULT: CLEAN');
globalThis.process.exitCode = results.flagged.length ? 1 : 0;
