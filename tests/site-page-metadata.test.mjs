// site-page-metadata.test.mjs — RUN-CU 2026-10-09 (small-tasks close-out, tasks 3, 4 and 6).
//
// Three small, repeatedly-flagged page defects, each guarded here so it cannot quietly come back:
//   task 3 — about.html had no <meta name="description"> and no <h2> at all (an <h1> and then only <h3>s).
//            The description is built from the page's own copy; the four section titles are <h2> now.
//   task 4 — the JSON-LD on index.html / services.html said areaServed = Canada + United States, 79 days
//            open. The business serves the Greater Toronto Area / Durham Region / Ontario onsite and Canada
//            remotely. docs/listing-copy-pack.md §10 is the one list; every schema must match it exactly.
//   task 6 — the three answer pages carried a hand-typed "Last reviewed 2026-07-14". Each now carries ONE
//            data-last-verified attribute (set to the file's last commit date) rendered by one shared inline
//            script that adds "(n days ago)". The attribute must be a real ISO date and never in the future;
//            the script is executed here against a tiny DOM shim so "renders" is measured, not assumed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");

// ------------------------------------------------------------------ task 3: about.html

test("about.html carries a factual meta description built from its own copy", () => {
  const html = read("about.html");
  const m = html.match(/<meta name="description" content="([^"]+)">/);
  assert.ok(m, "about.html has no <meta name=\"description\">");
  const desc = m[1];
  assert.ok(desc.length >= 80 && desc.length <= 320, `description length ${desc.length} is outside a sensible range`);
  // Every claim in the description must already be on the page — no new claims (Rule 14).
  for (const needle of ["May 2023", "RBC", "Scotiabank", "Ontario Health", "City of Toronto", "IBM", "Cavalluzzo", "Six Sigma", "ITIL"]) {
    assert.ok(desc.includes(needle), `description is missing "${needle}"`);
    assert.ok(html.includes(needle), `description claims "${needle}" but the page body does not say it`);
  }
  const og = html.match(/<meta property="og:description" content="([^"]+)">/);
  assert.ok(og && og[1] === desc, "og:description must be the same text as the meta description");
});

test("about.html has an <h1> followed by <h2> section titles — the four ids and their copy are unchanged", () => {
  const html = read("about.html");
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, "exactly one <h1>");
  const h2 = [...html.matchAll(/<h2 id="([a-z-]+)">([^<]+)<\/h2>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(h2, [
    ["about-biography", "Professional Biography"],
    ["about-certifications", "Certifications &amp; Methodology Mastery"],
    ["about-track", "Enterprise Track Record"],
    ["about-personal", "Personal Bio"],
  ]);
  // The visual rule that styled the old <h3>s now covers <h2> as well — same look, nothing dropped.
  assert.match(html, /\.about-bio h2, \.about-bio h3 \{/, "the .about-bio heading rule must include h2");
  assert.match(html, /\.about-bio h2:not\(:first-child\), \.about-bio h3:not\(:first-child\)/);
  assert.ok(!/<h3 id="about-/.test(html), "no section title is still an <h3>");
});

// ------------------------------------------------------------------ task 4: areaServed

/** The canonical list: the fenced block under "## 10. Service area" in the copy pack. */
function copyPackServiceArea() {
  const pack = read("docs/listing-copy-pack.md");
  const sec = pack.split(/^## 10\. Service area[^\n]*$/m)[1];
  assert.ok(sec, "docs/listing-copy-pack.md has no '## 10. Service area' section");
  const fence = sec.match(/```\n([\s\S]*?)```/);
  assert.ok(fence, "the service-area section has no fenced list");
  const names = fence[1].split("\n").map((l) => l.trim()).filter(Boolean);
  assert.ok(names.length >= 3, "the service-area list is suspiciously short");
  return names;
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map((m) => JSON.parse(m[1]));
}

test("the copy pack's service area names Ontario / GTA / Durham / Canada and never the United States", () => {
  const names = copyPackServiceArea();
  for (const n of ["Greater Toronto Area", "Durham Region", "Ontario", "Canada"]) assert.ok(names.includes(n), `copy pack list lacks "${n}"`);
  assert.ok(!names.some((n) => /united states|usa|\bus\b/i.test(n)), "the copy pack must not list the United States as a service area");
});

test("every page schema's areaServed matches the copy pack list exactly (index, services, about)", () => {
  const want = [...copyPackServiceArea()].sort();
  let checked = 0;
  for (const file of ["index.html", "services.html", "about.html"]) {
    for (const block of jsonLdBlocks(read(file))) {
      if (!("areaServed" in block)) continue;
      const got = block.areaServed.map((a) => (typeof a === "string" ? a : a && a.name)).sort();
      assert.deepEqual(got, want, `${file}: areaServed ${JSON.stringify(got)} must equal the copy pack list ${JSON.stringify(want)}`);
      assert.ok(block.areaServed.every((a) => typeof a === "object" && a["@type"] && a.name), `${file}: each areaServed entry is a typed schema.org place`);
      checked++;
    }
  }
  assert.equal(checked, 3, "expected exactly one areaServed schema on each of the three pages");
});

test("no page anywhere still says areaServed includes the United States", () => {
  for (const file of ["index.html", "services.html", "about.html", "aria.html", "book.html", "trust.html"]) {
    let html;
    try { html = read(file); } catch { continue; }
    assert.ok(!/"areaServed":\s*\[[^\]]*United States/.test(html), `${file} still lists the United States under areaServed`);
  }
});

// ------------------------------------------------------------------ task 6: last-verified stamps

const ANSWER_PAGES = ["managed-it-cost-toronto.html", "switching-it-provider-checklist.html", "copilot-oversharing-check.html"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP_SCRIPT = /<script>\s*\/\* last-verified stamp[\s\S]*?<\/script>/;

test("each answer page carries exactly one data-last-verified attribute: a real ISO date, not in the future, not stale-by-regression", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const file of ANSWER_PAGES) {
    const html = read(file);
    const stamps = [...html.matchAll(/data-last-verified="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(stamps.length, 1, `${file}: expected exactly one data-last-verified attribute, found ${stamps.length}`);
    const [v] = stamps;
    assert.match(v, ISO_DAY, `${file}: data-last-verified "${v}" is not YYYY-MM-DD`);
    const t = Date.parse(v + "T00:00:00Z");
    assert.ok(Number.isFinite(t), `${file}: "${v}" is not a real calendar date`);
    assert.equal(new Date(t).toISOString().slice(0, 10), v, `${file}: "${v}" is not a real calendar date (it normalises to something else)`);
    assert.ok(v <= today, `${file}: data-last-verified ${v} is in the future (today is ${today})`);
    assert.ok(v >= "2026-07-14", `${file}: ${v} is older than the hand-typed date it replaced — a regression, not a verification`);
    // The visible fallback text and the attribute are the same date (no second hand-typed copy to drift).
    assert.ok(html.includes(`data-last-verified="${v}">Last verified ${v}<`), `${file}: the no-JS text must carry the same date as the attribute`);
  }
});

test("one shared inline script renders the stamp, identically on all three pages, and only from the attribute", () => {
  const scripts = ANSWER_PAGES.map((f) => {
    const m = read(f).match(STAMP_SCRIPT);
    assert.ok(m, `${f}: the last-verified script is missing`);
    return m[0];
  });
  assert.ok(scripts.every((s) => s === scripts[0]), "the stamp script must be byte-identical on all three pages (one implementation)");
  const body = scripts[0].replace(/^<script>/, "").replace(/<\/script>$/, "");
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(body), "the script must not carry a date of its own — the attribute is the only source");

  // Execute it against a tiny DOM shim: a real date renders "(n days ago)", a future date and junk are left alone.
  const el = (v, text) => ({ _attrs: { "data-last-verified": v }, textContent: text, getAttribute(n) { return this._attrs[n]; } });
  const nineDaysAgo = new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const nodes = [el(nineDaysAgo, "Last verified " + nineDaysAgo), el(nextYear, "Last verified " + nextYear), el("not-a-date", "Last verified not-a-date")];
  const document = { querySelectorAll: (sel) => (sel === "[data-last-verified]" ? nodes : []) };
  new Function("document", body)(document);
  assert.match(nodes[0].textContent, new RegExp(`^Last verified ${nineDaysAgo} \\((8|9|10) days ago\\)$`), "a past date renders with its age");
  assert.equal(nodes[1].textContent, "Last verified " + nextYear, "a future date is left exactly as written — never painted over");
  assert.equal(nodes[2].textContent, "Last verified not-a-date", "junk is left exactly as written");
});
