// tests/netlify-function-config-static.test.mjs — RUN-SN1 publish hotfix (2026-10-15).
//
// The first production build of the Sentinel 0.2.1 merge (main@22f6202) died in 13 seconds:
//   "Function aria-recipes has a configuration error on 'path': Must be a string or array of strings"
// The export was `{ path: [...RECIPES_PATHS] }`. Netlify's zip-it-and-ship-it does not EVALUATE a
// function's `export const config` — it parses the object literal statically, so a spread, an
// identifier, a template string or a call inside it is "not a string". Reproduced locally with
// @netlify/zip-it-and-ship-it 16.3.0: the spread form fails, the literal array
// ["/aria-recipes", "/.netlify/functions/aria-recipes"] is accepted and yields both routes.
//
// This suite reads every `export const config = {...}` in netlify/functions the same way: the
// literal must parse as JSON5-ish data on its own (no identifiers, spreads, calls, templates), `path`
// must be a string or an array of strings, each starting with "/". It also pins the two path
// constants the desktop tests read (RECIPES_PATHS / STOP_CODES_PATHS) to the literals in the config,
// so the pretty path and the /.netlify/functions path can never drift apart again.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN = path.join(ROOT, 'netlify', 'functions');

/** Extract the balanced `{...}` literal that follows `export const config =`. */
function configLiteral(rawSrc) {
  // comments first — a cron file documents the shape as `export const config = { schedule }` in a comment
  const src = rawSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  const m = /export\s+const\s+config\s*(?::\s*[A-Za-z_<>,\s]+)?=\s*\{/.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length - 1, depth = 0, inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '[') depth++;
    if (c === '}' || c === ']') { depth--; if (depth === 0) return src.slice(m.index + m[0].length - 1, i + 1); }
  }
  return null;
}

/**
 * Turn a static JS object literal into JSON and parse it; throws on anything dynamic. Like the bundler,
 * a bare identifier (or shorthand `{ schedule }`) is resolved ONLY when the same file declares it as a
 * plain `const NAME = <string | number | boolean | array/object literal>;` — a spread, a call
 * (Object.freeze(...)), a template string or an unresolvable name is a build failure.
 */
function evalStatic(literal, src = '') {
  if (/\.\.\./.test(literal)) throw new Error('spread operator inside config');
  if (/`/.test(literal)) throw new Error('template string inside config');
  if (/\w\s*\(/.test(literal)) throw new Error('call expression inside config');
  let json = literal
    .replace(/\/\/[^\n]*/g, '')                                    // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')                              // block comments
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, s) => JSON.stringify(s)) // single → double quotes
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*(?=[,}])/g, '$1$2: $2') // shorthand { schedule } → { schedule: schedule }
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')        // bare keys
    .replace(/,(\s*[}\]])/g, '$1');                                 // trailing commas
  // resolve identifiers in value position from same-file literal consts (the bundler does the same)
  json = json.replace(/(:\s*|\[\s*|,\s*)([A-Za-z_$][\w$]*)(?=\s*[,}\]])/g, (whole, lead, name) => {
    if (name === 'true' || name === 'false' || name === 'null') return whole;
    const decl = new RegExp('(?:^|\\n)\\s*(?:export\\s+)?const\\s+' + name.replace(/\$/g, '\\$') + '\\s*=\\s*([^;]+);').exec(src);
    if (!decl) throw new Error(`identifier "${name}" is not a same-file literal const`);
    return lead + evalStaticValue(decl[1].trim());
  });
  return JSON.parse(json);
}
function evalStaticValue(expr) {
  if (/\.\.\.|`|\w\s*\(/.test(expr)) throw new Error(`const value "${expr.slice(0, 60)}" is not a literal`);
  const json = expr
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, s) => JSON.stringify(s))
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, '$1');
  JSON.parse(json); // throws if not data
  return json;
}

const files = fs.readdirSync(FN).filter((f) => /\.(m?js|cjs|mts|ts)$/.test(f) && !f.startsWith('_'));
assert.ok(files.length > 150, 'functions directory read');
let withConfig = 0, withPath = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(FN, f), 'utf8');
  const lit = configLiteral(src);
  if (!lit) continue;
  withConfig++;
  let cfg;
  try { cfg = evalStatic(lit, src); } catch (e) { assert.fail(`${f}: export const config is not a static literal (${e.message}) — Netlify's bundler cannot read it: ${lit.slice(0, 120)}`); }
  if (cfg.path !== undefined) {
    withPath++;
    const paths = Array.isArray(cfg.path) ? cfg.path : [cfg.path];
    assert.ok(paths.length > 0, `${f}: path must not be empty`);
    for (const p of paths) assert.ok(typeof p === 'string' && p.startsWith('/'), `${f}: every path is a string starting with "/" (got ${JSON.stringify(p)})`);
  }
}
assert.ok(withConfig > 20 && withPath > 5, `configs scanned: ${withConfig} with config, ${withPath} with path`);

// The desktop reads these two constants (ARIA Sentinel/src/shared/recipes.mjs + tests); the deployed
// routes come from the literal. Pin them to each other so a change to one without the other is red.
const { RECIPES_PATHS } = await import('../netlify/functions/aria-recipes.mjs');
const { STOP_CODES_PATHS } = await import('../netlify/functions/aria-stop-codes.mjs');
const recipesSrc = fs.readFileSync(path.join(FN, 'aria-recipes.mjs'), 'utf8'); const recipesCfg = evalStatic(configLiteral(recipesSrc), recipesSrc);
const stopSrc = fs.readFileSync(path.join(FN, 'aria-stop-codes.mjs'), 'utf8'); const stopCfg = evalStatic(configLiteral(stopSrc), stopSrc);
assert.deepEqual(recipesCfg.path, [...RECIPES_PATHS], 'aria-recipes config.path literal equals RECIPES_PATHS');
assert.deepEqual(stopCfg.path, [...STOP_CODES_PATHS], 'aria-stop-codes config.path literal equals STOP_CODES_PATHS');
assert.ok(recipesCfg.path.includes('/.netlify/functions/aria-recipes'), 'the desktop RECIPE_ENDPOINT path is deployed');
assert.ok(stopCfg.path.includes('/.netlify/functions/aria-stop-codes'), 'the desktop STOP_CODES_ENDPOINT path is deployed');

console.log(`[netlify-function-config-static] ${withConfig} config exports parsed statically, ${withPath} with path; recipes + stop-codes paths pinned to their constants`);
