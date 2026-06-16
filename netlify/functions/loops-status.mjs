// loops-status.mjs — read-only endpoint that surfaces loop activity.
// Powers the Loops panel inside /aperture-learning.html.
// ZERO cost. No LLM. Just filesystem reads.
//
// GET /.netlify/functions/loops-status
//   → { goal, loops: [...], ledger: [...recent 30], alignment: {...},
//       observerSummary: {...}, generatedAt: ISO }
//
// Always returns 200 with `error: ...` on partial failure so the panel
// degrades gracefully and never breaks the aperture login flow.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO = resolve(dirname(__filename), '..', '..');

async function safeRead(rel, json = false) {
  try {
    const txt = await readFile(resolve(REPO, rel), 'utf8');
    return json ? JSON.parse(txt) : txt;
  } catch (_) {
    return null;
  }
}

function parseLedger(md) {
  if (!md) return [];
  // Lines look like: "- 2026-06-14T01:24:56.750Z | message text"
  const lines = md.split('\n').filter(l => l.startsWith('- '));
  return lines.slice(-30).reverse().map(l => {
    const m = l.match(/^- (\S+)\s*\|\s*(.+)$/);
    if (m) return { ts: m[1], text: m[2] };
    return { ts: '', text: l.slice(2) };
  });
}

function parseAlignment(md) {
  if (!md) return { aligned: 0, drifting: 0, raw: '' };
  const aligned = (md.match(/Aligned\s*\((\d+)\/(\d+)\)/i) || [])[1] || 0;
  const total   = (md.match(/Aligned\s*\((\d+)\/(\d+)\)/i) || [])[2] || 0;
  const drifting = (md.match(/Drifting\s*\((\d+)\)/i) || [])[1] || 0;
  return { aligned: +aligned, total: +total, drifting: +drifting, raw: md.slice(0, 800) };
}

function parseGoal(md) {
  if (!md) return null;
  const lines = md.split('\n').filter(Boolean);
  return lines[0] || null;
}

function summarizeObserver(scan) {
  if (!scan || !scan.stats) return null;
  const c = scan.stats.codex || {};
  return {
    since: scan.since || 'last 200 commits',
    codexCommits: c.commitCount || 0,
    median: c.medianChurn || 0,
    topDir: (c.topDirectories || [])[0] || null,
    opinions: (scan.ops || []).slice(0, 3),
    generatedAt: scan.generatedAt || null,
  };
}

export default async (req) => {
  const [registry, ledgerMd, alignmentMd, goalMd, observerScan] = await Promise.all([
    safeRead('loops/registry.json', true),
    safeRead('docs/LOOPS_LEDGER.md'),
    safeRead('docs/LOOPS_ALIGNMENT.md'),
    safeRead('loops/CURRENT_GOAL.md'),
    safeRead('.codex-observer/last-scan.json', true),
  ]);

  const payload = {
    schema: 'iis-loops-status/v1',
    generatedAt: new Date().toISOString(),
    goal: parseGoal(goalMd),
    loops: (registry && registry.loops) || [],
    registryUpdated: (registry && registry.updated) || null,
    ledger: parseLedger(ledgerMd),
    alignment: parseAlignment(alignmentMd),
    observerSummary: summarizeObserver(observerScan),
    errors: {
      registry: registry ? null : 'loops/registry.json not found',
      ledger:   ledgerMd ? null : 'docs/LOOPS_LEDGER.md not found',
      goal:     goalMd ? null : 'loops/CURRENT_GOAL.md not found',
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=10, stale-while-revalidate=30',
      'access-control-allow-origin': '*',
    },
  });
};
