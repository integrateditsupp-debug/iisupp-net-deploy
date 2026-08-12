#!/usr/bin/env node
// axis-queue-steward.mjs - runs the queue steward over real state and writes the digest.
//
// Read-only against everything it inspects. It approves nothing, sends nothing, deletes nothing,
// and parks nothing on its own - Ahmad's approval rules are untouched. Its entire job is to make a
// jam visible, because the failure it exists for was invisible: 25 identical approvals sat for two
// months while healthy agents kept adding to the pile.
//
// Writes two places:
//   senior-director-state/autonomy/queue-steward.md  - for the fleet + the console
//   <AXIS vault>/13_Learned/queue-steward-digest.md  - so AXIS can answer "what is blocked?" from
//                                                      brain #1, with no model call
//
// Run:  node scripts/axis-queue-steward.mjs
//       node scripts/axis-queue-steward.mjs --quiet   (write files, print only the spoken line)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { steward, spokenSummary } from './lib/axis-queue-steward.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = process.env.AXIS_VAULT || path.join(os.homedir(), 'Documents', 'AXIS-Brain');
const QUIET = process.argv.includes('--quiet');

// Approval items. The supervisor writes an array or an object wrapping one; accept both rather
// than coupling to today's exact shape.
function loadItems() {
  const p = path.join(REPO, 'senior-director-state', 'autonomy', 'approval-inbox.json');
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const items = Array.isArray(j) ? j : (j.items || j.approvals || []);
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}

// Log surfaces worth watching. Each is a thing that runs unattended and writes its own failures
// somewhere nobody reads. Add to this list as new unattended jobs appear.
const LOG_SOURCES = [
  ['ARIA KB pull', 'aria_brain_pack/pull.log'],
  ['AXIS brain worker', 'logs/axis-brain-worker.log'],
];

function loadLogs() {
  const out = {};
  for (const [name, rel] of LOG_SOURCES) {
    try {
      const full = path.join(REPO, rel);
      const text = fs.readFileSync(full, 'utf8');
      // Only the tail matters - a year-old error is not an incident.
      out[name] = text.length > 60000 ? text.slice(-60000) : text;
    } catch { /* a missing log is not a failure; the job may simply never have run */ }
  }
  return out;
}

function render(rep) {
  const L = [];
  L.push('# Queue steward');
  L.push('');
  L.push(`Updated: ${new Date().toISOString()}`);
  L.push('');
  L.push('Read-only. Nothing here has been approved, sent, parked or deleted - this is what the');
  L.push('queue actually looks like, which is the part that was missing.');
  L.push('');

  L.push('## The headline');
  L.push('');
  if (rep.collapsedTo < rep.collapsedFrom) {
    L.push(`**${rep.collapsedFrom} open approvals are really ${rep.collapsedTo} decisions.**`);
  } else {
    L.push(`${rep.total} open approvals, all distinct.`);
  }
  if (rep.oldestDays !== null) {
    L.push(`Oldest ${rep.oldestDays} days, median ${rep.medianDays}. ${rep.stale} are 14+ days old; `
      + `${rep.parkable} are 45+ and should probably leave the live queue.`);
  }
  L.push('');

  if (rep.jammed.length) {
    L.push('## Jammed - stop producing these');
    L.push('');
    for (const j of rep.jammed) L.push(`- **${j.category}** — ${j.advice}`);
    L.push('');
  }

  if (rep.duplicated.length) {
    L.push('## One decision, asked many times');
    L.push('');
    for (const g of rep.duplicated.slice(0, 6)) {
      L.push(`### ${g.count}x · ${g.category}`
        + (g.oldestDays !== null ? ` · ${g.oldestDays}–${g.newestDays} days old` : ''));
      L.push('');
      L.push('Deciding once covers all of them:');
      L.push('');
      for (const it of g.items.slice(0, 30)) {
        const t = String(it.title || it.summary || it.text || '').replace(/\s+/g, ' ').slice(0, 120);
        L.push(`- ${t}`);
      }
      if (g.items.length > 30) L.push(`- …and ${g.items.length - 30} more of the same shape`);
      L.push('');
    }
  }

  if (rep.failures.length) {
    L.push('## Failing quietly');
    L.push('');
    L.push('These write their errors to a log and alert nobody.');
    L.push('');
    for (const f of rep.failures) {
      const since = f.earliest && f.earliest !== f.firstSeen
        ? ` — and ${f.distinctDays} failing days since ${f.earliest}, so it has not succeeded in weeks`
        : '';
      L.push(`- **${f.source}** — failing ${f.streakDays} days running (${f.firstSeen} → ${f.lastSeen})${since}`);
      L.push(`  - \`${f.sample}\``);
    }
    L.push('');
  }

  L.push('## Everything else');
  L.push('');
  for (const p of rep.pressure) L.push(`- ${p.category}: ${p.count} open (${p.verdict})`);
  L.push('');
  return L.join('\n');
}

const rep = steward({ items: loadItems(), logs: loadLogs() });
const md = render(rep);

const outFleet = path.join(REPO, 'senior-director-state', 'autonomy', 'queue-steward.md');
fs.mkdirSync(path.dirname(outFleet), { recursive: true });
fs.writeFileSync(outFleet, md, 'utf8');

// Into brain #1 so AXIS answers "what is blocked?" from the vault, free and instantly.
let vaultWritten = null;
try {
  const dir = path.join(VAULT, '13_Learned');
  if (fs.existsSync(VAULT)) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'queue-steward-digest.md');
    fs.writeFileSync(f, [
      '---', 'type: learned', 'brain_region: hippocampus', 'source: axis-queue-steward',
      'confidence: high', `created: ${new Date().toISOString().slice(0, 10)}`,
      'question: what is blocked, what is jammed, what is failing quietly',
      '---', '', md, '', 'Related: [[_Learned]] [[_HOME]]', '',
    ].join('\n'), 'utf8');
    vaultWritten = f;
  }
} catch { /* the digest is still on disk for the fleet; a vault miss must not fail the run */ }

const spoken = spokenSummary(rep);
if (QUIET) {
  console.log(spoken);
} else {
  console.log(md);
  console.log('---');
  console.log('spoken:', spoken);
  console.log('written:', path.relative(REPO, outFleet) + (vaultWritten ? ` + ${vaultWritten}` : ''));
}
