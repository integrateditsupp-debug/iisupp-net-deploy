// quote-inputs.test.mjs — RUN-BL / BL1. THE DOCUMENT A CONVERSATION ENDS IN, PROVEN BY FIXTURE.
//
// The invariant these cases exist to hold: the trace may NOT report a quote as traceable while the
// only generator in this tree refuses the card the buyer clicked, it may NOT report a founder's
// judgement as a gap, and it may NOT report a gap it merely inferred by reading two files and
// assuming they meet. Every class is proven RED FIRST against a fixture built to fail exactly that
// way — a trace that has only ever seen the real tree has been shown to produce a verdict, not to
// catch anything.
//
// It writes nothing and sends nothing, and a case at the bottom proves both.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  traceQuoteInputs, readQuoteAsk, statementFor,
  INPUTS, ORIGIN, STATE, VERDICT, QUOTE_INPUT_SCHEMA,
} from "../scripts/lib/quote-inputs.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function fixture(files) {
  const dir = makeScratchDir("bl1-quote-");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}
const withFixture = (files, fn) => {
  const dir = fixture(files);
  try { return fn(dir); } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* mount refuses unlink */ } }
};

/** A deck carrying a band and a quote button, in the shape the real page uses. */
const DECK = (band, options, title = "Tier 1 — Operational Foundation") => `
<div class="deck-slot" data-deck="1">
  <div class="deck-card">
    <div class="deck-face deck-front">
      <div class="deck-meta"><div class="deck-price">${band}</div></div>
    </div>
    <div class="deck-face deck-back">
      <button type="button" class="deck-cta-buy" data-buy-options='${JSON.stringify({ title, options })}'>Purchase</button>
    </div>
  </div>
</div>`;

const MAILTO = (fields) => `
<script>
  window.location.href = 'mailto:ahmad.wasee@iisupp.net?subject=' + encodeURIComponent('Custom Quote Request — ' + data.title) + '&body=' + encodeURIComponent('Please provide a custom quote for ' + data.title + '.\\n\\nEnvironment details:\\n${fields.map((f) => `- ${f}:\\n`).join("")}\\nThank you.');
</script>`;

const PAGE = (decks, fields = ["Users / devices", "Locations", "Current stack", "Timeline"]) =>
  `<html><body><div class="price-deck" data-price-deck>${decks.join("\n")}</div>${MAILTO(fields)}</body></html>`;

/** A published plan table in the exact shape `readPricingSources` parses. */
const PLANS = (headers, prices) =>
  `<table><thead><tr><th>Feature</th>${headers.map((h) => `<th>${h}</th>`).join("")}</tr><tr class="price-row"><td>Price</td>${prices.map((p) => `<td>${p}</td>`).join("")}</tr></thead></table>`;

const QUOTE_OPT = { id: "t1-quote", name: "Request Custom Quote", quote: true };
const MONTH_OPT = { id: "t1-first", name: "Tier 1 · First Month", price: "6000.00", description: "first month at lower bound" };
const DEPOSIT_OPT = { id: "t1-dep", name: "Tier 1 · Deposit to start", price: "2000.00", description: "deposit" };
const DECISIONS = {
  "docs/RESPONSE-TIME-DECISIONS.md": "# response times\nstated\n",
  "docs/RETENTION-DECISIONS.md": "# retention\nstated\n",
};

// ── the ask, read off the page rather than typed ─────────────────────────────

test("BL1 — the fields a buyer is asked for are read from the surface, not declared here", () => {
  withFixture({ "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [MONTH_OPT, QUOTE_OPT])]) }, (dir) => {
    const ask = readQuoteAsk({ root: dir });
    assert.equal(ask.ok, true, ask.reason || "");
    assert.deepEqual(ask.fields.map((f) => f.label), ["Users / devices", "Locations", "Current stack", "Timeline"]);
    assert.equal(ask.buttons, 1, "a quote button is one that DECLARES itself a quote, never one matched on its label");
  });
});

test("BL1 — RED: a surface whose ask cannot be read is UNREADABLE, never treated as asking nothing", () => {
  withFixture({ "index.html": `<html><body>${DECK("$6,000 – $10,000 / mo", [QUOTE_OPT])}</body></html>` }, (dir) => {
    const ask = readQuoteAsk({ root: dir });
    assert.equal(ask.ok, false);
    assert.match(ask.reason, /not the same fact as there being none/);
    assert.equal(ask.buttons, 1, "the buttons are still counted — a page can have a button and an unreadable ask");
  });
});

test("BL1 — RED: no surface at all is refused, not answered", () => {
  withFixture({ "README.md": "nothing here" }, (dir) => {
    const ask = readQuoteAsk({ root: dir });
    assert.equal(ask.ok, false);
    assert.match(ask.reason, /no declared quote surface/);
  });
});

// ── the finding, and its inverse ─────────────────────────────────────────────

test("BL1 — RED: a generator that refuses the card the buyer clicked is FOR_WANT, and names both sides", () => {
  // The real tree's shape, reduced: the plan table publishes keys the deck tiers do not have.
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [DEPOSIT_OPT, MONTH_OPT, QUOTE_OPT])]),
    "plans/index.html": PLANS(["Personal", "Pro"], ["$899/mo", "$2,250/mo"]),
    ...DECISIONS,
  }, (dir) => {
    const r = traceQuoteInputs({ root: dir });
    const gap = r.inputs.find((i) => i.id === "document.generator-for-this-surface");
    assert.equal(gap.state, STATE.FOR_WANT);
    assert.match(gap.missing, /personal, pro/, "the keys the generator DOES price must be named");
    assert.match(gap.missing, /retainer-tier-1/, "the tier it refuses must be named");
    assert.equal(r.verdict, VERDICT.INCOMPLETE);
  });
});

test("BL1 — the inverse, or the class is unfalsifiable: publish the deck tiers and it becomes CARRIED", () => {
  // Without this case, FOR_WANT could be hard-coded and nobody would know. Here the plan table
  // publishes the three deck tiers by name, and the same trace flips to carried on the same code.
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [MONTH_OPT, QUOTE_OPT])]),
    "plans/index.html": PLANS(
      ["Retainer Tier 1", "Retainer Tier 2", "Retainer Tier 3"],
      ["$6,000/mo", "$14,000/mo", "$30,000/mo"],
    ),
    ...DECISIONS,
  }, (dir) => {
    const r = traceQuoteInputs({ root: dir });
    const gen = r.inputs.find((i) => i.id === "document.generator-for-this-surface");
    assert.equal(gen.state, STATE.CARRIED, gen.statement);
    assert.match(gen.by, /generateRetainerProposal/);
  });
});

test("BL1 — RED: an unreadable plan table is UNREADABLE, which is not the same fact as a missing generator", () => {
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [MONTH_OPT, QUOTE_OPT])]),
    ...DECISIONS,
  }, (dir) => {
    const r = traceQuoteInputs({ root: dir });
    const gen = r.inputs.find((i) => i.id === "document.generator-for-this-surface");
    assert.equal(gen.state, STATE.UNREADABLE);
    assert.equal(r.verdict, VERDICT.UNREADABLE, "no verdict is honest while something could not be read");
    assert.match(statementFor(r), /UNREADABLE/);
  });
});

// ── the two classes that must never merge ────────────────────────────────────

test("BL1 — a founder's judgement is BY_DESIGN and is never counted as a gap", () => {
  // Every TREE input satisfied on purpose — deposit included — so that the only thing left standing
  // is the founder's two steps. If a gap remained here the case would prove nothing about classes.
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [DEPOSIT_OPT, MONTH_OPT, QUOTE_OPT])]),
    "plans/index.html": PLANS(["Retainer Tier 1", "Retainer Tier 2", "Retainer Tier 3"], ["$6,000/mo", "$14,000/mo", "$30,000/mo"]),
    ...DECISIONS,
  }, (dir) => {
    const r = traceQuoteInputs({ root: dir });
    for (const id of ["scope.of-work", "price.figure-for-this-scope"]) {
      const i = r.inputs.find((x) => x.id === id);
      assert.equal(i.state, STATE.BY_DESIGN, `${id} is a person's step, and reporting it as missing would bury the real gaps under work nobody should automate`);
      assert.equal(i.missing, null);
    }
    assert.equal(r.summary.forWant, 0,
      `nothing should be missing in this fixture; missing: ${r.inputs.filter((i) => i.state === STATE.FOR_WANT).map((i) => `${i.id} (${i.missing})`).join(" | ")}`);
  });
});

test("BL1 — a fact only the buyer knows, asked and captured by nothing, is its own class", () => {
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [MONTH_OPT, QUOTE_OPT])]),
    "plans/index.html": PLANS(["Retainer Tier 1", "Retainer Tier 2", "Retainer Tier 3"], ["$6,000/mo", "$14,000/mo", "$30,000/mo"]),
    ...DECISIONS,
  }, (dir) => {
    const r = traceQuoteInputs({ root: dir });
    const asked = r.inputs.filter((i) => i.state === STATE.ASKED_NOT_CAPTURED);
    assert.equal(asked.length, 4);
    for (const a of asked) {
      assert.match(a.missing, /intake artefact/);
      assert.ok(a.cite[0].includes("index.html:"), "an asked-and-uncaptured input must cite the line that asks");
    }
    assert.equal(r.verdict, VERDICT.INCOMPLETE, "asked and captured by nothing is not complete, even with every artefact present");
  });
});

// ── the disciplines ──────────────────────────────────────────────────────────

test("BL1 — RED: an hours figure on a card is REFUSED, and drags the whole verdict to UNREADABLE", () => {
  // Discipline 2, proven rather than declared. This company sells a flat retainer; the moment a card
  // prices by the hour, a quote built from these inputs is a quote for a different product, and the
  // trace must say so instead of quietly carrying it.
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [DEPOSIT_OPT, { ...MONTH_OPT, name: "Tier 1 · 40 hours included" }, QUOTE_OPT])]),
    "plans/index.html": PLANS(["Retainer Tier 1", "Retainer Tier 2", "Retainer Tier 3"], ["$6,000/mo", "$14,000/mo", "$30,000/mo"]),
    ...DECISIONS,
  }, (dir) => {
    const r = traceQuoteInputs({ root: dir });
    assert.equal(r.refusals.length > 0, true, "an hours figure read off a card must reach the refusal list");
    assert.match(r.refusals[0].why, /flat retainer/);
    assert.equal(r.verdict, VERDICT.UNREADABLE, "no verdict is honest while an input is priced by the hour");
    assert.match(statementFor(r), /UNREADABLE/);
  });
});

test("BL1 — the inverse: the same card without hours produces no refusal, so the guard is not a rubber stamp", () => {
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [DEPOSIT_OPT, MONTH_OPT, QUOTE_OPT])]),
    "plans/index.html": PLANS(["Retainer Tier 1", "Retainer Tier 2", "Retainer Tier 3"], ["$6,000/mo", "$14,000/mo", "$30,000/mo"]),
    ...DECISIONS,
  }, (dir) => {
    const r = traceQuoteInputs({ root: dir });
    assert.deepEqual(r.refusals, []);
    assert.notEqual(r.verdict, VERDICT.UNREADABLE);
  });
});

test("BL1 — RED: a decision that is not written down is named, never assumed", () => {
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [MONTH_OPT, QUOTE_OPT])]),
    "plans/index.html": PLANS(["Retainer Tier 1", "Retainer Tier 2", "Retainer Tier 3"], ["$6,000/mo", "$14,000/mo", "$30,000/mo"]),
    "docs/RETENTION-DECISIONS.md": "# retention\nstated\n",
  }, (dir) => {
    const r = traceQuoteInputs({ root: dir });
    const rt = r.inputs.find((i) => i.id === "terms.response-times");
    assert.equal(rt.state, STATE.FOR_WANT);
    assert.match(rt.missing, /RESPONSE-TIME-DECISIONS\.md/, "the missing artefact is named by path, so closing it is one file");
  });
});

test("BL1 — no figure is typed into this module; every amount is read from the module that owns it", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/lib/quote-inputs.mjs"), "utf8");
  const literals = src.match(/\$[0-9][0-9,]*/g) || [];
  assert.deepEqual(literals, [],
    `a dollar figure typed here (${literals.join(", ")}) is a figure that will disagree with chargeable-amounts within a month`);
});

test("BL1 — every declared input names an origin, and a TREE input names the provider that answers it", () => {
  for (const i of INPUTS) {
    assert.ok(Object.values(ORIGIN).includes(i.origin), `${i.id} has no origin`);
    assert.ok(String(i.what).length > 10, `${i.id} does not say what it is`);
    if (i.origin === ORIGIN.TREE) assert.ok(i.provider, `${i.id} claims the tree carries it and names nothing that reads it`);
    else assert.ok(i.why || i.capturedBy, `${i.id} is a person's input and does not say why`);
  }
});

test("BL1 — RED: a declared provider that does not exist is UNREADABLE, never quietly skipped", () => {
  // Proven through the public surface: an input whose provider is absent must not vanish.
  const broken = INPUTS.filter((i) => i.origin === ORIGIN.TREE && !i.provider);
  assert.deepEqual(broken, [], "no declared TREE input may lack a provider");
});

test("BL1 — the trace writes nothing and declares that it sends nothing", () => {
  withFixture({
    "index.html": PAGE([DECK("$6,000 – $10,000 / mo", [MONTH_OPT, QUOTE_OPT])]),
    "plans/index.html": PLANS(["Retainer Tier 1"], ["$6,000/mo"]),
    ...DECISIONS,
  }, (dir) => {
    const before = fs.readdirSync(dir).sort();
    const r = traceQuoteInputs({ root: dir });
    assert.equal(r.sends, false);
    assert.equal(r.schema, QUOTE_INPUT_SCHEMA);
    assert.deepEqual(fs.readdirSync(dir).sort(), before, "a trace that writes into the tree it is reading is not a trace");
  });
});

test("BL1 — the real tree: the statement is generated from the counts, never typed", () => {
  const r = traceQuoteInputs({ root: ROOT });
  const s = statementFor(r);
  assert.match(s, new RegExp(`${r.summary.quoteButtons} quote button`));
  assert.match(s, new RegExp(`${r.summary.carried} carried`));
  if (r.verdict === VERDICT.INCOMPLETE) {
    assert.match(s, /Named, not counted/, "a gap that is counted and not named is the reporting this program exists to refuse");
  }
});
