// RUN 19 §6 — odd-number layout. With 5 cards the grid is 3-on-top + 2-centered-on-bottom (never an
// orphan card alone on a wrapped row). Implemented on a 6-col grid: each card spans 2; cards 4 & 5 are
// offset to columns 2-3 and 4-5 so the bottom row is centered.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const css = read("src", "renderer", "sentinel.css");
const indexHtml = read("src", "renderer", "index.html");

// 6-column grid, cards span 2.
assert.match(css, /\.plan-grid-5\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*1fr\)/, "6-column grid");
assert.match(css, /\.plan-grid-5\s*>\s*\.plan-card\s*\{[^}]*grid-column:\s*span 2/, "each card spans 2 columns");

// Bottom row centered: card 4 → cols 2-3, card 5 → cols 4-5.
assert.match(css, /\.plan-grid-5\s*>\s*\.plan-card:nth-child\(4\)\s*\{\s*grid-column:\s*2\s*\/\s*span 2/, "card 4 offset to center");
assert.match(css, /\.plan-grid-5\s*>\s*\.plan-card:nth-child\(5\)\s*\{\s*grid-column:\s*4\s*\/\s*span 2/, "card 5 offset to center");

// The grid carries exactly 5 cards (the case the layout balances).
const grid = indexHtml.match(/class="plan-grid plan-grid-5"[\s\S]*?<\/div>\s*<div class="trial-end-license"/);
assert.ok(grid, "plan-grid-5 block found");
const cards = grid[0].match(/class="plan-card"/g) || [];
assert.equal(cards.length, 5, "5 cards balanced as 3 + 2");

// A narrow viewport falls back to a clean 2-column grid (no orphan offsets).
assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.plan-grid-5\s*\{[^}]*repeat\(2,\s*1fr\)/, "responsive fallback to 2 columns");

console.log("Odd-grid test passed (5 cards = 3 top + 2 centered; 6-col span-2 grid; responsive fallback).");
