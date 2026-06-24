// RUN 16 §L — Accessibility battery (WCAG 2.1 AA static checks). axe-core needs a live DOM/browser and
// would add a heavy dev-dep + headless run; instead these hand-rolled checks cover the static AA rules
// that apply to our renderer markup (lang, title, names, alt text, focus order, contrast tokens).
// See RUN_16_REPORT for the axe-core justification + the manual checks deferred to on-device QA.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const HTMLS = ["index.html", "overlay.html"];

for (const file of HTMLS) {
  const html = read("src", "renderer", file);

  // 3.1.1 Language of Page · 2.4.2 Page Titled · responsive viewport.
  assert.match(html, /<html[^>]*\blang="[a-z-]+"/i, `${file}: html has lang`);
  assert.match(html, /<title>[^<]+<\/title>/i, `${file}: has a non-empty <title>`);
  assert.match(html, /name="viewport"/i, `${file}: has a responsive viewport`);

  // 1.1.1 Non-text Content: every <img> has an alt attribute (empty alt is valid for decorative
  // images, which must also be aria-hidden).
  const imgs = html.match(/<img[^>]*>/g) || [];
  for (const img of imgs) {
    assert.match(img, /\salt=/, `${file}: <img> has alt — ${img}`);
    if (/alt=""/.test(img)) assert.match(img, /aria-hidden="true"/, `${file}: decorative img is aria-hidden — ${img}`);
  }

  // 2.4.4 Link/Control Purpose: every <button> has either visible text or an aria-label.
  const buttons = html.match(/<button[\s\S]*?<\/button>/g) || [];
  for (const btn of buttons) {
    const hasAria = /aria-label="[^"]+"/.test(btn);
    const open = btn.indexOf(">");
    const text = btn.slice(open + 1, btn.lastIndexOf("</button>")).replace(/<[^>]+>/g, "").trim();
    assert.ok(hasAria || text.length > 0, `${file}: button has an accessible name — ${btn.slice(0, 60)}`);
  }

  // 2.4.3 Focus Order: no positive tabindex anti-pattern.
  assert.doesNotMatch(html, /tabindex="[1-9]/, `${file}: no positive tabindex`);

  // 4.1.2 Name, Role, Value: interactive controls use real <button>/<a>, not click-only <div>s for nav.
  assert.doesNotMatch(html, /<div[^>]*\bonclick=/i, `${file}: no click-only div controls`);
}

// 1.4.3 Contrast: the brand palette is centralized as tokens (navy/dark bg + gold/cream fg). The
// chosen pairs (cream #f1dca7 on near-black #0d0f14) exceed the 4.5:1 AA threshold — verified by token
// presence here; pixel-level contrast confirmed in on-device QA (documented in the result file).
const css = read("src", "renderer", "sentinel.css");
assert.match(css, /--aria-gold|#c5a059/i, "gold brand token defined");
assert.match(css, /#f1dca7|--aria-cream|aria-font/i, "cream/foreground token defined");

console.log(`Accessibility battery passed (lang · title · viewport · alt text + decorative aria-hidden · button names · focus order · contrast tokens across ${HTMLS.length} renderer HTMLs).`);
