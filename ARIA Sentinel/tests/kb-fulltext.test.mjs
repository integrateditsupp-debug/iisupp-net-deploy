// F2 (2026-07-03) — the KB chat answer for the printer article truncated the "7. Escalation Trigger" section:
// it rendered "- Print server (`" and cut off at the stray "(". Root cause: the LIVE aria-kb-query endpoint
// serves a chunk the exporter cut MID-LINE (the deployed web bundle lags the fixed one). The desktop agent
// depends on that endpoint, so no client render change can invent the missing text. Fix: bundle the FULL
// article text in the .exe (aria-kb-pack/kb-fulltext.json) and, when the live excerpt `looksTruncated`, swap in
// the complete content; when we don't carry the article, strip the incomplete trailing fragment so a dangling
// token is never shown. This suite proves the detector, the repair, the bundled full text, and end-to-end that
// the full "Escalation Trigger" section renders — including the "(`\\printserver`)" that used to get cut.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { looksTruncated, repairTruncatedTail, loadFullText, fullArticle, stripFrontmatter } from "../src/shared/kb-fulltext.mjs";
import { renderMarkdown } from "../src/shared/aria-markdown.mjs";

let n = 0; const t = () => { n++; };

// The EXACT shape the live endpoint returns today (captured 2026-07-03): CRLF, ending mid-line at "(`".
const LIVE_TRUNCATED = "## 6. Verify\r\n- Test print succeeds.\r\n- Queue empty after job completes.\r\n\r\n## 7. Escalation Trigger\r\n- Print server (`";
const FULL_SECTION7 = "## 7. Escalation Trigger\n- Print server (`\\\\printserver`) unreachable.\n- Driver install requires admin and user lacks rights.\n- Hardware error code from display.";

// 1 — looksTruncated flags the real live artifact + the explicit marker, and clears complete text.
assert.equal(looksTruncated(LIVE_TRUNCATED), true, "dangling '(`' is detected as truncated");
assert.equal(looksTruncated("Body\n…[truncated — see iisupp.net/aria for full article]"), true, "explicit truncation marker detected");
assert.equal(looksTruncated("- Print server (`\\\\printserver`) unreachable."), false, "a complete code span is NOT truncated");
assert.equal(looksTruncated(FULL_SECTION7), false, "the full section is NOT truncated");
assert.equal(looksTruncated(""), false, "empty is not truncated");
t();

// 2 — repairTruncatedTail drops the incomplete fragment AND the now-orphaned heading; never fabricates text.
const repaired = repairTruncatedTail(LIVE_TRUNCATED);
assert.ok(!/Print server \(`?\s*$/.test(repaired), "dangling '- Print server (`' is removed");
assert.ok(!/Escalation Trigger/.test(repaired), "the now-empty '7. Escalation Trigger' heading is dropped");
assert.match(repaired, /Queue empty after job completes\./, "complete content above the cut is preserved");
// a complete answer is returned unchanged.
assert.equal(repairTruncatedTail(FULL_SECTION7), FULL_SECTION7.trimEnd(), "complete text passes through unchanged");
// the explicit marker is stripped without eating real content.
assert.equal(repairTruncatedTail("All good.\n…[truncated — see iisupp.net/aria]"), "All good.", "marker stripped, body kept");
t();

// 3 — the bundled full-text pack loads and carries the COMPLETE printer article (the deploy-free source of truth).
const packDir = path.resolve(import.meta.dirname, "..", "aria-kb-pack");
const idx = loadFullText(packDir, fs);
assert.ok(idx.size > 100, `full-text pack has many articles (got ${idx.size})`);
const printer = fullArticle(idx, "l1-printer-001-not-printing");
assert.ok(printer, "printer article present in the bundled pack");
assert.match(printer, /## 7\. Escalation Trigger/, "printer article carries the Escalation Trigger section");
assert.match(printer, /Print server \(`\\\\printserver`\) unreachable\./, "…including the full line that used to be cut at '('");
assert.doesNotMatch(printer, /^---/, "frontmatter is stripped");
t();

// 4 — end-to-end: given the live-truncated excerpt, the bundled full article makes the FULL section render.
//     (mirrors main.chat: looksTruncated → fullArticle(slug) → renderMarkdown)
const chosen = looksTruncated(LIVE_TRUNCATED) ? printer : LIVE_TRUNCATED;
const html = renderMarkdown(chosen);
assert.match(html, /<h3 class="md-h">7\. Escalation Trigger<\/h3>/, "section 7 heading renders");
assert.match(html, /<li>Print server \(<code>\\\\printserver<\/code>\) unreachable\.<\/li>/, "the full parenthesized line renders — no cut at '('");
assert.ok(html.includes("unreachable."), "text after '(' is present in the rendered HTML");
t();

// 5 — fallback path (article NOT bundled): a truncated excerpt is repaired, then renders with no dangling token.
const htmlFallback = renderMarkdown(repairTruncatedTail(LIVE_TRUNCATED));
assert.doesNotMatch(htmlFallback, /Print server \(<code>?\s*<\/(li|code)>/, "no dangling 'Print server (' li in the fallback render");
assert.ok(!htmlFallback.includes("Print server ("), "the incomplete fragment is gone entirely");
assert.match(htmlFallback, /Queue empty after job completes/, "the complete part still renders");
t();

// 6 — WIRING: main.mjs actually performs the swap (guards against the logic being dropped in a refactor).
const mainSrc = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "main", "main.mjs"), "utf8");
assert.match(mainSrc, /import \{ loadFullText, fullArticle, looksTruncated, repairTruncatedTail \} from "\.\.\/shared\/kb-fulltext\.mjs"/, "main imports the F2 helpers");
assert.match(mainSrc, /if \(looksTruncated\(text\)\)/, "chat() checks for a truncated live excerpt");
assert.match(mainSrc, /fullArticle\(fullTextIndex\(\), slug\)/, "chat() swaps in the bundled full article by slug");
t();

// 7 — the same class across OTHER articles: no bundled article is itself truncated (unterminated code / dangling '(').
let bad = 0; const samples = [];
for (const [slug, body] of idx) { if (looksTruncated(body)) { bad++; if (samples.length < 5) samples.push(slug); } }
assert.equal(bad, 0, `no bundled article is truncated (offenders: ${samples.join(", ")})`);
t();

assert.equal(n, 7, "7 F2 test groups");
console.log(`kb-fulltext (F2) test passed (${n} groups · detect/repair/bundle/end-to-end · ${idx.size} full articles · 0 truncated · printer "Escalation Trigger" renders in full).`);
