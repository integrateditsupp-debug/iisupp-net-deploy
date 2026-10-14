// tests/netlify-function-externals.test.mjs — RUN-AX2 hotfix guard (2026-10-13).
//
// Measured on the AXIS ONE merge: with node_bundler = "esbuild", zip-it-and-ship-it copies EVERY module in
// [functions].external_node_modules into EVERY v1 function zip, used or not. Seven heavy externals × 104
// CommonJS functions = ~3.2 GB of zips and "ENOSPC: no space left on device" on the Netlify build box.
// netlify.toml now lists only @netlify/blobs globally and scopes the heavy modules per function.
//
// This suite keeps that scoping honest in both directions:
//   1. every function whose import graph reaches a heavy module has a per-function block naming it
//      (otherwise esbuild inlines it — fine for CJS stripe, a 502 at load for pdfkit in an ESM function);
//   2. no per-function block names a module the function does not reach (that is the bloat coming back).
// The graph is static (import/require of './x' and './lib/x' followed recursively inside netlify/functions),
// which matches the esbuild metafile on 2026-10-13 for all 194 entries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN = path.join(ROOT, 'netlify', 'functions');
const HEAVY = ['stripe', 'pdfkit', 'jszip', 'pdf-parse', 'mammoth', 'busboy'];
const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');

// ── netlify.toml: the global list is blobs only; per-function blocks parsed ──
const globalList = (toml.match(/^\[functions\]\s*\n([\s\S]*?)(?=^\[)/m) || [, ''])[1].match(/external_node_modules\s*=\s*\[([^\]]*)\]/);
assert.ok(globalList, '[functions] has an external_node_modules line');
const globalMods = globalList[1].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
assert.deepEqual(globalMods, ['@netlify/blobs'], 'only @netlify/blobs is shipped to every function');

const perFn = {};
for (const m of toml.matchAll(/^\[functions\."([^"]+)"\]\s*\n\s*external_node_modules\s*=\s*\[([^\]]*)\]/gm))
  perFn[m[1]] = m[2].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);

// ── the import graph ──
const SPEC = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
function resolveLocal(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const c of [base, base + '.js', base + '.mjs', base + '.cjs', base + '.mts', base + '.ts', path.join(base, 'index.js'), path.join(base, 'index.mjs')])
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}
function reach(file, seen = new Set()) {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const out = new Set();
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(SPEC)) {
    const spec = m[1];
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (HEAVY.includes(pkg)) { out.add(pkg); continue; }
    if (spec.startsWith('.')) { const r = resolveLocal(file, spec); if (r && r.startsWith(FN)) for (const x of reach(r, seen)) out.add(x); }
  }
  return out;
}

const entries = fs.readdirSync(FN).filter((f) => /\.(m?js|cjs|mts)$/.test(f) && !f.startsWith('_') && fs.statSync(path.join(FN, f)).isFile());
assert.ok(entries.length > 150, 'the functions directory was read');
let checked = 0;
for (const f of entries) {
  const name = f.replace(/\.(m?js|cjs|mts)$/, '');
  const needs = [...reach(path.join(FN, f))].sort();
  const declared = (perFn[name] || []).filter((m) => HEAVY.includes(m)).sort();
  assert.deepEqual(declared, needs, `${f}: per-function externals must equal the heavy modules its bundle reaches`);
  checked++;
}
for (const name of Object.keys(perFn)) assert.ok(entries.some((f) => f.replace(/\.(m?js|cjs|mts)$/, '') === name), `[functions."${name}"] names a function that exists`);
console.log(`[netlify-function-externals] ${checked} functions checked, ${Object.keys(perFn).length} scoped blocks, global = ${globalMods.join(',')}`);
