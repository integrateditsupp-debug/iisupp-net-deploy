// Cowork 2026-07-10 — Ahmad's instruction: every scheduled agent runs on Opus (4.8), not Fable.
// Sweeps C:\Users\Ahmad Wasee\Documents\Claude\Scheduled\*\SKILL.md:
//  - frontmatter has no `model:`  -> insert `model: opus`
//  - `model:` set to fable/anything-not-opus -> replace with `model: opus`
//  - already `model: opus` -> untouched
// Prints a full audit table. Touches nothing outside the frontmatter block.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:\\Users\\Ahmad Wasee\\Documents\\Claude\\Scheduled';
let added = 0, replaced = 0, ok = 0, skipped = 0;
const rows = [];
for (const dir of readdirSync(ROOT)) {
  const f = join(ROOT, dir, 'SKILL.md');
  if (!existsSync(f) || !statSync(f).isFile()) continue;
  const t = readFileSync(f, 'utf8');
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) { rows.push([dir, 'NO FRONTMATTER — skipped']); skipped++; continue; }
  const fm = m[1];
  const modelLine = fm.match(/^model:\s*(.+)$/m);
  if (modelLine && modelLine[1].trim() === 'opus') { rows.push([dir, 'opus (already)']); ok++; continue; }
  let out;
  if (modelLine) {
    out = t.replace(/^(---\r?\n[\s\S]*?)^model:\s*.+$/m, '$1model: opus');
    // simpler + safer: replace just the model line inside the file's first frontmatter
    out = t.replace(modelLine[0], 'model: opus');
    rows.push([dir, `${modelLine[1].trim()} -> opus (REPLACED)`]); replaced++;
  } else {
    out = t.replace(/^---\r?\n([\s\S]*?)(\r?\n)---/, (_, body, nl) => `---\n${body}${nl}model: opus${nl}---`);
    rows.push([dir, 'none -> opus (ADDED)']); added++;
  }
  writeFileSync(f, out);
}
for (const [d, s] of rows) console.log(d.padEnd(42), s);
console.log('---');
console.log(`already opus: ${ok} · added: ${added} · replaced: ${replaced} · skipped(no fm): ${skipped}`);
