// Cowork 2026-07-14 — READ-ONLY probe: where does the Claude app store "fable" model
// choices for scheduled tasks and open tabs? Scans %APPDATA%\Claude for small text/JSON
// files mentioning fable; prints path + snippet. WRITES NOTHING.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.env.APPDATA, 'Claude');
const SKIP = /\\(Cache|Code Cache|GPUCache|DawnGraphiteCache|DawnWebGPUCache|blob_storage|Crashpad|Session Storage|Local Storage|IndexedDB|Service Worker|logs|Dictionaries|component_crx_cache|extensions_crx_cache|node_modules|outputs|uploads|\.git)\\/i;
const TEXTEXT = /\.(json|jsonl|txt|md|yaml|yml|ini|cfg|conf|db|sqlite|log)$|^[^.]+$/i;
const MAX = 8 * 1024 * 1024;
const hits = [];
(function walk(d, depth) {
  if (depth > 7) return;
  let es; try { es = readdirSync(d); } catch { return; }
  for (const e of es) {
    const p = join(d, e);
    if (SKIP.test(p + '\\')) continue;
    let s; try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) { walk(p, depth + 1); continue; }
    if (s.size > MAX || s.size === 0) continue;
    if (!TEXTEXT.test(e)) continue;
    let t; try { t = readFileSync(p, 'latin1'); } catch { continue; }
    const idx = t.toLowerCase().indexOf('fable');
    if (idx === -1) continue;
    // collect up to 3 snippets
    const snippets = [];
    let from = 0;
    for (let k = 0; k < 3; k++) {
      const i = t.toLowerCase().indexOf('fable', from);
      if (i === -1) break;
      snippets.push(t.slice(Math.max(0, i - 80), i + 80).replace(/[\r\n\x00-\x1f]+/g, ' '));
      from = i + 5;
    }
    hits.push({ p: p.replace(ROOT, '%CLAUDE%'), size: s.size, snippets });
  }
})(ROOT, 0);
for (const h of hits) {
  console.log('==', h.p, `(${h.size}b)`);
  for (const sn of h.snippets) console.log('   ...' + sn + '...');
}
console.log('---'); console.log('files mentioning fable:', hits.length);
