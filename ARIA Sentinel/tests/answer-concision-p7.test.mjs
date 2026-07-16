// P7 (2026-07-14) — answer concision. The chat LEADS with the plain-language explanation + the fix steps (Rule 17
// value-first) and tucks the supporting sections (verify / escalate / prevent) behind a "More help" toggle — losing
// nothing (F2-safe). Proves the shared splitter + that the renderer renders the lead and a collapsible remainder.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { shapeKbAnswerForEndUser, splitShapedAnswer } from "../src/shared/kb-answer-shape.mjs";

const root = path.resolve(import.meta.dirname, "..");
const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
let n = 0; const t = () => { n++; };

// A representative KB article (the shaper strips internal/keyword sections; ordering + labels are what we split on).
const article = [
  "# Printer shows offline",
  "## 9. User-Friendly Explanation",
  "Your PC still thinks the printer is busy from an earlier job.",
  "## 5. Resolution Steps",
  "1. Restart the Print Spooler service.\n2. Send a test page.",
  "## 6. Verification Steps",
  "Confirm the test page prints.",
  "## 7. Escalation Trigger",
  "If it still won't print, contact IT.",
  "## 8. Prevention Tips",
  "Keep the printer firmware current.",
  "## 10. Internal Technician Notes",
  "spooler CLI + registry keys (internal only).",
  "## 12. Keywords / Search Tags",
  "printer, offline, spooler"
].join("\n");

const shaped = shapeKbAnswerForEndUser(article);

// 1 — the shaped answer LEADS with the explanation + the fix steps, and never leaks internal/keyword content.
assert.match(shaped, /still thinks the printer is busy/, "leads with the plain-language explanation");
assert.match(shaped, /\*\*What to do\*\*/, "includes the fix steps under 'What to do'");
assert.doesNotMatch(shaped, /Internal Technician Notes|Keywords|registry keys/, "never leaks internal/keyword sections");
t();

// 2 — the splitter puts explanation + fix in `lead`, and verify/escalate/prevent in `more` (nothing lost).
const { lead, more } = splitShapedAnswer(shaped);
assert.match(lead, /still thinks the printer is busy/, "lead has the explanation");
assert.match(lead, /\*\*What to do\*\*/, "lead has the fix steps");
assert.doesNotMatch(lead, /Confirm it's fixed|If that doesn't resolve it|Prevent it next time/, "lead is concise — supporting sections are NOT in the lead");
assert.match(more, /Confirm it's fixed/, "more carries the verification section");
assert.match(more, /If that doesn't resolve it/, "more carries the escalation section");
assert.match(more, /Prevent it next time/, "more carries the prevention section");
// F2-safe: lead + more together preserve every kept section (nothing truncated away).
assert.match(more, /contact IT/, "escalation content preserved (F2-safe, not dropped)");
t();

// 3 — an answer WITHOUT the supporting markers (offline/learned chunk) returns all as lead, empty more (no toggle).
const plain = splitShapedAnswer("Just restart the app and try again.");
assert.equal(plain.lead, "Just restart the app and try again.", "plain answer stays whole in the lead");
assert.equal(plain.more, "", "no supporting markers → no 'more' → no empty toggle");
t();

// 4 — the renderer leads with the split lead and renders the remainder inside a collapsible <details> toggle.
assert.match(renderer, /const \{ lead, more \} = splitShapedAnswer\(full\)/, "renderer splits the shaped answer");
assert.match(renderer, /renderMarkdown\(lead \|\| full\)/, "renderer leads with the concise lead");
assert.match(renderer, /details"\); det\.className = "aria-chat-more"/, "the remainder is a collapsible 'more help' toggle");
t();

assert.equal(n, 4, "4 answer-concision-p7 groups");
console.log(`answer-concision-p7 test passed (${n} groups · leads with explanation + fix · verify/escalate/prevent behind a toggle · nothing lost (F2-safe) · plain answers stay whole · renderer wiring).`);
