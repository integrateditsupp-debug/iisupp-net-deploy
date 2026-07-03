// kb-fulltext — F2 (2026-07-03). Loads the bundled FULL KB article text so the desktop agent can render a
// complete answer even when the LIVE aria-kb-query endpoint serves a mid-line-truncated excerpt (the deployed
// web bundle lags the fixed one). This decouples the Sentinel from a pending web deploy: the .exe carries the
// full text, keyed by slug, and main swaps it in when the live excerpt `looksTruncated`.
//
// 🔒 NODE-ONLY: this imports node:fs and MUST NOT enter the renderer graph. The renderer imports the pure
// helpers from ./kb-text.mjs instead (see renderer-import-graph.test.mjs). File shipped in the .exe via
// build.files ("aria-kb-pack/**/*"). Shape: { generated_at, articles: { "<slug>": "<full markdown>" } }.
import fs from "node:fs";
import path from "node:path";
import { stripFrontmatter } from "./kb-text.mjs";

export { looksTruncated, repairTruncatedTail, stripFrontmatter, stripAnswerFooter } from "./kb-text.mjs";

/** Load aria-kb-pack/kb-fulltext.json → Map(slug → frontmatter-stripped full article). Missing/bad file → empty. */
export function loadFullText(dir, fsImpl = fs) {
  const map = new Map();
  try {
    const data = JSON.parse(fsImpl.readFileSync(path.join(dir, "kb-fulltext.json"), "utf8"));
    const articles = data && typeof data.articles === "object" && data.articles ? data.articles : {};
    for (const slug of Object.keys(articles)) map.set(String(slug), stripFrontmatter(articles[slug]));
  } catch { /* no bundle / parse error → empty map; caller degrades to the live excerpt (repaired) */ }
  return map;
}

/** Full article body for a slug, or "" when we don't carry it. */
export function fullArticle(index, slug) {
  if (!index || !slug || typeof index.get !== "function") return "";
  return index.get(String(slug)) || "";
}
