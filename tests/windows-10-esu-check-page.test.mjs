// windows-10-esu-check-page.test.mjs — RUN-CU 2026-10-09 (small-tasks close-out, task 5).
// windows-10-esu-oct-13-check.html is a perishable, sourced explainer: three Microsoft support dates land
// on 2026-10-13 (Windows 10 organization-ESU Year 1 end, Office 2021 / LTSC 2021 end of support, the last
// Windows Server 2012/R2 ESU year). Rule 14 is the whole page: every date and price it states must be one
// Microsoft's own page prints, with that page linked. This suite pins that down so a later edit cannot
// quietly add a figure nobody can cite:
//   - the eight Microsoft source URLs are present and linked;
//   - every USD figure on the page is in the cited set ($61 Year One organization ESU, $30 consumer one-time);
//     a derived "$122" / "$244" never appears — Microsoft does not print it, so neither do we;
//   - every October date on the page is one of the cited dates;
//   - the wiring: fine print + risk notice injected, sitemap entry, the two sibling pages link here,
//     the checker makes no network call;
//   - the 6-question checker actually runs: all-clear scores 0 and reads green, worst case reads red,
//     every scoring option with points carries a finding (executed against a tiny DOM shim).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "windows-10-esu-oct-13-check.html";
const html = readFileSync(join(ROOT, PAGE), "utf8");

const SOURCES = [
  "https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro",
  "https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates",
  "https://learn.microsoft.com/en-us/lifecycle/faq/extended-security-updates",
  "https://www.microsoft.com/windows/extended-security-updates",
  "https://learn.microsoft.com/en-us/lifecycle/products/office-2021",
  "https://learn.microsoft.com/en-us/lifecycle/products/office-ltsc-2021",
  "https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2012",
  "https://learn.microsoft.com/en-us/microsoft-365-apps/end-of-support/windows-10-support",
];

test("every Microsoft source is linked on the page, and nothing else is cited as a source", () => {
  for (const u of SOURCES) assert.ok(html.includes(`href="${u}"`), `missing source link ${u}`);
  const external = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith("https://iisupp.net"));
  const nonMicrosoft = external.filter((u) => !/^https:\/\/(learn|www)\.microsoft\.com\//.test(u) && !/fonts\.googleapis\.com/.test(u));
  assert.deepEqual(nonMicrosoft, [], `unexpected external links: ${nonMicrosoft.join(", ")}`);
});

test("every dollar figure is one Microsoft prints; the doubled Year-Two price is never stated as a number", () => {
  const dollars = [...html.matchAll(/(?:US)?\$\s?(\d[\d,]*)/g)].map((m) => m[1]);
  assert.ok(dollars.length >= 2, "expected the two cited USD figures to appear");
  const allowed = new Set(["61", "30"]);
  const stray = dollars.filter((d) => !allowed.has(d));
  assert.deepEqual(stray, [], `dollar figures not printed by Microsoft's pages: ${stray.join(", ")}`);
  assert.ok(!/\$\s?1,?22\b|\$\s?2,?44\b/.test(html), "a derived Year-Two/Three price must not be stated — Microsoft's page says 'doubles', it does not print the figure");
  assert.ok(/doubles every consecutive year/.test(html), "the 'price doubles' statement is quoted");
  assert.ok(/does not print the Year-Two/.test(html), "the page says out loud that Microsoft does not print the Year-Two figure");
});

test("every October date on the page is a cited Microsoft date", () => {
  const cited = new Set([
    "October 14, 2025", // Windows 10 end of support
    "October 13, 2026", // Win10 ESU Year 1 end · Office 2021 / LTSC 2021 · Server 2012 ESU Year 3 end
    "October 12, 2027", // Win10 ESU Year 2 end · consumer programme end (as fetched 2026-10-09)
    "October 10, 2028", // Win10 ESU Year 3 end · Microsoft 365 Apps on Win10 security updates end
    "October 10, 2023", // Server 2012/R2 extended support end
  ]);
  const found = [...html.matchAll(/October \d{1,2}, \d{4}/g)].map((m) => m[0]);
  const stray = [...new Set(found.filter((d) => !cited.has(d)))];
  assert.deepEqual(stray, [], `dates with no Microsoft citation: ${stray.join(", ")}`);
  for (const d of cited) assert.ok(found.includes(d), `expected cited date ${d} on the page`);
  // The Pacific-time table values are quoted as Microsoft prints them, with the plain-English reading beside them.
  assert.ok(html.includes("10/14/2026 6:59:59 AM"), "Office 2021 / Server 2012 table value quoted verbatim");
  assert.ok(html.includes("fetched on 2026-10-09") || html.includes("fetched on 2026-10-09"), "the fetch date is stated");
});

test("the wiring: fine print + risk notice, sitemap, sibling links, no network calls from the checker", () => {
  assert.ok(html.includes("<!-- iis-fineprint:head:start -->") && html.includes("<!-- iis-fineprint:start -->"), "fine print not injected — run node scripts/inject-disclaimer.mjs");
  assert.ok(html.includes("<!-- iis-riskbar:start -->"), "risk notice not injected — run node scripts/inject-riskbar.mjs");
  assert.ok(html.includes('href="/assets/xo-elite-theme.css"') && html.includes("fonts.googleapis.com/css2?family=Instrument+Serif"), "XO elite theme head pattern");
  assert.ok(html.includes('href="/book.html"') && html.includes("(647) 581-3182"), "booking CTA and the copy-pack phone number");
  assert.ok(readFileSync(join(ROOT, "sitemap.xml"), "utf8").includes(`https://iisupp.net/${PAGE}`), "sitemap entry");
  for (const sibling of ["switching-it-provider-checklist.html", "managed-it-cost-toronto.html"]) {
    assert.ok(readFileSync(join(ROOT, sibling), "utf8").includes(`href="/${PAGE}"`), `${sibling} does not link to the page`);
  }
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 2, "expected the stamp script and the checker script");
  for (const s of scripts) assert.ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon|localStorage|sessionStorage/.test(s), "the page must make no network call and store nothing");
});

/** A tiny DOM shim: enough for the checker's render + submit path, nothing more. */
function runChecker(answerIndexFor) {
  const byId = new Map();
  const makeEl = (id) => {
    const el = {
      id, className: "", innerHTML: "", textContent: "", value: "0", children: [], listeners: {},
      classList: { add(c) { el.className = (el.className + " " + c).trim(); }, remove(c) { el.className = el.className.replace(c, "").trim(); }, contains(c) { return el.className.split(/\s+/).includes(c); } },
      appendChild(c) { el.children.push(c); return c; },
      addEventListener(ev, fn) { el.listeners[ev] = fn; },
      scrollIntoView() {},
    };
    return el;
  };
  for (const id of ["qs", "chk", "res", "band", "score", "verdict", "fixes"]) byId.set(id, makeEl(id));
  const document = {
    getElementById(id) { if (!byId.has(id)) byId.set(id, makeEl(id)); return byId.get(id); },
    createElement() { return makeEl(null); },
  };
  const checker = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => /var QUESTIONS/.test(s));
  assert.ok(checker, "checker script not found");
  new Function("document", checker)(document);
  const QUESTIONS = new Function(checker.slice(checker.indexOf("var QUESTIONS"), checker.indexOf("var qs =")) + "; return QUESTIONS;")();
  for (const q of QUESTIONS) document.getElementById("q_" + q.id).value = String(answerIndexFor(q));
  byId.get("chk").listeners.submit({ preventDefault() {} });
  return { QUESTIONS, band: byId.get("band"), score: byId.get("score"), verdict: byId.get("verdict"), fixes: byId.get("fixes"), res: byId.get("res") };
}

test("the checker has six questions, each option with points carries a finding, and the arithmetic is honest", () => {
  const clear = runChecker(() => 0);
  assert.equal(clear.QUESTIONS.length, 6);
  for (const q of clear.QUESTIONS) {
    assert.ok(q.opts.length >= 3, `${q.id}: at least three options`);
    assert.equal(q.opts[0][1], 0, `${q.id}: the first option is the all-clear`);
    for (const [label, pts, finding] of q.opts) {
      if (pts > 0) assert.ok(Array.isArray(finding) && finding.length === 2, `${q.id} "${label}": a scored option must explain itself`);
      else assert.equal(finding, null, `${q.id} "${label}": a zero option carries no finding`);
    }
  }
  assert.ok(clear.band.classList.contains("green"), "all-clear reads green");
  assert.match(clear.score.textContent, /^0 \/ \d+$/, "all-clear scores 0 of the maximum");
  assert.match(clear.fixes.innerHTML, /No open items/);
  assert.ok(clear.res.classList.contains("show"));

  const worst = runChecker((q) => { let w = 0, idx = 0; q.opts.forEach((o, i) => { if (o[1] > w) { w = o[1]; idx = i; } }); return idx; });
  assert.ok(worst.band.classList.contains("red"), "worst case reads red");
  const [got, max] = worst.score.textContent.split(" / ").map(Number);
  assert.equal(got, max, "worst case scores the maximum, and the maximum is the sum of the worst option per question");
  assert.equal((worst.fixes.innerHTML.match(/<li>/g) || []).length, 6, "six findings, one per question");
  assert.ok(!/\d+%/.test(worst.fixes.innerHTML + worst.verdict.textContent), "no percentage or statistic is invented in the result");
});
