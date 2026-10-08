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
// LIMIT LADDER, not a single number. Measured against production 2026-08-12:
//   limit=5000 -> 502   limit=2000 -> 502   limit=1600 -> 502   limit=1200 -> 502 (~41s)
//   limit=800  -> 200 (26s)   limit=500 -> 200   limit=50 -> 200
// aria-kb-export does one Blobs read PER BIT (`blobs.slice(0, limit)` then `kb.get` in a loop), so
// its runtime scales with the limit and it blows Netlify's ~26s synchronous ceiling somewhere
// between 800 and 1200 bits. The old hard-coded 5000 was therefore guaranteed to fail the moment
// the KB outgrew ~1000 bits, which it did: pull.log shows "Export failed: 502" on every run from
// 2026-07-21 to 2026-08-12 - 22 failing days, logged faithfully, alerting nobody.
//
// A single smaller number would rot the same way as the KB keeps growing. So: walk DOWN the ladder
// until one completes. Getting some of the KB is strictly better than getting none, which is what
// three weeks of 502s delivered.
const LIMIT_LADDER = process.env.ARIA_KB_LIMIT
  ? [process.env.ARIA_KB_LIMIT]
  : ['800', '500', '250', '100'];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'aria_brain_pack', 'bits');

async function main() {
  if (!SECRET) {
    console.error('ERROR: set ARIA_AUDIT_SECRET (the value from your Netlify env) before running.');
    process.exit(1);
  }
  let data = null, usedLimit = null, lastStatus = null, lastBody = '';
  for (const limit of LIMIT_LADDER) {
    const url = `${SITE}/.netlify/functions/aria-kb-export?limit=${encodeURIComponent(limit)}`;
    console.log('Pulling live bit-KB from', url);
    let res;
    try {
      // Below the 26s server ceiling, so a hang is a real failure rather than us giving up early.
      res = await fetch(url, { headers: { 'x-aria-export-secret': SECRET }, signal: AbortSignal.timeout(50000) });
    } catch (e) {
      lastStatus = 'network'; lastBody = e.message;
      console.error(`  limit=${limit} failed (${e.message}) — trying a smaller page`);
      continue;
    }
    if (res.ok) { data = await res.json(); usedLimit = limit; break; }
    lastStatus = res.status;
    lastBody = await res.text().catch(() => '');
    // 401/403 is the secret, not the size — no smaller page will fix it.
    if (res.status === 401 || res.status === 403) break;
    console.error(`  limit=${limit} -> ${res.status} — trying a smaller page`);
  }
  if (!data) {
    console.error('Export failed:', lastStatus, String(lastBody).slice(0, 200));
    process.exit(1);
  }
  if (usedLimit !== LIMIT_LADDER[0]) {
    console.warn(`NOTE: fell back to limit=${usedLimit}. The export has no pagination, so this is a`
      + ' PARTIAL mirror — aria-kb-export needs an offset/cursor to pull the whole KB.');
  }
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
