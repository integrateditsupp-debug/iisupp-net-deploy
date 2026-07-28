// push-live-snapshot.mjs — compute REAL snapshots from data/axis-sales.db (NO seeding, read-only) and
// push them to Netlify Blobs so the authed /api/axis/snapshot endpoint serves LIVE data.
// Needs NETLIFY_SITE_ID + NETLIFY_API_TOKEN in env. Never mutates the DB.
//
// BUG B3 (CC-BRIEF §0): the live dashboard was rendering $93,250 pipeline / 22 approvals / 2 replies
// long after the DB was cleaned. The committed fallback seed is all zeros, so those figures were not
// coming from the seed — they were a REAL push made before the clean-up, still sitting in Blobs. Blobs
// has no TTL: a stale push serves forever until something overwrites it. So the fix is not a code
// change to the read path, it is making sure this script actually runs, and proving afterwards that
// what the endpoint serves matches SQLite. It now reads the snapshot BACK and diffs the headline KPIs,
// because "the push returned 200" is not the same claim as "the dashboard is telling the truth".
//
// Usage:
//   node scripts/push-live-snapshot.mjs            compute, push, then verify by reading back
//   node scripts/push-live-snapshot.mjs --dry-run  compute and print only; never writes
import { openDb } from './lib/axis-db.mjs';
import { computeSnapshots, pushSnapshots, openSnapshotStore } from './lib/axis-snapshots.mjs';

const dry = process.argv.includes('--dry-run');
const db = openDb();
const snaps = computeSnapshots(db);
db.close();

const k = snaps.overview.kpis;
console.log('[push-live] computed from SQLite (the truth):');
console.log('  pipeline_value   ', k.pipeline_value, '  (real opportunities, open or won)');
console.log('  assessed_value   ', snaps.analytics.assessed_value, '  (pre-contact research estimate — NOT pipeline)');
console.log('  awaiting_approval', k.awaiting_approval);
console.log('  messages_waiting ', k.messages_waiting, ' | inbox badge', snaps.inbox.badge);
console.log('  followups_due    ', k.followups_due);
console.log('  meetings_week    ', k.meetings_week, ' | mrr', k.mrr);
console.log('  prospects        ', snaps.prospects.count, '| pipeline cards', snaps.pipeline.cards.length,
  '| agents reporting', (snaps.fleet.agents || []).length);

if (dry) { console.log('[push-live] --dry-run: nothing written.'); process.exit(0); }

const store = await openSnapshotStore();
if (!store) {
  console.error('');
  console.error('[push-live] NO_STORE — cannot reach Netlify Blobs, so the live dashboard is STILL');
  console.error('            serving whatever was pushed last. Set both of these and re-run:');
  console.error('              NETLIFY_SITE_ID     (this repo is linked to 88265b1c-3380-4611-a1c0-28b4f688562a)');
  console.error('              NETLIFY_API_TOKEN   (a personal access token with Blobs write)');
  console.error('            Until then the numbers above are correct locally and stale in production.');
  process.exit(2);
}

const prev = await store.get('version', { type: 'json' }).catch(() => null);
const ver = await pushSnapshots(store, snaps, prev);
console.log('[push-live] PUSHED version v' + ver.v + ' tick=' + ver.tick + ' changed=[' + ver.changed.join(',') + ']');

// ── Read back and prove it. A push that silently wrote the wrong thing is the failure mode that
//    produced B3 in the first place, and it is invisible unless you actually check. ──
const served = await store.get('overview', { type: 'json' }).catch(() => null);
const got = served && served.data && served.data.kpis;
if (!got) { console.error('[push-live] VERIFY FAILED — overview did not read back. Treat the dashboard as stale.'); process.exit(3); }
const mismatches = Object.entries(k).filter(([key, want]) => got[key] !== want);
if (mismatches.length) {
  console.error('[push-live] VERIFY FAILED — what the endpoint will serve does not match SQLite:');
  for (const [key, want] of mismatches) console.error(`    ${key}: serving ${got[key]}, DB says ${want}`);
  process.exit(3);
}
console.log('[push-live] VERIFIED — every headline KPI read back matches SQLite exactly.');
