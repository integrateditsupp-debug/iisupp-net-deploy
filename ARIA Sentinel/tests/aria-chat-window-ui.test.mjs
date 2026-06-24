// RUN 33 PIVOT — ARIA Chat lives IN-APP as the Chat sub-section of the "ARIA" parent tab (the detached window
// was removed per Ahmad). This proves: the ARIA tab + its 5 sub-sections exist; the chat reuses the Slice 0
// design (company name, gold/neutral bubbles, article cards, source badges, frontmatter strip) inside the tab;
// and the detached-window machinery is GONE. (Visual polish confirmed on a real launch; this locks structure.)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const index = read("src", "renderer", "index.html");
const css = read("src", "renderer", "sentinel.css");
const rjs = read("src", "renderer", "renderer.js");
const main = read("src", "main", "main.mjs");
let n = 0; const t = () => { n++; };

// 1 — ARIA is a sidebar parent tab with 5 sub-section anchors (Chat primary).
assert.match(index, /data-tab="aria"/, "ARIA sidebar tab");
const navSub = index.slice(index.indexOf('data-sub="aria"'), index.indexOf('data-sub="aria"') + 600);
for (const a of ["aria-chat", "aria-learning", "aria-health", "aria-memory", "aria-agents"]) {
  assert.match(navSub, new RegExp(`data-anchor="${a}"`), `sub-section nav: ${a}`);
}
assert.match(index, /<section id="aria" class="tab-panel/, "ARIA tab panel");
// RUN 33 PIVOT (0.1.8 bug) — clicking ARIA must switch the right pane: TAB_TITLES + TAB_REDIRECTS must know it.
assert.match(rjs, /\baria:\s*"ARIA"/, "TAB_TITLES.aria → ARIA tab routes (not the dashboard fallback)");
for (const a of ["aria-chat", "aria-learning", "aria-health", "aria-memory", "aria-agents"]) {
  assert.match(rjs, new RegExp(`"${a}":\\s*\\{\\s*tab:\\s*"aria"`), `TAB_REDIRECTS["${a}"] → ARIA tab`);
}
t();

// 2 — Chat sub-section reuses the Slice 0 premium design (company name top, bubbles, composer).
assert.match(index, /aria-chat-company">Integrated IT Support Inc\./i, "company name in the chat header");
assert.match(index, /id="ariaChatLog"/, "chat log");
assert.match(index, /id="ariaChatInput"/, "chat input (focused by Ctrl+Alt+A)");
assert.match(css, /\.aria-chat-row\.me[^}]*flex-end/, "user bubbles right-aligned");
assert.match(css, /\.aria-chat-panel[^}]*max-width:\s*720px/, "centered dock max-width 720px (responsive)");
t();

// 3 — chat behaviour ported into renderer.js: same brain, article card, source badge, frontmatter strip.
assert.match(rjs, /function initAriaChat\(\)/, "in-tab chat init");
assert.match(rjs, /window\.sentinel\.chat/, "uses the same KB-first brain");
assert.match(rjs, /aria-chat-article/, "KB article card");
assert.match(rjs, /via Anthropic/, "Anthropic source badge (proves the chain)");
assert.match(rjs, /---\\r\?\\n\[\\s\\S\]\*\?\\r\?\\n---/, "frontmatter strip safety net");
t();

// 4 — Health sub-section carries the LOCKED Anthropic-preserved banner (hard stop if removed/hidden).
assert.match(index, /class="anthropic-banner" id="anthropicBanner"/, "Anthropic banner element");
assert.match(index, /Anthropic is your last-resort safety net/i, "banner copy present");
assert.doesNotMatch(index, /anthropicBanner"[^>]*hidden/, "banner is never hidden");
t();

// 5 — the detached-window machinery is GONE (Ctrl+Alt+A now opens the in-app tab; no window factory/IPC).
assert.doesNotMatch(main, /createAriaChatWindow/, "no detached-window factory");
assert.doesNotMatch(main, /ipcMain\.handle\("aria-chat:open"/, "no aria-chat:open IPC");
assert.doesNotMatch(read("src", "main", "preload.cjs"), /openAriaChat/, "no openAriaChat bridge");
assert.doesNotMatch(index, /openAriaChatTop|id="openAriaChat"/, "no top-bar pill / Mode-tab launcher button");
assert.ok(!fs.existsSync(path.join(root, "src", "renderer", "aria-chat-window.html")), "detached window HTML deleted");
assert.ok(!fs.existsSync(path.join(root, "src", "shared", "aria-chat-window-state.mjs")), "window-state module deleted");
assert.match(main, /action === "focus-chat"[\s\S]{0,120}showMainWindow\("aria"\)/, "Ctrl+Alt+A opens the in-app ARIA tab");
t();

assert.equal(n, 5, "5 ARIA in-tab chat test groups");
console.log(`aria-chat-window-ui test passed (${n} groups · ARIA parent tab + 5 sub-sections · Slice 0 chat design in-tab (720px responsive) · same brain/article/badge/frontmatter · LOCKED Anthropic banner · detached window removed).`);
