// deliverability-guardian.mjs — the Deliverability Guardian agent.
//
// Two jobs:
//   1. PRE-SEND (imported): scripts/lib/gmail-outreach.mjs calls assertDeliverabilityOrThrow() before every
//      send, so mail never goes out while SPF/DKIM/DMARC are down.
//   2. DAILY SWEEP (this CLI): run at 17:00 America/Toronto to confirm all three are live and, if any dropped,
//      report exactly which record and the likely cause + fix so it can be prevented next time.
//
// Run: node scripts/deliverability-guardian.mjs        (exit 0 = live, exit 1 = DOWN)
//      node scripts/deliverability-guardian.mjs --json  (machine-readable)
import { checkDeliverability, summarize, OUTREACH_DOMAIN } from './lib/deliverability.mjs';

const asJson = process.argv.includes('--json');

// Best-effort agent_run log so the sweep shows in the Fleet tab. Never fatal if the DB isn't reachable.
async function logRun(result) {
  try {
    const { openDb } = await import('./lib/axis-db.mjs');
    const db = openDb();
    const cols = db.prepare('PRAGMA table_info(agent_runs)').all().map(c => c.name);
    if (cols.includes('agent') && cols.includes('status')) {
      const now = Date.now();
      const fields = ['agent', 'status', 'summary'];
      const vals = ['deliverability-guardian', result.hard_ok ? 'ok' : 'error', summarize(result)];
      if (cols.includes('started_at')) { fields.push('started_at'); vals.push(now); }
      if (cols.includes('finished_at')) { fields.push('finished_at'); vals.push(now); }
      db.prepare(`INSERT INTO agent_runs (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...vals);
    }
    db.close();
  } catch { /* no DB in this context — fine, DNS is the source of truth */ }
}

const result = await checkDeliverability(OUTREACH_DOMAIN);
await logRun(result);

if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(result.hard_ok ? 0 : 1); }

console.log(`\n===== DELIVERABILITY GUARDIAN — ${OUTREACH_DOMAIN} =====`);
console.log(summarize(result));
for (const k of ['spf', 'dkim', 'dmarc', 'mx']) {
  const c = result.checks[k];
  console.log(`  ${c.live ? '✓' : '✗'} ${c.name.padEnd(6)} ${c.note}${c.value ? `\n           ${String(c.value).slice(0, 90)}` : ''}`);
}
if (!result.hard_ok) {
  console.log('\n⚠ DELIVERABILITY DOWN — sending is BLOCKED until fixed. Cause + fix:');
  for (const d of result.diagnosis) console.log('  • ' + d);
  process.exit(1);
}
console.log('\nAll send-critical records live. Safe to send. Sweep clean.');
process.exit(0);
