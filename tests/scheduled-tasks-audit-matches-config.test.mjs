// Guards the audit endpoint's list against the real per-function schedules (it drifted once; never again).
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../netlify/functions', import.meta.url));
const real = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.mjs'))) {
  const m = fs.readFileSync(path.join(dir, f), 'utf8').match(/export const config\s*=\s*\{\s*schedule:\s*'([^']+)'/);
  if (m) real[f.replace(/\.mjs$/, '')] = m[1];
}
const src = fs.readFileSync(path.join(dir, 'aria-scheduled-tasks-audit.js'), 'utf8');
const listed = {};
for (const m of src.matchAll(/\{ fn: '([^']+)', schedule: '([^']+)'/g)) listed[m[1]] = m[2];
assert.deepEqual(listed, real, 'aria-scheduled-tasks-audit SCHEDULED list drifted from real config.schedule values');
console.log(`scheduled-tasks-audit: ${Object.keys(real).length} crons match config`);
