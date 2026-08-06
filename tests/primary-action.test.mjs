// primary-action.test.mjs — RUN-AS / AS3.
//
// The claim under test: for every reader-facing file in the published set, the invitation the page
// actually makes is EXTRACTED FROM THE FILE — its words, its target, whether that target can
// receive anything in the tree being published, and whether the ask is proportionate to a first
// visit. Not assumed, not asserted by reading it once.
//
// RED-FIRST, each a failure that a route check and a link check both pass:
//   · a page whose only invitation is to pay — resolves, agrees with its siblings, converts nobody
//   · a form with no action and no delivery marker — the visitor believes they reached us
//   · a form posting to a handler that is not in the tree
//   · a primary ask pointing at a page that does not exist
//   · a page with NO invitation at all reported as having none, never scored as passing
//   · a stylesheet/sitemap declared NOT-APPLICABLE rather than quietly counted as a pass
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditPrimaryActions, auditFile, extractAsks, gradeAsk, resolveTarget, statementFor,
  ACTION_CLASSES, VERDICT, COST, READER_FACING, NOT_READER_FACING,
  PRIMARY_ACTION_SCHEMA, SENDS, WRITES,
} from "../scripts/lib/primary-action.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function scratch(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "as3-action-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}
const clean = (d) => fs.rmSync(d, { recursive: true, force: true });

test("AS3 — the ask is graded by its words, high first so a sale is never read as a browse", () => {
  assert.equal(gradeAsk("Buy now"), COST.HIGH);
  assert.equal(gradeAsk("Subscribe"), COST.HIGH);
  assert.equal(gradeAsk("Book a call"), COST.MEDIUM);
  assert.equal(gradeAsk("Get started"), COST.MEDIUM);
  assert.equal(gradeAsk("Learn more"), COST.LOW);
  assert.equal(gradeAsk("Integrated IT Support Inc."), null, "not every link is an ask");
});

test("AS3 — asks come back in DOCUMENT ORDER so the primary one is the first thing offered", () => {
  const html = `<a href="/pricing.html">Buy now</a><a href="/about.html">Learn more</a><a href="/contact.html">Book a call</a>`;
  const asks = extractAsks(html, { file: "t.html" });
  assert.equal(asks.length, 3);
  assert.deepEqual(asks.map((a) => a.cost), [COST.HIGH, COST.LOW, COST.MEDIUM]);
  assert.ok(asks.every((a) => a.line === 1));
});

test("AS3 — a page that offers a paid ask AND a conversation passes: the lower rung exists", () => {
  const dir = scratch({
    "index.html": `<a href="/plans.html">Buy now</a> <a href="/contact.html">Book a call</a>`,
    "plans.html": "x", "contact.html": "x",
  });
  try {
    const r = auditFile("index.html", { root: dir });
    assert.equal(r.verdict, VERDICT.OK, r.detail);
    assert.equal(r.primary.cost, COST.HIGH, "the primary ask is still the first one");
    assert.ok(r.costs.includes(COST.MEDIUM));
  } finally { clean(dir); }
});

test("AS3 RED — a page whose ONLY invitation is to pay fails as disproportionate", () => {
  const dir = scratch({
    "index.html": `<a href="/checkout.html">Subscribe</a><a href="/checkout.html">Buy</a>`,
    "checkout.html": "x",
  });
  try {
    const r = auditFile("index.html", { root: dir });
    assert.equal(r.verdict, VERDICT.BROKEN);
    assert.equal(r.class, ACTION_CLASSES.DISPROPORTIONATE);
    assert.match(r.detail, /no lower rung/);
  } finally { clean(dir); }
});

test("AS3 RED — a form with no action and no delivery marker reaches nobody", () => {
  const dir = scratch({ "index.html": `<a href="/a.html">Learn more</a><form><input name="email"></form>`, "a.html": "x" });
  try {
    const r = auditFile("index.html", { root: dir });
    assert.equal(r.verdict, VERDICT.BROKEN);
    assert.equal(r.class, ACTION_CLASSES.NO_DELIVERY);
    assert.match(r.detail, /no action and no delivery marker/);
  } finally { clean(dir); }
});

test("AS3 — a netlify-managed form with no action is NOT a dead ask: the host is the target", () => {
  const dir = scratch({ "index.html": `<a href="/a.html">Learn more</a><form netlify><input name="email"></form>`, "a.html": "x" });
  try {
    assert.equal(auditFile("index.html", { root: dir }).verdict, VERDICT.OK);
  } finally { clean(dir); }
});

test("AS3 RED — a form posting to a handler that is not in the tree is caught", () => {
  const dir = scratch({ "index.html": `<a href="/a.html">Learn more</a><form action="/api/no-such-handler"></form>`, "a.html": "x" });
  try {
    const r = auditFile("index.html", { root: dir });
    assert.equal(r.verdict, VERDICT.BROKEN);
    assert.equal(r.class, ACTION_CLASSES.NO_DELIVERY);
    assert.match(r.detail, /not in the tree/);
  } finally { clean(dir); }
});

test("AS3 — a form posting to a function that IS in the tree resolves", () => {
  const dir = scratch({
    "index.html": `<a href="/a.html">Learn more</a><form action="/api/lead"></form>`,
    "a.html": "x",
    "netlify/functions/lead.mjs": "export default () => {}",
  });
  try {
    assert.equal(auditFile("index.html", { root: dir }).verdict, VERDICT.OK);
  } finally { clean(dir); }
});

test("AS3 RED — a primary ask pointing at a page that does not exist is a dead target", () => {
  const dir = scratch({ "index.html": `<a href="/gone.html">Get started</a>` });
  try {
    const r = auditFile("index.html", { root: dir });
    assert.equal(r.verdict, VERDICT.BROKEN);
    assert.equal(r.class, ACTION_CLASSES.DEAD_TARGET);
    assert.match(r.detail, /gone\.html/);
  } finally { clean(dir); }
});

test("AS3 REAL-OR-EMPTY — a page with no invitation is reported as having none, never as passing", () => {
  const dir = scratch({ "index.html": `<h1>We are Integrated IT Support Inc.</h1><p>We do IT.</p>` });
  try {
    const r = auditFile("index.html", { root: dir });
    assert.equal(r.verdict, VERDICT.BROKEN);
    assert.equal(r.class, ACTION_CLASSES.NONE);
    assert.equal(r.primary, null);
  } finally { clean(dir); }
});

test("AS3 — non-prose members of the published set are DECLARED, not dropped and not passed", () => {
  const dir = scratch({ "index.html": `<a href="/a.html">Learn more</a>`, "a.html": "x" });
  try {
    const r = auditPrimaryActions({ root: dir, surfaces: ["index.html", "sitemap.xml", "assets/axis-tokens.css"] });
    assert.equal(r.surfaces, 3);
    assert.equal(r.checked, 1);
    assert.equal(r.notApplicable, 2);
    const skipped = r.rows.filter((x) => x.class === ACTION_CLASSES.NOT_APPLICABLE);
    assert.equal(skipped.length, 2);
    assert.ok(skipped.every((x) => x.verdict === VERDICT.UNCHECKED), "unchecked is a third answer, not a pass");
  } finally { clean(dir); }
});

test("AS3 — a file that is not on disk is UNREADABLE and named", () => {
  const dir = scratch({});
  try {
    const r = auditFile("index.html", { root: dir });
    assert.equal(r.class, ACTION_CLASSES.UNREADABLE);
    assert.equal(r.verdict, VERDICT.BROKEN);
  } finally { clean(dir); }
});

test("AS3 — targets resolve by kind: in-tree, mailto, external, anchor", () => {
  const dir = scratch({ "a.html": "x", "plans/index.html": "x" });
  try {
    assert.equal(resolveTarget("/a.html", { root: dir }).kind, "in-tree");
    assert.ok(resolveTarget("/a.html", { root: dir }).exists);
    assert.ok(resolveTarget("/plans/", { root: dir }).exists, "a directory index resolves");
    assert.ok(resolveTarget("mailto:ahmad.wasee@iisupp.net").exists);
    assert.equal(resolveTarget("https://example.com").kind, "external");
    assert.equal(resolveTarget("#pricing").kind, "anchor");
    assert.ok(!resolveTarget("/nope.html", { root: dir }).exists);
    assert.equal(resolveTarget("").kind, "none");
  } finally { clean(dir); }
});

test("AS3 — the gate reads files and does nothing else", () => {
  assert.equal(SENDS, false);
  assert.equal(WRITES, false);
  assert.equal(READER_FACING.length + NOT_READER_FACING.length, 14);
});

test("AS3 — every reader-facing page in the REAL published set makes an ask that lands", () => {
  const r = auditPrimaryActions({ root: REPO });
  assert.equal(r.schema, PRIMARY_ACTION_SCHEMA);
  assert.equal(r.checked, READER_FACING.length);
  const named = r.failures.map((f) => `${f.file}: ${f.class} — ${f.detail}`);
  assert.deepEqual(named, [], named.join("\n"));
  assert.match(statementFor(r), /each open with an ask/);
});
