// snapshot-module-parity.test.mjs — the read-model has FOUR places that must agree on the module list:
//   1. assets/axis-constants.js        SNAPSHOT_MODULES  (what the UI asks for)
//   2. scripts/lib/axis-snapshots.mjs  computeSnapshots  (what the worker produces)
//   3. netlify/functions/axis-snapshot.mjs      MODULES  (what the API serves)
//   4. netlify/functions/axis-snapshot-push.mjs MODULES  (what the API accepts)
//
// Why this gate exists: the Waiting Reply tab shipped end-to-end — computed by the worker, written to
// Blobs, rendered by a live screen — and still showed "Nothing waiting", because the serving function's
// allowlist did not include 'waiting_reply' and silently dropped it. That is invisible: no error, no
// 4xx, just an empty tab. Adding a module without touching all four lists must fail here, not in prod.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { if (ok) { pass++; } else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); } };

const listFrom = (src, re) => {
  const block = (src.match(re) || [''])[0];
  return [...block.matchAll(/'([a-z_][\w-]*)'/g)].map((m) => m[1]);
};

const canonical = listFrom(read('assets/axis-constants.js'), /export const SNAPSHOT_MODULES = \[[\s\S]*?\];/);
t('assets/axis-constants.js exposes a non-empty SNAPSHOT_MODULES', canonical.length > 0);
t('SNAPSHOT_MODULES includes waiting_reply', canonical.includes('waiting_reply'));
t('SNAPSHOT_MODULES has no duplicates', new Set(canonical).size === canonical.length);

for (const fn of ['netlify/functions/axis-snapshot.mjs', 'netlify/functions/axis-snapshot-push.mjs']) {
  const got = listFrom(read(fn), /const MODULES = new Set\(\[[\s\S]*?\]\);/);
  const missing = canonical.filter((m) => !got.includes(m));
  const extra = got.filter((m) => !canonical.includes(m));
  t(`${fn} allowlist covers every SNAPSHOT_MODULE`, missing.length === 0, 'missing: ' + missing.join(','));
  t(`${fn} allowlist has no modules the UI never asks for`, extra.length === 0, 'extra: ' + extra.join(','));
}

// The worker must actually emit every module the UI expects, or the tab is empty for the other reason.
const worker = read('scripts/lib/axis-snapshots.mjs');
for (const m of canonical) {
  const emitted = new RegExp(`out\\.${m}\\s*=|out\\['${m}'\\]\\s*=`).test(worker);
  t(`worker computes "${m}"`, emitted);
}

console.log(`[snapshot-module-parity] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
