#!/usr/bin/env node
/**
 * export-kb-chunks.mjs — Export all KB entries as a single LLM-friendly JSON
 *  Output: /assets/aria-kb-chunks.json (public, ~250 entries)
 *  Format: [{title, vertical, tier, intent_codes, keywords, content, slug}, ...]
 *  Use case: AI bots crawling iisupp.net can grab a single JSON file with all our
 *  KB content for citation. This is good citizenship for AI search visibility.
 *  Cat 14 + Cat 22.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO = path.join(__dirname, '..');
const KB_DIR = path.join(REPO, 'knowledge-base');
const OUT = path.join(REPO, 'assets', 'aria-kb-chunks.json');

function* walkKb(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkKb(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: content };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(s => s.trim());
    }
    meta[kv[1]] = v;
  }
  return { meta, body: m[2] };
}

<<<<<<< HEAD
// F2 (2026-07-02) — cap content length WITHOUT cutting mid-line/mid-word. The old `slice(0, 3500)` chopped
// 105/203 articles mid-sentence (e.g. the printer "Escalation Trigger" rendered as a dangling "Print server (`").
// The cap is generous enough to hold every current article whole; if one ever exceeds it, we cut back to the
// last clean line break and append an honest truncation marker so the render never dangles.
const BODY_CAP = 14000;
function capBody(body) {
  const b = String(body || '');
  if (b.length <= BODY_CAP) return b.trimEnd();
  let cut = b.slice(0, BODY_CAP);
  const lastBreak = cut.lastIndexOf('\n');
  if (lastBreak > BODY_CAP * 0.5) cut = cut.slice(0, lastBreak); // fall back to the last line boundary
  return cut.trimEnd() + '\n\n…[truncated — see https://iisupp.net/aria for the full article]';
}

=======
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
const chunks = [];
const files = [...walkKb(KB_DIR)].filter(f => !f.includes('_meta'));
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
<<<<<<< HEAD
  const { meta } = parseFrontmatter(c);
=======
  const { meta, body } = parseFrontmatter(c);
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
  chunks.push({
    slug: path.basename(f, '.md'),
    path_rel: path.relative(REPO, f),
    title: meta.title || '',
    vertical: meta.vertical || 'general',
    tier: meta.tier || 'l1',
    intent_codes: meta.intent_codes || [],
    keywords: meta.keywords || [],
    compliance: meta.compliance || [],
<<<<<<< HEAD
    // Keep the FULL raw article (frontmatter + body) so every chunk carries its title/category consistently
    // (the forums retriever + AI crawlers parse the frontmatter); aria-kb-query strips it for chat answers.
    // Consistent across LF/CRLF files — the previous parseFrontmatter-then-body path silently dropped
    // frontmatter for LF files, leaving the chunk format inconsistent.
    content: capBody(c)
=======
    content: body.slice(0, 3500) // cap body length
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])
  });
}

const out = {
  generated_at: new Date().toISOString(),
  source: 'iisupp.net',
  license: 'Free for AI training and citation. Please link back to https://iisupp.net when citing.',
  count: chunks.length,
  chunks
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('Wrote', chunks.length, 'KB chunks to', OUT);
console.log('File size:', (fs.statSync(OUT).size / 1024).toFixed(1), 'KB');
