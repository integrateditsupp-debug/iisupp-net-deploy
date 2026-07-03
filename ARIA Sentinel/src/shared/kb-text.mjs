// kb-text — F2 (2026-07-03). PURE string helpers for KB-answer hygiene. NO node builtins, NO bare imports:
// this module is reachable from the browser renderer graph (renderer.js → here), and under the strict CSP a
// single `node:*`/bare specifier anywhere in that graph silently bricks the whole window (see the dead-shell
// regression guard, renderer-import-graph.test.mjs). Keep it dependency-free and browser-safe.
//
// Why it exists: the LIVE aria-kb-query endpoint can return a chunk that the exporter cut MID-LINE — e.g. the
// printer "Escalation Trigger" section arrives as a dangling "- Print server (`" with an unterminated inline
// code span and an open paren. Rendering that raw shows customers a broken "Print server (". These helpers
// (a) DETECT that truncation and (b) REPAIR the tail (drop the incomplete fragment) so the chat never surfaces
// a dangling token. They NEVER fabricate missing text — when the full article is available (bundled), main
// swaps in the complete content instead; when it isn't, we degrade to a clean cut + the "read full article" card.

/** Strip a leading YAML frontmatter block (`---\n…\n---\n`), tolerant of BOM + CRLF. Returns the body. */
export function stripFrontmatter(s) {
  const str = String(s == null ? "" : s);
  const m = str.match(/^﻿?\s*---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n([\s\S]*)$/);
  return (m ? m[1] : str).trim();
}

// A single answer-footer line the client appends after the KB body: the read-more link ("→ Full article: <url>")
// and/or the explicit truncation marker ("…[truncated — see …]"). We must look PAST these when judging the tail —
// otherwise a body cut mid-line at "- Print server (`" hides behind a trailing footer and reads as "complete".
function isFooterLine(line) {
  const t = String(line == null ? "" : line).trim();
  return t === "" || /^→?\s*Full article:/i.test(t) || /^…?\s*\[truncated[^\]]*\]$/i.test(t);
}

/** Drop a trailing footer block (read-more link / truncation marker / blank lines) so tail checks see the real body. */
export function stripAnswerFooter(text) {
  const lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && isFooterLine(lines[lines.length - 1])) lines.pop();
  return lines.join("\n");
}

/**
 * True when a KB excerpt was cut mid-token by an upstream exporter/server, i.e. its BODY ends with an artifact
 * that would render as a dangling fragment: an unterminated inline-code span (odd number of backticks on the last
 * content line), a trailing "(" / "(`", or the explicit truncation marker. The client appends a "→ Full article:"
 * footer after the body (aria-brain-client.mjs), so we judge the tail AFTER stripping that footer — a mid-line cut
 * followed by the footer used to slip through the last-line check and render as a broken "Print server (`".
 */
export function looksTruncated(text) {
  const s = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
  if (!s.trim()) return false;
  if (/\[truncated/i.test(s)) return true;                          // explicit "…[truncated — see …]" marker (anywhere)
  const body = stripAnswerFooter(s);                                // ignore the trailing read-more footer the client adds
  const trimmed = body.replace(/\s+$/, "");
  if (/\(\s*`?\s*$/.test(trimmed)) return true;                     // dangling "(" or "(`"
  const lastLine = trimmed.split("\n").pop() || "";
  if ((lastLine.match(/`/g) || []).length % 2 === 1) return true;   // unterminated inline code on the last body line
  return false;
}

/**
 * Belt-and-suspenders repair for when NO full article is available: strip the incomplete trailing fragment so
 * the chat never renders a dangling "Print server (`". Drops (1) a trailing "…[truncated …]" marker, (2) any
 * final line that leaves an unterminated code span or a dangling "(", and (3) a now-empty trailing heading
 * (e.g. a bare "## 7. Escalation Trigger" whose only bullet was the truncated fragment). Never adds text.
 */
export function repairTruncatedTail(text) {
  const raw = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
  // Separate a trailing footer block ("→ Full article: …" + blank lines) so we repair the real BODY, then
  // re-attach the read-more link — otherwise the footer blocks the tail scan and the dangling token survives.
  const body = stripAnswerFooter(raw);
  const footerLink = raw.slice(body.length).split("\n").map((l) => l.trim()).find((l) => /^→?\s*Full article:/i.test(l)) || "";
  let s = body.replace(/\n?\s*…?\s*\[truncated[^\]]*\]\s*$/i, "");
  const lines = s.split("\n");
  while (lines.length) {
    const last = (lines[lines.length - 1] || "").trimEnd();
    const unterminatedCode = (last.match(/`/g) || []).length % 2 === 1;
    const danglingParen = /\(\s*`?\s*$/.test(last);
    const emptyBullet = /^\s*[-*+]\s*$/.test(last);
    if (!unterminatedCode && !danglingParen && !emptyBullet) break;
    lines.pop();
  }
  while (lines.length && /^\s*#{1,6}\s+\S/.test(lines[lines.length - 1])) lines.pop(); // drop a now-orphaned heading
  const repaired = lines.join("\n").trimEnd();
  return footerLink ? `${repaired}\n\n${footerLink}` : repaired;   // keep the "read full article" link after the repair
}
