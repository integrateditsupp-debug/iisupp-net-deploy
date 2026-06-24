// RUN 34-1 — ARIA Chat markdown rendering. KB answers are Markdown; customers must see real H3/lists/code,
// not raw "## / - / 1." text. Proves the constructs render + that model output can never inject HTML (XSS).
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/shared/aria-markdown.mjs";

let n = 0; const t = () => { n++; };

// 1 — headings become real heading tags (## → h3, ### → h4 …, capped at h5).
let h = renderMarkdown("## Printer won't print\n### Quick checks");
assert.match(h, /<h3 class="md-h">Printer won't print<\/h3>/);
assert.match(h, /<h4 class="md-h">Quick checks<\/h4>/);
assert.doesNotMatch(h, /^##/m, "no raw ## survives");
t();

// 2 — numbered fix steps render as a real <ol> (the headline complaint).
const ol = renderMarkdown("1. Open Settings\n2. Click Printers\n3. Restart the spooler");
assert.match(ol, /<ol class="md-ol"><li>Open Settings<\/li><li>Click Printers<\/li><li>Restart the spooler<\/li><\/ol>/);
assert.doesNotMatch(ol, /1\. Open/, "no raw numbered text");
t();

// 3 — bullets → <ul>; inline code + commands stay monospaced.
const ul = renderMarkdown("- Run `gpupdate /force`\n- Then `ipconfig /flushdns`");
assert.match(ul, /<ul class="md-ul">/);
assert.match(ul, /<code>gpupdate \/force<\/code>/);
assert.match(ul, /<code>ipconfig \/flushdns<\/code>/);
t();

// 4 — paragraphs, bold/italic, links (http/mailto only), fenced code block.
const p = renderMarkdown("Here is the **overview** of the _fix_.\n\nSee [the guide](https://iisupp.net/aria).\n\n```\nnetsh winsock reset\n```");
assert.match(p, /<p>Here is the <strong>overview<\/strong> of the <em>fix<\/em>\.<\/p>/);
assert.match(p, /<a href="https:\/\/iisupp\.net\/aria" target="_blank" rel="noopener">the guide<\/a>/);
assert.match(p, /<pre class="md-pre"><code>netsh winsock reset<\/code><\/pre>/);
t();

// 5 — 🔒 XSS: model output is HTML-escaped first; no raw tags / javascript: links ever execute.
const evil = renderMarkdown('## <script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[click](javascript:alert(3))');
assert.doesNotMatch(evil, /<script>/i, "script tags neutralized");
assert.doesNotMatch(evil, /<img/i, "img tags neutralized");
assert.doesNotMatch(evil, /href="javascript:/i, "javascript: never becomes a clickable link");
assert.doesNotMatch(evil, /<a /i, "no anchor created from a javascript: link");
assert.match(evil, /&lt;script&gt;/, "raw html shown as escaped text");
// code blocks are escaped too (a fenced block can't inject html).
const codeEvil = renderMarkdown("```\n<script>alert(1)</script>\n```");
assert.doesNotMatch(codeEvil, /<script>/i, "code-block html escaped");
assert.match(codeEvil, /&lt;script&gt;/);
t();

// 6 — visual hierarchy on a realistic KB answer: title > overview > steps > escalation.
const ans = renderMarkdown("## Printer won't print\nMost often it's a stuck spooler or offline status.\n\n### Try these in order\n1. Set the printer back to **Online**\n2. Clear the queue\n3. Restart `Print Spooler`\n\n> If it still fails, a technician should check the driver.");
assert.ok(ans.indexOf("<h3") < ans.indexOf("<p>"), "title before overview");
assert.ok(ans.indexOf("<ol") > ans.indexOf("<h4"), "steps under their subheading");
assert.match(ans, /<blockquote class="md-quote">If it still fails/, "escalation note as a blockquote");
assert.doesNotMatch(ans, /\n##|\n- |\n1\./, "no raw markdown markers leak through");
t();

// 7 — wiring: the Chat sub-section renders answers THROUGH renderMarkdown (not raw textContent).
import fs from "node:fs";
import path from "node:path";
const rjs = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "renderer", "renderer.js"), "utf8");
assert.match(rjs, /import \{ renderMarkdown \} from "\.\.\/shared\/aria-markdown\.mjs"/, "renderer imports the markdown renderer");
assert.match(rjs, /renderMarkdown\(stripFm/, "chat answer is rendered as markdown");
t();

assert.equal(n, 7, "7 markdown test groups");
console.log(`aria-markdown test passed (${n} groups · headings/ol/ul/code/links/quotes/fences · XSS-safe escape-first · readable hierarchy).`);
