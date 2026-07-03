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

/**
 * True when a KB excerpt was cut mid-token by an upstream exporter/server, i.e. it ends with an artifact that
 * would render as a dangling fragment: an unterminated inline-code span (odd number of backticks on the last
 * content line), a trailing "(" / "(`", or the explicit truncation marker.
 */
export function looksTruncated(text) {
  const s = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
  if (!s.trim()) return false;
  if (/\[truncated/i.test(s)) return true;                          // explicit "…[truncated — see …]" marker
  const trimmed = s.replace(/\s+$/, "");
  if (/\(\s*`?\s*$/.test(trimmed)) return true;                     // dangling "(" or "(`"
  const lastLine = trimmed.split("\n").pop() || "";
  if ((lastLine.match(/`/g) || []).length % 2 === 1) return true;   // unterminated inline code on the last line
  return false;
}

/**
 * Belt-and-suspenders repair for when NO full article is available: strip the incomplete trailing fragment so
 * the chat never renders a dangling "Print server (`". Drops (1) a trailing "…[truncated …]" marker, (2) any
 * final line that leaves an unterminated code span or a dangling "(", and (3) a now-empty trailing heading
 * (e.g. a bare "## 7. Escalation Trigger" whose only bullet was the truncated fragment). Never adds text.
 */
export function repairTruncatedTail(text) {
  let s = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
  s = s.replace(/\n?\s*…?\s*\[truncated[^\]]*\]\s*$/i, "");
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
  return lines.join("\n").trimEnd();
}
