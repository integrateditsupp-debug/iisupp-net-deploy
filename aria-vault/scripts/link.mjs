#!/usr/bin/env node
// link.mjs — conservative auto-linker. Scans captured notes and inserts [[wikilinks]]
// where a note's prose mentions another note's title.
//
// Hard guards (learned the expensive way — never mangle the vault):
//   * Only EDITS capture-target notes (daily, decisions, people, campaigns, customers,
//     recipes). NEVER edits CLAUDE.md, README, 02_Memory/**, 06_Templates/**, docs/**,
//     or `_*.md` index files — those are scaffolding, not capture.
//   * Never links inside frontmatter, headings, fenced code, or inline `code`.
//   * Never links inside an existing [[...]] (no nesting) or across a path/extension
//     (`07_People/Ahmad`, `CLAUDE.md` stay intact).
//   * Never links generic words, template names, or bare dates.

import { readFile, writeFile } from "node:fs/promises";
import { listExistingNotes } from "./_vault.mjs";

// Folders whose notes may be EDITED by the linker (captured content only).
const EDITABLE = ["04_Daily/", "09_Decisions/", "07_People/", "03_Campaigns/",
                  "01_Business/IIS/Customers/", "01_Business/ARIA/Customers/",
                  "01_Business/Sentinel/Recipes/"];

// Names that must never become link targets (generic words / scaffolding / dates).
const STOPNAMES = new Set([
  "index", "notes", "detail", "readme", "home", "rules", "voice", "stack",
  "claude", "campaign", "customer", "decision", "daily-note",
  "product", "pricing", "sales", "marketing", "operations", "partners",
  "customers", "services", "build", "design", "tests", "sprints", "recipes", "kb",
]);
const isDate = n => /^\d{4}-\d{2}-\d{2}$/.test(n);
const isScaffold = n => n.startsWith("_") || /^CLAUDE/i.test(n);

const notes = await listExistingNotes();
const targets = notes
  .map(n => n.name)
  .filter(n => n.length > 3 && !isScaffold(n) && !isDate(n) && !STOPNAMES.has(n.toLowerCase()))
  .sort((a, b) => b.length - a.length); // longer names win first

const editable = notes.filter(n => EDITABLE.some(f => n.rel.startsWith(f)));

let totalInserted = 0;
let filesChanged = 0;

// Link only plain-prose runs: skip existing [[links]] and `inline code`.
function linkPlainRuns(line, selfName) {
  let inserted = 0;
  // Split keeping [[...]] and `...` spans as untouchable delimiters.
  const out = line.split(/(\[\[[^\]]*\]\]|`[^`]*`)/g).map(seg => {
    if (seg.startsWith("[[") || seg.startsWith("`")) return seg; // protected span
    for (const target of targets) {
      if (target === selfName) continue;
      const safe = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Whole token, not adjacent to path/extension/word chars.
      const re = new RegExp(`(?<![\\w/\\\\.-])${safe}(?![\\w.-])`);
      if (re.test(seg)) { seg = seg.replace(re, `[[${target}]]`); inserted++; }
    }
    return seg;
  }).join("");
  return { out, inserted };
}

for (const note of editable) {
  const text = await readFile(note.path, "utf8");
  const fm = text.match(/^---\n[\s\S]*?\n---\n?/);
  const head = fm ? fm[0] : "";
  const body = fm ? text.slice(fm[0].length) : text;

  let noteInserted = 0;
  let inFence = false;
  const rebuilt = body.split("\n").map(line => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return line; } // toggle fenced code
    if (inFence) return line;
    if (/^\s{0,3}#{1,6}\s/.test(line)) return line;                // heading
    const { out, inserted } = linkPlainRuns(line, note.name);
    noteInserted += inserted;
    return out;
  }).join("\n");

  if (noteInserted > 0) {
    await writeFile(note.path, head + rebuilt);
    totalInserted += noteInserted;
    filesChanged++;
  }
}

console.log(`link.mjs · inserted ${totalInserted} wikilinks across ${filesChanged}/${editable.length} editable notes (${notes.length} total scanned)`);
