// cross-surface-consistency.test.mjs — RUN-AS / AS1. The sixteen, checked as a SET.
//
// The proof this suite is required to show, and shows below with both halves:
//   RED   — a plan priced differently on two surfaces; a topic (support hours, certification status,
//           trial availability, experience figure, response time) answered two different ways; a call
//           to action pointing at a path not in the tree; a call to action pointing where a SIBLING
//           surface tells the reader the thing is not open yet.
//   GREEN — the real published set, read together from disk, every finding naming BOTH files and
//           BOTH 1-based lines.
//
// And the honesty half: a declared surface that is not on disk, or that is not prose a reader
// consumes, comes back UNCHECKED with a reason and is asserted NEVER to be counted as checked — and
// the summary is asserted to carry no pass RATE, because a ratio that folds unchecked into passed is
// the dishonesty this series keeps deleting.
//
// Silence is not disagreement: a surface that never mentions a topic must produce no finding.
//
// Run: node tests/cross-surface-consistency.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  auditCrossSurface, extractPrices, extractTopics, extractCtas, extractDenials,
  proseOf, lineOf, pathExists, statementFor,
  VERDICT, CLASSES, CROSS_SURFACE_SCHEMA, SENDS, WRITES,
  PROSE_SURFACES, NON_PROSE_SURFACES, PUBLISHED_SET,
  crossFilePair, normalisePlan, COMPARABLE_UNITS,
} = await import(new URL("../scripts/lib/cross-surface-consistency.mjs", import.meta.url).href);

const page = (body) => `<!doctype html><html><head><title>t</title></head><body>
<nav><a href="/">Home</a><a href="/plans/">Plans</a></nav>
${body}
<footer><a href="/terms.html">Terms</a></footer></body></html>`;

function fixture(files) {
  const dir = makeScratchDir("as1-");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

const classesOf = (r) => r.findings.map((f) => f.class);
const find = (r, cls) => r.findings.find((f) => f.class === cls);

test("AS1 — the module is pure: it declares that it neither sends nor writes", () => {
  assert.equal(SENDS, false);
  assert.equal(WRITES, false);
  assert.equal(CROSS_SURFACE_SCHEMA, "cross-surface-consistency.v1");
});

test("AS1 — prose extraction blanks script and style without moving any line number", () => {
  const html = "line one\n<script>\nvar x = '$99/mo Starter';\n</script>\nline five $10";
  const prose = proseOf(html);
  assert.ok(!/var x/.test(prose), "script body must not survive into prose");
  assert.equal(prose.split("\n").length, html.split("\n").length, "line count must be preserved");
  assert.equal(lineOf(html, html.indexOf("line five")), 5);
});

test("AS1 RED — the same plan priced differently on two surfaces is a contradiction naming both", () => {
  const dir = fixture({
    "index.html": page("<h1>Managed IT</h1><p>The Starter plan is $499/mo.</p>"),
    "aria.html": page("<h1>ARIA</h1><p>Starter starts at $349 / mo.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "aria.html"] });
  assert.equal(r.verdict, VERDICT.BROKEN);
  const f = find(r, CLASSES.PRICE_DISAGREEMENT);
  assert.ok(f, `expected a price disagreement, got ${classesOf(r).join(", ") || "none"}`);
  assert.deepEqual([f.a.file, f.b.file].sort(), ["aria.html", "index.html"]);
  assert.ok(f.a.line > 0 && f.b.line > 0, "both sides must carry a 1-based line");
  assert.deepEqual([f.a.value, f.b.value].sort(), ["349", "499"]);
});

test("AS1 GREEN — the same plan at the same price on two surfaces is not a finding", () => {
  const dir = fixture({
    "index.html": page("<p>The Starter plan is $499/mo.</p>"),
    "aria.html": page("<p>Starter is $499 per month.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "aria.html"] });
  assert.equal(r.summary.contradictions, 0, JSON.stringify(r.findings));
  assert.equal(r.verdict, VERDICT.OK);
});

test("AS1 — money with no plan word near it binds to nothing and raises nothing", () => {
  const prices = extractPrices(page("<p>We saved a client $12,000 last year.</p>"));
  assert.equal(prices.length, 0, "an unattached figure is not a plan price");
});

test("AS1 — a per-year price and a per-month price are different units, never a contradiction", () => {
  const dir = fixture({
    "index.html": page("<p>Starter is $499/mo.</p>"),
    "aria.html": page("<p>Starter is $4990/yr.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "aria.html"] });
  assert.equal(r.summary.contradictions, 0, "different units are not the same claim");
});

test("AS1 RED — support hours answered two ways across the set", () => {
  const dir = fixture({
    "index.html": page("<p>Our team is available 24/7.</p>"),
    "trust.html": page("<p>Support is business hours only.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "trust.html"] });
  const f = find(r, CLASSES.CLAIM_DISAGREEMENT);
  assert.ok(f, `expected a claim disagreement, got ${classesOf(r).join(", ") || "none"}`);
  assert.equal(f.topic, "support-hours");
  assert.deepEqual([f.a.value, f.b.value].sort(), ["24-7", "business-hours-only"]);
  assert.deepEqual([f.a.file, f.b.file].sort(), ["index.html", "trust.html"]);
});

test("AS1 RED — 'SOC 2 certified' on one screen and 'SOC 2 readiness' on another is the legal case", () => {
  const dir = fixture({
    "index.html": page("<p>We are SOC 2 certified.</p>"),
    "trust.html": page("<p>Our SOC 2 readiness work is in progress.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "trust.html"] });
  const f = find(r, CLASSES.CLAIM_DISAGREEMENT);
  assert.ok(f, `expected a certification disagreement, got ${classesOf(r).join(", ") || "none"}`);
  assert.equal(f.topic, "certification-status");
  assert.ok(f.a.value.startsWith("soc2:") && f.b.value.startsWith("soc2:"));
  assert.ok(f.why && f.why.length > 10, "a contradiction must carry why it matters");
});

test("AS1 RED — the experience figure must be one number everywhere", () => {
  const dir = fixture({
    "about.html": page("<p>15+ years of IT operations experience.</p>"),
    "index.html": page("<p>21 years of IT experience behind every ticket.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["about.html", "index.html"] });
  const f = find(r, CLASSES.CLAIM_DISAGREEMENT);
  assert.ok(f && f.topic === "experience-years", `got ${JSON.stringify(classesOf(r))}`);
  assert.deepEqual([f.a.value, f.b.value].sort(), ["15+", "21+"]);
});

test("AS1 RED — a trial offered on one surface and denied on another", () => {
  const dir = fixture({
    "aria.html": page("<p>Start your free trial today.</p>"),
    "index.html": page("<p>There is no free trial; every engagement starts with a call.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["aria.html", "index.html"] });
  const f = find(r, CLASSES.CLAIM_DISAGREEMENT);
  assert.ok(f && f.topic === "trial-availability", `got ${JSON.stringify(classesOf(r))}`);
  assert.deepEqual([f.a.value, f.b.value].sort(), ["free-trial", "none"]);
});

test("AS1 RED — a response-time promise that differs between screens", () => {
  const dir = fixture({
    "index.html": page("<p>15 minute response, every ticket.</p>"),
    "trust.html": page("<p>Target is a 4 hour response.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "trust.html"] });
  const f = find(r, CLASSES.CLAIM_DISAGREEMENT);
  assert.ok(f && f.topic === "response-time", `got ${JSON.stringify(classesOf(r))}`);
});

test("AS1 GREEN — silence is not disagreement: a surface that never raises a topic raises nothing", () => {
  const dir = fixture({
    "index.html": page("<p>Our team is available 24/7.</p>"),
    "about.html": page("<p>We are an IT company in Whitby, Ontario.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "about.html"] });
  assert.equal(r.summary.contradictions, 0, JSON.stringify(r.findings));
});

test("AS1 RED — a call to action pointing at a path that is not in the tree", () => {
  const dir = fixture({
    "index.html": page('<p><a href="/book-a-call.html">Book a call</a></p>'),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html"] });
  const f = find(r, CLASSES.CTA_TARGET_MISSING);
  assert.ok(f, `expected a missing CTA target, got ${classesOf(r).join(", ") || "none"}`);
  assert.equal(f.a.file, "index.html");
  assert.equal(f.a.value, "/book-a-call.html");
  assert.equal(f.b, null, "a missing target has no second surface to name");
});

test("AS1 GREEN — navigation is not a call to action", () => {
  const dir = fixture({ "index.html": page('<p><a href="/nowhere.html">Terms</a></p>') });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html"] });
  assert.equal(r.summary.contradictions, 0, "a non-asking link is not an ask");
});

test("AS1 GREEN — a directory CTA resolves through its index.html", () => {
  const dir = fixture({
    "index.html": page('<p><a href="/plans/">See plans</a></p>'),
    "plans/index.html": page("<p>Plans</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html"] });
  assert.equal(r.summary.contradictions, 0, JSON.stringify(r.findings));
  assert.equal(pathExists("/plans/", { root: dir }), true);
});

test("AS1 RED — a CTA pointing where a SIBLING says the thing is not open yet", () => {
  const dir = fixture({
    "index.html": page('<p><a href="/marketplace.html">Get started</a></p>'),
    "aria.html": page('<p>The <a href="/marketplace.html">marketplace</a> is coming soon.</p>'),
    "marketplace.html": page("<p>Marketplace</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "aria.html", "marketplace.html"] });
  const f = find(r, CLASSES.CTA_TARGET_DENIED);
  assert.ok(f, `expected a denied CTA target, got ${classesOf(r).join(", ") || "none"}`);
  assert.equal(f.a.file, "index.html");
  assert.equal(f.b.file, "aria.html");
  assert.match(f.detail, /coming soon/i);
});

test("AS1 — a surface that denies its OWN link is not accused of contradicting itself", () => {
  const dir = fixture({
    "index.html": page('<p>The <a href="/marketplace.html">marketplace</a> is coming soon — sign up for the waitlist.</p>'),
    "marketplace.html": page("<p>Marketplace</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "marketplace.html"] });
  assert.equal(r.findings.filter((f) => f.class === CLASSES.CTA_TARGET_DENIED).length, 0);
});

test("AS1 — extractors are addressable on their own", () => {
  assert.equal(extractTopics(page("<p>Available 24/7.</p>"))[0].value, "24-7");
  assert.equal(extractCtas(page('<a href="/x.html">Book a call</a>'))[0].href, "/x.html");
  assert.equal(extractDenials(page('<p><a href="/y.html">Y</a> is not yet available.</p>'))[0].phrase.length > 0, true);
});

test("AS1 HONESTY — a declared surface not on disk is UNCHECKED with a reason, never checked", () => {
  const dir = fixture({ "index.html": page("<p>Hello.</p>") });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "ghost.html"] });
  const u = r.unchecked.find((x) => x.file === "ghost.html");
  assert.ok(u, "a missing surface must be reported, not silently dropped");
  assert.equal(u.class, CLASSES.NOT_ON_DISK);
  assert.ok(u.reason.length > 10);
  assert.ok(!r.checked.includes("ghost.html"), "unchecked must never appear in checked");
  assert.equal(r.summary.surfacesChecked, 1);
  assert.equal(r.summary.surfacesUnchecked, 1);
});

test("AS1 HONESTY — a non-prose member of the set is declared, not quietly dropped", () => {
  const dir = fixture({ "index.html": page("<p>Hello.</p>"), "sitemap.xml": "<urlset/>" });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "sitemap.xml"] });
  const u = r.unchecked.find((x) => x.file === "sitemap.xml");
  assert.ok(u && u.class === CLASSES.NOT_PROSE);
  assert.ok(!r.checked.includes("sitemap.xml"));
});

test("AS1 HONESTY — the summary carries no pass RATE that could fold unchecked into passed", () => {
  const dir = fixture({ "index.html": page("<p>Hello.</p>") });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "ghost.html"] });
  const keys = Object.keys(r.summary).join(" ").toLowerCase();
  assert.ok(!/rate|percent|pct|score/.test(keys), `summary must not carry a rate: ${keys}`);
  assert.ok(Object.prototype.hasOwnProperty.call(r.summary, "surfacesUnchecked"));
});

test("AS1 — the declared set is the priced range's public files, prose and non-prose both named", () => {
  for (const f of ["index.html", "aria.html", "trust.html", "about.html",
    "ai-edge.html", "growth-library.html", "health-check.html", "scorecard.html"]) {
    assert.ok(PROSE_SURFACES.includes(f), `${f} must be in the declared prose set`);
  }
  assert.ok(NON_PROSE_SURFACES.includes("sitemap.xml"));
  assert.equal(PUBLISHED_SET.length, PROSE_SURFACES.length + NON_PROSE_SURFACES.length);
});

// ── The three findings the real tree produced on this suite's FIRST run. Each was a defect in the
// audit, not in the site, and each is asserted here so it cannot come back silently. ──────────────

test("AS1 — two figures inside ONE file are that file's business, never a cross-surface finding", () => {
  const dir = fixture({
    "index.html": page("<p>Business tier is $6000/mo.</p><p>Business engagements run $14000/mo at scale.</p>"),
    "about.html": page("<p>We are an IT company.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "about.html"] });
  assert.equal(r.summary.contradictions, 0, JSON.stringify(r.findings));
  assert.equal(crossFilePair([{ file: "a", value: 1 }, { file: "a", value: 2 }]), null);
  assert.ok(crossFilePair([{ file: "a", value: 1 }, { file: "b", value: 2 }]));
});

test("AS1 — plan names are normalised by a map, never by stripping a trailing s", () => {
  assert.equal(normalisePlan("Business"), "business", "the blind strip made this 'busines'");
  assert.equal(normalisePlan("Essentials"), "essential");
  const dir = fixture({
    "index.html": page("<p>Business is $6000/mo.</p>"),
    "aria.html": page("<p>Business is $6000/mo.</p>"),
  });
  assert.equal(auditCrossSurface({ root: dir, surfaces: ["index.html", "aria.html"] }).summary.contradictions, 0);
});

test("AS1 HONESTY — a dollar figure with no recurring unit is ambiguous and is NOT compared", () => {
  assert.ok(!COMPARABLE_UNITS.has("unspecified"));
  const dir = fixture({
    "index.html": page("<p>Starter engagements start at $6,000.</p>"),
    "aria.html": page("<p>Starter is $499/mo.</p>"),
  });
  const r = auditCrossSurface({ root: dir, surfaces: ["index.html", "aria.html"] });
  assert.equal(r.summary.contradictions, 0, "an unpriced figure is not evidence of a second price");
  // And the extractor still SEES it — the audit declines to compare it, it does not pretend it is absent.
  assert.ok(extractPrices(page("<p>Starter engagements start at $6,000.</p>")).length === 1);
});

test("AS1 GREEN — the REAL published set, read together from this repository", () => {
  const r = auditCrossSurface({ root: ROOT });
  assert.equal(r.schema, CROSS_SURFACE_SCHEMA);
  assert.ok(r.checked.length >= 6, `expected the prose set on disk, checked ${r.checked.length}`);
  for (const f of r.findings) {
    assert.ok(f.a && f.a.file && f.a.line > 0, `every finding names a file and a line: ${JSON.stringify(f)}`);
    assert.ok(f.detail && f.detail.length > 10);
    if (f.class !== CLASSES.CTA_TARGET_MISSING) {
      assert.ok(f.b && f.b.file, "a between-surfaces contradiction must name BOTH surfaces");
    }
  }
  assert.ok(statementFor(r).length > 20);
  // The real set must AGREE. This is the assertion that makes the suite worth running every cycle:
  // it goes red the day two published screens start telling a visitor different things.
  assert.equal(
    r.summary.contradictions, 0,
    "the published set contradicts itself:\n" +
    r.findings.map((f) => `  ${f.class}: ${f.detail}`).join("\n"),
  );
});
