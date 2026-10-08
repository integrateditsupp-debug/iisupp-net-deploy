#!/usr/bin/env node
/**
 * Held-release guard.
 *
 * Some work is finished, reviewed and deliberately NOT published — it sits under
 * docs/held-releases/ waiting on a gate that costs money or time (a code-signing
 * certificate, a rebuild, a legal review). The failure mode is that someone pastes
 * it back into a public page months later without remembering why it was parked.
 *
 * This gate fails the build if a held marker shows up in a publicly-served file.
 * Add an entry to HOLDS when you park something; delete the entry when you ship it.
 *
 * Run: node scripts/check-held-release-markers.mjs
 * Wired into: npm run site:hygiene
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not new URL().pathname — this repo lives under "ARIA — Real-Time AI Assistant",
// so the raw pathname arrives percent-encoded ("%20", "%E2%80%94") and every fs call misses.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const HOLDS = [
  {
    id: 'aria-sentinel-public-download',
    // Any of these appearing in a public file means the held section is back on the site.
    markers: ['dl-card', 'AVAILABLE NOW', 'aria-sentinel-windows.exe'],
    // ...except in the parking file itself and anything else non-public.
    heldFile: 'docs/held-releases/downloads-available-now.html',
    why:
      'The ARIA Sentinel public download is held until (1) the Authenticode EV cert is ' +
      'purchased and the installer signed, and (2) the installer is rebuilt from the ' +
      'current source tree (shipped binary v0.1.0 vs source v0.1.16).',
  },
];

// Directories that netlify.toml 404s, plus build/vendor noise. Nothing here is public.
const NON_PUBLIC = new Set([
  '.git', 'node_modules', 'docs', 'scripts', 'data', 'tests', 'archive', 'backups',
  'artifacts', 'outputs', 'netlify', 'apps', '.github', 'senior-director-state',
  'ARIA Sentinel', 'aria_brain_pack', 'case-study-templates', 'procurement-downloads',
]);

const PUBLIC_EXT = /\.(html|htm)$/i;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (NON_PUBLIC.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (PUBLIC_EXT.test(entry)) out.push(full);
  }
  return out;
}

const publicFiles = walk(ROOT);
const violations = [];

for (const hold of HOLDS) {
  for (const file of publicFiles) {
    const rel = relative(ROOT, file).split(sep).join('/');
    if (rel === hold.heldFile) continue;
    const text = readFileSync(file, 'utf8');
    const hits = hold.markers.filter((m) => text.includes(m));
    if (hits.length) violations.push({ hold: hold.id, file: rel, markers: hits, why: hold.why });
  }
}

// netlify.toml is not an HTML file but is the other way the download can go live.
const toml = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
for (const line of toml.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('#')) continue;
  if (trimmed.includes('/downloads/aria-sentinel-windows.exe')) {
    violations.push({
      hold: 'aria-sentinel-public-download',
      file: 'netlify.toml',
      markers: ['/downloads/aria-sentinel-windows.exe redirect is uncommented'],
      why: HOLDS[0].why,
    });
  }
}

if (violations.length === 0) {
  console.log(JSON.stringify({ heldReleases: HOLDS.length, scannedPublicFiles: publicFiles.length, violations: [] }, null, 2));
  process.exit(0);
}

console.error('\nHELD RELEASE GATE FAILED — content that is deliberately unpublished is back on a public path.\n');
for (const v of violations) {
  console.error(`  ${v.file}`);
  console.error(`    hold:    ${v.hold}`);
  console.error(`    matched: ${v.markers.join(', ')}`);
  console.error(`    why:     ${v.why}\n`);
}
console.error('If the gate has genuinely cleared, remove the entry from HOLDS in this script');
console.error('and delete the matching file under docs/held-releases/. Do not silence it otherwise.\n');
process.exit(1);
