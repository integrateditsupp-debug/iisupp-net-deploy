// BF1 — the price a stranger is quoted, checked end to end.
//
// The invariant these tests exist to hold: the audit may NOT return "consistent" while two surfaces
// quote the same tier differently or route the same company to different tiers, and it may NOT pick
// which surface moves. Every class is proven against a fixture built to fail exactly that way — an
// audit that has only ever seen the real tree has been shown to produce a verdict, not to catch
// anything.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  auditPrices, readQuotes, readDirection, statementFor, parseMoney, monthlyCents,
  PRICE_SURFACES, VERDICT, KIND, PERIOD, DECISION_FILE, PRICE_SCHEMA,
} from "../scripts/lib/price-consistency.mjs";

const root = path.resolve(import.meta.dirname, "..");

function fixture(files) {
  // Not `os.tmpdir()` — RUN-BE recorded that volume full on this machine, with 16 of 20 cases dying
  // on `ENOSPC ... mkdtemp` before an assertion ran. The scratch location is chosen by probing.
  const dir = makeScratchDir("price-fixture-");
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

/** A plans page carrying whatever card prices a case needs. */
const PLANS = (cards, { matrix = null, bands = null } = {}) => {
  const cardHtml = Object.entries(cards).map(([tier, price]) =>
    `<div class="pf-tier">${tier}</div>\n      <div class="pf-price">${price}<span class="pf-unit">/mo</span></div>`).join("\n");
  const m = matrix ? [
    "<!-- SENTINEL_MATRIX:START -->",
    "<table><thead>",
    `<tr><th>Feature</th>${Object.keys(matrix).map((t) => `<th>${t}</th>`).join("")}</tr>`,
    `<tr class="price-row"><td>Price</td>${Object.values(matrix).map((p) => `<td>${p}</td>`).join("")}</tr>`,
    "</thead><tbody></tbody></table>",
    "<!-- SENTINEL_MATRIX:END -->",
  ].join("\n") : "";
  const b = bands ? `<script>\nvar TIER_BANDS=[\n${bands.map((x) => `      {name:'${x.name}',max:${x.max},yr:${x.yr}}`).join(",\n")}\n];\n</script>` : "";
  return `<html><body>\n${cardHtml}\n${m}\n${b}\n</body></html>`;
};

const EXPERIMENTS = (rows) => `<html><body><div class="grid">\n${rows.map((r) =>
  `  <div class="box"><strong>${r.tier}</strong><br>${r.price}/mo${r.tail || ""}</div>`).join("\n")}\n</div></body></html>`;

const DECK = (tier, name, lo, hi) =>
  `<span class="deck-badge"><span class="dot"></span>${tier} · ${name}</span>\n<h4 class="deck-name">${name}</h4>\n<div class="deck-price">${lo} – ${hi} / mo</div>`;

/** Only the surfaces a case needs, so an absent file is never mistaken for a passing check. */
const only = (...files) => PRICE_SURFACES.filter((s) => files.includes(`${s.file}::${s.reader}`));

// ---- the primitives ---------------------------------------------------------------------------

test("money is read exactly, or not at all", () => {
  assert.equal(parseMoney("$899"), 89900);
  assert.equal(parseMoney("$19,500"), 1950000);
  assert.equal(parseMoney("$2,250.00"), 225000);
  for (const bad of ["899", "$", "$1,2", "about $899", "$899/mo", "€899", "$899 – $1,200", ""]) {
    assert.equal(parseMoney(bad), null, `"${bad}" must not be read as an exact figure`);
  }
});

test("a period is never assumed — an unreadable one is refused", () => {
  assert.equal(monthlyCents(1200, PERIOD.MONTH).cents, 1200);
  assert.equal(monthlyCents(1200, PERIOD.YEAR).cents, 100);
  assert.equal(monthlyCents(1200, "per-week"), null);
  assert.equal(monthlyCents(1200, undefined), null, "a missing period must never default to monthly");
});

test("the conversion is reported so it can be checked rather than trusted", () => {
  const y = monthlyCents(1078800, PERIOD.YEAR);
  assert.match(y.how, /1078800 \/ 12 = 89900/);
  assert.equal(monthlyCents(89900, PERIOD.MONTH).how, "stated per month; no conversion");
});

test("an annual figure that does not divide evenly is flagged, not rounded", () => {
  const odd = monthlyCents(100, PERIOD.YEAR);
  assert.equal(odd.uneven, true);
  assert.match(odd.how, /does not divide evenly/);
});

// ---- reading is anchored, never opportunistic --------------------------------------------------

test("a matrix with no declared markers is REFUSED, never guessed at from another table", () => {
  withFixture({
    "plans/index.html": '<html><table><thead><tr><th>Feature</th><th>Personal</th></tr><tr class="price-row"><td>Price</td><td>$1/mo</td></tr></thead></table></html>',
  }, (dir) => {
    const { quotes, unreadable } = readQuotes({ root: dir, surfaces: only("plans/index.html::sentinel-matrix") });
    assert.equal(quotes.length, 0, "an unmarked table must not be read as the price matrix");
    assert.match(unreadable[0].why, /refusing to guess/);
  });
});

test("a price elsewhere on the page is not picked up as a plan card", () => {
  withFixture({
    "plans/index.html": '<html><p>Setup from $500</p><div class="deck-price">$9,000 – $11,000 / mo</div></html>',
  }, (dir) => {
    const { quotes } = readQuotes({ root: dir, surfaces: only("plans/index.html::plan-cards") });
    assert.equal(quotes.length, 0);
  });
});

test("a tier name nobody declared is reported UNREADABLE, never absorbed", () => {
  withFixture({
    "plans/index.html": PLANS({ "Platinum": "$5,000" }),
  }, (dir) => {
    const { quotes, unreadable } = readQuotes({ root: dir, surfaces: only("plans/index.html::plan-cards") });
    assert.equal(quotes.length, 0);
    assert.match(unreadable[0].why, /not a declared tier name/);
  });
});

test("an absent surface is unreadable, not silently clean", () => {
  withFixture({}, (dir) => {
    const { unreadable } = readQuotes({ root: dir, surfaces: only("plans/index.html::plan-cards") });
    assert.equal(unreadable.length, 1);
    assert.match(unreadable[0].why, /absent or unreadable/);
  });
});

// ---- the classes never merge --------------------------------------------------------------------

test("a band is its own class and is never counted as a selectable price", () => {
  withFixture({
    "index.html": `<html>${DECK("Tier 2", "Business Continuity", "$14,000", "$24,000")}</html>`,
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("index.html::retainer-decks") });
    assert.equal(r.summary.bands, 1);
    assert.equal(r.summary.selectable, 0);
    assert.equal(r.bands[0].lowCents, 1400000);
    assert.equal(r.bands[0].highCents, 2400000);
    assert.ok(r.bands[0].why.length > 20, "a band must carry the reason it is legitimately a band");
  });
});

test("a band alone is not a disagreement — a quote-based service is not an unbacked claim", () => {
  withFixture({
    "index.html": `<html>${DECK("Tier 1", "Operational Foundation", "$6,000", "$10,000")}</html>`,
  }, (dir) => {
    assert.equal(auditPrices({ root: dir, surfaces: only("index.html::retainer-decks") }).verdict, VERDICT.CONSISTENT);
  });
});

// ---- disagreement is caught, and never smoothed --------------------------------------------------

test("two surfaces quoting one tier differently CANNOT return consistent", () => {
  withFixture({
    "plans/index.html": PLANS({ Personal: "$899" }),
    "pricing-experiments.html": EXPERIMENTS([{ tier: "Personal", price: "$999" }]),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::plan-cards", "pricing-experiments.html::experiment-boxes") });
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
    assert.equal(r.summary.priceDisagreements, 1);
    assert.deepEqual(r.priceDisagreements[0].values, [89900, 99900]);
    // and the finding names files, so the remedy is not a number to go hunting for
    const files = r.priceDisagreements[0].cites.map((c) => `${c.file}:${c.line}`);
    assert.equal(files.length, 2);
    assert.ok(files.every((f) => /:\d+$/.test(f)), "every citation carries a line number");
  });
});

test("the same figure stated monthly on one surface and annually on another is NOT a disagreement", () => {
  withFixture({
    "plans/index.html": PLANS({ Personal: "$899" }, { bands: [{ name: "Personal", max: 10, yr: 10788 }] }),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::plan-cards", "plans/index.html::tier-bands") });
    assert.equal(r.summary.priceDisagreements, 0, "10788/yr and $899/mo are the same price");
    assert.equal(r.verdict, VERDICT.CONSISTENT);
  });
});

test("an annual figure that does NOT divide into the monthly one is caught", () => {
  withFixture({
    "plans/index.html": PLANS({ Personal: "$899" }, { bands: [{ name: "Personal", max: 10, yr: 12000 }] }),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::plan-cards", "plans/index.html::tier-bands") });
    assert.equal(r.summary.priceDisagreements, 1);
  });
});

test("two surfaces routing one company size to different tiers CANNOT return consistent", () => {
  withFixture({
    "plans/index.html": PLANS({}, { bands: [{ name: "Small Business", max: 500, yr: 234000 }, { name: "Enterprise", max: "Infinity", yr: 937500 }] }),
    "pricing-experiments.html": EXPERIMENTS([
      { tier: "Small Business", price: "$19,500", tail: " · 1-20 staff org" },
      { tier: "Enterprise", price: "$78,125", tail: " · 100+ staff org" },
    ]),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::tier-bands", "pricing-experiments.html::experiment-boxes") });
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
    assert.ok(r.summary.audienceDisagreements > 0);
    const at = r.audienceDisagreements.find((d) => d.headcount === 500);
    assert.ok(at, "the boundary a router declares is exactly where two routers first disagree");
    assert.deepEqual(at.tiers.slice().sort(), ["enterprise", "small-business"]);
  });
});

test("the probe headcounts come from declared boundaries — none is invented", () => {
  withFixture({
    "plans/index.html": PLANS({}, { bands: [{ name: "Pro", max: 75, yr: 27000 }] }),
    "pricing-experiments.html": EXPERIMENTS([{ tier: "Mid Size", price: "$39,000", tail: " · 21-100 staff org" }]),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::tier-bands", "pricing-experiments.html::experiment-boxes") });
    const declared = new Set([75, 76, 21, 100, 101]);
    for (const d of r.audienceDisagreements) {
      assert.ok(declared.has(d.headcount), `headcount ${d.headcount} was not read off a declared boundary`);
    }
  });
});

test("a surface silent about who a tier is for is neither in agreement nor in conflict", () => {
  withFixture({
    "plans/index.html": PLANS({ Personal: "$899", Pro: "$2,250" }),
    "pricing-experiments.html": EXPERIMENTS([{ tier: "Personal", price: "$899" }, { tier: "Pro", price: "$2,250" }]),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::plan-cards", "pricing-experiments.html::experiment-boxes") });
    assert.equal(r.summary.audienceDisagreements, 0, "no surface stated a headcount, so none can disagree about one");
    assert.equal(r.verdict, VERDICT.CONSISTENT);
  });
});

test("ONE surface claiming a headcount for two tiers is its own finding", () => {
  // The likeliest person to find this is a customer reading one page top to bottom.
  withFixture({
    "pricing-experiments.html": EXPERIMENTS([
      { tier: "Mid Size", price: "$39,000", tail: " · 21-100 staff org" },
      { tier: "Enterprise", price: "$78,125", tail: " · 100+ staff org" },
    ]),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("pricing-experiments.html::experiment-boxes") });
    assert.equal(r.summary.audienceOverlaps, 1);
    assert.equal(r.audienceOverlaps[0].from, 100);
    assert.equal(r.audienceOverlaps[0].to, 100);
    assert.notEqual(r.verdict, VERDICT.CONSISTENT, "a page contradicting itself is not consistent");
  });
});

// ---- direction is Ahmad's, before and after ------------------------------------------------------

test("with disagreements and NO declared direction the verdict is UNDECIDED, never resolved", () => {
  withFixture({
    "plans/index.html": PLANS({ Personal: "$899" }),
    "pricing-experiments.html": EXPERIMENTS([{ tier: "Personal", price: "$999" }]),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::plan-cards", "pricing-experiments.html::experiment-boxes") });
    assert.equal(r.verdict, VERDICT.UNDECIDED);
    assert.equal(r.direction.declared, false);
    assert.equal(r.resolvedHere, false);
    assert.match(statementFor(r), /no direction declared/);
  });
});

test("with a declared direction the SAME tree reads DIVERGENT — the decision is made once", () => {
  withFixture({
    "plans/index.html": PLANS({ Personal: "$899" }),
    "pricing-experiments.html": EXPERIMENTS([{ tier: "Personal", price: "$999" }]),
    [DECISION_FILE]: JSON.stringify({ decidedBy: "Ahmad", on: "2026-08-12", canonicalSurface: "plans/index.html" }),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::plan-cards", "pricing-experiments.html::experiment-boxes") });
    assert.equal(r.verdict, VERDICT.DIVERGENT);
    assert.equal(r.direction.declared, true);
    assert.equal(r.direction.decidedBy, "Ahmad");
  });
});

test("no output field ever names a winning surface — software does not pick", () => {
  withFixture({
    "plans/index.html": PLANS({ Personal: "$899" }),
    "pricing-experiments.html": EXPERIMENTS([{ tier: "Personal", price: "$999" }]),
  }, (dir) => {
    const r = auditPrices({ root: dir, surfaces: only("plans/index.html::plan-cards", "pricing-experiments.html::experiment-boxes") });
    const blob = JSON.stringify({ ...r, direction: null });
    assert.equal(/"(correct|canonical|winner|shouldBe|correctPrice)"/.test(blob), false, "the audit named a right answer");
    assert.equal(r.resolvedHere, false);
  });
});

test("nothing is read at all is UNREADABLE, and is not mistaken for consistent", () => {
  withFixture({}, (dir) => {
    assert.equal(auditPrices({ root: dir, surfaces: only("plans/index.html::plan-cards") }).verdict, VERDICT.UNREADABLE);
  });
});

// ---- Rule 14: nothing invented ------------------------------------------------------------------

test("the audit output carries no forecast, no attach rate, no average deal size", () => {
  const r = auditPrices({ root });
  const blob = JSON.stringify(r).toLowerCase();
  for (const banned of ["forecast", "projected", "attach rate", "average deal", "arr", "mrr", "expected revenue", "pipeline value"]) {
    assert.equal(blob.includes(banned), false, `the price audit emitted "${banned}"`);
  }
});

test("every reported figure is traceable to a file and a line in this tree", () => {
  const r = auditPrices({ root });
  for (const q of r.quotes) {
    assert.ok(q.file && Number.isFinite(q.line) && q.line > 0, `${q.tier} has no citation`);
    assert.ok(fs.existsSync(path.join(root, q.file)), `${q.file} does not exist`);
    assert.ok(q.source && q.source.length > 0, `${q.tier} carries no source text`);
  }
});

// ---- against the real tree ----------------------------------------------------------------------

test("the real tree: every declared Sentinel tier is quoted, and none is missing", () => {
  const r = auditPrices({ root });
  assert.equal(r.summary.tiersQuoted, r.summary.tiersDeclared,
    "a declared tier nobody publishes a price for is a buyer who cannot buy it");
});

test("the real tree: nothing is unreadable — every surface parsed", () => {
  const r = auditPrices({ root });
  assert.equal(r.summary.unreadable, 0, JSON.stringify(r.unreadable, null, 1));
});

test("the real tree: the price NUMBERS agree on every surface that quotes them", () => {
  // Stated as its own assertion rather than passed over in silence. This audit exists to find
  // disagreement, and on the figures themselves there is none — including the savings calculator's
  // annual bands, which divide by twelve into exactly the published monthly figures.
  const r = auditPrices({ root });
  assert.equal(r.summary.priceDisagreements, 0, JSON.stringify(r.priceDisagreements, null, 1));
});

test("the real tree: the schema is stated and the verdict is one of the declared set", () => {
  const r = auditPrices({ root });
  assert.equal(r.schema, PRICE_SCHEMA);
  assert.ok(Object.values(VERDICT).includes(r.verdict));
});
