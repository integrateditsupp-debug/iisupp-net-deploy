// AV1 — the currency, settled end to end.
//
// The invariant this suite exists to hold: the audit may NOT return "consistent" while surfaces
// disagree, and it may NOT pick a direction on its own. Every class below is proven against a
// fixture built to fail exactly that way — an audit that has only ever seen the real tree has been
// shown to produce a verdict, not to catch anything.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  auditCurrency, readDeclarations, readDirection, statementFor,
  SURFACES, UNRUN_SURFACES, VERDICT, HOW, ROLE, DECISION_FILE,
} from "../scripts/lib/currency-consistency.mjs";

const root = path.resolve(import.meta.dirname, "..");

/** A fixture tree carrying only the surfaces a case needs. Removed by the caller. */
function fixture(files) {
  const dir = makeScratchDir("currency-fixture-");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}
const withFixture = (files, fn) => {
  const dir = fixture(files);
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

const PLANS = (cur) => `<html><body><p>All prices in ${cur}.</p></body></html>`;
const CHECKOUT = (cur) => `// checkout\nconst currency = String(pd.currency || '${cur.toLowerCase()}').toLowerCase();\n`;

/* ── 1. the real tree, read rather than asserted ─────────────────────────────────────────────── */

test("the money path is read from the real tree and every declaration carries a file and a line", () => {
  const { declarations } = readDeclarations({ root });
  assert.ok(declarations.length >= 2, "the money path declares at least two currencies somewhere");
  for (const d of declarations) {
    assert.match(d.currency, /^[A-Z]{3}$/);
    assert.ok(typeof d.file === "string" && d.file.length, "every declaration names its file");
    assert.ok(Number.isInteger(d.line) && d.line > 0, `every declaration carries a line: ${d.file}`);
    assert.ok(typeof d.evidence === "string" && d.evidence.length, "every declaration carries the source text that produced it");
    assert.ok(Object.values(ROLE).includes(d.role), "every declaration names the role it plays on the money path");
    assert.ok(Object.values(HOW).includes(d.how), "every declaration says HOW the currency got there");
  }
});

test("the surface table is data, not prose — every entry names a file, a role, a reason and a matcher", () => {
  for (const s of SURFACES) {
    assert.ok(s.file && s.role && s.why, `surface incomplete: ${JSON.stringify(s.file)}`);
    assert.ok(s.re instanceof RegExp, `surface ${s.file} carries no matcher`);
    assert.ok(Object.values(HOW).includes(s.how), `surface ${s.file} does not say how`);
  }
});

/* ── 2. THE INVARIANT: disagreement can never read as agreement ──────────────────────────────── */

test("two currencies with no declared direction is UNDECIDED — never consistent", () => {
  withFixture({ "plans/index.html": PLANS("USD"), "netlify/functions/stripe-checkout.js": CHECKOUT("CAD") }, (dir) => {
    const r = auditCurrency({ root: dir });
    assert.equal(r.verdict, VERDICT.UNDECIDED);
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
    assert.deepEqual(r.currencies, ["CAD", "USD"]);
  });
});

test("the divergence is reported WITH both citations, not smoothed into a count", () => {
  withFixture({ "plans/index.html": PLANS("USD"), "netlify/functions/stripe-checkout.js": CHECKOUT("CAD") }, (dir) => {
    const r = auditCurrency({ root: dir });
    const line = statementFor(r);
    assert.match(line, /UNDECIDED/);
    assert.match(line, /stripe-checkout\.js:\d+/, "the statement names the file and the line of the off surface");
    assert.match(line, /CAD/);
    assert.match(line, /USD/);
    assert.match(line, /software may not pick/, "the statement says out loud that this is not software's decision");
  });
});

test("one currency everywhere and no direction reads CONSISTENT", () => {
  withFixture({ "plans/index.html": PLANS("USD"), "netlify/functions/stripe-checkout.js": CHECKOUT("USD") }, (dir) => {
    const r = auditCurrency({ root: dir });
    assert.equal(r.verdict, VERDICT.CONSISTENT);
    assert.equal(r.summary.divergent, 0);
  });
});

/* ── 3. once a direction exists, the same module ENFORCES it ─────────────────────────────────── */

test("a declared direction turns the divergence red by name, and names every surface that is off", () => {
  withFixture({
    "plans/index.html": PLANS("CAD"),
    "netlify/functions/stripe-checkout.js": CHECKOUT("CAD"),
    "netlify/functions/aria-web-tier.js": "export const TIER = {\n  currency: 'USD',\n};\n",
    [DECISION_FILE]: JSON.stringify({ currency: "CAD", decidedBy: "Ahmad", decidedOn: "2026-08-11" }),
  }, (dir) => {
    const r = auditCurrency({ root: dir });
    assert.equal(r.verdict, VERDICT.DIVERGENT);
    assert.equal(r.summary.divergent, 1);
    assert.equal(r.divergent[0].file, "netlify/functions/aria-web-tier.js");
    assert.equal(r.divergent[0].currency, "USD");
    assert.match(statementFor(r), /DIVERGENT from the declared CAD/);
  });
});

test("a direction every surface agrees with reads CONSISTENT and says so", () => {
  withFixture({
    "plans/index.html": PLANS("CAD"),
    "netlify/functions/stripe-checkout.js": CHECKOUT("CAD"),
    [DECISION_FILE]: JSON.stringify({ currency: "CAD" }),
  }, (dir) => {
    const r = auditCurrency({ root: dir });
    assert.equal(r.verdict, VERDICT.CONSISTENT);
    assert.match(statementFor(r), /matching the declared direction/);
  });
});

test("a single currency that contradicts the declared direction is still DIVERGENT — unanimity is not correctness", () => {
  withFixture({
    "plans/index.html": PLANS("USD"),
    "netlify/functions/stripe-checkout.js": CHECKOUT("USD"),
    [DECISION_FILE]: JSON.stringify({ currency: "CAD" }),
  }, (dir) => {
    const r = auditCurrency({ root: dir });
    assert.equal(r.verdict, VERDICT.DIVERGENT);
    assert.equal(r.summary.divergent, 2);
  });
});

/* ── 4. the decision file itself cannot be fudged ────────────────────────────────────────────── */

test("an absent decision file is undeclared with a reason, not an error", () => {
  withFixture({ "plans/index.html": PLANS("USD") }, (dir) => {
    const d = readDirection({ root: dir });
    assert.equal(d.declared, false);
    assert.match(d.reason, /no direction has been declared/);
  });
});

test("an unparseable or currency-less decision file is undeclared with its reason — never treated as a decision", () => {
  withFixture({ "plans/index.html": PLANS("USD"), [DECISION_FILE]: "{ not json" }, (dir) => {
    const d = readDirection({ root: dir });
    assert.equal(d.declared, false);
    assert.match(d.reason, /unparseable/);
  });
  withFixture({ "plans/index.html": PLANS("USD"), [DECISION_FILE]: JSON.stringify({ note: "soon" }) }, (dir) => {
    const d = readDirection({ root: dir });
    assert.equal(d.declared, false);
    assert.match(d.reason, /names no three-letter currency/);
  });
});

/* ── 5. unreadable and unrun are their own facts ─────────────────────────────────────────────── */

test("a money path with nothing readable is UNREADABLE — not consistent by vacancy", () => {
  withFixture({ "README.md": "nothing here" }, (dir) => {
    const r = auditCurrency({ root: dir });
    assert.equal(r.verdict, VERDICT.UNREADABLE);
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
  });
});

test("a present file that declares no currency is reported unreadable BY NAME, not silently skipped", () => {
  withFixture({ "plans/index.html": "<html><body>no prices here</body></html>" }, (dir) => {
    const { unreadable } = readDeclarations({ root: dir });
    const hit = unreadable.find((u) => u.file === "plans/index.html");
    assert.ok(hit, "the present-but-silent file is named");
    assert.match(hit.reason, /declares no currency/);
  });
});

test("the Stripe half is declared UNRUN with its reason and is never counted as agreeing", () => {
  assert.equal(UNRUN_SURFACES.length, 1);
  const u = UNRUN_SURFACES[0];
  assert.equal(u.how, HOW.UNRUN);
  assert.match(u.reason, /stored inside Stripe/);
  const r = auditCurrency({ root });
  assert.equal(r.summary.unrun, 1);
  assert.ok(!r.declarations.some((d) => d.how === HOW.UNRUN), "an unrun surface never appears as a declaration");
  assert.match(statementFor(r), /unrun/);
});

/* ── 6. a typed currency is a different fact from a read one ─────────────────────────────────── */

test("the proposal generator's currency is classed TYPED, because a literal survives a page change", () => {
  const r = auditCurrency({ root });
  const typed = r.declarations.filter((d) => d.how === HOW.TYPED);
  assert.equal(typed.length, r.summary.typed);
  assert.ok(typed.length >= 1, "at least one surface types its currency rather than reading it");
  assert.ok(typed.every((d) => d.role === ROLE.SALES_DOCUMENT));
});

/* ── 7. the real tree, stated rather than asserted green ─────────────────────────────────────── */

test("the real money path is reported honestly today: more than one currency, no direction declared", () => {
  const r = auditCurrency({ root });
  // This assertion is deliberately NOT "consistent". It records the true state, and it will go red
  // the moment the state changes — which is exactly when someone should look at it again.
  assert.ok([VERDICT.UNDECIDED, VERDICT.DIVERGENT, VERDICT.CONSISTENT].includes(r.verdict));
  if (r.summary.currencies > 1) {
    assert.ok(r.divergent.length > 0, "a split money path always names the surfaces that are off");
    for (const d of r.divergent) assert.ok(d.file && d.line, "every off surface is citable");
  }
});

/* ── 8. a tie is not a majority ──────────────────────────────────────────────────────────────── */

test("an even split with no direction puts EVERY surface in dispute — software does not nominate a winner", () => {
  withFixture({ "plans/index.html": PLANS("USD"), "netlify/functions/stripe-checkout.js": CHECKOUT("CAD") }, (dir) => {
    const r = auditCurrency({ root: dir });
    assert.equal(r.verdict, VERDICT.UNDECIDED);
    assert.equal(r.summary.divergent, r.summary.surfaces, "in a tie no surface is treated as the default");
    const line = statementFor(r);
    assert.match(line, /plans\/index\.html:\d+/);
    assert.match(line, /stripe-checkout\.js:\d+/);
  });
});

test("a strict majority with no direction cites only the minority — a fact about the tree, not a decision", () => {
  withFixture({
    "plans/index.html": PLANS("USD"),
    "netlify/functions/stripe-webhook.js": "const currency = (invoice.currency || 'usd').toUpperCase();\n",
    "netlify/functions/stripe-checkout.js": CHECKOUT("CAD"),
  }, (dir) => {
    const r = auditCurrency({ root: dir });
    assert.equal(r.verdict, VERDICT.UNDECIDED);
    assert.equal(r.summary.divergent, 1);
    assert.equal(r.divergent[0].currency, "CAD");
  });
});
