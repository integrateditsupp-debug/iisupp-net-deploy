// RUN 19 §2 — sidebar layout: brand centered, the mode/watching status moved to a top-bar pill, and
// two live <aria-globe> instances (header 56px, footer 120px).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const css = read("src", "renderer", "sentinel.css");
const rendererJs = read("src", "renderer", "renderer.js");

// Two globe instances render in the rail.
const globes = indexHtml.match(/<aria-globe[^>]*>/g) || [];
assert.equal(globes.length, 2, "exactly two rail globes");
assert.match(indexHtml, /<aria-globe class="brand-globe" size="56">/, "header globe at 56px");
assert.match(indexHtml, /<aria-globe class="aria-living-globe" size="120">/, "footer globe at 120px");

// Brand name centered: the .settings-brand stacks vertically + centers.
const brandRule = css.match(/\.settings-brand\s*\{[^}]*flex-direction:\s*column[^}]*\}/);
assert.ok(brandRule, ".settings-brand is a centered column");
assert.match(brandRule[0], /align-items:\s*center/, "brand items centered");
assert.match(css, /\.settings-brand \.brand-name\s*\{[^}]*text-align:\s*center/, "brand name text centered");

// The brand block no longer carries the live mode/watching status (it moved to the top bar).
const brandBlock = indexHtml.match(/<div class="settings-brand">[\s\S]*?<\/div>\s*<nav/);
assert.ok(brandBlock, "settings-brand block found");
assert.doesNotMatch(brandBlock[0], /id="railStatus"/, "status pill is NOT in the brand area");
assert.equal(brandBlock[0].includes("Autonomous mode"), false, "no live mode status text in brand");

// The status pill lives in the top bar's status-stack and renderer keeps it updated.
const topbar = indexHtml.match(/<div class="status-stack">[\s\S]*?<\/div>/);
assert.ok(topbar && /id="railStatus"\s+class="chip mode-pill"/.test(topbar[0]), "mode pill in the top-bar status stack");
assert.match(rendererJs, /setText\("railStatus"/, "renderer updates the mode pill");
assert.match(css, /\.chip\.mode-pill/, "mode pill has discreet pill styling");

console.log("Sidebar-layout test passed (brand centered · mode pill in top bar · 2 live globes 56/120).");
