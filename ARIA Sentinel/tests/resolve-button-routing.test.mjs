// P1 (the money test): "Resolve it for me" must NEVER dead-end at Control Center. On a matched answer it presents
// two clear paths — "Walk me through it" (Walk-through tab, guide mode, changes nothing) and "Resolve it for me"
// (gated apply for a vetted recipe). An UNVETTED recipe or NO match degrades to the Walk-through tab + an honest
// note — never Control Center, never a dead click. Structural proof over the renderer wiring.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const renderer = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "renderer", "renderer.js"), "utf8");
const slice = (from, to) => { const a = renderer.indexOf(from); const b = renderer.indexOf(to, a + 1); return renderer.slice(a, b); };
const chip = slice("function appendResolveChip(", "function appendConfidenceAndFeedback");
const cardFix = slice("function bindResolveFix(button)", "function cssEscape");
let n = 0; const t = () => { n++; };

// 1 — the chat answer presents BOTH paths.
assert.match(chip, /walkBtn\.textContent = "Walk me through it";/, "chat offers 'Walk me through it'");
assert.match(chip, /btn\.textContent = "Resolve it for me";/, "chat offers 'Resolve it for me'");
t();

// 2 — "Walk me through it" opens the Walk-through tab in guide mode (never a fix from here).
assert.match(chip, /walkBtn\.addEventListener\("click"[\s\S]*?activateTab\("walkthrough"\)[\s\S]*?renderWalkthrough/, "walk button → Walk-through tab (guide)");
t();

// 3 — NO match → Walk-through tab (guide/describe), and a matched VETTED recipe → the gated supervised fix.
assert.match(chip, /if \(!recipeId\) \{[\s\S]*?activateTab\("walkthrough"\)[\s\S]*?return;/, "no-match routes to Walk-through");
assert.match(chip, /isVettedRecipe/, "resolve checks vetted-ness before applying");
assert.match(chip, /supervisedFix\(\{ recipeId, mode: "confirmed" \}\)/, "vetted → gated confirmed apply");
t();

// 4 — an UNVETTED matched recipe degrades to the Walk-through tab + honest 'can't auto-apply yet' (not a fix).
assert.match(chip, /if \(!vetted\) \{[\s\S]*?can't safely auto-apply this one yet[\s\S]*?activateTab\("walkthrough"\)/, "unvetted → Walk-through + honest note");
t();

// 5 — THE ASSERTION: no resolve path ever routes to Control Center (the old dead end is gone).
assert.doesNotMatch(chip, /activateTab\("control-center"\)/, "chat resolve NEVER routes to Control Center");
assert.doesNotMatch(chip, /selfDiagnose/, "chat resolve no longer punts to the old diagnostics dead end");
t();

// 6 — the recipe-card "Resolve it for me" is gated the same way: unvetted → Walk-through, vetted → gated apply,
// and it too never routes to Control Center.
assert.match(cardFix, /isVettedRecipe/, "recipe card checks vetted-ness");
assert.match(cardFix, /if \(!vetted\) \{[\s\S]*?activateTab\("walkthrough"\)/, "recipe card unvetted → Walk-through");
assert.match(cardFix, /resolveViaSupervisor\(recipeId, risk/, "recipe card vetted → gated supervised fix");
assert.doesNotMatch(cardFix, /activateTab\("control-center"\)/, "recipe card resolve NEVER routes to Control Center");
t();

// 7 — the recipe card also exposes a direct "Walk me through it" affordance into the guided tab.
assert.match(renderer, /data-walk-recipe=/, "recipe card has a Walk-me-through control");
assert.match(renderer, /\[data-walk-recipe\][\s\S]*?activateTab\("walkthrough"\)/, "recipe walk control → Walk-through tab");
t();

assert.equal(n, 7, "7 resolve-button-routing groups");
console.log(`resolve-button-routing test passed (${n} groups · two paths on every answer · vetted→gated apply · unvetted/no-match→Walk-through · NEVER Control Center).`);
