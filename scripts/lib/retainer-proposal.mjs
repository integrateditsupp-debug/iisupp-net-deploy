// retainer-proposal.mjs — RUN-AT / AT2.
//
// AT1 found that the hour after a yes runs on artefacts that either live on one machine or do not
// exist. This closes the most expensive of them: the document that turns a call into a signature.
//
// The discipline is the one AM1 set for figures and AK1 set for claims, applied to a SALES document:
// **no number in this proposal may be typed into the generator.** Every figure is selected by key out
// of a table parsed from the repository's own published plans, and carries the file and line it came
// from. A price a founder half-remembers at 11pm is the cheapest possible way to lose money and
// trust at the same time, and it is the exact failure this refuses at generation time rather than
// catching in review.
//
// It generates a document. It sends nothing, mails nothing, and signs nothing.
//
// Rule 7 is enforced on the OUTPUT, not on the author's intentions: guarantee / money-back /
// risk-free / no-risk language, an experience claim past 15+ years, and the forbidden name are
// refusals, not warnings.

import fs from "node:fs";
import path from "node:path";

export const PROPOSAL_SCHEMA = "retainer-proposal/1";
export const PRICING_FILE = "plans/index.html";

export const REFUSALS = {
  NO_CLIENT: "no-client",
  UNKNOWN_PLAN: "unknown-plan",
  UNTRACEABLE_FIGURE: "untraceable-figure",
  FORBIDDEN_LANGUAGE: "forbidden-language",
  MISSING_SECTION: "missing-section",
  NO_SOURCE: "no-pricing-source",
};

/** Every section a client's lawyer looks for. A proposal missing one of these is not a proposal. */
export const REQUIRED_SECTIONS = ["Scope", "Not included", "Term", "Notice", "What you own at the end", "Price"];

const FORBIDDEN = [
  { re: /\bguarantee[ds]?\b/i, why: "standing rule 7 — no guarantee language" },
  { re: /\bmoney[- ]back\b/i, why: "standing rule 7 — no money-back language" },
  { re: /\brisk[- ]free\b/i, why: "standing rule 7 — no risk-free language" },
  { re: /\bno[- ]risk\b/i, why: "standing rule 7 — no no-risk language" },
  { re: /\b(?:1[6-9]|2[0-9]|3[0-9])\+?\s*years\b/i, why: "resume-honest — 15+ years is the ceiling" },
  { re: /raymond\s+james/i, why: "forbidden name" },
];

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stripTags = (s) => String(s).replace(/<[^>]*>/g, "").replace(/&middot;|&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * The published plan table, parsed out of the page a visitor actually reads — so a proposal can
 * never quote a price the website does not. Returns figures carrying their own file and line.
 */
export function readPricingSources({ root, file = PRICING_FILE } = {}) {
  const base = root || process.cwd();
  const abs = path.join(base, file);
  if (!fs.existsSync(abs)) return { file, ok: false, reason: "no such file", figures: [] };

  const lines = fs.readFileSync(abs, "utf8").split("\n");
  const figures = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/class="price-row"/.test(line)) continue;
    const headerMatch = line.match(/<thead>\s*<tr>([\s\S]*?)<\/tr>/);
    const priceMatch = line.match(/<tr class="price-row">([\s\S]*?)<\/tr>/);
    if (!headerMatch || !priceMatch) continue;

    const heads = [...headerMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => stripTags(m[1]));
    const cells = [...priceMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripTags(m[1]));
    for (let c = 1; c < cells.length; c += 1) {
      const plan = heads[c];
      const raw = cells[c];
      const money = raw.match(/\$([\d,]+)/);
      if (!plan || !money) continue;
      figures.push({
        key: slug(plan),
        plan,
        raw,
        amount: Number(money[1].replace(/,/g, "")),
        currency: "USD",
        unit: /\/mo/.test(raw) ? "per month" : /\/yr/.test(raw) ? "per year" : "unstated",
        cadence: /billed annually/i.test(raw) ? "billed annually" : "billed monthly",
        file,
        line: i + 1,
      });
    }
  }
  return { file, ok: figures.length > 0, reason: figures.length ? null : "no price row found", figures };
}

/** Every money token a reader could quote back at us. */
function moneyTokens(text) {
  return [...String(text).matchAll(/\$[\d,]+(?:\.\d{2})?/g)].map((m) => m[0]);
}

function render({ client, figure, startDate, term, notice }) {
  const price = `$${figure.amount.toLocaleString("en-US")}`;
  return `# Managed IT retainer — proposal for ${client}

Prepared by **Integrated IT Support Inc.** · iisupp.net · 647-581-3182 · D-U-N-S 241726397
Plan: **${figure.plan}** · this proposal is a draft for discussion and is not an invoice.

## Price
${price} ${figure.currency} ${figure.unit}, ${figure.cadence}.
Every figure above is taken from our published plan table (\`${figure.file}\`, line ${figure.line}) — the
same page anyone can read on the website. If the page and this document ever disagree, the page wins.

## Scope
- A named engineer accountable for your environment, reachable by phone and email during business hours.
- Monitoring, patching and endpoint hygiene across the workstations covered by the ${figure.plan} plan.
- Helpdesk for your staff: they contact us directly instead of routing through you.
- ARIA runs alongside the human desk on covered machines; every automated fix is previewed and applied
  only on an operator's confirmation click.
- A monthly written review of what broke, what was fixed, and what we recommend next.

## Not included
- Hardware, software licences, and third-party subscriptions — bought in your name, never marked up.
- Projects outside routine operations (migrations, office moves, new-site builds) — quoted separately
  before any work starts.
- Anything requiring a licensed professional we are not: legal, accounting, or regulated compliance sign-off.

## Term
Month to month from ${startDate}. Minimum ${term}.

## Notice
Either side may end this with ${notice} written notice, by email. No termination fee.

## What you own at the end
- Every credential, licence and domain stays in your name throughout — we hold access, never ownership.
- Your documentation, asset inventory and ticket history are exported to you in an open format on request,
  during the term or after it.
- Nothing in this agreement locks your data inside a tool you cannot leave.

## What we need from you
- One person on your side who can approve changes.
- Administrative access to the systems in scope.
- Thirty minutes at the start of each month for the review.

---
*Prepared ${new Date().toISOString().slice(0, 10)} for discussion. Not an invoice; no payment details are
collected with this document. Have your own advisor review before signing.*
`;
}

/**
 * Generates, or refuses with the reason. The refusal is the point: this returns `ok:false` with a
 * named class rather than a document containing a number nobody can trace.
 */
export function generateRetainerProposal({
  root, client, planKey, startDate = "the date both sides sign",
  term = "3 months", notice = "30 days", sources = null,
} = {}) {
  const refusals = [];
  const priced = sources || readPricingSources({ root });

  if (!priced.ok) refusals.push({ class: REFUSALS.NO_SOURCE, detail: priced.reason || "pricing unreadable" });
  if (!client || !String(client).trim()) refusals.push({ class: REFUSALS.NO_CLIENT, detail: "a proposal addressed to nobody" });

  const figure = priced.figures.find((f) => f.key === planKey) || null;
  if (!figure) {
    refusals.push({
      class: REFUSALS.UNKNOWN_PLAN,
      detail: `"${planKey}" is not a plan published in ${priced.file}; known: ${priced.figures.map((f) => f.key).join(", ") || "none"}`,
    });
  }
  if (refusals.length) return { ok: false, schema: PROPOSAL_SCHEMA, refusals, document: null, traced: [] };

  const document = render({ client: String(client).trim(), figure, startDate, term, notice });

  // Trace AFTER rendering: whatever ended up in the text is what a client will quote back.
  const traceable = new Set([`$${figure.amount.toLocaleString("en-US")}`]);
  for (const token of moneyTokens(document)) {
    if (!traceable.has(token)) {
      refusals.push({
        class: REFUSALS.UNTRACEABLE_FIGURE,
        detail: `${token} appears in the document and cannot be traced to ${priced.file}`,
      });
    }
  }
  for (const f of FORBIDDEN) {
    const hit = document.match(f.re);
    if (hit) refusals.push({ class: REFUSALS.FORBIDDEN_LANGUAGE, detail: `"${hit[0]}" — ${f.why}` });
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!new RegExp(`^##\\s+${section}\\b`, "m").test(document)) {
      refusals.push({ class: REFUSALS.MISSING_SECTION, detail: `no "${section}" section` });
    }
  }
  if (refusals.length) return { ok: false, schema: PROPOSAL_SCHEMA, refusals, document: null, traced: [] };

  return {
    ok: true,
    schema: PROPOSAL_SCHEMA,
    refusals: [],
    document,
    sends: false,
    traced: [{ token: `$${figure.amount.toLocaleString("en-US")}`, plan: figure.plan, file: figure.file, line: figure.line }],
    figure,
  };
}

export function statementFor(result) {
  if (result.ok) {
    const t = result.traced[0];
    return `a retainer proposal generated from ${t.file}:${t.line} (${t.plan} ${t.token}) — every figure traced, nothing sent`;
  }
  return `the proposal was REFUSED: ${result.refusals.map((r) => `${r.class} (${r.detail})`).join("; ")}`;
}
