// first-screen-audit.test.mjs — RUN-AO / AO1. What the first screen SAYS.
//
// The proof this suite is required to show, and shows below with both halves:
//   RED   — a fabricated guarantee, an experience overclaim beyond 15+ years, the forbidden name, a
//           fabricated proof claim, a hard metric the measured feed does not carry, and a first
//           screen that is navigation and nothing else (`no-claim-above-the-fold`).
//   GREEN — the real declared entry points, audited from disk, every finding naming its file and,
//           where the offending string exists in the source, its 1-based line.
//
// And the honesty half: an entry point whose first screen is mounted at runtime, or which is not on
// disk at all, comes back UNCHECKED with a reason and is asserted NEVER to be folded into `passed`.
//
// Run: node tests/first-screen-audit.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  auditFirstScreen, auditEntryPoints, extractFirstScreen, stripChrome, lineOf,
  hasValueClaim, uncarriedMetrics,
  VERDICT, CLASSES, FIRST_SCREEN_SCHEMA, SENDS, WRITES,
} = await import(new URL("../scripts/lib/first-screen-audit.mjs", import.meta.url).href);

const { CUSTOMER_ENTRY_POINTS } =
  await import(new URL("../scripts/lib/customer-link-graph.mjs", import.meta.url).href);

const page = (body) => `<!doctype html><html><head><title>t</title></head><body>
<nav><a href="/">Home</a><a href="/services.html">Services</a><a href="/plans/">Plans</a></nav>
${body}
<footer><a href="/terms.html">Terms</a></footer></body></html>`;

const classesOf = (r) => r.findings.map((f) => f.class);

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ao1-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

test("AO1 — the module is pure: it declares that it neither sends nor writes", () => {
  assert.equal(SENDS, false);
  assert.equal(WRITES, false);
  assert.equal(FIRST_SCREEN_SCHEMA, "first-screen-audit.v1");
});

test("AO1 RED — a first screen that is navigation and nothing else fails as no-claim-above-the-fold", () => {
  const r = auditFirstScreen(page("<main><h1>Integrated IT Support</h1></main>"), { file: "x.html" });
  assert.equal(r.verdict, VERDICT.BROKEN);
  assert.ok(classesOf(r).includes(CLASSES.NO_CLAIM),
    `expected ${CLASSES.NO_CLAIM}, got ${classesOf(r).join(", ")}`);
});

test("AO1 RED — nav chrome alone never counts as a claim, however much of it there is", () => {
  const heavyNav = page(`<div class="menu-drawer"><a href="/a">Services</a><a href="/b">Plans</a>
    <a href="/c">Shop</a><a href="/d">About Us</a><a href="/e">Downloads</a></div>
    <main><h2>Integrated IT Support Inc.</h2></main>`);
  const r = auditFirstScreen(heavyNav, { file: "x.html" });
  assert.ok(classesOf(r).includes(CLASSES.NO_CLAIM));
  assert.ok(!/Downloads/.test(extractFirstScreen(heavyNav)), "menu container was not stripped");
});

test("AO1 RED — guarantee / money-back / risk-free language fails by name, with a line", () => {
  for (const bad of ["100% guaranteed results", "money-back guarantee", "risk-free trial", "We guarantee uptime"]) {
    const html = page(`<main><h1>Support that saves you hours</h1><p>${bad}.</p></main>`);
    const r = auditFirstScreen(html, { file: "x.html" });
    assert.equal(r.verdict, VERDICT.BROKEN, `"${bad}" was allowed through`);
    assert.ok(classesOf(r).includes(CLASSES.GUARANTEE), `"${bad}" → ${classesOf(r).join(", ")}`);
    const f = r.findings.find((x) => x.class === CLASSES.GUARANTEE);
    assert.equal(typeof f.line, "number", `"${bad}" reported no source line`);
  }
});

test("AO1 RED — an experience claim beyond 15+ years fails; 15+ years passes", () => {
  const over = auditFirstScreen(page("<main><h1>21+ years of IT support that saves you hours</h1></main>"), { file: "x.html" });
  assert.ok(classesOf(over).includes(CLASSES.EXPERIENCE_OVERCLAIM));

  const ok = auditFirstScreen(page("<main><h1>15+ years of IT support that saves you hours</h1></main>"), { file: "x.html" });
  assert.ok(!classesOf(ok).includes(CLASSES.EXPERIENCE_OVERCLAIM), "15+ years must remain sayable");
});

test("AO1 RED — the forbidden name fails wherever it sits above the fold", () => {
  const r = auditFirstScreen(page("<main><h1>We save you hours</h1><p>Formerly at Raymond James.</p></main>"), { file: "x.html" });
  assert.ok(classesOf(r).includes(CLASSES.FORBIDDEN_NAME));
  assert.equal(typeof r.findings.find((f) => f.class === CLASSES.FORBIDDEN_NAME).line, "number");
});

test("AO1 RED — proof claims with no evidence on disk fail as fabricated", () => {
  for (const bad of ["Trusted by 200 businesses", "Official Microsoft partner", "Used by thousands"]) {
    const r = auditFirstScreen(page(`<main><h1>We fix it faster</h1><p>${bad}.</p></main>`), { file: "x.html" });
    assert.ok(classesOf(r).includes(CLASSES.FABRICATED_PROOF), `"${bad}" → ${classesOf(r).join(", ")}`);
  }
});

test("AO1 RED — a hard metric the measured feed does not carry fails; one it carries passes", () => {
  const html = page("<main><h1>We resolve 99.9% of tickets and save you hours</h1></main>");

  const uncarried = auditFirstScreen(html, { file: "x.html", carriedFigures: [] });
  assert.ok(classesOf(uncarried).includes(CLASSES.UNCARRIED_METRIC));

  const carried = auditFirstScreen(html, { file: "x.html", carriedFigures: ["99.9%"] });
  assert.ok(!classesOf(carried).includes(CLASSES.UNCARRIED_METRIC),
    "a figure the feed genuinely carries must not be flagged");
});

test("AO1 — a price is an offer, not a measurement, and is never flagged as an uncarried metric", () => {
  const r = auditFirstScreen(page("<main><h1>Preventative IT support starting at $6,000 per month</h1></main>"), { file: "x.html" });
  assert.equal(r.verdict, VERDICT.OK, JSON.stringify(r.findings));
  assert.deepEqual(uncarriedMetrics("starting at $6,000 per month", []), []);
});

test("AO1 GREEN — a first screen that promises something and overclaims nothing passes clean", () => {
  const r = auditFirstScreen(
    page("<main><h1>Stop losing hours to IT problems</h1><p>Preventative support that keeps your team working, starting at $600 per month. 15+ years of real IT operations.</p></main>"),
    { file: "x.html" },
  );
  assert.equal(r.verdict, VERDICT.OK, JSON.stringify(r.findings, null, 1));
  assert.deepEqual(classesOf(r), [CLASSES.OK]);
});

test("AO1 HONESTY — a runtime-mounted first screen is UNCHECKED with a reason, never a pass", () => {
  const r = auditFirstScreen(`<!doctype html><body><div id="root"></div><script>mount()</script></body>`, { file: "app.html" });
  assert.equal(r.verdict, VERDICT.UNCHECKED);
  assert.equal(r.findings[0].class, CLASSES.RUNTIME_FIRST_SCREEN);
  assert.match(r.findings[0].detail, /runtime/i);
});

test("AO1 HONESTY — an entry point not on disk is UNCHECKED and is not counted in passed", () => {
  const dir = fixture({ "index.html": page("<main><h1>We save you time</h1></main>") });
  const out = auditEntryPoints({ root: dir, entryPoints: ["index.html", "gone.html"] });
  assert.equal(out.summary.entryPoints, 2);
  assert.equal(out.summary.passed, 1);
  assert.equal(out.summary.unchecked, 1);
  assert.equal(out.unchecked[0].findings[0].class, CLASSES.NO_FILE);
  assert.notEqual(out.summary.passed, out.summary.entryPoints,
    "unchecked must never be folded into the pass count");
  assert.match(out.summary.note, /never folded/i);
});

test("AO1 — the audit is not fooled into green by a page that merely resolves", () => {
  const dir = fixture({
    "a.html": page("<main><h1>Integrated IT Support Inc.</h1></main>"),          // resolves, says nothing
    "b.html": page("<main><h1>We cut your downtime</h1><p>Risk-free.</p></main>"), // resolves, lies
  });
  const out = auditEntryPoints({ root: dir, entryPoints: ["a.html", "b.html"] });
  assert.equal(out.ok, false);
  assert.equal(out.summary.broken, 2);
  assert.equal(out.summary.passed, 0);
});

test("AO1 GREEN — the real declared entry points are audited, and every finding names a file", () => {
  const out = auditEntryPoints({ root: ROOT, entryPoints: CUSTOMER_ENTRY_POINTS });
  assert.equal(out.schema, FIRST_SCREEN_SCHEMA);
  assert.equal(out.summary.entryPoints, CUSTOMER_ENTRY_POINTS.length);
  assert.equal(
    out.summary.passed + out.summary.broken + out.summary.unchecked,
    out.summary.entryPoints,
    "every entry point must land in exactly one bucket",
  );
  for (const r of out.results) {
    assert.ok(typeof r.file === "string" && r.file.length > 0);
    assert.ok(Array.isArray(r.findings) && r.findings.length > 0, `${r.file} produced no finding at all`);
    for (const f of r.findings) assert.ok(typeof f.class === "string" && f.class.length > 0);
  }
  // Reported, not enforced: this cycle records the real state rather than rewriting pages to pass.
  console.log(`AO1 first screens — ${out.summary.passed} pass · ${out.summary.broken} with findings · ${out.summary.unchecked} unchecked (never counted as passing)`);
  for (const r of out.broken) {
    for (const f of r.findings) console.log(`  ${r.file}${f.line ? ":" + f.line : ""} — ${f.class}: ${f.detail}`);
  }
});

test("AO1 — the real entry points carry no forbidden name and no guarantee language", () => {
  const out = auditEntryPoints({ root: ROOT, entryPoints: CUSTOMER_ENTRY_POINTS });
  const hard = [];
  for (const r of out.results) {
    for (const f of r.findings) {
      if (f.class === CLASSES.FORBIDDEN_NAME || f.class === CLASSES.GUARANTEE) {
        hard.push(`${r.file}${f.line ? ":" + f.line : ""} — ${f.class}: ${f.detail}`);
      }
    }
  }
  assert.deepEqual(hard, [], `hard Rule 14 violations above the fold:\n${hard.join("\n")}`);
});

test("AO1 — helpers behave: stripChrome removes chrome, lineOf names a real line", () => {
  const html = page("<main><h1>We save you hours</h1></main>");
  assert.ok(!/Terms/.test(stripChrome(html)), "footer survived");
  assert.ok(!/Services/.test(stripChrome(html)), "nav survived");
  assert.ok(hasValueClaim("this saves you hours"));
  assert.ok(!hasValueClaim("Integrated IT Support Inc."));
  const ln = lineOf(html, "We save you hours");
  assert.equal(typeof ln, "number");
  assert.match(html.split("\n")[ln - 1], /We save you hours/);
  assert.equal(lineOf(html, "a string that is not there"), null);
});
