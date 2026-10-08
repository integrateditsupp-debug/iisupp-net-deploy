// miner-agent.mjs — Product Discovery agent (S11 Miner). WORKER-OWNED, LOCAL. Re-runs discoverProducts on
// a cadence; results land in products_discovered → S11 + AXIS review. Safe to run anytime; nothing sends.
import { openDb } from './lib/axis-db.mjs';
import { discoverProducts } from './lib/miner.mjs';
import { logBootstrapHeader } from './autonomy-supervisor-core.mjs';
// RUN-CU 2026-10-08: name the current-state file this run started from, so a run that acted on
// stale state can be told apart from one that never read any. Guarded: a missing note is a log
// line, never a dead worker.
await logBootstrapHeader('miner-agent');

const db = openDb();
const ids = discoverProducts(db);
console.log(`[miner] discovered ${ids.length} product opportunities`);
db.close();
