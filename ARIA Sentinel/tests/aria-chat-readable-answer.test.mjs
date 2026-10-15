// JULY PORT 2026-10-14 (from cd518cea) — desktop ARIA chat KB answers read like the web ARIA answer cards.
// ADAPTED: the production line already leads with the P7 concise lead + "More help" drawer, so the July card is a
// FRAME around that content (kicker · article title · question · gate note · "Show KB detail" drawer); the extracted
// "safest first checks" render only when the lead has no list of its own — never a duplicate of the lead's steps.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

assert.match(renderer, /function shapeReadableAriaAnswer\(rawText, res, question\)/, "KB answers are shaped before display");
assert.match(renderer, /function renderReadableAriaAnswer\(model, \{ contentNodes = \[\], showSteps = true \} = \{\}\)/, "guided answer renderer frames the existing content");
assert.match(renderer, /Knowledge-base match/, "answer card has clear source label");
assert.match(renderer, /Start with the safest checks below/, "answer card gives simple instruction");
assert.match(renderer, /Show KB detail/, "raw KB detail is collapsed behind a drawer");
assert.match(renderer, /Sentinel never applies a fix from chat without the normal approval gates/, "local action safety copy present");
assert.match(renderer, /const readable = shapeReadableAriaAnswer\(full, res, question\);/, "fill() shapes the KB answer");
assert.match(renderer, /showSteps: !\/<li>\/i\.test\(answer\.innerHTML\)/, "extracted steps only when the P7 lead has no list (no duplicate steps)");
assert.match(renderer, /contentNodes: \[answer, moreDrawer\]/, "the P7 lead + More-help drawer stay inside the card");
// The P7 contract is untouched (the card wraps it, never replaces it).
assert.match(renderer, /const \{ lead, more \} = splitShapedAnswer\(full\)/, "P7 split still runs");
assert.match(renderer, /renderMarkdown\(lead \|\| full\)/, "P7 lead still rendered");
// A non-KB answer renders exactly as before (no card).
assert.match(renderer, /else \{ bubble\.appendChild\(answer\); if \(moreDrawer\) bubble\.appendChild\(moreDrawer\); \}/, "non-KB answers are unchanged");
// The shaper is pure: it only returns a model for a real kb-match (real-or-empty — never invents a KB match).
assert.match(renderer, /if \(!kb \|\| res\?\.action !== "kb-match"\) return null;/, "no card without a real KB match");

assert.match(css, /\.aria-answer-card/, "answer card styling exists");
assert.match(css, /\.aria-answer-steps/, "steps are styled");
assert.match(css, /\.aria-answer-details summary/, "KB detail drawer is styled");
assert.match(css, /\.aria-chat-row\.aria \{ max-width:min\(700px,96%\); \}/, "ARIA answers get enough width for readable steps");

console.log("aria-chat-readable-answer passed (KB match → readable card frame around the P7 lead · steps only for raw blobs · non-KB answers unchanged).");
