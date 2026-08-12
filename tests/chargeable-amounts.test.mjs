// BI2 — the amount a buyer is actually charged, checked end to end.
//
// The invariant these cases exist to hold: the audit may NOT report a clean result while a buyer can
// be charged a figure that is published nowhere on the card they clicked, and it may NOT pick which
// side moves. Every class is proven RED FIRST against a fixture built to fail exactly that way — an
// audit that has only ever seen the real tree has been shown to produce a verdict, not to catch
// anything.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  auditCharges, readCharges, readBands, readDirection, statementFor,
  parseChargeAmount, parsePublished,
  CHARGE_SURFACES, CLASS, VERDICT, CHARGE_SCHEMA, DECISION_FILE,
} from "../scripts/lib/chargeable-amounts.mjs";

const root = path.resolve(import.meta.dirname, "..");

function fixture(files) {
  // Not `os.tmpdir()` — RUN-BE/BH recorded that volume full on this machine. The scratch location
  // is chosen by probing, never assumed.
  const dir = makeScratchDir("charge-fixture-");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}
const withFixture = (files, fn) => {
  const dir = fixture(files);
  try { return fn(dir); } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* mount refuses unlink; harmless */ } };
};

/** One deck carrying a published band and a set of buy options. */
const DECK = (band, options, { title = "A Tier" } = {}) => `
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
const PAGE = (...decks) => `<html><body><div class="price-deck" data-price-deck>${decks.join("\n")}</div></body></html>`;
const SURFACES = [{ id: "t", file: "index.html", reason: "fixture" }];

// ── the parsers ───────────────────────────────────────────────────────────────────────────────────

test("a charge amount parses only in the exact form it must appear in", () => {
  assert.equal(parseChargeAmount("2000.00"), 200000);
  assert.equal(parseChargeAmount("750"), 75000);
  assert.equal(parseChargeAmount("1250.50"), 125050);
});

test("a malformed charge amount is UNREADABLE and is never repaired", () => {
  // The whole reason discipline 2 exists: RUN-BF's money parser stripped commas and read `$1,2` as
  // `$12`. A parser that repairs the number a card is debited for is inventing a transaction.
  for (const bad of ["2,000.00", "$2000", " 2000", "2000.0", "2000.000", "-500", "2e3", "", null, undefined, "abc"]) {
    assert.equal(parseChargeAmount(bad), null, `expected UNREADABLE for ${JSON.stringify(bad)}`);
  }
});

test("a published figure parses with its grouping validated, not stripped", () => {
  assert.equal(parsePublished("$6,000"), 600000);
  assert.equal(parsePublished("$1,250.50"), 125050);
  assert.equal(parsePublished("$750"), 75000);
  assert.equal(parsePublished("$1,2"), null);      // the RUN-BF defect, permanently closed
  assert.equal(parsePublished("$60,00"), null);
});

// ── bands read from declared markers only ─────────────────────────────────────────────────────────

test("a band is read from a declared marker, never from a nearby dollar figure", () => {
  const html = `<div class="deck-slot"><div class="not-a-marker">$99,999 / mo</div><div class="deck-price">$6,000 – $10,000 / mo</div></div>`;
  const bands = readBands(html);
  assert.equal(bands.length, 1, "the undeclared $99,999 must not be read as a band");
  assert.equal(bands[0].floorCents, 600000);
  assert.equal(bands[0].ceilingCents, 1000000);
});

test("a flat published price is a band whose floor and ceiling are equal", () => {
  const bands = readBands(`<div class="deck-slot"><div class="deck-price">$2,500</div></div>`);
  assert.deepEqual([bands[0].floorCents, bands[0].ceilingCents], [250000, 250000]);
});

test("line items on the reverse face are bands too", () => {
  const bands = readBands(`<div class="deck-slot"><ul><li>Data Recovery — $2,500 – $5,000 flat</li></ul></div>`);
  assert.equal(bands[0].floorCents, 250000);
  assert.equal(bands[0].ceilingCents, 500000);
});

// ── the classes, each proven against a fixture built to fail ──────────────────────────────────────

test("RED FIRST: a charge below every band on its own card, not named a deposit, is UNPUBLISHED", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "x", name: "First Month", price: "3500.00" }])) }, (dir) => {
    const { charges } = readCharges({ root: dir, surfaces: SURFACES });
    assert.equal(charges[0].class, CLASS.UNPUBLISHED);
    assert.match(charges[0].why, /matches none of the 1 bands/);
  });
});

test("a charge equal to the floor of its card's band is LOWER_BOUND — the strongest result, stated", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "x", name: "First Month", price: "6000.00" }])) }, (dir) => {
    const { charges } = readCharges({ root: dir, surfaces: SURFACES });
    assert.equal(charges[0].class, CLASS.LOWER_BOUND);
  });
});

test("a charge strictly inside its card's band is IN_BAND", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "x", name: "First Month", price: "8000.00" }])) }, (dir) => {
    const { charges } = readCharges({ root: dir, surfaces: SURFACES });
    assert.equal(charges[0].class, CLASS.IN_BAND);
  });
});

test("RED FIRST: a deposit whose amount appears on no card is DEPOSIT_UNPUBLISHED, not a band mismatch", () => {
  // Discipline 3. Reporting a deposit as "outside the band" would bury the finding that matters —
  // the amount is published nowhere — underneath a false one.
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "d", name: "Deposit to start", price: "2000.00" }])) }, (dir) => {
    const { charges } = readCharges({ root: dir, surfaces: SURFACES });
    assert.equal(charges[0].class, CLASS.DEPOSIT_UNPUBLISHED);
    assert.notEqual(charges[0].class, CLASS.UNPUBLISHED);
  });
});

test("THE INVERSE, so the class is not noise: a deposit printed on the card is DEPOSIT_PUBLISHED", () => {
  withFixture({ "index.html": PAGE(DECK("$2,000 – $10,000 / mo", [{ id: "d", name: "Deposit to start", price: "2000.00" }])) }, (dir) => {
    const { charges } = readCharges({ root: dir, surfaces: SURFACES });
    assert.equal(charges[0].class, CLASS.DEPOSIT_PUBLISHED);
  });
});

test("a deposit is recognised because the option SAYS deposit, never because the amount is small", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "x", name: "Starter fee", price: "100.00" }])) }, (dir) => {
    const { charges } = readCharges({ root: dir, surfaces: SURFACES });
    assert.equal(charges[0].class, CLASS.UNPUBLISHED, "a small amount is not a deposit; only the words make it one");
  });
});

test("an option with no amount is a QUOTE and is never counted as a charge that matched", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "q", name: "Request Custom Quote", quote: true }])) }, (dir) => {
    const { charges } = readCharges({ root: dir, surfaces: SURFACES });
    assert.equal(charges[0].class, CLASS.QUOTE);
    assert.equal(charges[0].cents, null);
  });
});

test("RED FIRST: a grouped charge amount is UNREADABLE and drags the whole verdict to UNREADABLE", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "x", name: "First Month", price: "6,000.00" }])) }, (dir) => {
    const r = auditCharges({ root: dir, surfaces: SURFACES });
    assert.equal(r.counts[CLASS.UNREADABLE], 1);
    assert.equal(r.verdict, VERDICT.UNREADABLE, "an unreadable amount must never read as clean");
  });
});

test("RED FIRST: a buy button outside any declared deck is UNREADABLE, never silently classed", () => {
  const orphan = `<html><body><button class="deck-cta-buy" data-buy-options='${JSON.stringify({ title: "T", options: [{ id: "x", name: "Month", price: "6000.00" }] })}'>Buy</button></body></html>`;
  withFixture({ "index.html": orphan }, (dir) => {
    const r = auditCharges({ root: dir, surfaces: SURFACES });
    assert.equal(r.verdict, VERDICT.UNREADABLE);
    assert.match(r.unreadable[0].why, /no declared deck-slot/);
  });
});

test("RED FIRST: a missing surface is UNREADABLE, never an empty clean result", () => {
  withFixture({ "other.html": "<html></html>" }, (dir) => {
    const r = auditCharges({ root: dir, surfaces: SURFACES });
    assert.equal(r.verdict, VERDICT.UNREADABLE);
    assert.equal(r.chargeCount, 0);
  });
});

test("RED FIRST: an attribute that is not JSON is UNREADABLE, never skipped in silence", () => {
  withFixture({ "index.html": `<html><body><div class="deck-slot"><div class="deck-price">$6,000</div><button data-buy-options='{oops'>Buy</button></div></body></html>` }, (dir) => {
    const r = auditCharges({ root: dir, surfaces: SURFACES });
    assert.equal(r.verdict, VERDICT.UNREADABLE);
    assert.match(r.unreadable[0].why, /not JSON/);
  });
});

// ── the direction stays Ahmad's ───────────────────────────────────────────────────────────────────

test("with no direction declared the verdict is UNDECIDED and nothing is resolved here", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "d", name: "Deposit to start", price: "2000.00" }])) }, (dir) => {
    const r = auditCharges({ root: dir, surfaces: SURFACES });
    assert.equal(r.verdict, VERDICT.UNDECIDED);
    assert.equal(r.resolvedHere, false);
    assert.equal(r.directionDeclared, false);
  });
});

test("once a direction says deposits must be published, an unpublished deposit is DIVERGENT", () => {
  withFixture({
    "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "d", name: "Deposit to start", price: "2000.00" }])),
    [DECISION_FILE]: JSON.stringify({ publishDeposits: true, depositPolicy: "one third of the floor" }),
  }, (dir) => {
    const r = auditCharges({ root: dir, surfaces: SURFACES });
    assert.equal(r.verdict, VERDICT.DIVERGENT);
  });
});

test("a direction that does not parse is UNDECIDED, never treated as permission", () => {
  withFixture({
    "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "x", name: "First Month", price: "6000.00" }])),
    [DECISION_FILE]: "{not json",
  }, (dir) => {
    const r = auditCharges({ root: dir, surfaces: SURFACES });
    assert.equal(r.directionDeclared, false);
    assert.equal(r.verdict, VERDICT.UNDECIDED);
  });
});

test("no output field ever names a surface that must move (Rule 15)", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "d", name: "Deposit to start", price: "2000.00" }])) }, (dir) => {
    const blob = JSON.stringify(auditCharges({ root: dir, surfaces: SURFACES })).toLowerCase();
    for (const word of ["should be", "must be changed", "correct value", "fix to", "winner"]) {
      assert.equal(blob.includes(word), false, `audit output must not carry "${word}"`);
    }
  });
});

// ── the arithmetic is reported so it can be checked, never trusted ────────────────────────────────

test("a deposit's share of the floor is reported with its division shown", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "d", name: "Deposit to start", price: "2000.00" }])) }, (dir) => {
    const { charges } = readCharges({ root: dir, surfaces: SURFACES });
    assert.equal(charges[0].share.pct, 33.33);
    assert.equal(charges[0].share.how, "200000 / 600000 = 33.33%");
  });
});

test("no forecast, no attach rate, no expected revenue anywhere in the output (Rule 14)", () => {
  withFixture({ "index.html": PAGE(DECK("$6,000 – $10,000 / mo", [{ id: "d", name: "Deposit to start", price: "2000.00" }])) }, (dir) => {
    const blob = JSON.stringify(auditCharges({ root: dir, surfaces: SURFACES })).toLowerCase();
    for (const word of ["forecast", "projected", "attach rate", "expected revenue", "arr", "mrr"]) {
      assert.equal(blob.includes(word), false, `audit output must not carry "${word}"`);
    }
  });
});

// ── the real tree, read rather than asserted ──────────────────────────────────────────────────────

test("the declared surface exists and still carries chargeable amounts", () => {
  for (const s of CHARGE_SURFACES) {
    assert.equal(fs.existsSync(path.join(root, s.file)), true, `${s.file} is declared as a charge surface and must exist`);
  }
  const r = auditCharges({ root });
  assert.equal(r.schema, CHARGE_SCHEMA);
  assert.ok(r.chargeCount > 0, "a surface that stopped carrying charges must not read as clean");
});

test("the real tree reads without a single UNREADABLE amount or surface", () => {
  const r = auditCharges({ root });
  assert.deepEqual(r.unreadable, [], "every declared surface and attribute must be readable");
  assert.equal(r.counts[CLASS.UNREADABLE], 0);
});

test("every chargeable amount on the real tree is classed, and none is left without a reason", () => {
  const r = auditCharges({ root });
  for (const c of r.charges) {
    assert.ok(Object.values(CLASS).includes(c.class), `${c.id} carries an unknown class`);
    assert.ok(c.why && c.why.length > 8, `${c.id} carries no reason`);
    assert.ok(c.line > 0, `${c.id} carries no line citation`);
  }
});

test("the statement carries no verdict the audit did not reach", () => {
  const r = auditCharges({ root });
  const s = statementFor(r);
  assert.ok(s.length > 40);
  if (!r.directionDeclared) assert.match(s, /nothing resolved here/);
});
