// Rebuilds the local AXIS read model from the worker-owned SQLite database.
// `--push` also updates the authenticated production Blobs store when Netlify credentials are available.
import fs from 'node:fs';
import path from 'node:path';
import { openDb, DATA_DIR } from './lib/axis-db.mjs';
import { computeSnapshots, diffAndBump, openSnapshotStore, pushSnapshots } from './lib/axis-snapshots.mjs';

const localFile = path.join(DATA_DIR, 'axis-snapshots.local.json');
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const db = openDb();
const snapshots = computeSnapshots(db);
db.close();

const previous = readJson(localFile)?.version || null;
const version = diffAndBump(snapshots, previous);
version.tick = new Date().toISOString();
const generatedAt = version.tick;
const local = {
  version,
  snapshots: Object.fromEntries(Object.entries(snapshots).map(([module, data]) => [module, { module, version: version.modules[module], generatedAt, data }])),
};
fs.writeFileSync(localFile, JSON.stringify(local));

console.log(JSON.stringify({
  localFile,
  version: version.v,
  inbox: snapshots.inbox.counts,
  badge: snapshots.inbox.badge,
  prospects: snapshots.prospects.count,
  pendingApprovals: snapshots.approvals.pending,
}, null, 2));

if (process.argv.includes('--push')) {
  const store = await openSnapshotStore();
  if (!store) throw new Error('Netlify Blobs store unavailable. Run through a linked Netlify session or set NETLIFY_SITE_ID + NETLIFY_API_TOKEN.');
  const remotePrevious = await store.get('version', { type: 'json' }).catch(() => null);
  const pushed = await pushSnapshots(store, snapshots, remotePrevious);
  console.log(JSON.stringify({ pushed: true, version: pushed.v, changed: pushed.changed }, null, 2));
}
