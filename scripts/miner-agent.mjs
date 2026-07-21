// miner-agent.mjs — Product Discovery agent (S11 Miner). WORKER-OWNED, LOCAL. Re-runs discoverProducts on
// a cadence; results land in products_discovered → S11 + AXIS review. Safe to run anytime; nothing sends.
import { openDb } from './lib/axis-db.mjs';
import { discoverProducts } from './lib/miner.mjs';
const db = openDb();
const ids = discoverProducts(db);
console.log(`[miner] discovered ${ids.length} product opportunities`);
db.close();
