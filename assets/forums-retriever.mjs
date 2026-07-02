// IIS Forums — Solutions retriever over the REAL offline KB (assets/aria-kb-chunks.json).
// Mirrors the server scorer in netlify/functions/aria-kb-query.mjs (token +1, title +2,
// 30-char phrase +4) and keeps the SAME abstain threshold (score < 8 → no confident match,
// aligned with Sentinel since 2026-06-23). Structured so the RUN-A semantic retriever can
// swap in behind `retrieve()` without touching any caller.
// Rule 14: the confidence shown to users is a REAL, documented normalization of the raw
// retriever score — never decorative. Below threshold we abstain and say so; we never
// fabricate a #1. Works in the browser (ES module) and in node tests (same file).

export const ABSTAIN_THRESHOLD = 8; // raw score; matches aria-kb-query.mjs + Sentinel

/** Parse the YAML-ish frontmatter block of a chunk's markdown content. */
export function parseFrontmatter(content) {
  const m = String(content || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

/** Body markdown without the frontmatter block. */
export function stripFrontmatter(content) {
  return String(content || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** Normalize a raw chunk into a searchable doc (title from frontmatter when blank). */
export function toDoc(chunk) {
  const fm = parseFrontmatter(chunk.content);
  return {
    slug: chunk.slug,
    title: chunk.title || fm.title || chunk.slug.replace(/-/g, " "),
    category: fm.category || chunk.vertical || "general",
    tier: chunk.tier || fm.support_level || "",
    keywords: Array.isArray(chunk.keywords) ? chunk.keywords : [],
    body: stripFrontmatter(chunk.content),
    sourceType: "kb"
  };
}

const tokenize = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);

/** Score one doc against a query — the aria-kb-query.mjs recipe, verbatim in spirit. */
export function scoreDoc(query, doc) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return 0;
  const hayTitle = String(doc.title || "").toLowerCase();
  const hay = (hayTitle + " " + doc.keywords.join(" ") + " " + String(doc.body || "").toLowerCase()).slice(0, 20000);
  let score = 0;
  for (const tok of new Set(tokenize(q))) {
    if (hay.includes(tok)) score += 1;
    if (hayTitle.includes(tok)) score += 2;
  }
  const frag = q.slice(0, 30);
  if (frag.length >= 10 && hay.includes(frag)) score += 4;
  return score;
}

/**
 * Real, documented normalization of the raw score to 0–100 for the confidence meter:
 * conf = round(100 · (1 − e^(−raw/12))). Monotone in the raw score; raw 8 (the abstain
 * threshold) ≈ 49, raw 20 ≈ 81, raw 30 ≈ 92. The raw score is always carried alongside.
 */
export function normalizeConfidence(raw) {
  const n = Math.max(0, Number(raw) || 0);
  return Math.round(100 * (1 - Math.exp(-n / 12)));
}

export function confidenceBand(raw) {
  if (raw >= 20) return "high";
  if (raw >= ABSTAIN_THRESHOLD) return "med";
  return "low";
}

/**
 * Retrieve ranked docs for a query. `docs` = KB docs (from toDoc); `communityDocs` = accepted
 * community answers already graduated (sourceType "discussion", carry deepLink). Returns
 * { abstain, results, top, confidence:{raw,value,band,sources} } — abstain=true means render
 * the honest no-match state (never a fabricated #1).
 */
export function retrieve(query, docs, { topK = 4, communityDocs = [] } = {}) {
  const all = [...docs, ...communityDocs];
  const scored = all
    .map((d) => ({ doc: d, score: scoreDoc(query, d) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = scored[0] || null;
  const sources = scored.filter((r) => r.score >= ABSTAIN_THRESHOLD).length;
  const abstain = !top || top.score < ABSTAIN_THRESHOLD;
  return {
    abstain,
    results: scored.slice(0, topK),
    top,
    confidence: {
      raw: top ? top.score : 0,
      value: normalizeConfidence(top ? top.score : 0),
      band: confidenceBand(top ? top.score : 0),
      sources
    }
  };
}

/** First meaningful paragraph of a doc body — used for the sourced AI-answer summary. */
export function summarize(doc, maxLen = 260) {
  const body = String(doc && doc.body || "");
  const para = body.split(/\r?\n\r?\n/).map((p) => p.replace(/^#+\s.*$/gm, "").replace(/[*_`>#-]/g, " ").replace(/\s+/g, " ").trim()).find((p) => p.length > 40) || "";
  return para.length > maxLen ? para.slice(0, maxLen - 1).trimEnd() + "…" : para;
}
