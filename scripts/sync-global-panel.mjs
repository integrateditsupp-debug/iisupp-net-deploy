// sync-global-panel.mjs — bakes senior-director-state/global-engine/global-panel.json into the
// embedded `const GLOBAL = {...}` literal inside assets/axis-app.js.
//
// Why bake instead of fetch: the Overview panel has to render with zero backend, same as the
// Procurement panel next to it. data('global') still wins at runtime when the snapshot carries a
// global feed — the baked copy is only the floor, so the page is never empty.
//
// Run after every agent cycle:  node scripts/sync-global-panel.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const panelPath = path.join(root, 'senior-director-state', 'global-engine', 'global-panel.json');
const appPath = path.join(root, 'assets', 'axis-app.js');

const panel = JSON.parse(await readFile(panelPath, 'utf8'));
const app = await readFile(appPath, 'utf8');

const START = 'const GLOBAL = {';
const i = app.indexOf(START);
if (i < 0) throw new Error('GLOBAL literal not found in assets/axis-app.js');
// Find the terminating "};" at column 0 — the literal is written flush-left.
const end = app.indexOf('\n};\n', i);
if (end < 0) throw new Error('GLOBAL literal terminator not found');

const shaped = {
  updated: panel.updated,
  cycle: panel.cycle,
  counts: panel.counts,
  attention: panel.attention,
  queue: panel.queue,
  registered: panel.registered,
  opportunities: panel.opportunities,
  marketing: panel.marketing,
};
const literal = 'const GLOBAL = ' + JSON.stringify(shaped, null, 2).replace(/\n/g, '\n');
const next = app.slice(0, i) + literal + app.slice(end + 3);
await writeFile(appPath, next);
console.log(JSON.stringify({
  ok: true, cycle: shaped.cycle, updated: shaped.updated,
  opportunities: shaped.opportunities.length, queue: shaped.queue.length,
  attention: shaped.attention.length, marketing: shaped.marketing.length,
}));
