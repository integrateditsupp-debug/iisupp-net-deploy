// currency-consistency.mjs — RUN-AV / AV1. THE CURRENCY, SETTLED END TO END.
//
// AU2 rehearsed the invoice and found two surfaces disagreeing: the published plan table states USD,
// the inline one-time charge path defaults to CAD. It reported those two and staged the decision.
//
// This walks the WHOLE money path instead of the two surfaces one rehearsal happened to touch, and
// the walk found five more. The reason that matters is not tidiness: one of them is the renewal
// email a paying customer receives. A company can survive a mislabelled dashboard. A company that
// emails a customer an amount in one currency and charges their card in another has a chargeback and
// a credibility problem in the same message.
//
// THE DISCIPLINE, stated so it cannot drift:
//
//   1. A currency is READ out of the file that declares it, never assumed. Every declaration in the
//      report carries its file, its line, and the exact source text that produced it.
//
//   2. The audit may not return "consistent" while surfaces disagree. There is no code path in this
//      module that can produce CONSISTENT from more than one distinct currency. A gate that went
//      green by ignoring the question would be the failure, not the fix.
//
//   3. Software does not pick the direction. Which currency this company charges is a decision about
//      money and it belongs to Ahmad. Until a direction is declared IN THE TREE, the verdict is
//      UNDECIDED and the divergence is reported with every citation. Once a direction exists, every
//      surface that disagrees with it is DIVERGENT and the suite goes red until it is corrected.
//      The same module reports honestly before the decision and enforces it after, so the decision
//      only has to be made once.
//
//   4. What lives inside Stripe stays UNRUN. The preset plan subscriptions charge through Stripe
//      price IDs whose currency is stored in Stripe, not in this repository. It cannot be read here,
//      so it is reported unrun WITH ITS REASON — never counted as agreeing, never counted as broken.
//
//   5. A typed currency is not the same fact as a read one. `retainer-proposal.mjs` stamps "USD" on
//      every figure it selects out of the plan table — a literal in the generator, not a value parsed
//      from the page. It happens to be right today. It would keep being "right" on the day the page
//      changed. It is classed TYPED, separately from READ, because the failure mode is different.
//
// FOUND BY RUNNING IT (2026-08-11): seven currency declarations across the money path, in two
// currencies. AU reported two of them.

import fs from "node:fs";
import path from "node:path";

export const CURRENCY_SCHEMA = "currency-consistency/1";

/** Where a declared direction would live. Absent = undecided. This file is never written by software. */
export const DECISION_FILE = "senior-director-state/decisions/currency.json";

export const VERDICT = Object.freeze({
  CONSISTENT: "consistent",   // every readable surface states the same currency, and it matches the direction if one exists
  DIVERGENT: "divergent",     // surfaces disagree with a declared direction
  UNDECIDED: "undecided",     // surfaces disagree and no direction has been declared — reported, never smoothed
  UNREADABLE: "unreadable",   // the money path could not be read at all
});

export const HOW = Object.freeze({
  READ: "read-from-the-file-that-declares-it",
  TYPED: "a-literal-in-the-generator-rather-than-a-value-parsed-from-the-published-page",
  FALLBACK: "a-default-used-when-the-upstream-value-is-absent",
  UNRUN: "stored-outside-this-repository-and-not-readable-here",
});

export const ROLE = Object.freeze({
  PUBLISHED: "what-the-visitor-reads-on-the-plan-page",
  CHARGE: "what-the-customer-card-is-actually-charged-in",
  CUSTOMER_MESSAGE: "what-a-customer-is-told-in-a-message-we-send-them",
  OPERATOR_REPORT: "what-an-operator-dashboard-reports",
  SALES_DOCUMENT: "what-a-prospect-is-quoted-in-a-document",
});

/**
 * The money path, as data. Each entry names the file, the role it plays, and a matcher that pulls the
 * currency OUT of the source rather than asserting it. Keeping this as data is what lets the suite
 * plant a drift in any single surface and assert it is caught BY FILE AND BY LINE.
 */
export const SURFACES = [
  {
    file: "plans/index.html",
    role: ROLE.PUBLISHED,
    how: HOW.READ,
    why: "the page a visitor decides on; if this is wrong the customer was misled before anyone charged anything",
    re: /\b(USD|CAD)\b/g,
  },
  {
    file: "netlify/functions/stripe-checkout.js",
    role: ROLE.CHARGE,
    how: HOW.FALLBACK,
    why: "the inline one-time price path; this is the currency a card is actually charged in",
    re: /currency\s*=\s*String\(\s*[\w.]+\s*\|\|\s*['"]([a-z]{3})['"]/gi,
  },
  {
    file: "netlify/functions/aria-web-tier.js",
    role: ROLE.CHARGE,
    how: HOW.READ,
    why: "the web tier's own price definition",
    re: /currency\s*:\s*['"]([A-Za-z]{3})['"]/g,
  },
  {
    file: "netlify/functions/aria-renewal-reminders.js",
    role: ROLE.CUSTOMER_MESSAGE,
    how: HOW.FALLBACK,
    why: "the renewal email a PAYING customer receives, stating the amount they are about to be charged",
    re: /currency\s*=\s*\(\(?[^)]*\)?\s*\|\|\s*['"]([a-z]{3})['"]\)/gi,
  },
  {
    file: "netlify/functions/stripe-webhook.js",
    role: ROLE.CUSTOMER_MESSAGE,
    how: HOW.FALLBACK,
    why: "the amount stamped on the payment confirmation a customer receives",
    re: /currency\s*=\s*\([\w.]+\s*\|\|\s*['"]([a-z]{3})['"]\)/gi,
  },
  {
    file: "netlify/functions/aria-mrr-dashboard.js",
    role: ROLE.OPERATOR_REPORT,
    how: HOW.READ,
    why: "the recurring-revenue figure an operator reads and repeats out loud",
    re: /currency\s*:\s*['"]([A-Za-z]{3})['"]/g,
  },
  {
    file: "scripts/lib/retainer-proposal.mjs",
    role: ROLE.SALES_DOCUMENT,
    how: HOW.TYPED,
    why: "the currency printed beside every figure in the proposal a prospect signs against",
    re: /currency\s*:\s*"([A-Za-z]{3})"/g,
  },
];

/** The half that genuinely cannot be read here. Declared, never silently omitted. */
export const UNRUN_SURFACES = [
  {
    file: "netlify/functions/stripe-checkout.js",
    role: ROLE.CHARGE,
    how: HOW.UNRUN,
    what: "the preset plan subscriptions",
    reason:
      "they charge through Stripe price IDs; the currency of a price ID is stored inside Stripe and is not " +
      "present in this repository, so it can be neither confirmed nor contradicted from here",
  },
];

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** Read every currency declaration on the money path. Nothing below is a currency this file chose. */
export function readDeclarations({ root = process.cwd(), surfaces = SURFACES } = {}) {
  const declarations = [];
  const unreadable = [];

  for (const s of surfaces) {
    const abs = path.join(root, s.file);
    if (!fs.existsSync(abs)) { unreadable.push({ file: s.file, role: s.role, reason: "no such file" }); continue; }
    let text;
    try { text = fs.readFileSync(abs, "utf8"); }
    catch (err) { unreadable.push({ file: s.file, role: s.role, reason: String((err && err.message) || err) }); continue; }

    s.re.lastIndex = 0;
    const seen = new Map(); // currency -> first citation, so eight identical USD cells are one declaration
    let m;
    while ((m = s.re.exec(text)) !== null) {
      const raw = m[1] || m[0];
      const currency = String(raw).toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) continue;
      const cur = seen.get(currency);
      if (cur) { cur.occurrences += 1; continue; }
      seen.set(currency, {
        file: s.file, line: lineOf(text, m.index), currency,
        role: s.role, how: s.how, why: s.why,
        evidence: m[0].trim().slice(0, 120),
        occurrences: 1,
      });
    }
    if (!seen.size) {
      unreadable.push({ file: s.file, role: s.role, reason: "the file is present but declares no currency this matcher can read" });
      continue;
    }
    for (const d of seen.values()) declarations.push(d);
  }

  return { declarations, unreadable };
}

/** The direction, if one has been declared in the tree. Absent is a first-class answer, not an error. */
export function readDirection({ root = process.cwd(), file = DECISION_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { declared: false, currency: null, file, reason: "no direction has been declared in the tree" };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(abs, "utf8")); }
  catch (err) { return { declared: false, currency: null, file, reason: `unparseable: ${String((err && err.message) || err)}` }; }
  const currency = String(parsed && parsed.currency ? parsed.currency : "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { declared: false, currency: null, file, reason: "the file exists but names no three-letter currency" };
  return { declared: true, currency, file, decidedBy: parsed.decidedBy || null, decidedOn: parsed.decidedOn || null };
}

/**
 * Audit the money path.
 *
 * There is deliberately no branch below that can return CONSISTENT while more than one distinct
 * currency was read. That is the single invariant this whole module exists to hold.
 */
export function auditCurrency({ root = process.cwd(), surfaces = SURFACES, decisionFile = DECISION_FILE } = {}) {
  const { declarations, unreadable } = readDeclarations({ root, surfaces });
  const direction = readDirection({ root, file: decisionFile });

  if (!declarations.length) {
    return {
      schema: CURRENCY_SCHEMA, verdict: VERDICT.UNREADABLE, direction,
      declarations: [], unreadable, unrun: UNRUN_SURFACES,
      currencies: [], divergent: [],
      summary: { surfaces: 0, currencies: 0, divergent: 0, unreadable: unreadable.length, unrun: UNRUN_SURFACES.length, typed: 0 },
    };
  }

  const currencies = [...new Set(declarations.map((d) => d.currency))].sort();

  // Against a declared direction, "divergent" means "disagrees with the decision".
  // With no direction, it means "disagrees with the majority of readable surfaces" — reported so the
  // operator can see the shape of the split, never as a recommendation.
  let divergent;
  if (direction.declared) {
    divergent = declarations.filter((d) => d.currency !== direction.currency);
  } else if (currencies.length > 1) {
    // No direction declared. A STRICT majority is a fact about the tree and worth reporting: the
    // minority surfaces are the ones out of step with everything else. A TIE is not — picking a side
    // of a tie is software leaning on a decision it was told not to make, so in a tie EVERY surface
    // is in dispute and every one of them is cited. Found by a test that planted a 1-1 split and
    // watched the alphabetical tiebreak quietly nominate a winner.
    const counts = {};
    for (const d of declarations) counts[d.currency] = (counts[d.currency] || 0) + 1;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const tied = ranked.length > 1 && ranked[0][1] === ranked[1][1];
    divergent = tied ? declarations.slice() : declarations.filter((d) => d.currency !== ranked[0][0]);
  } else {
    divergent = [];
  }

  const verdict = currencies.length > 1
    ? (direction.declared ? VERDICT.DIVERGENT : VERDICT.UNDECIDED)
    : (direction.declared && currencies[0] !== direction.currency ? VERDICT.DIVERGENT : VERDICT.CONSISTENT);

  return {
    schema: CURRENCY_SCHEMA, verdict, direction,
    declarations, unreadable, unrun: UNRUN_SURFACES,
    currencies, divergent,
    summary: {
      surfaces: declarations.length,
      currencies: currencies.length,
      divergent: divergent.length,
      unreadable: unreadable.length,
      unrun: UNRUN_SURFACES.length,
      typed: declarations.filter((d) => d.how === HOW.TYPED).length,
    },
  };
}

/** One line an operator can act on at 11pm, with the citations attached rather than summarised away. */
export function statementFor(report) {
  const s = report.summary;
  if (report.verdict === VERDICT.UNREADABLE) return "currency: the money path could not be read at all.";
  if (report.verdict === VERDICT.CONSISTENT) {
    return `currency: ${report.currencies[0]} across all ${s.surfaces} readable surface(s)` +
      `${report.direction.declared ? ", matching the declared direction" : ", no direction declared"}` +
      ` · ${s.unrun} unrun (${UNRUN_SURFACES[0].what}).`;
  }
  const cites = report.divergent.map((d) => `${d.file}:${d.line} ${d.currency}`).join(" · ");
  const head = report.direction.declared
    ? `currency: DIVERGENT from the declared ${report.direction.currency}`
    : `currency: UNDECIDED — ${report.currencies.join(" and ")} both declared on the money path, and software may not pick`;
  return `${head} — ${s.divergent} surface(s) off: ${cites} · ${s.unrun} unrun (${UNRUN_SURFACES[0].what}).`;
}

export default { auditCurrency, readDeclarations, readDirection, statementFor, SURFACES, UNRUN_SURFACES, VERDICT, HOW, ROLE };
