// surface-class.test.mjs — RUN-AP / AP1. THE EXEMPTION, ARGUED IN CODE.
//
// The proof this suite is required to show, and shows below with both halves:
//   RED   — a sales surface moved into the exempt list with no reason behind it; an exempt count
//           folded into the pass count; an obligation surface that carries a Rule 14 violation and
//           tries to hide behind its exemption.
//   GREEN — the real declared entry points, split by surface class, with `terms.html` exempt and
//           `product.html` NOT exempt — and the assertion message says why in each case.
//
// The rule being defended: an exemption that is argued for is honest; an exemption that is quietly
// special-cased to move a number is a fabricated metric. The argument is a string in the code, the
// test reads it, and an empty argument fails red.
//
// Run: node tests/surface-class.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  classifySurface, validateExemptions, auditSalesSurfaces, assertExemptNotFolded,
  OBLIGATION_SURFACES, SURFACE, CLASSES, RULE_14_CLASSES, SURFACE_CLASS_SCHEMA, SENDS, WRITES,
} = await import(new URL("../scripts/lib/surface-class.mjs", import.meta.url).href);

const { CLASSES: FS_CLASSES } =
  await import(new URL("../scripts/lib/first-screen-audit.mjs", import.meta.url).href);

const { CUSTOMER_ENTRY_POINTS } =
  await import(new URL("../scripts/lib/customer-link-graph.mjs", import.meta.url).href);

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────
const page = (main) => `<!doctype html>
<html><body>
<nav><a href="/services.html">Services</a></nav>
<main>${main}</main>
<footer><a href="/terms.html">Terms</a></footer>
</body></html>`;

const SELLS = page("<h1>We fix your IT before it stops your team working.</h1><p>Flat retainer, no surprise invoices, so you can get back to the job.</p>");
const SILENT = page("<h1>Product</h1><p>Integrated IT Support Inc. Product overview and documentation index for the platform.</p>");
const LIES = page("<h1>We save you hours every week.</h1><p>Money-back guarantee on every engagement.</p>");

function tmpSite(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ap1-"));
  for (const [rel, html] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, html);
  }
  return dir;
}

// ── the module is inert ───────────────────────────────────────────────────────────────────────
test("AP1 — the classifier sends nothing and writes nothing", () => {
  assert.equal(SENDS, false);
  assert.equal(WRITES, false);
  const src = fs.readFileSync(path.join(ROOT, "scripts/lib/surface-class.mjs"), "utf8");
  assert.ok(!/writeFileSync|fetch\(|child_process/.test(src),
    "AP1 must not write, spawn, or reach the network — it only classifies what AO1 read");
});

// ── RED #1: an exemption with no argument behind it ───────────────────────────────────────────
test("AP1 RED — a surface declared exempt with NO reason fails by name", () => {
  for (const bad of [undefined, null, "", "   ", "legal"]) {
    const r = validateExemptions({ "product.html": bad });
    assert.equal(r.ok, false,
      `an obligation surface declared with reason ${JSON.stringify(bad)} must fail — an exemption ` +
      `that is not argued for is a special case, and a special case that moves a number is a fabricated metric`);
    assert.equal(r.failures[0].class, CLASSES.EXEMPT_WITHOUT_REASON);
    assert.match(r.failures[0].detail, /product\.html/);
  }
});

test("AP1 GREEN — the real declared exemptions each carry a real argument", () => {
  const r = validateExemptions();
  assert.equal(r.ok, true, `declared exemptions failed their own rule:\n${JSON.stringify(r.failures, null, 2)}`);
  for (const [file, reason] of Object.entries(OBLIGATION_SURFACES)) {
    assert.ok(reason.trim().length >= 40, `${file} carries a reason too short to be an argument`);
  }
});

// ── RED #2: the exempt count folded into the pass count ───────────────────────────────────────
test("AP1 RED — folding an exempt surface into passed fails by name", () => {
  const dir = tmpSite({ "sells.html": SELLS, "obligation.html": SILENT });
  const audit = auditSalesSurfaces({
    root: dir,
    entryPoints: ["sells.html", "obligation.html"],
    obligations: { "obligation.html": "A policy page discharging a stated obligation; it is not required to sell anything to anyone." },
  });

  assert.equal(audit.summary.passed, 1, "only the sales surface may be counted as passed");
  assert.equal(audit.summary.exempt, 1);
  assert.equal(assertExemptNotFolded(audit).ok, true);

  // Now fold it, exactly the way a well-meaning green-number edit would.
  const folded = {
    ...audit,
    passed: [...audit.passed, ...audit.exempt],
    summary: { ...audit.summary, passed: audit.summary.passed + audit.summary.exempt },
  };
  const check = assertExemptNotFolded(folded);
  assert.equal(check.ok, false,
    "an exemption that raises the pass count is not an exemption — the invariant must go red here");
  assert.ok(check.failures.some((f) => f.class === CLASSES.EXEMPT_FOLDED_INTO_PASSED));
  assert.ok(check.failures.some((f) => /obligation\.html/.test(f.detail || "")));
});

// ── RED #3: the exemption covers Rule 17 and NOTHING else ─────────────────────────────────────
test("AP1 RED — an obligation surface may be silent; it may NOT lie", () => {
  const dir = tmpSite({ "obligation.html": LIES });
  const audit = auditSalesSurfaces({
    root: dir,
    entryPoints: ["obligation.html"],
    obligations: { "obligation.html": "A legal page discharging a stated obligation; it is not required to sell anything to anyone." },
  });
  assert.equal(audit.summary.exempt, 0, "a Rule 14 violation outranks the exemption");
  assert.equal(audit.summary.broken, 1);
  assert.ok(audit.broken[0].rule14.length >= 1);
  assert.ok(RULE_14_CLASSES.has(audit.broken[0].rule14[0].class));
});

test("AP1 — silence on an obligation surface is exempt, silence on a sales surface is not", () => {
  const dir = tmpSite({ "a.html": SILENT, "b.html": SILENT });
  const audit = auditSalesSurfaces({
    root: dir,
    entryPoints: ["a.html", "b.html"],
    obligations: { "b.html": "A contract surface discharging a stated obligation; it is not required to sell anything to anyone." },
  });
  assert.equal(audit.summary.broken, 1, "the sales surface stays broken while silent");
  assert.equal(audit.broken[0].file, "a.html");
  assert.ok(audit.broken[0].findings.some((f) => f.class === FS_CLASSES.NO_CLAIM));
  assert.equal(audit.summary.exempt, 1);
  assert.equal(audit.exempt[0].file, "b.html");
  assert.ok(audit.exempt[0].reason.length >= 40, "the exempt surface carries its argument through to the report");
});

// ── the split itself, on the real declared entry points ───────────────────────────────────────
test("AP1 — terms.html is exempt and product.html is not, and the assertion says why", () => {
  assert.equal(classifySurface("terms.html").surface, SURFACE.OBLIGATION,
    "terms.html is a contract surface: its job is to state terms plainly and be reachable, not to sell");
  assert.ok(classifySurface("terms.html").reason.length >= 40);

  assert.equal(classifySurface("product.html").surface, SURFACE.SALES,
    "product.html exists to make a stranger want to talk to us — there is no obligation that requires " +
    "a product page to exist, so it does not get to be exempt from earning its reader");
  assert.equal(classifySurface("product.html").reason, null);

  // The default is the demanding one: an undeclared page is a sales surface, never the reverse.
  assert.equal(classifySurface("a-page-nobody-declared.html").surface, SURFACE.SALES,
    "a page must be argued OUT of having to earn its reader, never argued in");
});

test("AP1 — the real entry points split, and the counts never absorb each other", () => {
  const audit = auditSalesSurfaces({ root: ROOT, entryPoints: CUSTOMER_ENTRY_POINTS });
  assert.equal(audit.schema, SURFACE_CLASS_SCHEMA);
  assert.equal(audit.exemptionsValid, true);

  const s = audit.summary;
  assert.equal(s.entryPoints, CUSTOMER_ENTRY_POINTS.length);
  assert.equal(s.passed + s.broken + s.exempt + s.unchecked, s.entryPoints,
    "every entry point lands in exactly one bucket");
  assert.equal(s.salesSurfaces + s.obligationSurfaces, s.entryPoints);
  assert.equal(assertExemptNotFolded(audit).ok, true);
  assert.match(s.note, /never folded into passed/);

  // terms.html is declared exempt, so it must not appear among the broken sales surfaces.
  assert.ok(!audit.broken.some((r) => r.file === "terms.html"),
    "terms.html is an obligation surface and must not be reported as a failing sales surface");
});

// ── AP2. The copy, and the promise that nothing was removed to get it. ────────────────────────
test("AP2 — every SALES surface makes a value claim; exempt and unchecked stay separate", () => {
  const audit = auditSalesSurfaces({ root: ROOT, entryPoints: CUSTOMER_ENTRY_POINTS });
  const silent = audit.broken
    .filter((r) => r.silent)
    .map((r) => `${r.file} — first screen names things but promises nothing a reader can feel`);
  assert.deepEqual(silent, [],
    `sales surfaces still silent above the fold:\n${silent.join("\n")}`);
  assert.equal(audit.summary.broken, 0, "no sales surface may be left silent at the close of AP2");
  assert.ok(audit.summary.exempt > 0, "the exemptions are reported, not hidden");
  assert.ok(audit.summary.passed < audit.summary.entryPoints,
    "passed must never reach the entry-point total — exempt and unchecked are not passes");
});

test("AP2 — Rule 15: the rewritten pages kept every capability they had", () => {
  // The exact strings that existed above the fold before AP2 touched these files. A diff that
  // deletes a feature to make a first screen cleaner fails here regardless of how the audit reads.
  const preserved = {
    "about.html": [
      "RBC &middot; Scotiabank &middot; Ontario Health &middot; City of Toronto &middot; IBM &middot; Cavalluzzo",
      "15 Years &bull; Enterprise-Grade Delivery &bull; One Standard",
      "/images/profile-photo.jpg",
    ],
    "trust.html": [
      "real capabilities, honestly stated",
      "Governance &amp; Safety",
      "Safety-first, by design",
    ],
    "growth-library.html": [
      "Practical AI, IT, and workflow packs buyers can use the same day",
      "Private intelligence vault",
      "Buy a practical asset, map the workflow first, or bring IIS in for the build.",
      "This isn’t content. It’s",
    ],
  };
  for (const [file, needles] of Object.entries(preserved)) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const needle of needles) {
      assert.ok(html.includes(needle),
        `${file} lost "${needle}" — Rule 15: copy is improved IN PLACE, nothing is removed, renamed or simplified away to make a first screen read better`);
    }
  }
});

test("AP1 — every entry point on disk is honest, exempt or not (Rule 14 has no exemption)", () => {
  const audit = auditSalesSurfaces({ root: ROOT, entryPoints: CUSTOMER_ENTRY_POINTS });
  const lies = audit.results.flatMap((r) => r.rule14.map((f) => `${r.file}:${f.line ?? "?"} ${f.class} — ${f.detail}`));
  assert.deepEqual(lies, [], `Rule 14 violations above the fold (exemption does not cover these):\n${lies.join("\n")}`);
});
