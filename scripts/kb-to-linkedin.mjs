#!/usr/bin/env node
/**
 * kb-to-linkedin.mjs — Turn KB entries into LinkedIn post drafts
 *  Reads knowledge-base/<vertical>/*.md, picks N at random,
 *  generates a LinkedIn post per KB entry using the "specific tactical tip" pattern.
 *  Outputs to outputs/linkedin-drafts-YYYY-MM-DD.md
 *  Run weekly to refresh the queue.
 *  Cat 14 — Marketing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO = path.join(__dirname, '..');
const KB_DIR = path.join(REPO, 'knowledge-base');
const OUT_DIR = path.join(REPO, 'outputs');
const N_DRAFTS = 7; // one week of posts

function* walkKb(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkKb(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

const files = [...walkKb(KB_DIR)].filter(f => !f.endsWith('_meta/manifest.json'));
console.log('Found', files.length, 'KB entries');

// Pick N random
const picked = [];
const pool = files.slice();
while (picked.length < N_DRAFTS && pool.length > 0) {
  const idx = Math.floor(Math.random() * pool.length);
  picked.push(pool.splice(idx, 1)[0]);
}

function extractTitle(content) {
  const m = content.match(/^title:\s*(.+)$/m);
  return m ? m[1].trim() : 'IT issue';
}
function extractFirstFix(content) {
  // Find "## Fix" section, then first numbered or bulleted step
  const fixSec = content.match(/## Fix[\s\S]*?(?=##|\Z)/);
  if (!fixSec) return null;
  const stepMatch = fixSec[0].match(/(?:###|\d+\.|\*)\s+([^\n]+)/);
  return stepMatch ? stepMatch[1].trim() : null;
}
function extractVertical(filePath) {
  const m = filePath.match(/vertical-([a-z]+)/);
  if (m) return m[1];
  if (filePath.includes('tier3-hybrid')) return 'hybrid IT';
  return 'general SMB';
}

const drafts = [];
for (const f of picked) {
  const content = fs.readFileSync(f, 'utf8');
  const title = extractTitle(content);
  const fix = extractFirstFix(content);
  const vertical = extractVertical(f);
  const filename = path.basename(f);

  // Pattern: hook + observation + tip + soft CTA
  const draft = `**[Draft ${drafts.length + 1}]** Source KB: \`${filename}\`

Most ${vertical} IT teams hit this and don't know the fast fix.

**The issue:** ${title}

**The fix in 30 seconds:** ${fix || 'See KB entry for details — usually takes 3-5 troubleshooting steps.'}

We shipped this exact workflow into ARIA — when a user types it, ARIA walks them through the safe fix without bothering you. iisupp.net/aria — 15 min free trial.

---
`;
  drafts.push(draft);
}

const today = new Date().toISOString().slice(0, 10);
const outFile = path.join(OUT_DIR, 'linkedin-drafts-' + today + '.md');
const header = `# LinkedIn Drafts (KB-sourced) — ${today}

**${N_DRAFTS} draft posts auto-generated from KB entries.**
Pick any, edit personally, post manually. Each is sourced from a real shipped KB entry, so the tactical tip is verifiable.

**Pattern:** Hook → Observation → Tactical tip → Soft CTA → KB-source citation.

---

`;
fs.writeFileSync(outFile, header + drafts.join('\n'));
console.log('Wrote', drafts.length, 'drafts to', outFile);
