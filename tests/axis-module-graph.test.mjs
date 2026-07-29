// tests/axis-module-graph.test.mjs — the browser has no bundler and no npm: assets/axis-app.js is loaded
// as a raw <script type="module">, so a single bad import path or a name that is imported but never
// exported white-screens the entire console with nothing but a console error. There is no build step to
// catch it. This walks the real import graph from the entry module and asserts every edge resolves.
//
// It also guards the two structural invariants CC-BRIEF calls out explicitly:
//   * NAV is exactly the 16 tabs, in order, unrenamed  (Ahmad: "DO not change or move around anything")
//   * every NAV id has a real SCREENS handler — a missing one silently falls through to placeholder()
//     and dumps raw JSON at the operator, which is how Fleet sat dead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'assets', 'axis-app.js');
let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.error('  FAIL', n); } };

const exportsOf = (file) => {
  const src = fs.readFileSync(file, 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) out.add(name);
    }
  }
  return out;
};

const visited = new Set();
const problems = [];
function walk(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue; // bare specifiers would not resolve in the browser at all
    const target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target)) { problems.push(`${path.basename(file)} -> missing module ${spec}`); continue; }
    const exported = exportsOf(target);
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name && !exported.has(name)) problems.push(`${path.basename(file)} imports {${name}} from ${spec}, which does not export it`);
    }
    walk(target);
  }
}
walk(ENTRY);

t('entry module exists', fs.existsSync(ENTRY));
t('module graph has every screen module', visited.size >= 7);
t('no broken imports in the browser module graph', problems.length === 0);
problems.forEach(p => console.error('    ->', p));

// A browser-served asset must never pull in operator-internal strategy (locked template, watched
// mailbox, pacing). /assets/* is world-readable; /scripts/* is force-404'd.
// Match real import/export-from statements only — these files legitimately MENTION the private module
// in comments explaining why they must never pull it in, and a naive substring check flags those.
const IMPORTS_PRIVATE = /(?:^|\n)\s*(?:import|export)[^\n;]*from\s*['"][^'"]*axis-private-constants[^'"]*['"]/;
const IMPORTS_WORKER_LIB = /(?:^|\n)\s*(?:import|export)[^\n;]*from\s*['"][^'"]*\/scripts\//;
for (const f of visited) {
  const src = fs.readFileSync(f, 'utf8');
  t(`${path.basename(f)} does not import private constants`, !IMPORTS_PRIVATE.test(src));
  t(`${path.basename(f)} does not import from scripts/`, !IMPORTS_WORKER_LIB.test(src));
  t(`${path.basename(f)} does not call the Gmail API`, !/googleapis\.com|gmail\.googleapis/.test(src));
  // The locked outreach copy must never be inlined into a world-readable asset.
  t(`${path.basename(f)} does not inline the locked template body`, !/Hope you are doing well, I won't take much of your time/.test(src));
}

// ── NAV integrity ────────────────────────────────────────────────────────────────────────────────
const app = fs.readFileSync(ENTRY, 'utf8');
const navBlock = (app.match(/const NAV = \[[\s\S]*?\n\];/) || [''])[0];
const navIds = [...navBlock.matchAll(/id: '([^']+)'/g)].map(m => m[1]);
// 2026-07-28 (DEFECT-107): commit eecd0510 ADDED a 16th tab `waiting_reply` between `approvals` and
// `followups`. Nothing was removed, renamed, or reordered — Rule 15 intact — so the guard baseline is
// extended, not relaxed. Additions still have to be declared here on purpose.
const EXPECTED = ['overview', 'inbox', 'pipeline', 'crm', 'prospects', 'outreach', 'approvals', 'waiting_reply',
  'followups', 'documents', 'analytics', 'products', 'fleet', 'axis-agent-director', 'reports', 'settings'];
t('NAV has exactly 16 tabs', navIds.length === 16);
t('NAV ids and order are unchanged', JSON.stringify(navIds) === JSON.stringify(EXPECTED));

const screens = new Set();
for (const m of app.matchAll(/SCREENS\.([A-Za-z_][\w]*)\s*=/g)) screens.add(m[1]);
for (const m of app.matchAll(/SCREENS\['([^']+)'\]\s*=/g)) screens.add(m[1]);
for (const id of EXPECTED) t(`tab "${id}" has a real screen (not placeholder)`, screens.has(id));

// Reports and Settings deliberately share one screen (spec S13) — both tabs must keep rendering.
t('settings still aliases the reports screen', /SCREENS\.settings\s*=\s*SCREENS\.reports/.test(app));

console.log(`[axis-module-graph] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
