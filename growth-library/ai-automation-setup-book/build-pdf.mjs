// Build the DIY book PDF: Markdown → IIS-branded HTML → PDF (headless Edge --print-to-pdf).
// Run: node build-pdf.mjs   (then Edge is invoked by the caller / or --render for HTML only)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const mdPath = path.join(dir, "AI-Automation-Setup-Guide.md");
const htmlPath = path.join(dir, "AI-Automation-Setup-Guide.html");
const md = fs.readFileSync(mdPath, "utf8");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Inline: escape first, then apply links/bold/italic/code on the escaped text.
function inline(s) {
  let t = esc(s);
  t = t.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return t;
}

const lines = md.split(/\r?\n/);
const out = [];
let i = 0;
let listType = null; // 'ul' | 'ol'
const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

while (i < lines.length) {
  const line = lines[i];
  const raw = line.trimEnd();

  if (/^\s*$/.test(raw)) { closeList(); i++; continue; }

  // Screenshot placeholder → styled callout box.
  const shot = raw.match(/^\[SCREENSHOT:\s*(.+?)\]\s*$/i);
  if (shot) { closeList(); out.push(`<div class="shot"><span class="shot-tag">Screenshot</span><span class="shot-desc">${inline(shot[1])}</span></div>`); i++; continue; }

  if (/^---+\s*$/.test(raw)) { closeList(); out.push('<hr>'); i++; continue; }

  const h = raw.match(/^(#{1,6})\s+(.*)$/);
  if (h) { closeList(); const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i++; continue; }

  if (/^>\s?/.test(raw)) {
    closeList();
    const buf = [];
    while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
    out.push(`<blockquote>${buf.map((b) => (b.trim() ? `<p>${inline(b)}</p>` : "")).join("")}</blockquote>`);
    continue;
  }

  const ol = raw.match(/^\s*\d+\.\s+(.*)$/);
  if (ol) { if (listType !== "ol") { closeList(); out.push('<ol>'); listType = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); i++; continue; }

  const ul = raw.match(/^\s*[-*]\s+(.*)$/);
  if (ul) { if (listType !== "ul") { closeList(); out.push('<ul>'); listType = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); i++; continue; }

  closeList();
  out.push(`<p>${inline(raw)}</p>`);
  i++;
}
closeList();

const body = out.join("\n");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>AI Automation Setup — The Business Owner's Step-by-Step Guide</title>
<style>
  @page { size: Letter; margin: 22mm 20mm; }
  :root{ --navy:#0b1220; --ink:#1a2230; --gold:#c5a059; --gold-d:#9c7b3a; --muted:#5b6472; --line:#e4dcc9; }
  *{ box-sizing:border-box; }
  body{ font-family:"Georgia","Times New Roman",serif; color:var(--ink); line-height:1.62; font-size:11.5pt; margin:0; }
  h1{ font-family:"Trebuchet MS",Arial,sans-serif; color:var(--navy); font-size:26pt; line-height:1.12; margin:0 0 6pt; letter-spacing:.2px; }
  h2{ font-family:"Trebuchet MS",Arial,sans-serif; color:var(--navy); font-size:17pt; margin:22pt 0 6pt; padding-bottom:4pt; border-bottom:2px solid var(--gold); page-break-after:avoid; }
  h3{ font-family:"Trebuchet MS",Arial,sans-serif; color:var(--gold-d); font-size:12.5pt; margin:14pt 0 4pt; page-break-after:avoid; }
  h4{ font-family:"Trebuchet MS",Arial,sans-serif; color:var(--ink); font-size:11.5pt; margin:12pt 0 3pt; }
  p{ margin:0 0 8pt; }
  a{ color:var(--gold-d); text-decoration:none; border-bottom:1px solid rgba(156,123,58,.4); }
  strong{ color:var(--navy); }
  ul,ol{ margin:0 0 9pt; padding-left:20pt; }
  li{ margin:0 0 3pt; }
  code{ font-family:"Consolas","Courier New",monospace; background:#f4f0e6; border:1px solid var(--line); border-radius:3px; padding:0 3px; font-size:10pt; }
  hr{ border:0; border-top:1px solid var(--line); margin:16pt 0; }
  blockquote{ margin:12pt 0; padding:10pt 14pt; background:linear-gradient(180deg,#faf7ef,#f6f1e4); border-left:3px solid var(--gold); border-radius:4px; }
  blockquote p{ margin:0 0 5pt; } blockquote p:last-child{ margin:0; }
  .shot{ margin:11pt 0; padding:12pt 14pt; border:1px dashed var(--gold); border-radius:6px; background:#fbfaf5; display:flex; gap:10pt; align-items:baseline; page-break-inside:avoid; }
  .shot-tag{ font-family:"Trebuchet MS",Arial,sans-serif; font-size:8pt; letter-spacing:1.4px; text-transform:uppercase; color:var(--gold-d); border:1px solid var(--gold); border-radius:3px; padding:1px 6px; white-space:nowrap; }
  .shot-desc{ color:var(--muted); font-style:italic; font-size:10.5pt; }
  /* Cover treatment: the first h1 + the two rules around the intro. */
  h1:first-of-type{ margin-top:8pt; }
  .cover-rule{ height:3px; background:linear-gradient(90deg,var(--gold),transparent); border:0; margin:10pt 0 16pt; }
</style></head>
<body>
${body}
</body></html>`;

fs.writeFileSync(htmlPath, html, "utf8");
console.log("wrote HTML:", htmlPath, `(${html.length} bytes)`);
