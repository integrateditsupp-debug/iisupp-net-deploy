// push-snapshot-via-endpoint.mjs — push the snapshot read-model through /api/axis/snapshot-push.
//
// scripts/push-live-snapshot.mjs needs a Netlify personal access token to reach Blobs directly, which is
// exactly the friction axis-snapshot-push.mjs was built to remove: inside a Function the Blobs creds are
// ambient, so the machine credential is a simple bearer token instead. This is the client for it.
//
// It reuses pushSnapshots() unchanged by handing it a shim "store" that buffers setJSON calls instead of
// writing — so the tested diff/bump/version logic stays the single source of truth and cannot drift.
//
// Usage: node scripts/push-snapshot-via-endpoint.mjs [--base https://iisupp.net] [--dry-run]
import fs from 'node:fs';
import { openDb } from './lib/axis-db.mjs';
import { computeSnapshots, pushSnapshots } from './lib/axis-snapshots.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'https://iisupp.net');
const DRY = process.argv.includes('--dry-run');
const URL_ = `${BASE}/api/axis/snapshot-push`;

const token = (process.env.AXIS_SNAPSHOT_PUSH_TOKEN
  || fs.readFileSync('data/secrets/axis-snapshot-push-token.txt', 'utf8')).trim();
if (!token) { console.error('FATAL: no push token'); process.exit(2); }

const db = openDb();
const snaps = computeSnapshots(db);
db.close();

// Read the CURRENT version doc first so only genuinely-changed modules get bumped and re-sent.
const cur = await fetch(URL_, { headers: { authorization: `Bearer ${token}` } });
if (!cur.ok) { console.error('FATAL: GET failed', cur.status, (await cur.text()).slice(0, 200)); process.exit(1); }
const prev = (await cur.json()).version || null;

const envelopes = {};
const shim = { setJSON: async (key, value) => { envelopes[key] = value; } };
const versionDoc = await pushSnapshots(shim, snaps, prev);
delete envelopes.version; // the endpoint writes the version key itself from the `version` field

console.log('changed modules:', versionDoc.changed.join(', ') || '(none)');
const wr = snaps.waiting_reply?.rows || snaps.waiting_reply?.items || [];
console.log(`waiting_reply rows=${wr.length}  kpis=${JSON.stringify(snaps.overview.kpis)}`);
if (DRY) { console.log('DRY RUN — nothing pushed.'); process.exit(0); }
if (!versionDoc.changed.length) { console.log('nothing changed; skipping push.'); process.exit(0); }

const res = await fetch(URL_, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ version: versionDoc, envelopes }),
});
const out = await res.text();
console.log('POST', res.status, out.slice(0, 400));
process.exit(res.ok ? 0 : 1);
