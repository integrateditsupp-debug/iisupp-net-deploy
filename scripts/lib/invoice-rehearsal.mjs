// invoice-rehearsal.mjs — RUN-AU / AU2. THE FIRST INVOICE, WALKED BEFORE IT IS RAISED.
//
// AS2 rehearsed the publish rather than assuming it. AT2 generated the proposal rather than writing
// it. The step between them — an agreed proposal becoming a raised invoice — has never been walked
// by anything. It has been assumed for as long as this program has existed, and an assumption that
// has never been executed is a hope with a schedule.
//
// SAME DISCIPLINE AS AS2, stated so it cannot drift:
//   · No live API call. No key read. No network. No money moved. Nothing written inside the repo.
//   · Everything happens in a throwaway directory under the OS temp root, removed pass or fail.
//   · A step that genuinely CANNOT be rehearsed here is reported UNRUN with its reason. It is never
//     reported as a pass, and never as a failure either — "we could not check" and "it is broken"
//     are different facts, and collapsing them is how a program learns to distrust its own greens.
//
// EVERY FAILURE CLASS IS NAMED, because a red that starts an investigation is worth less than a red
// that names the file. The four AU2 asked for are here — a figure with no source, a plan that is not
// published, a missing client, a currency that disagrees with the plan table — plus the two the walk
// itself turned up: a plan with no route to a charge at all, and a checkout function that cannot be
// read.
//
// FOUND BY RUNNING IT (2026-08-11): the published plan table states USD in eight places. The
// checkout function defaults an inline one-time price to CAD. Those are different paths — plans go
// through preset Stripe price IDs whose currency lives in Stripe and cannot be read from here
// (UNRUN, correctly) — but a company whose page says USD and whose charge code says CAD has one of
// the two wrong, and which one is a DECISION about money. This reports it with both file:line
// citations and refuses to guess.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readPricingSources } from "./retainer-proposal.mjs";

export const INVOICE_REHEARSAL_SCHEMA = "invoice-rehearsal.v1";
export const SENDS = false;
export const CHARGES = false;
export const READS_KEYS = false;
export const WRITES_IN_REPO = false;

export const VERDICT = Object.freeze({ OK: "ok", BROKEN: "broken", UNRUN: "unrun" });

export const INVOICE_CLASSES = Object.freeze({
  OK: "the-invoice-can-be-raised-from-a-traced-figure-without-a-key",
  NO_PRICING_SOURCE: "the-published-plan-table-could-not-be-read",
  PLAN_NOT_PUBLISHED: "the-plan-being-invoiced-is-not-in-the-published-table",
  FIGURE_UNTRACEABLE: "a-money-figure-on-the-invoice-cannot-be-traced-to-a-published-line",
  CLIENT_MISSING: "no-client-is-named-so-the-invoice-is-addressed-to-nobody",
  CURRENCY_DISAGREES: "the-currency-on-the-charge-path-disagrees-with-the-published-plan-table",
  NO_CHARGE_ROUTE: "the-plan-has-no-price-key-so-nothing-can-be-charged-for-it",
  CHECKOUT_UNREADABLE: "the-checkout-function-is-absent-or-unreadable",
  API_UNRUN: "the-charge-itself-cannot-be-rehearsed-here-no-key-no-network-and-that-is-correct",
});

export const CHECKOUT_FILE = "netlify/functions/stripe-checkout.js";
export const INVOICE_FILE = "netlify/functions/aria-invoice-download.js";
export const PRICING_FILE = "plans/index.html";

const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

/** The currency the published plan table states, read from the page rather than assumed. */
export function publishedCurrency({ root, file = PRICING_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { readable: false, file, currency: null, occurrences: 0, line: null };
  const text = fs.readFileSync(abs, "utf8");
  const hits = [...text.matchAll(/\b(USD|CAD)\b/g)];
  if (!hits.length) return { readable: true, file, currency: null, occurrences: 0, line: null };
  const counts = {};
  for (const h of hits) counts[h[1]] = (counts[h[1]] || 0) + 1;
  const [currency, occurrences] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { readable: true, file, currency, occurrences, line: lineOf(text, hits[0].index), mixed: Object.keys(counts).length > 1 };
}

/** The currency the charge path would actually use, read out of the checkout function. */
export function chargeCurrency({ root, file = CHECKOUT_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { readable: false, file, currency: null, line: null, path: null };
  const text = fs.readFileSync(abs, "utf8");
  const m = text.match(/currency\s*(?:=|:)\s*String\(\s*[\w.]+\s*\|\|\s*['"]([a-z]{3})['"]/i)
    || text.match(/currency\s*(?:=|:)\s*['"]([a-z]{3})['"]/i);
  if (!m) return { readable: true, file, currency: null, line: null, path: "inline-one-time" };
  return {
    readable: true, file, currency: m[1].toUpperCase(), line: lineOf(text, m.index),
    path: "inline-one-time",
    note: "preset plan subscriptions use Stripe price IDs whose currency lives in Stripe and cannot be read from this repository",
  };
}

/** The plan keys the charge path knows how to bill, read out of the price-key map. */
export function chargeableKeys({ root, file = CHECKOUT_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { readable: false, file, keys: new Set() };
  const text = fs.readFileSync(abs, "utf8");
  const keys = new Set();
  for (const m of text.matchAll(/^\s*'?([a-z0-9_-]+)'?\s*:\s*process\.env\.STRIPE_PRICE_/gim)) keys.add(m[1]);
  return { readable: true, file, keys };
}

/**
 * Render the invoice the way AT2 renders the proposal: every money token selected BY KEY out of the
 * published table and carrying the file and line it came from. Nothing is typed.
 */
export function renderInvoiceDraft({ client, figure, issuedOn }) {
  return [
    "# Invoice — DRAFT (rehearsal only; nothing is sent, signed or charged)",
    "",
    `**Bill to:** ${client}`,
    `**Issued:** ${issuedOn}`,
    `**Plan:** ${figure.plan}`,
    "",
    `| Description | Amount | Source |`,
    `|---|---|---|`,
    `| ${figure.plan} — ${figure.unit} (${figure.cadence}) | $${figure.amount.toLocaleString("en-US")} | ${figure.file}:${figure.line} |`,
    "",
    "Integrated IT Support Inc. · iisupp.net · 647-581-3182",
    "",
  ].join("\n");
}

/**
 * Walk the path. Everything below happens against a throwaway directory; the repository is read
 * only. Returns a report, never throws for a business failure — a thrown error would lose the class.
 */
export function rehearseInvoice({ root = process.cwd(), planKey = "personal", client = "Example Client Inc.", now = Date.now() } = {}) {
  const steps = [];
  const decisions = [];
  const add = (id, verdict, cls, detail, extra = {}) => {
    steps.push({ id, verdict, class: cls, detail, ...extra });
    return steps[steps.length - 1];
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "invoice-rehearsal-"));
  try {
    // 1 — the published table.
    const pricing = readPricingSources({ root, file: PRICING_FILE });
    if (!pricing.ok) {
      add("read-published-table", VERDICT.BROKEN, INVOICE_CLASSES.NO_PRICING_SOURCE, `${PRICING_FILE}: ${pricing.reason}`);
      return finish();
    }
    add("read-published-table", VERDICT.OK, INVOICE_CLASSES.OK,
      `${pricing.figures.length} plan figure(s) read from ${pricing.file}`, { figures: pricing.figures.length });

    // 2 — the plan being invoiced must be one a visitor can see.
    const figure = pricing.figures.find((f) => f.key === planKey);
    if (!figure) {
      add("resolve-plan", VERDICT.BROKEN, INVOICE_CLASSES.PLAN_NOT_PUBLISHED,
        `"${planKey}" is not in the published table (published: ${pricing.figures.map((f) => f.key).join(", ")})`);
      return finish();
    }
    add("resolve-plan", VERDICT.OK, INVOICE_CLASSES.OK, `${figure.plan} → $${figure.amount} ${figure.unit}, from ${figure.file}:${figure.line}`);

    // 3 — an invoice addressed to nobody is not an invoice.
    if (!client || !String(client).trim()) {
      add("name-client", VERDICT.BROKEN, INVOICE_CLASSES.CLIENT_MISSING, "no client name was supplied");
      return finish();
    }
    add("name-client", VERDICT.OK, INVOICE_CLASSES.OK, `addressed to ${client}`);

    // 4 — render into the throwaway directory and re-read every money token off disk. A figure that
    //     cannot be traced back to a published line refuses the whole rehearsal (AT2's rule).
    const issuedOn = new Date(now).toISOString().slice(0, 10);
    const draftPath = path.join(tmp, "invoice-draft.md");
    fs.writeFileSync(draftPath, renderInvoiceDraft({ client, figure, issuedOn }));
    const written = fs.readFileSync(draftPath, "utf8");
    const published = new Set(pricing.figures.map((f) => `$${f.amount.toLocaleString("en-US")}`));
    const untraceable = [...written.matchAll(/\$[\d,]+(?:\.\d{2})?/g)].map((m) => m[0]).filter((t) => !published.has(t));
    if (untraceable.length) {
      add("trace-every-figure", VERDICT.BROKEN, INVOICE_CLASSES.FIGURE_UNTRACEABLE,
        `${untraceable.length} money token(s) on the rendered invoice trace to no published line: ${[...new Set(untraceable)].join(", ")}`);
      return finish();
    }
    add("trace-every-figure", VERDICT.OK, INVOICE_CLASSES.OK,
      `every money token on the rendered invoice is selected by key out of ${figure.file}`, { bytes: Buffer.byteLength(written) });

    // 5 — a route to a charge must exist for this plan.
    const chargeable = chargeableKeys({ root });
    if (!chargeable.readable) {
      add("charge-route", VERDICT.BROKEN, INVOICE_CLASSES.CHECKOUT_UNREADABLE, `${CHECKOUT_FILE} is absent`);
    } else if (!chargeable.keys.has(planKey)) {
      add("charge-route", VERDICT.BROKEN, INVOICE_CLASSES.NO_CHARGE_ROUTE,
        `"${planKey}" has no price key in ${chargeable.file} — an invoice could be raised that nothing can collect`);
    } else {
      add("charge-route", VERDICT.OK, INVOICE_CLASSES.OK, `"${planKey}" maps to a price key in ${chargeable.file}`);
    }

    // 6 — the currency the page states against the currency the code would charge.
    const pageCur = publishedCurrency({ root });
    const codeCur = chargeCurrency({ root });
    if (!pageCur.currency || !codeCur.readable) {
      add("currency-agreement", VERDICT.UNRUN, INVOICE_CLASSES.API_UNRUN,
        "one side of the comparison could not be read, so no claim is made about the other");
    } else if (codeCur.currency && codeCur.currency !== pageCur.currency) {
      const d = {
        kind: "currency-divergence",
        published: { currency: pageCur.currency, file: pageCur.file, line: pageCur.line, occurrences: pageCur.occurrences },
        charged: { currency: codeCur.currency, file: codeCur.file, line: codeCur.line, path: codeCur.path },
        why: "the page a client reads and the code that charges them state different currencies; which one is wrong is a decision about money, not a defect software may pick",
      };
      decisions.push(d);
      add("currency-agreement", VERDICT.BROKEN, INVOICE_CLASSES.CURRENCY_DISAGREES,
        `${pageCur.file}:${pageCur.line} states ${pageCur.currency} (${pageCur.occurrences}x); ${codeCur.file}:${codeCur.line} charges ${codeCur.currency} on the ${codeCur.path} path`,
        { decision: d });
    } else {
      add("currency-agreement", VERDICT.OK, INVOICE_CLASSES.OK, `both sides state ${pageCur.currency}`);
    }

    // 7 — the charge itself. Correctly UNRUN, forever, in this environment.
    add("raise-the-charge", VERDICT.UNRUN, INVOICE_CLASSES.API_UNRUN,
      "no Stripe key is read and no network call is made; the preset plan price IDs carry their currency inside Stripe, which cannot be read from this repository");

    return finish();
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  function finish() {
    const broken = steps.filter((s) => s.verdict === VERDICT.BROKEN);
    const unrun = steps.filter((s) => s.verdict === VERDICT.UNRUN);
    return {
      schema: INVOICE_REHEARSAL_SCHEMA,
      sends: SENDS, charges: CHARGES, readsKeys: READS_KEYS, writesInRepo: WRITES_IN_REPO,
      planKey, client,
      steps,
      decisions,
      summary: {
        total: steps.length,
        ok: steps.filter((s) => s.verdict === VERDICT.OK).length,
        broken: broken.length,
        unrun: unrun.length,
        walkedToARenderedInvoice: steps.some((s) => s.id === "trace-every-figure" && s.verdict === VERDICT.OK),
        firstBreak: broken.length ? broken[0].class : null,
        decisions: decisions.length,
      },
    };
  }
}

export function statementFor(report) {
  const s = report.summary;
  const tail = `${s.unrun} step(s) correctly unrun here (no key, no network, no money)`;
  if (!s.walkedToARenderedInvoice) {
    return `the invoice path breaks before an invoice exists — ${s.firstBreak}; ${tail}`;
  }
  if (s.broken) {
    return (
      `an invoice can be rendered from traced figures, but ${s.broken} step(s) on the way to collecting it are broken ` +
      `(${report.steps.filter((x) => x.verdict === "broken").map((x) => x.class).join(", ")}); ${tail}`
    );
  }
  return `the path from an agreed proposal to a raised invoice walks end to end on traced figures; ${tail}`;
}

export default { rehearseInvoice, statementFor, publishedCurrency, chargeCurrency, chargeableKeys, INVOICE_CLASSES, VERDICT };
