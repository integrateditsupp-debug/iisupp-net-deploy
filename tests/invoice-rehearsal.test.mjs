// AU2 — the first invoice, rehearsed rather than assumed.
//
// Every failure class below is proven RED against a fixture built to fail exactly that way. A
// rehearsal that has only ever seen the real tree has been shown to produce a green, not to catch
// anything.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  rehearseInvoice, statementFor, publishedCurrency, chargeCurrency, chargeableKeys,
  INVOICE_CLASSES, VERDICT, SENDS, CHARGES, READS_KEYS, WRITES_IN_REPO,
} from "../scripts/lib/invoice-rehearsal.mjs";

const root = path.resolve(import.meta.dirname, "..");

/** A fixture tree with only the two files the rehearsal reads. Removed by the caller. */
function fixture({ priceRow, currencyWord, checkoutBody }) {
  const dir = makeScratchDir("invoice-fixture-");
  fs.mkdirSync(path.join(dir, "plans"), { recursive: true });
  fs.mkdirSync(path.join(dir, "netlify/functions"), { recursive: true });
  fs.writeFileSync(path.join(dir, "plans/index.html"),
    `<html><body>${currencyWord ? `<p>All prices in ${currencyWord}.</p>` : ""}` +
    `<table><thead><tr><th>Plan</th><th>Personal</th></tr></thead>` +
    (priceRow === null ? "" : `<tr class="price-row"><td>Price</td><td>${priceRow}</td></tr>`) +
    `</table></body></html>`);
  if (checkoutBody !== null) fs.writeFileSync(path.join(dir, "netlify/functions/stripe-checkout.js"), checkoutBody);
  return dir;
}
const withFixture = (opts, fn) => {
  const dir = fixture(opts);
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

const OK_CHECKOUT = `const PRICE = { personal: process.env.STRIPE_PRICE_PERSONAL || 'price_x' };\nconst currency = String(pd.currency || 'usd').toLowerCase();\n`;

test("the rehearsal declares, in code, that it sends nothing and charges nothing", () => {
  assert.equal(SENDS, false);
  assert.equal(CHARGES, false);
  assert.equal(READS_KEYS, false);
  assert.equal(WRITES_IN_REPO, false);
});

test("it walks the real tree to a rendered invoice built only from traced figures", () => {
  const r = rehearseInvoice({ root });
  assert.equal(r.summary.walkedToARenderedInvoice, true, "the walk must reach a rendered invoice on the real tree");
  const trace = r.steps.find((s) => s.id === "trace-every-figure");
  assert.equal(trace.verdict, VERDICT.OK,
    "a money token that traces to no published line must refuse the whole rehearsal, so reaching this step green means every token traced");
  assert.equal(r.charges, false);
});

test("the charge itself is UNRUN with its reason, never a pass", () => {
  const r = rehearseInvoice({ root });
  const charge = r.steps.find((s) => s.id === "raise-the-charge");
  assert.equal(charge.verdict, VERDICT.UNRUN, "no key and no network means unrun, and unrun is not a pass");
  assert.equal(charge.class, INVOICE_CLASSES.API_UNRUN);
  assert.match(charge.detail, /no Stripe key|no network/);
  assert.ok(r.summary.unrun >= 1);
  assert.match(statementFor(r), /correctly unrun/);
});

test("RED — a plan that is not in the published table is refused by name", () => {
  const r = rehearseInvoice({ root, planKey: "a-plan-nobody-published" });
  assert.equal(r.summary.firstBreak, INVOICE_CLASSES.PLAN_NOT_PUBLISHED);
  assert.equal(r.summary.walkedToARenderedInvoice, false, "no invoice may be rendered for a plan a visitor cannot see");
});

test("RED — an invoice addressed to nobody is refused", () => {
  const r = rehearseInvoice({ root, client: "   " });
  assert.equal(r.summary.firstBreak, INVOICE_CLASSES.CLIENT_MISSING);
  assert.equal(r.summary.walkedToARenderedInvoice, false);
});

test("RED — an unreadable plan table stops the walk instead of inventing a figure", () => {
  withFixture({ priceRow: null, currencyWord: "USD", checkoutBody: OK_CHECKOUT }, (dir) => {
    const r = rehearseInvoice({ root: dir });
    assert.equal(r.summary.firstBreak, INVOICE_CLASSES.NO_PRICING_SOURCE);
    assert.equal(r.summary.total, 1, "nothing downstream is claimed once the source is unreadable");
  });
});

test("RED — a plan with no price key can be invoiced but not collected, and says so", () => {
  withFixture({ priceRow: "$899/mo", currencyWord: "USD", checkoutBody: "const PRICE = {};\nconst currency = String(pd.currency || 'usd');\n" }, (dir) => {
    const r = rehearseInvoice({ root: dir });
    const route = r.steps.find((s) => s.id === "charge-route");
    assert.equal(route.verdict, VERDICT.BROKEN);
    assert.equal(route.class, INVOICE_CLASSES.NO_CHARGE_ROUTE);
    assert.match(route.detail, /nothing can collect/);
  });
});

test("RED — an absent checkout function is reported, not skipped", () => {
  withFixture({ priceRow: "$899/mo", currencyWord: "USD", checkoutBody: null }, (dir) => {
    const r = rehearseInvoice({ root: dir });
    const route = r.steps.find((s) => s.id === "charge-route");
    assert.equal(route.class, INVOICE_CLASSES.CHECKOUT_UNREADABLE);
  });
});

test("RED — a currency that disagrees with the plan table is named with both file:line citations", () => {
  withFixture({ priceRow: "$899/mo", currencyWord: "USD", checkoutBody: "const PRICE = { personal: process.env.STRIPE_PRICE_PERSONAL || 'p' };\nconst currency = String(pd.currency || 'cad').toLowerCase();\n" }, (dir) => {
    const r = rehearseInvoice({ root: dir });
    const cur = r.steps.find((s) => s.id === "currency-agreement");
    assert.equal(cur.verdict, VERDICT.BROKEN);
    assert.equal(cur.class, INVOICE_CLASSES.CURRENCY_DISAGREES);
    assert.equal(r.decisions.length, 1);
    assert.equal(r.decisions[0].published.currency, "USD");
    assert.equal(r.decisions[0].charged.currency, "CAD");
    assert.ok(r.decisions[0].published.line > 0 && r.decisions[0].charged.line > 0,
      "a divergence without both line numbers is not something an operator can settle");
  });
});

test("GREEN — when both sides agree, the currency step passes rather than warning forever", () => {
  withFixture({ priceRow: "$899/mo", currencyWord: "USD", checkoutBody: OK_CHECKOUT }, (dir) => {
    const r = rehearseInvoice({ root: dir });
    const cur = r.steps.find((s) => s.id === "currency-agreement");
    assert.equal(cur.verdict, VERDICT.OK);
    assert.equal(r.decisions.length, 0);
  });
});

test("UNRUN — an unreadable currency on either side makes no claim about the other", () => {
  withFixture({ priceRow: "$899/mo", currencyWord: null, checkoutBody: OK_CHECKOUT }, (dir) => {
    const r = rehearseInvoice({ root: dir });
    const cur = r.steps.find((s) => s.id === "currency-agreement");
    assert.equal(cur.verdict, VERDICT.UNRUN, "unreadable is not agreement and it is not divergence");
  });
});

test("the real tree's currency state is REPORTED rather than smoothed over", () => {
  // This asserts the report is honest about whatever the tree currently says — not that the tree is
  // clean. Whichever way the standing decision goes, the two sides must be readable and the report
  // must state them; a gate that went green by ignoring the question would be the failure.
  const page = publishedCurrency({ root });
  const code = chargeCurrency({ root });
  assert.equal(page.readable, true, "the published plan page must be readable");
  assert.ok(page.currency, "the published plan page must state a currency somewhere a client can see it");
  assert.equal(code.readable, true, "the checkout function must be readable");

  const r = rehearseInvoice({ root });
  const cur = r.steps.find((s) => s.id === "currency-agreement");
  if (code.currency && code.currency !== page.currency) {
    assert.equal(cur.class, INVOICE_CLASSES.CURRENCY_DISAGREES);
    assert.equal(r.summary.decisions, 1, "a live divergence must surface as a decision, not as a silent pass");
  } else {
    assert.equal(cur.verdict, VERDICT.OK);
    assert.equal(r.summary.decisions, 0);
  }
});

test("the price-key map is read from the checkout function rather than typed here", () => {
  const k = chargeableKeys({ root });
  assert.equal(k.readable, true);
  assert.ok(k.keys.size >= 5, `expected the real price-key map (got ${k.keys.size})`);
  assert.ok(k.keys.has("personal"), "the plan the rehearsal walks must be one the charge path knows");
});

test("nothing is left behind on disk", () => {
  const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("invoice-rehearsal-")).length;
  rehearseInvoice({ root });
  const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("invoice-rehearsal-")).length;
  assert.equal(after, before, "the throwaway directory is removed whether the rehearsal passes or fails");
});
