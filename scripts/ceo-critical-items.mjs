#!/usr/bin/env node
// ceo-critical-items.mjs — RUN-CU / CU6 (2026-10-09). Print the CEO-critical block for a chat reply.
//
//   node scripts/ceo-critical-items.mjs          # Markdown block (🔴 + bold = red); paste it FIRST
//   node scripts/ceo-critical-items.mjs --json   # rows + urgency for another agent
//   node scripts/ceo-critical-items.mjs --html   # the red HTML block the email channel uses
//
// Reads only. Exit code 2 when the ledger is missing so a scheduled run notices; 0 otherwise — an
// overdue row is not a program failure, it is the message.
import { loadCriticalItems, renderCriticalBlock, renderCriticalHtml } from './lib/ceo-critical-items.mjs';

const args = new Set(process.argv.slice(2));
const loaded = loadCriticalItems();
if (args.has('--json')) {
  process.stdout.write(JSON.stringify({ file: loaded.file, missing: loaded.missing, items: loaded.items.map((i) => ({ ...i, deadline: i.deadline ? i.deadline.iso : null })), watch: loaded.watch }, null, 2) + '\n');
} else if (args.has('--html')) {
  process.stdout.write(renderCriticalHtml(loaded) + '\n');
} else {
  process.stdout.write(renderCriticalBlock(loaded) + '\n');
}
process.exit(loaded.missing ? 2 : 0);
