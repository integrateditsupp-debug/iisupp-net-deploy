// retainer-proposal.test.mjs — RUN-AT / AT2.
//
// The claim under test: a retainer proposal can be produced in minutes from the repository's OWN
// published prices, and it REFUSES rather than emits when a figure cannot be traced to a source.
//
// RED-FIRST, each against a real failure:
//   · a plan key that is not on the published page          → unknown-plan, listing what is
//   · a figure injected into the source table by hand       → untraceable-figure, naming the token
//   · guarantee / money-back / risk-free language           → forbidden-language (rule 7)
//   · an experience claim past 15+ years, the banned name   → forbidden-language
//   · a required section removed from the template          → missing-section
//   · a proposal addressed to nobody                        → no-client
//   · a missing pricing page                                → no-pricing-source, never a default price
// And the property that matters most: the generator SENDS NOTHING.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  readPricingSources, generateRetainerProposal, statementFor,
  REFUSALS, REQUIRED_SECTIONS, PROPOSAL_SCHEMA, PRICING_FILE,
} from "../scripts/lib/retainer-proposal.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A miniature published plan table, shaped exactly like the real page's comparison row. */
function pricedWorld(row = '<td>Price</td><td>$1,200/mo</td><td>$3,400/mo (billed annually)</td>') {
  const dir = makeScratchDir("at2-proposal-");
  fs.mkdirSync(path.join(dir, "plans"));
  fs.writeFileSync(
    path.join(dir, "plans/index.html"),
    "<html>\n<table>\n" +
      `<thead><tr><th>Feature</th><th>Starter</th><th>Growth</th></tr><tr class="price-row">${row}</tr></thead>\n` +
      "</table>\n</html>\n",
  );
  return dir;
}

test("AT2 · prices are parsed from the published page, carrying file and line", () => {
  const dir = pricedWorld();
  const priced = readPricingSources({ root: dir });
  assert.equal(priced.ok, true);
  assert.equal(priced.figures.length, 2);
  const growth = priced.figures.find((f) => f.key === "growth");
  assert.equal(growth.amount, 3400);
  assert.equal(growth.unit, "per month");
  assert.equal(growth.cadence, "billed annually");
  assert.equal(growth.file, PRICING_FILE);
  assert.equal(growth.line, 3);
});

test("AT2 · a plan the page does not publish is REFUSED, and the refusal lists what is published", () => {
  const r = generateRetainerProposal({ root: pricedWorld(), client: "Acme", planKey: "platinum" });
  assert.equal(r.ok, false);
  assert.equal(r.document, null);
  const ref = r.refusals.find((x) => x.class === REFUSALS.UNKNOWN_PLAN);
  assert.match(ref.detail, /starter, growth/);
  assert.match(statementFor(r), /REFUSED/);
});

test("AT2 · a proposal addressed to nobody is REFUSED", () => {
  const r = generateRetainerProposal({ root: pricedWorld(), client: "   ", planKey: "growth" });
  assert.equal(r.ok, false);
  assert.ok(r.refusals.some((x) => x.class === REFUSALS.NO_CLIENT));
});

test("AT2 · no pricing page means no proposal — never a remembered default", () => {
  const empty = makeScratchDir("at2-nopricing-");
  const r = generateRetainerProposal({ root: empty, client: "Acme", planKey: "growth" });
  assert.equal(r.ok, false);
  assert.ok(r.refusals.some((x) => x.class === REFUSALS.NO_SOURCE));
});

test("AT2 · a figure that reaches the document without a source is REFUSED by token", () => {
  // The realistic failure: a second number smuggled into the priced figure itself.
  const sources = {
    file: "plans/index.html", ok: true, reason: null,
    figures: [{ key: "growth", plan: "Growth (was $9,999)", raw: "$3,400/mo", amount: 3400,
      currency: "USD", unit: "per month", cadence: "billed monthly", file: "plans/index.html", line: 3 }],
  };
  const r = generateRetainerProposal({ root: pricedWorld(), client: "Acme", planKey: "growth", sources });
  assert.equal(r.ok, false);
  const ref = r.refusals.find((x) => x.class === REFUSALS.UNTRACEABLE_FIGURE);
  assert.match(ref.detail, /\$9,999/);
  assert.match(ref.detail, /cannot be traced/);
});

test("AT2 · rule-7 language anywhere in the output is a refusal, not a warning", () => {
  const cases = [
    ["Growth — results guaranteed", /guarantee/i],
    ["Growth — money-back", /money-back/i],
    ["Growth — risk-free", /risk-free/i],
    ["Growth — 21+ years", /21\+ years/i],
    ["Growth — Raymond James", /forbidden name/i],
  ];
  for (const [plan, expected] of cases) {
    const sources = {
      file: "plans/index.html", ok: true, reason: null,
      figures: [{ key: "growth", plan, raw: "$3,400/mo", amount: 3400, currency: "USD",
        unit: "per month", cadence: "billed monthly", file: "plans/index.html", line: 3 }],
    };
    const r = generateRetainerProposal({ root: pricedWorld(), client: "Acme", planKey: "growth", sources });
    assert.equal(r.ok, false, `${plan} must refuse`);
    const ref = r.refusals.find((x) => x.class === REFUSALS.FORBIDDEN_LANGUAGE);
    assert.ok(ref, `${plan} refuses as forbidden-language`);
    assert.match(`${ref.detail}`, expected);
  }
});

test("AT2 · a clean generation produces every required section and sends nothing", () => {
  const r = generateRetainerProposal({ root: pricedWorld(), client: "Northline Dental", planKey: "growth" });
  assert.equal(r.ok, true, JSON.stringify(r.refusals));
  assert.equal(r.schema, PROPOSAL_SCHEMA);
  assert.equal(r.sends, false, "the generator writes a document and sends nothing");
  for (const section of REQUIRED_SECTIONS) {
    assert.match(r.document, new RegExp(`^##\\s+${section}\\b`, "m"), `${section} present`);
  }
  assert.match(r.document, /Northline Dental/);
  assert.match(r.document, /plans\/index\.html`, line 3/);
  assert.equal(r.traced.length, 1);
  assert.equal(r.traced[0].token, "$3,400");
});

test("AT2 · what the client owns at the end is stated, and the page wins on conflict", () => {
  const r = generateRetainerProposal({ root: pricedWorld(), client: "Acme", planKey: "growth" });
  assert.match(r.document, /stays in your name/);
  assert.match(r.document, /the page wins/);
  assert.match(r.document, /never marked up/);
});

test("AT2 · the real tree: the published plans are readable and a proposal generates from them", () => {
  const priced = readPricingSources({ root: REPO });
  assert.equal(priced.ok, true, "plans/index.html publishes a price row");
  assert.ok(priced.figures.length >= 2);
  for (const f of priced.figures) {
    assert.ok(Number.isFinite(f.amount) && f.amount > 0, `${f.key} has a real amount`);
    assert.equal(f.file, PRICING_FILE);
  }
  const r = generateRetainerProposal({ root: REPO, client: "A real prospect", planKey: priced.figures[0].key });
  assert.equal(r.ok, true, JSON.stringify(r.refusals));
  assert.equal(r.figure.amount, priced.figures[0].amount, "the document quotes the published number");
});
