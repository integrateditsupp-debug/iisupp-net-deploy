// RUN 20 §2 — parser for the symptom → cause → safe-fix knowledge base. Pure + node-safe so the
// diagnostic reasoner and the test battery can load the bit-native diagnostic .md files without Electron.
//
// File shape (aria-kb-pack/diagnostics/<symptom>.md):
//   # <Title>
//   ## Symptom: <plain language>
//   > User phrasings: "phrase a", "phrase b", "phrase c"
//   ### Cause: <name>
//   **Probability:** 40%
//   **Detection:** <one line, references a system-context field>
//   **Safe diagnostic:** <read-only step>
//   **Safe fix:** <Tier-1 action on confirmation>
//   **Escalation:** <next step if it persists>

import fs from "node:fs";
import path from "node:path";

export const CAUSE_FIELDS = ["probability", "detection", "safeDiagnostic", "safeFix", "escalation"];

// A2 (recovered 2026-08-05) — newer KB docs carry a YAML frontmatter block declaring what KIND of
// article they are. `intent: setup` marks a HOW-TO ("how do I add a printer") — a real KB article the
// matcher should route to, but NOT a symptom -> cause -> fix record. Loading a how-to as a symptom doc
// was a mis-classification: it has no ranked causes to parse, so it could only ever read as malformed.
// Docs with no frontmatter (the original 17) are break-fix by definition, so the default preserves them.
export const NON_SYMPTOM_INTENTS = ["setup"];

/** Parse a leading `---\nkey: value\n---` block. Returns {} when absent. Never throws. */
export function parseFrontmatter(md) {
  const m = String(md || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (kv) out[kv[1].toLowerCase()] = kv[2].trim();
  }
  return out;
}

/** True when a doc is a symptom (break-fix) record rather than a how-to/setup article. */
export function isSymptomDoc(rec) {
  return !NON_SYMPTOM_INTENTS.includes(String(rec?.intent || "break-fix"));
}

function field(block, label) {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

/** Extract every quoted phrase from the `> User phrasings:` lines in a file. */
export function parsePhrasings(md) {
  const out = [];
  for (const line of String(md || "").split(/\r?\n/)) {
    if (!/^>\s*User phrasings:/i.test(line)) continue;
    for (const m of line.matchAll(/["“]([^"”]+)["”]/g)) out.push(m[1].trim().toLowerCase());
  }
  return out;
}

/** Parse one symptom .md into a structured record. */
export function parseSymptomFile(md, id = "") {
  const text = String(md || "");
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : id;
  const phrasings = parsePhrasings(text);
  const symptoms = [...text.matchAll(/^##\s+Symptom:\s*(.+)$/gim)].map((m) => m[1].trim());

  const parts = text.split(/^###\s+Cause:/im);
  const causes = parts.slice(1).map((chunk) => {
    const nameLine = chunk.split(/\r?\n/)[0] || "";
    const probRaw = field(chunk, "Probability");
    return {
      name: nameLine.trim(),
      probability: Number((probRaw.match(/\d+/) || [0])[0]),
      detection: field(chunk, "Detection"),
      safeDiagnostic: field(chunk, "Safe diagnostic"),
      safeFix: field(chunk, "Safe fix"),
      escalation: field(chunk, "Escalation")
    };
  });

  const fm = parseFrontmatter(text);
  return { id, title, symptoms, phrasings, causes, intent: fm.intent || "break-fix", vertical: fm.vertical || "generic" };
}

/** True when a parsed record has the required structure (used by the parse test). */
export function isWellFormed(rec) {
  if (!rec || !rec.title || !rec.symptoms.length || !rec.phrasings.length || !rec.causes.length) return false;
  return rec.causes.every((c) =>
    c.name && c.probability > 0 && c.detection && c.safeDiagnostic && c.safeFix && c.escalation);
}

/** Load + parse every <symptom>.md in a directory (skips the symptoms.md master index). */
export function loadSymptomKb(dir, { includeNonSymptom = false } = {}) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "symptoms.md");
  const recs = files.map((f) => parseSymptomFile(fs.readFileSync(path.join(dir, f), "utf8"), path.basename(f, ".md")));
  return includeNonSymptom ? recs : recs.filter(isSymptomDoc);
}
