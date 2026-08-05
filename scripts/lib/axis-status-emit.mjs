#!/usr/bin/env node
// axis-status-emit.mjs — the ONLY sanctioned writer of the public AXIS status feed.
//
// WHY (2026-07-21): the flywheel/observer loop regenerates .well-known/axis/status.json each run and
// repeatedly re-leaked internal build state (git SHAs, cc/ branch names, AHMAD-*.cmd operator scripts,
// index.lock state) to the anonymous web — publish = "." serves BOTH mirrors, including
// /public/.well-known/axis/status.json which the 9f40a6c2 trim missed. This module makes the leak class
// structurally impossible instead of relying on each run's discipline:
//
//   PUBLIC mirrors  (.well-known/axis/status.json + public/.well-known/axis/status.json)
//     → HEADLINE-ONLY: an allowlisted, length-capped set of keys (status / milestone / readiness /
//       revenueToDate / headline / note), scanned against LEAK_PATTERNS. A leaky value throws — the
//       emitter REFUSES to write it publicly.
//   INTERNAL detail (netlify/functions/_axis-status-full.json)
//     → full flywheel state, force-404'd live (/netlify/* rule) and served ONLY through the
//       authenticated /api/axis-status function (verifyAperture), same pattern as _axis-state-full.json.
//
// Flywheel rule: NEVER hand-write the .well-known mirrors. Put full detail in the internal file and run:
//   node scripts/lib/axis-status-emit.mjs emit --fields <headline-fields.json> [--full <full-detail.json>]
//   node scripts/lib/axis-status-emit.mjs check     ← scans the public mirrors; exit 1 on any leak
// tests/deploy-safety-denylist.test.mjs imports LEAK_PATTERNS so a bypassing writer still fails the suite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditAndAnnotate } from './claim-evidence.mjs';

export const PUBLIC_STATUS_FILES = [
  '.well-known/axis/status.json',
  'public/.well-known/axis/status.json',
];
export const INTERNAL_FULL_FILE = 'netlify/functions/_axis-status-full.json';

// Everything a PUBLIC status file may contain. Nothing else survives the emitter.
export const PUBLIC_ALLOWED_KEYS = [
  'schema', 'generatedAt', 'public', 'honest',
  'status', 'milestone', 'readiness', 'revenueToDate',
  'headline', 'note',
];
const MAX_VALUE_LEN = 400; // headline fields are sentences, not reports — a full dump cannot fit

// The leak class this file exists to kill. Belt-and-braces on top of the allowlist:
// even an allowlisted field refuses to ship if its VALUE smuggles internal state.
export const LEAK_PATTERNS = [
  [/\b(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/i, 'git SHA'],
  [/\bcc\/[\w.-]+/i, 'cc/ branch name'],
  [/\brefs\/(heads|remotes)\b/i, 'git ref path'],
  [/\borigin\/[\w.-]+/i, 'remote branch name'],
  [/\b(index|main)\.lock\b/i, 'git lock state'],
  [/\bgit\s+(status|merge|checkout|commit|push|pull|fetch|ls-remote|reset)\b/i, 'git command/state'],
  [/\.(cmd|ps1|bat|sh)\b/i, 'operator script name'],
  [/\bAHMAD-[A-Z0-9][\w-]*/i, 'operator one-click script'],
  [/\b(flywheel|observer)\s+run\s+\d+/i, 'internal run counter'],
  [/senior-director-state|aria-vault|documents\/product-engineering/i, 'internal path'],
  [/[A-Za-z]:\\\\|(?:^|[\s"'(])\/(tmp|home|Users)\//, 'absolute file path'],
  [/\.git\b/, '.git internals'],
  [/\bquarantin/i, 'internal build-quality state'],
];

export function findLeaks(text) {
  const t = String(text || '');
  const hits = [];
  for (const [re, reason] of LEAK_PATTERNS) {
    const m = t.match(re);
    if (m) hits.push({ reason, match: String(m[0]).slice(0, 60) });
  }
  return hits;
}

// Build + validate the headline-only public object. Throws on unknown keys, oversized values, or leaks.
export function buildPublicStatus(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!PUBLIC_ALLOWED_KEYS.includes(k)) throw new Error(`public status: key "${k}" is not allowlisted — internal detail belongs in ${INTERNAL_FULL_FILE}`);
    if (typeof v !== 'string' && typeof v !== 'boolean' && typeof v !== 'number') throw new Error(`public status: key "${k}" must be a primitive (got ${typeof v}) — no nested detail on the public feed`);
    if (typeof v === 'string' && v.length > MAX_VALUE_LEN) throw new Error(`public status: key "${k}" exceeds ${MAX_VALUE_LEN} chars — that is a report, not a headline`);
    out[k] = v;
  }
  out.schema = out.schema || 'axis-status/1';
  if (!out.generatedAt) out.generatedAt = new Date().toISOString();
  out.public = true;
  if (out.honest === undefined) out.honest = true;
  for (const k of ['status', 'milestone', 'readiness', 'revenueToDate', 'headline']) {
    if (!(k in out)) throw new Error(`public status: required headline key "${k}" missing`);
  }
  const leaks = findLeaks(JSON.stringify(out));
  if (leaks.length) throw new Error('public status REFUSED — internal detail in public fields: ' + leaks.map(l => `${l.reason} ("${l.match}")`).join('; '));
  return out;
}

// Write internal full detail + headline-only public mirrors. Returns what was written where.
export function emitAxisStatus({ root, publicFields, fullDetail = null }) {
  const repoRoot = root || process.cwd();
  const pub = buildPublicStatus(publicFields);
  const written = { internal: null, public: [] };
  if (fullDetail) {
    // RUN-AK / AK1 + AK2 — a figure published in the operator-internal detail must carry its
    // evidence ({ value, measuredAt, source }) or the emitter REFUSES the whole write, and a figure
    // older than its class allows is LABELLED stale rather than reading as freshly measured.
    // Nothing is dropped by staleness. The public headline never carries any of this machinery.
    if (fullDetail.claims !== undefined) {
      const { claims, stale } = auditAndAnnotate(fullDetail.claims);
      fullDetail = { ...fullDetail, claims, staleClaims: stale };
    }
    const full = Object.assign({
      _internal: true,
      _emitRule: 'INTERNAL ONLY — force-404 live, served via authenticated /api/axis-status. NEVER copy this content into .well-known: regenerate the public mirrors with scripts/lib/axis-status-emit.mjs (headline-only, leak-scanned).',
    }, fullDetail);
    const p = path.join(repoRoot, INTERNAL_FULL_FILE);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(full, null, 1) + '\n');
    written.internal = INTERNAL_FULL_FILE;
  }
  for (const rel of PUBLIC_STATUS_FILES) {
    const p = path.join(repoRoot, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(pub, null, 1) + '\n');
    written.public.push(rel);
  }
  return { written, publicStatus: pub };
}

// Scan the public mirrors on disk. Used by `check` and the deploy-safety suite.
export function checkPublicFiles(root) {
  const repoRoot = root || process.cwd();
  const problems = [];
  for (const rel of PUBLIC_STATUS_FILES) {
    let text;
    try { text = fs.readFileSync(path.join(repoRoot, rel), 'utf8'); } catch { continue; }
    for (const leak of findLeaks(text)) problems.push({ file: rel, ...leak });
  }
  return problems;
}

// ── CLI ──
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [, , cmd, ...rest] = process.argv;
  const arg = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
  const root = arg('--root') || process.cwd();
  if (cmd === 'check') {
    const problems = checkPublicFiles(root);
    if (problems.length) {
      console.error(`axis-status-emit check: ${problems.length} internal-detail leak(s) in PUBLIC status files:`);
      for (const p of problems) console.error(`  ${p.file}: ${p.reason} ("${p.match}")`);
      process.exit(1);
    }
    console.log('axis-status-emit check: OK — public AXIS status mirrors are headline-only (no leak-class content).');
  } else if (cmd === 'emit') {
    const fieldsPath = arg('--fields');
    if (!fieldsPath) { console.error('usage: axis-status-emit.mjs emit --fields <headline-fields.json> [--full <full-detail.json>] [--root <repo>]'); process.exit(2); }
    const publicFields = JSON.parse(fs.readFileSync(fieldsPath, 'utf8'));
    const fullPath = arg('--full');
    const fullDetail = fullPath ? JSON.parse(fs.readFileSync(fullPath, 'utf8')) : null;
    const { written } = emitAxisStatus({ root, publicFields, fullDetail });
    console.log('axis-status-emit: wrote public headline-only → ' + written.public.join(', ') + (written.internal ? ('; full detail → ' + written.internal) : ''));
  } else {
    console.error('usage: axis-status-emit.mjs <check|emit> …'); process.exit(2);
  }
}
