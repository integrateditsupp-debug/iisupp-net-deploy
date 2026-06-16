#!/usr/bin/env node
// loops/cli/goal.mjs — read or set the IIS top-level goal.
// Zero deps. Persists to loops/CURRENT_GOAL.md.
//
// Usage:
//   node loops/cli/goal.mjs                       (print current goal)
//   node loops/cli/goal.mjs "new top-level goal"  (set new goal, archive old)
//   npm run goal                                  (same as no-args)
//   npm run goal -- "new goal"                    (set new goal)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOAL_FILE = resolve(__dirname, '..', 'CURRENT_GOAL.md');

const newGoal = process.argv.slice(2).join(' ').trim();

if (!newGoal) {
  // print mode
  if (!existsSync(GOAL_FILE)) {
    console.log('No goal set yet. Run:  node loops/cli/goal.mjs "Your goal here"');
    process.exit(0);
  }
  console.log(readFileSync(GOAL_FILE, 'utf8'));
  process.exit(0);
}

// set mode — preserve history
let prior = '';
if (existsSync(GOAL_FILE)) prior = readFileSync(GOAL_FILE, 'utf8');

const ts = new Date().toISOString().slice(0, 10);
const oldTop = (prior.split('\n')[0] || '').replace(/^#+\s*/, '').trim();

const updated =
`${newGoal}

## Sub-goals (rolling — swap as Ahmad updates via /goal)
${extractSubgoals(prior)}

## Locked constraints (every loop inherits — see LOOPS_SPEC §7)
- $0 default spend until first paying client closes.
- HARD RULE: aperture login + ARIA chat must never break post-deploy.
- Visual stability on iisupp.net (no theme/font/copy drift).
- Manual Netlify publish.
- Ethical design rules.
- Garry Tan filter on every ARIA-touching artifact.

## History
- ${ts} — Goal set/changed via /goal CLI.${oldTop ? `\n  Previous top: ${oldTop}` : ''}
${extractHistory(prior)}
`;

writeFileSync(GOAL_FILE, updated);
console.log(`Goal updated. ${GOAL_FILE}`);
console.log(`Top now: ${newGoal}`);

function extractSubgoals(text) {
  const m = text.match(/##\s*Sub-goals[^\n]*\n([\s\S]*?)(?=\n##|\n*$)/);
  return m ? m[1].trim() : '_(none yet — add via direct edit of CURRENT_GOAL.md)_';
}

function extractHistory(text) {
  const m = text.match(/##\s*History[^\n]*\n([\s\S]*?)$/);
  if (!m) return '';
  // skip the first existing history line (we already prepended ours) and return the rest
  return m[1].trim();
}
