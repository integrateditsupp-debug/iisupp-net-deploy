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
const occurrences = app.split(START).length - 1;
if (occurrences !== 1) throw new Error(`expected exactly 1 GLOBAL literal, found ${occurrences}`);
const i = app.indexOf(START);

// Find the end of the object by MATCHING BRACES, not by searching for the next flush-left "};".
//
// The flush-left search is what broke production on 2026-08-06. `SCREENS.overview = (c) => {...};`
// is an arrow-function assignment, so it also terminates with "};" at column 0. The naive search
// sailed past the end of the GLOBAL literal and the rewrite deleted globalSection() and the whole
// Overview screen — 3,954 bytes — leaving a file that still parsed cleanly and rendered nothing.
// `node --check` cannot catch that class of bug; only real delimiter matching can.
function literalEnd(s, from) {
  let i = s.indexOf('{', from);
  let depth = 0, quote = null, esc = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  throw new Error('unbalanced GLOBAL literal in assets/axis-app.js');
}
const end = literalEnd(app, i);

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
const next = app.slice(0, i) + 'const GLOBAL = ' + JSON.stringify(shaped, null, 2) + app.slice(end);

// Post-write guard. Everything the Overview tab needs must survive the rewrite; if any of these
// vanish the page renders blank and the failure only surfaces in production.
const REQUIRED = [
  ['function globalSection()', 1],
  ['SCREENS.overview =', 1],
  ['c.append(procurementSection())', 1],
  ['c.append(globalSection())', 1],
];
for (const [needle, want] of REQUIRED) {
  const got = next.split(needle).length - 1;
  if (got !== want) throw new Error(`refusing to write: "${needle}" appears ${got}x, expected ${want}x`);
}

await writeFile(appPath, next);
console.log(JSON.stringify({
  ok: true, cycle: shaped.cycle, updated: shaped.updated,
  bytesReplaced: end - i,
  opportunities: shaped.opportunities.length, queue: shaped.queue.length,
  attention: shaped.attention.length, marketing: shaped.marketing.length,
}));
