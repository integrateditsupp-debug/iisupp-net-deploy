// F2 RECURRENCE (2026-07-03) — the printer "Escalation Trigger" section STILL rendered as a dangling
// "- Print server (`" at 51d389c9, even though kb-fulltext.test proved the detector/repair/swap. Root cause:
// aria-brain-client.mjs appends a footer AFTER the KB body — `reply = content_excerpt + "\n\n→ Full article: <url>"`.
// So when the live excerpt is cut mid-line, the dangling "(`" is no longer at the END of `reply` (the URL footer
// is), and the OLD looksTruncated — which only inspected the last line — returned FALSE. No detection → no
// full-text swap → the broken code span reached the renderer. This suite locks the WITH-FOOTER contract so the
// recurrence can't come back silently: any KB answer whose body was cut (dangling "(", unterminated `code`, or a
// "[truncated]" marker) is detected EVEN behind the read-more footer, and either the bundled full article is
// swapped in (printer) or the tail is repaired while KEEPING the footer link.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { looksTruncated, repairTruncatedTail, stripAnswerFooter, loadFullText, fullArticle } from "../src/shared/kb-fulltext.mjs";
import { renderMarkdown } from "../src/shared/aria-markdown.mjs";

let n = 0; const t = () => { n++; };

const FOOTER = "\n\n→ Full article: https://iisupp.net/aria?article=l1-printer-001-not-printing";
// The reply the DESKTOP actually receives: a mid-line-cut body + the client's read-more footer (the shape that
// slipped past the old detector). CRLF like the live endpoint.
const CUT_BODY = "## 6. Verify\r\n- Test print succeeds.\r\n- Queue empty after job completes.\r\n\r\n## 7. Escalation Trigger\r\n- Print server (`";
const REPLY_WITH_FOOTER = CUT_BODY + FOOTER.replace(/\n/g, "\r\n");

// 1 — the CORE regression: truncation is detected even with the footer appended after the cut (this is what failed).
assert.equal(looksTruncated(REPLY_WITH_FOOTER), true, "dangling '(`' behind the '→ Full article:' footer IS detected");
assert.equal(looksTruncated(CUT_BODY), true, "…and still detected without a footer");
// an explicit truncation marker sitting before the footer is caught too.
assert.equal(looksTruncated("Body cut here\n…[truncated — see iisupp.net/aria]" + FOOTER), true, "marker + footer detected");
// unterminated inline code before the footer (not just a dangling paren) is caught.
assert.equal(looksTruncated("Run `net stop spooler" + FOOTER), true, "unterminated `code` behind the footer detected");
t();

// 2 — a COMPLETE answer that legitimately carries a footer (and inline code) is NOT a false positive.
const COMPLETE = "- Restart the `Spooler` service.\n- Print server (`\\\\printserver`) unreachable → escalate." + FOOTER;
assert.equal(looksTruncated(COMPLETE), false, "a complete body with a real footer is NOT flagged");
assert.equal(looksTruncated("All resolved. Queue is empty." + FOOTER), false, "plain complete body + footer not flagged");
t();

// 3 — stripAnswerFooter removes only the footer/marker/blank tail, never real content.
assert.equal(stripAnswerFooter("real body line" + FOOTER), "real body line", "footer + blanks stripped, body kept");
assert.equal(stripAnswerFooter("no footer here"), "no footer here", "no footer → unchanged");
t();

// 4 — FALLBACK repair (article NOT bundled): the dangling fragment is dropped, the orphan heading goes, and the
//     read-more footer SURVIVES the repair so the customer can still click through.
const repaired = repairTruncatedTail(REPLY_WITH_FOOTER);
assert.ok(!/Print server \(/.test(repaired), "dangling 'Print server (' removed");
assert.ok(!/Escalation Trigger/.test(repaired), "now-orphaned '7. Escalation Trigger' heading dropped");
assert.match(repaired, /Queue empty after job completes\./, "complete content above the cut preserved");
assert.match(repaired, /→ Full article: https:\/\/iisupp\.net/, "the read-more footer link is kept after repair");
// the repaired answer renders with no dangling code span (balanced backticks in the source).
const repairedHtml = renderMarkdown(repaired);
assert.ok(!repairedHtml.includes("Print server ("), "no dangling fragment in the fallback render");
t();

// 5 — END-TO-END (bundled path, mirrors main.chat): truncated reply → looksTruncated → swap in the full article →
//     the WHOLE "Escalation Trigger" section renders, with a CLOSED <code> span and the text after "(".
const packDir = path.resolve(import.meta.dirname, "..", "aria-kb-pack");
const idx = loadFullText(packDir, fs);
const full = fullArticle(idx, "l1-printer-001-not-printing");
assert.ok(full, "printer article bundled");
const chosen = looksTruncated(REPLY_WITH_FOOTER) ? full : REPLY_WITH_FOOTER;   // main swaps in `full` when truncated
const html = renderMarkdown(chosen);
assert.match(html, /<li>Print server \(<code>\\\\printserver<\/code>\) unreachable\.<\/li>/, "full line renders — code span CLOSED, no cut at '('");
assert.match(html, /Driver install requires admin/, "the rest of section 7 renders (not truncated)");
// no unclosed <code> in the final HTML (balanced open/close).
assert.equal((html.match(/<code>/g) || []).length, (html.match(/<\/code>/g) || []).length, "every <code> is closed in the rendered answer");
t();

// 6 — CLASS invariant: no bundled article, when passed through the client-footer path, ever looks truncated
//     (guards the whole KB pack against a source article that ends on an open code span / dangling '(').
let bad = 0; const offenders = [];
for (const [slug, body] of idx) {
  if (looksTruncated(body + FOOTER)) { bad++; if (offenders.length < 5) offenders.push(slug); }
}
assert.equal(bad, 0, `no bundled article looks truncated behind the footer (offenders: ${offenders.join(", ")})`);
t();

assert.equal(n, 6, "6 truncation-recurrence groups");
console.log(`kb-answer-truncation (F2 recurrence) passed (${n} groups · footer-aware detect/repair/swap · printer "Escalation Trigger" renders in full with a closed code span · ${idx.size} articles, 0 truncated behind footer).`);
