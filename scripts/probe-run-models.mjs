// Cowork 2026-07-14 — READ-ONLY probe v2: which MODEL did recent scheduled runs actually use?
// Scans %APPDATA%\Claude\local-agent-mode-sessions for .jsonl transcripts modified in the last
// 6 hours, extracts "model":"..." values. Prints per-file model tally. WRITES NOTHING.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.env.APPDATA, 'Claude', 'local-agent-mode-sessions');
const CUTOFF = Date.now() - 6 * 3600 * 1000;
const results = [];
(function walk(d, depth) {
  if (depth > 14) return;
  let es; try { es = readdirSync(d); } catch { return; }
  for (const e of es) {
    const p = join(d, e);
    let s; try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) { if (!/\\(outputs|uploads|node_modules)$/i.test(p)) walk(p, depth + 1); continue; }
    if (!e.endsWith('.jsonl')) continue;
    if (s.mtimeMs < CUTOFF || s.size === 0 || s.size > 50 * 1024 * 1024) continue;
    let t; try { t = readFileSync(p, 'utf8'); } catch { continue; }
    const models = {};
    for (const m of t.matchAll(/"model"\s*:\s*"([^"]+)"/g)) models[m[1]] = (models[m[1]] || 0) + 1;
    if (Object.keys(models).length === 0) continue;
    results.push({ p, mtime: new Date(s.mtimeMs).toISOString(), models });
  }
})(ROOT, 0);
results.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
for (const r of results.slice(0, 40)) {
  const short = r.p.split('\\').slice(-4).join('\\');
  console.log(r.mtime, '|', short, '|', JSON.stringify(r.models));
}
console.log('---');
const agg = {};
for (const r of results) for (const [k, v] of Object.entries(r.models)) agg[k] = (agg[k] || 0) + v;
console.log('AGGREGATE (last 6h):', JSON.stringify(agg));
console.log('transcripts found:', results.length);
