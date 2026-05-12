// aria-kb-local.mjs
// Tier 3 client-side fallback retrieval — runs when both droplet RAG and Anthropic are unreachable.
// Pure JS, no LLM required. Loads aria-kb-local-bundle.json on demand.

let __bundle = null;
let __loading = null;

async function loadBundle() {
  if (__bundle) return __bundle;
  if (__loading) return __loading;
  __loading = fetch("/assets/aria-kb-local-bundle.json", { cache: "force-cache" })
    .then(r => r.ok ? r.json() : null)
    .then(b => { __bundle = b; __loading = null; return b; })
    .catch(() => { __loading = null; return null; });
  return __loading;
}

const STOPWORDS = new Set([
  "the","a","an","of","to","in","on","is","are","was","were","be","been","being",
  "i","you","my","your","me","we","our","it","its","this","that","these","those",
  "and","or","but","if","then","else","not","no","so","with","for","by","at",
  "as","do","does","did","done","have","has","had","can","could","would","should",
  "will","wont","cant","dont","didnt","wasnt","arent","isnt","im","ive","weve"
]);

function tokenize(q) {
  return (q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

function scoreArticle(article, tokens) {
  const title = (article.title || "").toLowerCase();
  const kws = (article.keywords || []).map(k => (k || "").toLowerCase());
  const summary = (article.summary || "").toLowerCase();
  const body = (article.body_md || "").toLowerCase();
  const cat = (article.category || "").toLowerCase();
  let score = 0;
  let hits = 0;
  for (const t of tokens) {
    let tHit = 0;
    if (title.includes(t)) { score += 10; tHit++; }
    if (kws.some(k => k.includes(t) || t.includes(k))) { score += 6; tHit++; }
    if (cat.includes(t)) { score += 4; tHit++; }
    if (summary.includes(t)) { score += 3; tHit++; }
    if (body.includes(t)) { score += 1; tHit++; }
    if (tHit > 0) hits++;
  }
  // Demand at least 2 token hits OR a single very specific match (title-keyword)
  const titleKwOverlap = tokens.filter(t => title.includes(t) || kws.some(k => k.includes(t))).length;
  if (hits < 2 && titleKwOverlap < 1) return 0;
  return score;
}

export async function localKBRetrieve(query, opts = {}) {
  const minScore = opts.minScore || 8;
  const maxResults = opts.maxResults || 3;
  const b = await loadBundle();
  if (!b || !b.articles || b.articles.length === 0) {
    return {
      kb_source: "local",
      confidence: 0,
      answer: "I'm currently working offline and don't have the knowledge base loaded. Please reconnect to the internet, or call (647) 581-3182 for live help.",
      kb_articles_used: []
    };
  }
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return {
      kb_source: "local",
      confidence: 0,
      answer: "Could you describe the issue in a few more words? I'm trying to match your question to my offline KB.",
      kb_articles_used: []
    };
  }
  const scored = b.articles
    .map(a => ({ article: a, score: scoreArticle(a, tokens) }))
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  if (scored.length === 0) {
    return {
      kb_source: "local",
      confidence: 0,
      answer: "I'm offline from my main systems and couldn't match your question to my local knowledge base. Try rephrasing, or call (647) 581-3182 for live help.",
      kb_articles_used: []
    };
  }
  const top = scored[0];
  const article = top.article;
  // Strip frontmatter-style headings, keep the useful sections
  const body = article.body_md;
  const confidence = Math.min(top.score / 40, 0.85);
  return {
    kb_source: "local",
    confidence,
    answer:
      "I'm answering from a locally-cached article because my main systems aren't reachable right now. Here's the closest match:\n\n" +
      "**" + article.title + "**\n\n" +
      body,
    kb_articles_used: [article.id],
    related_articles: (scored.slice(1).map(s => ({ id: s.article.id, title: s.article.title }))),
    bundle_version: b.version,
    bundle_generated: b.generated
  };
}

export async function getBundleStatus() {
  const b = await loadBundle();
  if (!b) return { loaded: false };
  return {
    loaded: true,
    version: b.version,
    generated: b.generated,
    article_count: b.article_count
  };
}

// Make available globally for easy debugging from console / non-module callers
if (typeof window !== "undefined") {
  window.ariaLocalKB = { retrieve: localKBRetrieve, status: getBundleStatus };
}
