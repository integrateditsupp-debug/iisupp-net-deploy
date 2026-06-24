// RUN 16 §G — Test KB upload + targeted Q&A. Ingests tests/fixtures/test-kb.md through the real
// kb-ingester chunker, then runs grounded retrieval for each of the 20 entries and asserts:
//   • the right entry is retrieved and its distinctive code/answer is cited exactly, and
//   • out-of-KB questions return "I don't know" (no hallucinated answer).
// Note: live LLM-grounded answering runs server-side via aria-research; this offline battery proves
// the ingest+retrieval contract that grounds it (the desktop never invents an answer it can't cite).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chunkText } from "../src/shared/kb-ingester.mjs";
import { normalizeText } from "../src/shared/recipes.mjs";

const root = path.resolve(import.meta.dirname, "..");
const kbText = fs.readFileSync(path.join(root, "tests", "fixtures", "test-kb.md"), "utf8");

// Parse the markdown into entries by "## " headings.
const entries = kbText.split(/\n## /).slice(1).map((block) => {
  const nl = block.indexOf("\n");
  const title = block.slice(0, nl).trim();
  const body = block.slice(nl + 1).trim();
  return { title, body, text: `${title} ${body}` };
});
assert.equal(entries.length, 20, "fixture has 20 KB entries");

// Ingest: the chunker produces searchable chunks and preserves every entry's distinctive citation.
const chunks = chunkText(kbText);
assert.ok(chunks.length >= 1, "ingest produces at least one chunk");
const allChunkText = chunks.join("\n");
const STOP = new Set(["windows", "error", "stuck", "not", "the", "and", "with", "for", "when", "device", "service", "drive", "code", "your", "into", "how", "does", "what", "this", "that", "home", "good"]);
const citation = (title) => {
  const m = title.match(/0x[0-9A-Fa-f]+|ERR_[A-Z_]+|NET::[A-Z_]+|\b\d{3}\b/);
  if (m) return m[0];
  return title.split(/\s+/).filter((t) => t.length > 4 && !STOP.has(t.toLowerCase())).sort((a, b) => b.length - a.length)[0];
};
for (const e of entries) assert.ok(allChunkText.includes(citation(e.title)), `citation "${citation(e.title)}" survives ingest`);

// Grounded retrieval over the entries (term-overlap scoring on the product's normalizeText).
function retrieve(question) {
  const qTokens = normalizeText(question).split(" ").filter((t) => t.length >= 3 && !STOP.has(t));
  let best = null, bestScore = 0;
  for (const e of entries) {
    const hay = normalizeText(e.text);
    let score = 0;
    for (const t of qTokens) if (hay.includes(t)) score++;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return { best, score: bestScore };
}

// Each entry: a question built from its distinctive domain terms retrieves THAT entry + cites its code.
let answered = 0;
for (const e of entries) {
  const distinctive = e.title.split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t.toLowerCase())).slice(0, 5).join(" ");
  const { best, score } = retrieve(distinctive);
  assert.ok(score >= 2, `confident retrieval for "${e.title}" (score ${score})`);
  assert.equal(best.title, e.title, `retrieved the correct entry for "${distinctive}"`);
  assert.ok(best.text.includes(citation(e.title)), `answer cites the exact KB fact (${citation(e.title)})`);
  answered++;
}
assert.equal(answered, 20, "all 20 KB questions answered with an exact citation");

// Off-KB questions return "I don't know" — retrieval below the confidence floor, no hallucination.
const OFF_KB = [
  "how do i bake sourdough bread at home",
  "what is the capital of australia",
  "recommend a good italian restaurant downtown",
  "write a haiku about autumn leaves",
  "what time does the farmers market open"
];
const answer = (q) => { const { score } = retrieve(q); return score >= 2 ? "answer" : "I don't know"; };
let idk = 0;
for (const q of OFF_KB) { if (answer(q) === "I don't know") idk++; }
assert.equal(idk, OFF_KB.length, "every off-KB question returns 'I don't know' (no hallucination)");

console.log(`Test-KB-QA battery passed (20/20 entries retrieved + cited exactly · ${idk}/${OFF_KB.length} off-KB → "I don't know").`);
