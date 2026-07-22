// push-live-snapshot.mjs — compute REAL snapshots from data/axis-sales.db (NO seeding, read-only) and
// push them to Netlify Blobs so the authed /api/axis/snapshot endpoint serves LIVE data.
// Needs NETLIFY_SITE_ID + NETLIFY_API_TOKEN in env. Never mutates the DB.
import { openDb } from './lib/axis-db.mjs';
import { computeSnapshots, pushSnapshots, openSnapshotStore } from './lib/axis-snapshots.mjs';

const db = openDb();
const snaps = computeSnapshots(db);
console.log('[push-live] overview.kpis :', JSON.stringify(snaps.overview.kpis));
console.log('[push-live] pipeline cards:', snaps.pipeline.cards.length, '| inbox.badge:', snaps.inbox.badge, '| approvals.pending:', snaps.approvals.pending, '| prospects:', snaps.prospects.count);
const store = await openSnapshotStore();
if (!store) { console.error('[push-live] NO_STORE — set NETLIFY_SITE_ID + NETLIFY_API_TOKEN'); process.exit(2); }
const prev = await store.get('version', { type: 'json' }).catch(() => null);
const ver = await pushSnapshots(store, snaps, prev);
console.log('[push-live] PUSHED version v' + ver.v + ' tick=' + ver.tick + ' changed=[' + ver.changed.join(',') + ']');
db.close();
