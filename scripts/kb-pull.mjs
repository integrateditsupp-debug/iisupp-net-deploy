#!/usr/bin/env node
// scripts/kb-pull.mjs — pull ARIA's LIVE learned bit-KB down to THIS machine.
//
// Rule 7 (Ahmad, 2026-05-25): the KB must live locally and be owned by Ahmad. Serverless
// can't push to your PC, so you (or a local Task Scheduler / cron job) RUN this. It calls
// the aria-kb-export endpoint, then writes every learned bit into ./aria_brain_pack/bits/
// plus a manifest. The curated base (assets/aria-kb-local-bundle-v2.json) is already in
// the repo, so it's already local — this fetches what the continuous loop has learned since.
//
// Usage (PowerShell):
//   $env:ARIA_AUDIT_SECRET="<the value from Netlify env>"
//   node scripts/kb-pull.mjs
// Optional: $env:ARIA_SITE="https://iisupp.net"   (default)
//
// Schedule it (Windows Task Scheduler, daily) to keep the local copy fresh.

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = (process.env.ARIA_SITE || 'https://iisupp.net').replace(/\/$/, '');
const SECRET = process.env.ARIA_AUDIT_SECRET || process.env.ARIA_EXPORT_SECRET || '';
const LIMIT = process.env.ARIA_KB_LIMIT || '5000';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'aria_brain_pack', 'bits');

async function main() {
  if (!SECRET) {
    console.error('ERROR: set ARIA_AUDIT_SECRET (the value from your Netlify env) before running.');
    process.exit(1);
  }
  const url = `${SITE}/.netlify/functions/aria-kb-export?limit=${encodeURIComponent(LIMIT)}`;
  console.log('Pulling live bit-KB from', url);
  const res = await fetch(url, { headers: { 'x-aria-export-secret': SECRET } });
  if (!res.ok) {
    console.error('Export failed:', res.status, await res.text().catch(() => ''));
    process.exit(1);
  }
  const data = await res.json();
  const bits = data.bits || [];
  await mkdir(outDir, { recursive: true });

  let written = 0;
  for (const bit of bits) {
    const safe = String(bit.key || `bit-${written}`).replace(/[^a-z0-9._-]/gi, '_');
    await writeFile(join(outDir, safe.endsWith('.json') ? safe : safe + '.json'), JSON.stringify(bit, null, 2), 'utf8');
    written++;
  }
  const manifest = {
    pulledAt: new Date().toISOString(),
    site: SITE,
    exportedAt: data.exportedAt,
    count: bits.length,
    written,
    note: 'Local owned copy of ARIA live bit-KB. Curated base is assets/aria-kb-local-bundle-v2.json.'
  };
  await writeFile(join(root, 'aria_brain_pack', 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Done. Wrote ${written} bits to aria_brain_pack/bits/ (manifest updated).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
