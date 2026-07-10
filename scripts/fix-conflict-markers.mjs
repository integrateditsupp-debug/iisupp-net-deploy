// Cowork 2026-07-10 — remove crashed-rebase conflict-marker debris from tracked HTML/CSS/JS/JSON.
// Pattern observed tree-wide:  <<<<<<< HEAD ... ======= (empty or content) >>>>>>> 6a5244d1 ...
// Policy: keep the HEAD side. Only auto-fix when the OTHER side is EMPTY (the observed uniform case)
// or when both sides are IDENTICAL. Anything else is reported for manual review and left untouched.
// Skips: .git, node_modules, ARIA Sentinel/dist*, _shipped-src, _branch-src, outputs, backups.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP = /[\\\/](\.git|node_modules|_shipped-src|_branch-src|outputs|backups|ARIA Sentinel[\\\/]dist)/i;
const EXT = /\.(html|css|js|mjs|json|md|xml|toml|txt)$/i;
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (SKIP.test(p)) continue;
    let s; try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p);
    else if (EXT.test(e)) files.push(p);
  }
})(ROOT);

// <<<<<<< HEAD\n (A) \n=======\n (B) \n>>>>>>> label\n
const RE = /^<<<<<<<[^\n]*\r?\n([\s\S]*?)^=======[^\n]*\r?\n([\s\S]*?)^>>>>>>>[^\n]*\r?\n?/gm;
let fixed = 0, manual = [];
for (const f of files) {
  let t; try { t = readFileSync(f, 'utf8'); } catch { continue; }
  if (!t.includes('<<<<<<<')) continue;
  let changed = false, needsManual = false;
  const KEEP_HEAD_ALL = process.argv.includes('--keep-head');
  const out = t.replace(RE, (m, a, b) => {
    const bTrim = b.replace(/\s/g, '');
    const aTrim = a.replace(/\s/g, '');
    if (bTrim === '' || aTrim === bTrim) { changed = true; return a; }   // keep HEAD side
    if (aTrim === '') { changed = true; return b; }                      // HEAD empty -> keep other side
    if (KEEP_HEAD_ALL) { changed = true; return a; }                     // operator decision 2026-07-10: HEAD = live production lineage (v1.1); 6a5244d1 side stays recoverable in git history
    needsManual = true; return m;                                        // both sides real: leave for human
  });
  if (changed) { writeFileSync(f, out); fixed++; console.log('FIXED', f.replace(ROOT, '.')); }
  if (needsManual) { manual.push(f.replace(ROOT, '.')); }
}
console.log('---');
console.log('fixed files:', fixed);
console.log('manual review needed:', manual.length ? manual.join(' | ') : 'none');
