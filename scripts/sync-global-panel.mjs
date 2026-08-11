// sync-global-panel.mjs — bakes senior-director-state/global-engine/global-panel.json into the
// embedded `const GLOBAL = {...}` literal inside assets/axis-app.js.
//
// Why bake instead of fetch: the Overview panel has to render with zero backend, same as the
// Procurement panel next to it. data('global') still wins at runtime when the snapshot carries a
// global feed — the baked copy is only the floor, so the page is never empty.
//
// Run after every agent cycle:  node scripts/sync-global-panel.mjs
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const panelPath = path.join(root, 'senior-director-state', 'global-engine', 'global-panel.json');
const appPath = path.join(root, 'assets', 'axis-app.js');

const panel = JSON.parse(await readFile(panelPath, 'utf8'));
const app = await readFile(appPath, 'utf8');

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

// Validate the PAYLOAD before touching the file.
//
// This check used to live after the write, which meant a panel JSON missing a key produced a
// fully-written, syntactically valid, silently amputated Overview and *then* crashed on
// `shaped.opportunities.length`. JSON.stringify drops undefined keys without complaint, and
// globalSection()'s block() helper early-returns on a falsy array — so 25 opportunity rows
// vanish from the page with no error anywhere. Exit code 1, file already mutated on disk.
// Validate first, write second.
const ROW_KEYS = ['attention', 'queue', 'registered', 'opportunities', 'marketing'];
const COUNT_KEYS = ['countries', 'portals', 'registered', 'queued', 'gated', 'channels'];
for (const k of ['updated', 'cycle', 'counts', ...ROW_KEYS]) {
  if (shaped[k] === undefined) throw new Error(`global-panel.json is missing "${k}"`);
}
for (const k of ROW_KEYS) {
  if (!Array.isArray(shaped[k])) throw new Error(`global-panel.json "${k}" must be an array`);
}
if (typeof shaped.counts !== 'object' || shaped.counts === null) {
  throw new Error('global-panel.json "counts" must be an object');
}
for (const k of COUNT_KEYS) {
  // globalSection() renders g.counts.<k> straight into a KPI tile. A missing one prints the
  // literal string "undefined" on the page — no throw, no guard failure, no test failure.
  if (typeof shaped.counts[k] !== 'number') {
    throw new Error(`global-panel.json counts.${k} must be a number, got ${typeof shaped.counts[k]}`);
  }
}
for (const k of ROW_KEYS) {
  for (const [n, row] of shaped[k].entries()) {
    if (!row || typeof row.title !== 'string' || !row.title.trim()) {
      throw new Error(`global-panel.json ${k}[${n}] has no title`);
    }
    // procRow() reads `href`. A row without one used to fall through to the Ontario portal,
    // which looks like it worked and is worse than a dead link.
    if (!row.href || !/^https?:\/\//.test(row.href)) {
      throw new Error(`global-panel.json ${k}[${n}] ("${row.title}") has no absolute href`);
    }
  }
}

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
//
// Scope note: this matcher understands strings and escapes, NOT comments, regex literals or
// nested template interpolation. That is sound for what it parses — JSON.stringify output, which
// contains only double-quoted strings — and unsound for hand-written JS. The byte-tail invariant
// below is what makes that limitation non-fatal: if the matcher is ever wrong, the write aborts.
function literalEnd(s, from) {
  let i = s.indexOf('{', from);
  if (i < 0) throw new Error('no opening brace after the GLOBAL marker');
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

const next = app.slice(0, i) + 'const GLOBAL = ' + JSON.stringify(shaped, null, 2) + app.slice(end);

// THE BYTE-TAIL INVARIANT — the one check that makes the whole overshoot class impossible.
//
// This script edits exactly one region: [i, end). Every byte before i and every byte after end
// must survive untouched. Assert that directly instead of enumerating the things that must not
// disappear. If literalEnd() is ever wrong — a comment, a regex literal, a hand-edited literal,
// anything the matcher does not model — the tail stops matching and nothing is written.
// The 2026-08-06 outage fails this check on its first byte.
const head = app.slice(0, i);
const tail = app.slice(end);
if (next.slice(0, head.length) !== head) throw new Error('refusing to write: bytes before the literal changed');
if (next.slice(next.length - tail.length) !== tail) throw new Error('refusing to write: bytes after the literal changed');

// Belt and braces: the specific things the Overview tab cannot render without. Redundant with the
// tail invariant, kept because a named failure is faster to diagnose than a byte-offset one.
const REQUIRED = [
  ['function globalSection()', 1],
  ['function procurementSection()', 1],
  ['SCREENS.overview =', 1],
  ['c.append(procurementSection())', 1],
  ['c.append(globalSection())', 1],
];
// Same comment-stripping as the test suite: `//c.append(globalSection())` contains the needle
// but does nothing, so a raw substring count would wave through a commented-out Overview.
const nextCode = next.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
for (const [needle, want] of REQUIRED) {
  const got = nextCode.split(needle).length - 1;
  if (got !== want) throw new Error(`refusing to write: "${needle}" appears ${got}x, expected ${want}x`);
}

// Write atomically, and prove it parses before it becomes the real file. writeFile() truncates
// first, so writing in place means a crash mid-write leaves a truncated axis-app.js on disk.
// Suffix must be .mjs, not .tmp: `node --check` infers module format from the extension and
// bails with ERR_UNKNOWN_FILE_EXTENSION on anything it does not recognise. axis-app.js is an ES
// module (top-level import), so the probe file has to look like one.
const tmp = appPath + '.check.mjs';
await writeFile(tmp, next);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  await unlink(tmp).catch(() => {});
  throw new Error(`refusing to write: result does not parse\n${e.stderr?.toString() || e.message}`);
}
await rename(tmp, appPath);

console.log(JSON.stringify({
  ok: true, cycle: shaped.cycle, updated: shaped.updated,
  bytesReplaced: end - i,
  opportunities: shaped.opportunities.length, queue: shaped.queue.length,
  attention: shaped.attention.length, marketing: shaped.marketing.length,
}));
