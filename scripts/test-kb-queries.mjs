#!/usr/bin/env node
/**
 * test-kb-queries.mjs — DEFECT-220 fix (Sentinel watcher run179, 2026-08-06).
 *
 * `npm run kb:test` pointed at this path but the file was never committed
 * (verified first-hand: `git log -- scripts/test-kb-queries.mjs` is empty), so the
 * script exited 1 with MODULE_NOT_FOUND on every run.
 *
 * This is a REAL retrieval test against the built bundle
 * (`assets/aria-kb-local-bundle.json`, produced by `npm run kb:build`).
 * Rule 14: it asserts only that queries retrieve SOMETHING relevant and that the
 * bundle is structurally sound. It does NOT claim, print, or hard-code any
 * accuracy/hit-rate figure. If the bundle is missing, it says so and exits 1 —
 * real-or-empty, never a fabricated pass.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = join(REPO_ROOT, "assets/aria-kb-local-bundle.json");

let failures = 0;
const ok = (name) => console.log("  PASS  " + name);
const bad = (name, detail) => { failures++; console.log("  FAIL  " + name + (detail ? " — " + detail : "")); };

if (!existsSync(BUNDLE)) {
  console.error("KB bundle not found at assets/aria-kb-local-bundle.json — run `npm run kb:build` first.");
  process.exit(1);
}

let bundle;
try {
  bundle = JSON.parse(readFileSync(BUNDLE, "utf8"));
} catch (err) {
  console.error("KB bundle is not valid JSON: " + err.message);
  process.exit(1);
}

console.log("KB QUERY TEST — bundle schema " + bundle.schema + " v" + bundle.version);

// --- structural assertions -------------------------------------------------
const articles = Array.isArray(bundle.articles) ? bundle.articles : [];
articles.length > 0 ? ok("bundle contains articles (" + articles.length + ")")
                    : bad("bundle contains articles", "articles array is empty");

bundle.article_count === articles.length
  ? ok("article_count matches articles.length")
  : bad("article_count matches articles.length", bundle.article_count + " vs " + articles.length);

const missingId = articles.filter(a => !a.id).length;
missingId === 0 ? ok("every article has an id") : bad("every article has an id", missingId + " missing");

const missingTitle = articles.filter(a => !a.title).length;
missingTitle === 0 ? ok("every article has a title") : bad("every article has a title", missingTitle + " missing");

const missingBody = articles.filter(a => !a.body_md || !a.body_md.trim()).length;
missingBody === 0 ? ok("every article has a body") : bad("every article has a body", missingBody + " empty");

const ids = articles.map(a => a.id);
const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
dupes.length === 0 ? ok("article ids are unique")
                   : bad("article ids are unique", "duplicates: " + [...new Set(dupes)].slice(0, 5).join(", "));

// --- retrieval assertions --------------------------------------------------
// Same keyword-scoring shape the local ARIA KB lookup uses: title > keywords > body.
function search(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  return articles
    .map(a => {
      const title = (a.title || "").toLowerCase();
      const keys = (a.keywords || []).join(" ").toLowerCase();
      const body = (a.body_md || "").toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 5;
        if (keys.includes(t)) score += 3;
        if (body.includes(t)) score += 1;
      }
      return { a, score };
    })
    .filter(r => r.score > 0)
    .sort((x, y) => y.score - x.score);
}

// Queries derived from categories actually present in the bundle — no invented topics.
const QUERIES = [
  "printer not printing",
  "password reset",
  "wifi network connection",
  "outlook email not sending",
  "slow computer performance",
  "backup and restore",
  "vpn remote access",
  "windows update failed"
];

for (const q of QUERIES) {
  const hits = search(q);
  hits.length > 0
    ? ok('query "' + q + '" -> ' + hits.length + " hit(s), top: " + hits[0].a.id)
    : bad('query "' + q + '" -> 0 hits');
}

// A nonsense query must NOT match everything (guards against a degenerate scorer).
const noise = search("zqxjvkwbrmpf");
noise.length === 0 ? ok("nonsense query returns no hits")
                   : bad("nonsense query returns no hits", noise.length + " spurious hits");

console.log(failures === 0
  ? "\nALL KB QUERY ASSERTIONS PASSED ✅"
  : "\n" + failures + " KB QUERY ASSERTION(S) FAILED ❌");
process.exit(failures === 0 ? 0 : 1);
