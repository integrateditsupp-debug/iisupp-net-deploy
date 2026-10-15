// JULY PORT 2026-10-14 (c0a0f6b4, cc/security-lockdown-2026-07-01) — the Resolution surface: Fix It (search + family
// filter over the vetted-fix + Tier-0 lists) and Fix History (REAL local activity, 30 days, newest first, ≤50, 10/page).
// ADAPTED: the July line relabelled the Recipes tab "Resolution"; Rule 15 (never rename a tab) and the 11-tab budget
// (six count-locks) keep the Recipes nav item, so Fix It / Fix History are sub-anchors INSIDE the Recipes tab, exactly
// like Dashboard → Overview / Performance / SLA. Nothing the Recipes tab had is removed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const html = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

// ── Rule 15: the Recipes tab keeps its name + its two lists; Resolution is additive sub-anchors. ──
assert.match(html, /data-tab="recipes"[^>]*>[\s\S]{0,80}Recipes/, "the recipes nav item still reads Recipes");
assert.match(html, /data-sub="recipes"[\s\S]*data-anchor="fix-it"[\s\S]*data-anchor="fix-history"/, "Recipes has Fix It and Fix History sub-anchors");
assert.match(renderer, /recipes:\s*"Recipes"/, "TAB_TITLES keeps Recipes (never renamed)");
const recipesPanel = html.slice(html.indexOf('id="recipes"'), html.indexOf('id="walkthrough"'));
for (const id of ["fix-it", "fix-history", "fixSearch", "fixCategory", "recipeCatalogMeta", "recipeFilterMeta", "recipeList", "tier0FilterMeta", "tier0List", "fixHistoryList", "fixHistorySummary", "fixHistoryPrev", "fixHistoryNext", "fixHistoryPage"]) {
  assert.match(recipesPanel, new RegExp(`id="${id}"`), `Recipes panel hosts #${id}`);
}
assert.match(recipesPanel, /Vetted fixes/, "the vetted-fixes heading stays");
assert.match(recipesPanel, /Safe Generic fixes/, "the Tier-0 heading stays");
assert.match(recipesPanel, /<input id="fixSearch" type="search" name="fixSearch"/, "the search input has a name (a11y / form rule)");

// ── Redirects: old-style anchor routes land in the Recipes tab. ──
assert.match(renderer, /"fix-it":\s*\{\s*tab:\s*"recipes",\s*anchor:\s*"fix-it"/, "Fix It redirects to recipes#fix-it");
assert.match(renderer, /"fix-history":\s*\{\s*tab:\s*"recipes",\s*anchor:\s*"fix-history"/, "Fix History redirects to recipes#fix-history");

// ── Fix It browser: search + family filter over BOTH lists; the card keeps walk · resolve · dry-run. ──
assert.match(renderer, /function wireResolutionControls\(\)/, "Resolution controls are wired");
assert.match(renderer, /wireResolutionControls\(\);/, "…from wireActions");
assert.match(renderer, /function renderFixBrowser\(\)/, "Fix browser renderer exists");
assert.match(renderer, /function populateFixCategoryFilter\(\)/, "Fix family dropdown is populated from loaded fixes");
assert.match(renderer, /function fixMatchesSearch\(item, category\)/, "search + family predicate exists");
assert.match(renderer, /function renderRecipes\(recipes\) \{[\s\S]*?recipeCatalogCache = Array\.isArray\(recipes\) \? recipes : \[\];[\s\S]*?renderFixBrowser\(\);/, "renderRecipes feeds the browser (no filter = every recipe)");
assert.match(renderer, /data-walk-recipe=/, "card keeps Walk me through it");
assert.match(renderer, /data-resolve-fix=/, "card keeps Resolve it for me (the gated pipeline)");
assert.match(renderer, /data-recipe-run=/, "card keeps Dry-run");
assert.match(renderer, /qsa\("\[data-resolve-fix\]"\)\.forEach\(\(button\) => bindResolveFix\(button\)\)/, "Resolve it for me still binds to the gated resolve flow");
assert.match(renderer, /sentinel\.runRecipe\(id, \{ dryRun: true \}\)/, "Dry-run still asks for a preview only");
assert.match(renderer, /tier0Cache = Array\.isArray\(list\) \? list : \[\];/, "Tier-0 list is cached for the filter");
assert.match(renderer, /if \(tier0Loaded\) \{ renderFixBrowser\(\); return; \}/, "re-opening the tab re-renders through the filter, never a second fetch");

// ── Fix History: REAL rows only (detections + audit), 30 days, ≤50, 10/page, ≤5 pages, newest first. ──
assert.match(renderer, /function buildFixHistory\(next = state, now = Date\.now\(\)\)/, "Fix history is built from current state");
assert.match(renderer, /function renderFixHistory\(next = state\)/, "Fix history renderer exists");
assert.match(renderer, /renderFixHistory\(state\); \/\/ JULY PORT/, "every state push refreshes the history");
assert.match(renderer, /const FIX_HISTORY_DAYS = 30;/, "history window is 30 days");
assert.match(renderer, /const FIX_HISTORY_MAX = 50;/, "history cap is 50 events");
assert.match(renderer, /const FIX_HISTORY_PAGE_SIZE = 10;/, "history page size is 10");
assert.match(renderer, /\.slice\(0, FIX_HISTORY_MAX\)/, "history result is capped");
assert.match(renderer, /Math\.min\(5, Math\.ceil\(rows\.length \/ FIX_HISTORY_PAGE_SIZE\)\)/, "history is limited to 5 pages");
assert.match(renderer, /\.sort\(\(a, b\) => b\.sort - a\.sort\)/, "newest first");
assert.match(renderer, /next\?\.detections/, "Fix history includes detections");
assert.match(renderer, /next\?\.transparencyLog/, "Fix history includes audit/transparency events");
assert.match(renderer, /No troubleshooting history in the last \$\{FIX_HISTORY_DAYS\} days\./, "real-or-empty: an honest empty sentence, never a sample row");
const historyBlock = renderer.slice(renderer.indexOf("function parseHistoryTime"), renderer.indexOf("function fixHistoryCardHtml"));
assert.doesNotMatch(historyBlock, /sample|placeholder|fake|example row/i, "no fabricated history");

for (const cls of [".fix-toolbar", ".fix-section-title", ".fix-history-list", ".fix-history-card", ".fix-history-pagination", ".fix-empty"]) {
  assert.match(css, new RegExp(cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `CSS includes ${cls}`);
}

console.log("Resolution tab test passed (Fix It search/dropdown + 30-day paginated Fix History, as sub-anchors of the Recipes tab · Rule 15 names kept).");
