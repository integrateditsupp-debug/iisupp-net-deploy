// 2026-07-05 - Resolution tab contract.
// Recipes remains the internal route, but the user-facing tab is Resolution with Fix It + Fix History.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const html = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

assert.match(html, /data-tab="recipes"[^>]*>[\s\S]*Resolution/, "recipes route is user-facing Resolution");
assert.match(html, /data-sub="recipes"[\s\S]*data-anchor="fix-it"[\s\S]*data-anchor="fix-history"/, "Resolution has Fix It and Fix History subanchors");
for (const id of ["fix-it", "fix-history", "fixSearch", "fixCategory", "recipeFilterMeta", "tier0FilterMeta", "fixHistoryList", "fixHistoryPrev", "fixHistoryNext", "fixHistoryPage"]) {
  assert.match(html, new RegExp(`id="${id}"`), `Resolution markup includes #${id}`);
}

assert.match(renderer, /recipes:\s*"Resolution"/, "TAB_TITLES exposes Resolution");
assert.match(renderer, /"fix-it":\s*\{\s*tab:\s*"recipes",\s*anchor:\s*"fix-it"/, "Fix It redirects to recipes#fix-it");
assert.match(renderer, /"fix-history":\s*\{\s*tab:\s*"recipes",\s*anchor:\s*"fix-history"/, "Fix History redirects to recipes#fix-history");
assert.match(renderer, /function wireResolutionControls\(\)/, "Resolution controls are wired");
assert.match(renderer, /function renderFixBrowser\(\)/, "Fix browser renderer exists");
assert.match(renderer, /function populateFixCategoryFilter\(\)/, "Fix family dropdown is populated from loaded fixes");
assert.match(renderer, /function buildFixHistory\(next = state, now = Date\.now\(\)\)/, "Fix history is built from current state");
assert.match(renderer, /function renderFixHistory\(next = state\)/, "Fix history renderer exists");
assert.match(renderer, /const FIX_HISTORY_DAYS = 30;/, "history window is 30 days");
assert.match(renderer, /const FIX_HISTORY_MAX = 50;/, "history cap is 50 events");
assert.match(renderer, /const FIX_HISTORY_PAGE_SIZE = 10;/, "history page size is 10");
assert.match(renderer, /\.slice\(0, FIX_HISTORY_MAX\)/, "history result is capped");
assert.match(renderer, /Math\.min\(5, Math\.ceil\(rows\.length \/ FIX_HISTORY_PAGE_SIZE\)\)/, "history is limited to 5 pages");
assert.match(renderer, /next\?\.detections/, "Fix history includes detections");
assert.match(renderer, /next\?\.transparencyLog/, "Fix history includes audit/transparency events");

for (const cls of [".fix-toolbar", ".fix-section-title", ".fix-history-list", ".fix-history-card", ".fix-history-pagination"]) {
  assert.match(css, new RegExp(cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `CSS includes ${cls}`);
}

console.log("Resolution tab test passed (Fix It search/dropdown + 30-day paginated Fix History).");
