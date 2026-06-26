// W5 Slice 3 — System Inventory UI cleanup. The flat installed-software dump is now grouped into
// Apps / Drivers / Security updates: collapsible <details>, a live count per group, filtered by the one
// search box, with a clean empty state (no blank dead panel) and no raw inline-styled headings. Source-
// level assertions (same style as the other renderer tests). 🔒 R11 — read-only inventory path unchanged.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// ── 1 — three inventory categories defined, sourced from the real ctx fields ──
const groups = renderer.slice(renderer.indexOf("const INVENTORY_GROUPS"), renderer.indexOf("function renderSystemContextApps"));
for (const [key, label, src] of [["apps", "Apps", "c.apps"], ["drivers", "Drivers", "c.drivers"], ["updates", "Security updates", "c.recentUpdates"]]) {
  assert.match(groups, new RegExp(`key:\\s*"${key}"`), `group ${key} defined`);
  assert.match(groups, new RegExp(`label:\\s*"${label}"`), `group label ${label}`);
  assert.match(groups, new RegExp(src.replace(".", "\\.")), `${key} sourced from ${src}`);
}
ok("three categories defined (Apps / Drivers / Security updates) from real ctx fields");

// ── 2 — collapsible <details> with a per-group count, filter-aware ──
const fn = renderer.slice(renderer.indexOf("function renderSystemContextApps"), renderer.indexOf("async function loadBlueprints"));
assert.match(fn, /<details class="inv-group"/, "renders collapsible <details> groups");
assert.match(fn, /class="inv-count">\$\{matched\.length\}/, "shows a per-group count");
assert.match(fn, /\(filter\)/, "takes a filter argument");
assert.match(fn, /inv-empty/, "renders a clean empty state, not a blank panel");
assert.match(fn, /slice\(0,\s*300\)/, "caps rendered rows");
ok("collapsible groups with counts + filter + clean empty state");

// ── 3 — the single search box drives the grouped render (no second filter UI) ──
assert.match(renderer, /#systemContextSearch[\s\S]{0,160}renderSystemContextApps\(/, "search input filters the grouped inventory");
assert.match(indexHtml, /id="systemContextSearch"/, "search box present");
ok("one search box filters all groups");

// ── 4 — markup cleanup: grouped container, no raw inline-styled heading ──
const systemPanel = indexHtml.slice(indexHtml.indexOf('id="system"'), indexHtml.indexOf('id="servicenow"'));
assert.match(systemPanel, /id="systemContextApps" class="inventory-groups"/, "apps host is the grouped container");
assert.doesNotMatch(systemPanel, /<h3 style=/, "no raw inline-styled <h3> heading remains");
ok("grouped container + no raw inline-styled headings in the System panel");

// ── 5 — styling exists + black/gold theme kept ──
for (const sel of [".inventory-groups", ".inv-group", ".inv-count", ".inv-body", ".inv-empty"]) {
  assert.match(css, new RegExp(sel.replace(".", "\\.")), `style ${sel} present`);
}
assert.match(css, /\.inv-group\[open\]\s*>\s*summary::before/, "open/closed disclosure marker styled");
assert.match(css, /--aria-gold/, "keeps the gold theme tokens");
ok("inventory group styling present + gold theme kept");

// ── 6 — R11: the read-only inventory enumerator is untouched (no writes, guard still wired) ──
assert.match(read("src", "main", "system-context.mjs"), /path-guard\.mjs/, "R11 guard still wired into the inventory path");
ok("R11 read-only inventory path unchanged");

assert.equal(tests, 6, "system-inventory-grouping runs exactly 6 test cases");
console.log(`System-inventory-grouping test passed (${tests}/6 · Apps/Drivers/Security updates · collapsible + counted + filtered · no blank panel).`);
