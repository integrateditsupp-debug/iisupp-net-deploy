// tests/axis-overview-panels.test.mjs — guards the Overview tab against silent amputation.
//
// On 2026-08-06 a rewrite of the embedded `const GLOBAL = {...}` literal in assets/axis-app.js used a
// naive search for the next flush-left "};" to find the end of the object. `SCREENS.overview = (c) => {...};`
// is an arrow-function assignment, so it terminates with "};" at column 0 too. The search sailed past
// the literal and the rewrite deleted 3,954 bytes: globalSection() and the entire Overview screen.
//
// The file still parsed. `node --check` passed. It shipped, and the Command Center rendered its default
// tab as nothing. That is the failure this file exists to make impossible: structural presence is a
// separate property from syntactic validity, and only the former tells you the page still works.
//
// Run: node tests/axis-overview-panels.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'assets', 'axis-app.js'), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, detail = '') => {
  if (cond) { pass++; return; }
  fail++;
  console.error('  FAIL', name, detail);
};
const count = (needle) => src.split(needle).length - 1;

// 1. The Overview screen exists at all. It is the default module (state.module = 'overview'), so if
//    this is missing the app boots straight into a blank pane.
t('SCREENS.overview is defined', count('SCREENS.overview =') === 1, `found ${count('SCREENS.overview =')}`);

// 2. Both panels are DEFINED and CALLED. Defined-but-never-called is exactly the state origin/main
//    was left in: procurementSection() sat in the file as dead code while the tab rendered nothing.
for (const fn of ['procurementSection', 'globalSection']) {
  t(`${fn}() is defined`, count(`function ${fn}()`) === 1, `found ${count(`function ${fn}()`)}`);
  t(`${fn}() is called from Overview`, count(`c.append(${fn}())`) === 1, `found ${count(`c.append(${fn}())`)}`);
}

// 3. The baked GLOBAL literal is present, brace-balanced, and real JSON. A truncated literal is the
//    other half of the same failure mode — it would throw at module load and white-screen every tab.
t('GLOBAL literal appears exactly once', count('const GLOBAL = {') === 1, `found ${count('const GLOBAL = {')}`);
if (count('const GLOBAL = {') === 1) {
  const start = src.indexOf('const GLOBAL = {');
  let i = src.indexOf('{', start), depth = 0, quote = null, esc = false, end = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = i + 1; break; }
  }
  t('GLOBAL literal is brace-balanced', end > 0);
  if (end > 0) {
    let parsed = null;
    try { parsed = JSON.parse(src.slice(src.indexOf('{', start), end)); } catch (e) { /* reported below */ }
    t('GLOBAL literal is valid JSON', parsed !== null);
    if (parsed) {
      for (const k of ['updated', 'cycle', 'counts', 'attention', 'queue', 'registered', 'opportunities', 'marketing']) {
        t(`GLOBAL.${k} is present`, k in parsed);
      }
      t('GLOBAL.opportunities is a non-empty array',
        Array.isArray(parsed.opportunities) && parsed.opportunities.length > 0);
      // Every row the panel renders as a link needs a real href, or the operator clicks into nothing.
      // The panel shape is {code, title, meta, href, cta} — procRow() reads `href`, so that is the
      // field to assert. Asserting `link` (the agent's internal name) passes vacuously and proves nothing.
      const rows = [...(parsed.opportunities || []), ...(parsed.queue || []), ...(parsed.attention || [])];
      const bad = rows.filter(o => !o.href || !/^https?:\/\//.test(o.href));
      t('every panel row has an absolute href', bad.length === 0,
        bad.length ? `${bad.length}/${rows.length} bad: ${bad.slice(0, 2).map(o => o.title).join(' | ')}` : '');
      t('every panel row has a title', rows.every(o => typeof o.title === 'string' && o.title.trim()));
    }
  }
}

// 4. The COMMAND CENTER title survives too — same class of regression, reported the same day.
const html = fs.readFileSync(path.join(ROOT, 'aperture-learning.html'), 'utf8');
t('COMMAND CENTER title markup is present', /id="ccTitle"/.test(html) && /COMMAND CENTER/.test(html));
const css = fs.readFileSync(path.join(ROOT, 'assets', 'axis-tokens.css'), 'utf8');
t('.cc-title has a style rule', /\.cc-title\s*\{/.test(css));

console.log(`axis-overview-panels: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
