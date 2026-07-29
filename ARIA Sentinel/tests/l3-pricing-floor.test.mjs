// l3-pricing-floor.test.mjs — RUN-L L3 exit criteria, test-locked.
// floor-known / floor-unknown / quote-below-floor all reachable; every input traces to a real
// record; the K3 ask flags a below-floor price; nothing sends (static-scan locked).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  PRICING_FLOOR_SCHEMA, SENT, NOTHING_SENT, MIN_RECORDS_FOR_FLOOR,
  computePricingFloor, floorFor, checkQuoteAgainstFloor, flagAskAgainstFloor, pricingFloorMarkdown,
} from "../src/shared/pricing-floor.mjs";

const NOW = Date.parse("2026-07-22T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Recorded operator cost basis — a real record with an id. 4000 CAD/mo over 8000 available minutes
// = 0.5 CAD per delivered minute. Nothing modelled.
const costBasis = { sourceId: "cost-basis-2026-07", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 };

const accounts = [
  // 600 observed minutes over 2 months = 300 min/mo => floor 150 CAD/mo
  { key: "harbor", months: 2, records: [
    { id: "h-1", durationMinutes: 200 }, { id: "h-2", durationMinutes: 200 },
    { id: "h-3", durationMinutes: 150 }, { id: "h-4", durationMinutes: 50 },
  ] },
  // only two usable records -> no stateable floor, must be named not guessed
  { key: "thin-data", months: 1, records: [
    { id: "t-1", durationMinutes: 30 }, { id: "t-2", durationMinutes: 30 }, { id: "t-3" },
  ] },
];

const res = computePricingFloor({ costBasis, accounts }, { now: NOW });

test("floor-known: stated only from observed minutes and a recorded cost basis", () => {
  assert.equal(res.schema, PRICING_FLOOR_SCHEMA);
  assert.equal(res.verdict, "floor-known");
  assert.equal(res.observedOnly, true);
  assert.equal(res.modelled, false);
  assert.equal(res.costPerMinuteCad, 0.5);
  assert.equal(res.costBasisId, "cost-basis-2026-07");
  const f = floorFor(res, "harbor");
  assert.equal(f.observedMinutes, 600);
  assert.equal(f.monthlyMinutes, 300);
  assert.equal(f.monthlyFloorCad, 150);
});

test("every input traces to a real record id", () => {
  const f = floorFor(res, "harbor");
  assert.deepEqual(f.recordIds, ["h-1", "h-2", "h-3", "h-4"]);
  assert.equal(f.costBasisId, costBasis.sourceId);
  // a record with no recorded duration contributes nothing and is named
  const thin = res.unpriceable.find((u) => u.key === "thin-data");
  assert.ok(thin, "thin account is named, never filled from a neighbour");
  assert.match(thin.why, new RegExp(`at least ${MIN_RECORDS_FOR_FLOOR}`));
  assert.ok(thin.excluded.some((e) => e.id === "t-3" && /no recorded duration/.test(e.why)));
  assert.ok(!JSON.stringify(thin).includes("150"), "thin account never inherits harbor's floor");
});

test("floor-unknown: no recorded cost basis => cannot be stated, never a default rate", () => {
  for (const bad of [undefined, {}, { sourceId: "x" }, { sourceId: "x", monthlyOperatorCostCad: 4000 },
    { sourceId: "", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 },
    { sourceId: "x", monthlyOperatorCostCad: 0, monthlyAvailableMinutes: 8000 }]) {
    const r = computePricingFloor({ costBasis: bad, accounts }, { now: NOW });
    assert.equal(r.verdict, "floor-unknown");
    assert.equal(r.costPerMinuteCad, null);
    assert.equal(r.floors.length, 0);
    assert.match(r.statement, /Cannot be stated/);
    assert.match(r.statement, /will not invent a rate/);
  }
});

test("floor-unknown also when the basis is real but nobody has enough observed minutes", () => {
  const r = computePricingFloor({ costBasis, accounts: [accounts[1]] }, { now: NOW });
  assert.equal(r.verdict, "floor-unknown");
  assert.equal(r.floors.length, 0);
  assert.match(r.statement, /No floor is invented/);
});

test("quote-below-floor is reachable and blocks", () => {
  const below = checkQuoteAgainstFloor(res, "harbor", 120);
  assert.equal(below.status, "quote-below-floor");
  assert.equal(below.blocked, true);
  assert.equal(below.floorCad, 150);
  assert.match(below.message, /loses money/);

  const atFloor = checkQuoteAgainstFloor(res, "harbor", 150);
  assert.equal(atFloor.status, "quote-below-floor", "at the floor is not above it");
  assert.equal(atFloor.blocked, true);

  const above = checkQuoteAgainstFloor(res, "harbor", 900);
  assert.equal(above.status, "above-floor");
  assert.equal(above.blocked, false);
  assert.equal(above.marginCad, 750);

  const unknown = checkQuoteAgainstFloor(res, "thin-data", 900);
  assert.equal(unknown.status, "floor-unknown");
  assert.equal(unknown.blocked, true);

  const noQuote = checkQuoteAgainstFloor(res, "harbor", 0);
  assert.equal(noQuote.status, "no-quote");
  assert.equal(noQuote.blocked, true);
});

test("the K3 ask is flagged, additively, before a below-floor price can reach a buyer", () => {
  const ask = { schema: "one-page-ask.v1", rendered: true, customer: "harbor" };
  const flag = flagAskAgainstFloor(ask, res, 120);
  assert.equal(flag.schema, "pricing-floor-ask-flag.v1");
  assert.equal(flag.askKey, "harbor");
  assert.equal(flag.blocked, true);
  assert.equal(flag.status, "quote-below-floor");
  assert.equal(flag.staged, true);
  assert.equal(flag.executed, false);
  // additive: the ask itself is untouched (Rule 15)
  assert.deepEqual(ask, { schema: "one-page-ask.v1", rendered: true, customer: "harbor" });
  const ok = flagAskAgainstFloor(ask, res, 900);
  assert.equal(ok.blocked, false);
});

test("nothing sends: flags + markdown carries the observed-only law", () => {
  assert.equal(SENT, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(res.sent, false);
  assert.equal(res.nothingSent, true);
  const md = pricingFloorMarkdown(res);
  assert.ok(/Honest pricing floor/.test(md));
  assert.ok(/No modelled rate, no assumed utilisation/.test(md));
  assert.ok(/nothing here sends or charges/i.test(md));
  assert.ok(/No stateable floor/.test(md));
  assert.equal(pricingFloorMarkdown(null), "_no pricing floor_");
});

test("STATIC-SCAN LOCK: the source has no send/network/exec class at all", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/pricing-floor.mjs"), "utf8");
  const forbidden = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /\bhttps?:\/\//, /nodemailer/, /sendmail/i,
    /child_process/, /\bexec(Sync)?\s*\(/, /\bspawn\s*\(/, /net\.(connect|Socket)/, /\brequest\s*\(/,
    /readFileSync/, /writeFileSync/, /stripe/i, /invoice\s*\(/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(src), `pricing-floor.mjs must not contain ${re}`);
  }
});
