#!/usr/bin/env node
// SUPPORT FAQ — the public "Technical Support · FAQ" is built from the REAL KB, is end-user-safe
// (P0: no Internal Technician Notes / registry / keyword-tag leak anywhere on the page), is crawlable
// (index,follow + a valid FAQPage JSON-LD whose questions match the rendered entries), degrades cleanly
// with no fabricated screenshots (Rule 14), and every entry traces back to a real KB slug.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isEndUserSafe } from "../assets/kb-answer-shape.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => readFileSync(path.join(root, p), "utf8");

// 0 — shipped artifacts exist.
for (const p of ["support-faq.html", "assets/support-faq.json", "assets/support-faq-screenshots.json", "scripts/build-support-faq.mjs"]) {
  assert.ok(existsSync(path.join(root, p)), `${p} must exist`);
}

const data = JSON.parse(rd("assets/support-faq.json"));
const html = rd("support-faq.html");

// 1 — real content, sourced from the KB (nothing invented).
assert.ok(data.count >= 30, `expected a real FAQ corpus (got ${data.count})`);
assert.ok(Array.isArray(data.categories) && data.categories.length >= 6, "category-organized");
assert.equal(data.source, "assets/aria-kb-chunks.json", "single source of truth = the real KB");
const kb = JSON.parse(rd("assets/aria-kb-chunks.json"));
const kbSlugs = new Set((kb.chunks || []).map((c) => c.slug));
let entryCount = 0;
for (const c of data.categories) {
  assert.ok(c.entries.length >= 1, `category ${c.key} must render at least one entry`);
  for (const e of c.entries) {
    entryCount++;
    assert.ok(kbSlugs.has(e.slug), `entry ${e.slug} traces to a real KB chunk`);
    assert.ok(e.question && e.stepsMd && e.stepsMd.length >= 8, `entry ${e.slug} has a question + real fix steps`);
  }
}
assert.equal(entryCount, data.count, "count matches rendered entries");

// 2 — P0: NO internal-technician-notes / registry / keyword-tag leak ANYWHERE (page + data).
for (const label of ["support-faq.html", "assets/support-faq.json"]) {
  const txt = rd(label);
  assert.ok(isEndUserSafe(txt), `${label} must be end-user-safe (no internal/registry leak)`);
  assert.ok(!/Internal Technician Notes/i.test(txt), `${label}: no Internal Technician Notes`);
  assert.ok(!/Keywords\s*\/\s*Search Tags/i.test(txt), `${label}: no Keywords / Search Tags`);
  assert.ok(!/Questions To Ask User/i.test(txt), `${label}: no Questions To Ask User`);
  assert.ok(!/net stop spooler|RpcAuthnLevelPrivacyEnabled|HKLM\\|HKEY_/i.test(txt), `${label}: no registry / internal CLI`);
}

// 3 — crawlable: index,follow + canonical + valid FAQPage JSON-LD matching the rendered entries.
assert.ok(/<meta name="robots" content="index, follow/i.test(html), "public FAQ is index,follow");
assert.ok(/<link rel="canonical" href="https:\/\/iisupp\.net\/support-faq">/.test(html), "canonical set");
const ld = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
assert.ok(ld, "FAQPage JSON-LD present");
const schema = JSON.parse(ld[1]);
assert.equal(schema["@type"], "FAQPage", "schema is FAQPage");
assert.equal(schema.mainEntity.length, data.count, "one Question per entry");
assert.ok(schema.mainEntity.every((q) => q["@type"] === "Question" && q.name && q.acceptedAnswer && q.acceptedAnswer.text), "each Question has an acceptedAnswer");
assert.ok(schema.mainEntity.every((q) => isEndUserSafe(q.acceptedAnswer.text)), "JSON-LD answers are end-user-safe");

// 4 — the DOM carries every entry (SEO-crawlable, not JS-only) + accordion is native-a11y <details>.
assert.equal((html.match(/<details class="faq-item"/g) || []).length, data.count, "every entry rendered as an accordion item in the DOM");
assert.ok(/<input id="faqSearch"/.test(html), "search box present");
assert.ok((html.match(/class="faq-cat"/g) || []).length >= data.categories.length, "a category filter chip per category");
for (const c of data.categories) {
  assert.ok(html.includes(`data-cat="${c.key}"`), `category section+chip rendered: ${c.key}`);
  const escLabel = c.label.replace(/&/g, "&amp;");
  assert.ok(html.includes(escLabel), `category label rendered: ${c.label}`);
}

// 5 — HONEST screenshots: manifest is real-or-empty and the page ships NO fabricated device screenshots.
const shots = JSON.parse(rd("assets/support-faq-screenshots.json"));
assert.ok(shots.shots && typeof shots.shots === "object", "screenshot manifest present");
for (const c of data.categories) for (const e of c.entries) assert.ok(e.slug in shots.shots, `manifest has a slot for ${e.slug}`);
assert.ok(Object.values(shots.shots).every((v) => Array.isArray(v)), "every manifest slot is an array (empty = text-only, honest)");
assert.ok(!/<img[^>]+faq/i.test(html), "no fabricated FAQ screenshots ship — entries degrade to text + breadcrumbs");

// 6 — escalation + deep-links wired (guided walk-through + community + ARIA).
assert.ok(html.includes("Open ARIA for a guided walk-through"), "escalation deep-link to ARIA");
assert.ok(/href="\/aria\?mode=walkthrough/.test(html), "ARIA walk-through deep-link");
assert.ok(html.includes('href="/forums/"'), "cross-links the forums");
assert.ok(html.includes('href="/start-here.html"'), "IIS contact link");

console.log(`support-faq test passed (${data.count} real-KB entries · ${data.categories.length} categories · FAQPage JSON-LD valid · no internal leak · honest screenshots · deep-links wired).`);
