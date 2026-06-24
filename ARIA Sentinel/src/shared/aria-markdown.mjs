// RUN 34-1 — safe Markdown → HTML for the ARIA Chat sub-section. KB answers come back as Markdown (## H2,
// numbered steps, `code`, - bullets); rendering them as raw text shows customers walls of "## / - / \n\n".
// This turns them into real <h3>/<ol>/<ul>/<p>/<code>/<a>, matching the readable iisupp.net/aria experience.
//
// 🔒 Safety: the input is HTML-escaped FIRST, then a small, fixed set of Markdown constructs is re-introduced
// as known-safe tags. No raw HTML from the model is ever trusted. Links are restricted to http(s)/mailto.
// Pure + dependency-free (Node built-ins only) so it's unit-tested and identical in the renderer.

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// fmt: escape raw text FIRST (XSS-safe), then re-introduce inline marks as known-safe tags.
function fmt(raw) { return inline(esc(raw)); }

// inline: `code`, **bold**, *italic*, [text](url) — applied to already-escaped text.
function inline(text) {
  let s = text;
  s = s.replace(/`([^`]+?)`/g, (_m, c) => `<code>${c}</code>`);
  s = s.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_m, t, url) => `<a href="${url}" target="_blank" rel="noopener">${t}</a>`);
  s = s.replace(/\*\*([^*]+?)\*\*/g, (_m, b) => `<strong>${b}</strong>`);
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, (_m, pre, i) => `${pre}<em>${i}</em>`);
  s = s.replace(/(^|[^_\w])_([^_\n]+?)_(?![_\w])/g, (_m, pre, i) => `${pre}<em>${i}</em>`); // _italic_
  return s;
}

/**
 * Render a Markdown string to a safe HTML string. Supports: ATX headings (#..######→h3..h5), fenced code
 * blocks (``` ),  ordered + unordered lists, blockquotes, horizontal rules, and paragraphs with inline marks.
 */
export function renderMarkdown(md) {
  const lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n"); // RAW lines (escape per-content)
  const out = [];
  let i = 0;
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${fmt(para.join(" ")).trim()}</p>`); para = []; } };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block ```
    const fence = line.match(/^\s*```(\w+)?\s*$/);
    if (fence) {
      flushPara();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
      i++; // closing fence
      out.push(`<pre class="md-pre"><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    // heading
    const h = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) { flushPara(); const lvl = Math.min(5, Math.max(3, h[1].length + 1)); out.push(`<h${lvl} class="md-h">${fmt(h[2])}</h${lvl}>`); i++; continue; }

    // horizontal rule
    if (/^\s*([-*_])\s*\1\s*\1[\s\S]*$/.test(line) && /^[\s\-*_]+$/.test(line)) { flushPara(); out.push('<hr class="md-hr"/>'); i++; continue; }

    // ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; }
      out.push(`<ol class="md-ol">${items.map((it) => `<li>${fmt(it)}</li>`).join("")}</ol>`);
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; }
      out.push(`<ul class="md-ul">${items.map((it) => `<li>${fmt(it)}</li>`).join("")}</ul>`);
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      flushPara();
      const q = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push(`<blockquote class="md-quote">${fmt(q.join(" "))}</blockquote>`);
      continue;
    }

    // blank line → paragraph break
    if (/^\s*$/.test(line)) { flushPara(); i++; continue; }

    para.push(line.trim());
    i++;
  }
  flushPara();
  return out.join("\n");
}
