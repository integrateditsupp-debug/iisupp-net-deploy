// axis-researcher-agent.mjs — the researcher as a standalone fleet agent.
//
//   node scripts/axis-researcher-agent.mjs "your question"           # research + vault note
//   node scripts/axis-researcher-agent.mjs --fast-moving "question"  # stale-source flagging on
//   node scripts/axis-researcher-agent.mjs --no-vault "question"     # dry run, no note written
//
// Isolated on purpose (Phase 2 spec): no other agent's behaviour changes because this exists.
// AXIS reaches the same module through the research.web task kind; this entry point is for Ahmad
// and for scheduled use later. Exit code 0 only when research produced validated findings.
import { research, spokenSummary } from './lib/axis-researcher.mjs';

const args = process.argv.slice(2);
const fastMoving = args.includes('--fast-moving');
const writeVault = !args.includes('--no-vault');
const question = args.filter((a) => !a.startsWith('--')).join(' ').trim();

if (!question) {
  console.error('usage: node scripts/axis-researcher-agent.mjs [--fast-moving] [--no-vault] "question"');
  process.exit(2);
}

console.log(`[axis-researcher] researching: ${question}`);
const t0 = Date.now();
const result = await research(question, { fastMoving, writeVault });
console.log(`[axis-researcher] ${spokenSummary(result)} (${Math.round((Date.now() - t0) / 1000)}s)`);
for (const c of result.claims) {
  console.log(`  [${c.kind}]${c.downgraded ? ' (downgraded)' : ''} ${c.claim}`);
  for (const s of c.sources) console.log(`     - ${s.url} (${s.publisher}, published ${s.published}, accessed ${s.accessed})`);
}
if (result.conflicts.length) { console.log('  conflicts:'); for (const x of result.conflicts) console.log(`     - ${x}`); }
if (result.gaps.length) { console.log('  gaps:'); for (const x of result.gaps) console.log(`     - ${x}`); }
if (result.recency.length) { console.log('  recency flags:'); for (const x of result.recency) console.log(`     - ${x}`); }
process.exit(result.ok ? 0 : 1);
