// quoted-figures.mjs — RUN-AV / AV2. EVERY MONEY FIGURE A CLIENT CAN READ, RECONCILED.
//
// AU1 found that three client-signable contracts quote prices that appear nowhere a client can check
// them, and staged the decision. It looked at `legal/` only, and it could only ever say "this figure
// is not in the plan table" — which is true of an insurance limit and a breach-cost benchmark too,
// neither of which belongs in a plan table and neither of which is wrong.
//
// So the gate AU left behind had exactly two moves available: publish the figure, or delete it. Both
// are wrong for most of these figures, and deleting a working contract to make a gate go green would
// have been the worse failure by a distance (Rule 15).
//
// AV2 replaces that binary with a third state that is neither a loophole nor a lie: a figure may be
// DECLARED, in the tree, as deliberately quoted outside the published table, WITH A REASON. The
// reason is a sentence a person wrote and can be argued with. What disappears is the SILENT figure —
// a number a client is quoted that nobody in this company has ever consciously accounted for.
//
// THE DISCIPLINE:
//
//   1. **Nothing is deleted to reach zero.** The reconciliation is additive. There is no code path
//      here that edits a client-facing document.
//
//   2. **A declaration must carry a reason with content.** A declaration whose reason is empty,
//      "n/a", "tbd", or a restatement of the figure is REFUSED — declaring by writing the word
//      "declared" is how a gate becomes a rubber stamp.
//
//   3. **A declaration must match a figure that actually exists.** A declaration matching nothing in
//      the tree is STALE and reported, so the file cannot rot into a list of numbers nobody quotes.
//
//   4. **A figure that is neither published nor declared is SILENT, and silent is the failure.**
//
//   5. **The figure's own line travels with it.** "$5,000 in MSA-template.md" is not actionable at
//      11pm; "$5,000 · legal/MSA-template.md:203 · ServiceNow ITSM one-time implementation" is.

import fs from "node:fs";
import path from "node:path";
import { publishedMoney } from "./client-facing-leak.mjs";
import { readPricingSources } from "./retainer-proposal.mjs";

export const QUOTED_FIGURES_SCHEMA = "quoted-figures/1";

/** Where the declarations live. A tracked, client-safe file: it explains figures, it quotes no secrets. */
export const DECLARATIONS_FILE = "docs/QUOTED-FIGURES.md";

/**
 * What counts as client-facing for this reconciliation. Contracts a client signs, the security
 * documents a client's own reviewers read, and the one-pager a prospect is handed.
 */
export const CLIENT_FACING_DIRS = ["legal", "compliance", "ARIA Sentinel/sales"];

export const CLASS = Object.freeze({
  PUBLISHED: "published-in-the-plan-table-a-client-can-check",
  DECLARED: "deliberately-quoted-outside-the-published-table-with-a-stated-reason",
  SILENT: "quoted-to-a-client-and-accounted-for-nowhere",
});

/**
 * A separate finding, and the more expensive one. A figure is CONTRADICTORY when it sits on a line
 * that names a plan the company publishes, and states a different amount for it. That is not an
 * unpublished figure — it is a second price for the same named thing, in a document a prospect is
 * handed. Software does not pick which one is right: the sales one-pager may describe a different
 * product line entirely, and silently "correcting" a price would be exactly the guess Rule 14
 * forbids. It is reported with both citations and left standing.
 */
export const CONTRADICTION = "a-plan-the-company-publishes-quoted-at-a-different-amount";

/** Reasons that are not reasons. A declaration matching one of these is refused. */
const EMPTY_REASON = /^(n\/?a|tbd|todo|none|-+|\.*|declared|see above|ok|fine|as discussed)$/i;

// The decimal part is NOT restricted to two places. An earlier version required exactly two, which
// read "$937.5K" as "$937" and "$73.5" as "$73" — misreading a client-facing figure by three orders
// of magnitude while reporting confidently. Found by reading the collected tokens against the source
// line rather than trusting the collector.
const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:[KMB]\b)?/g;

/** "$ 5,000" · "$625K" · "$937.50" all normalise to one comparable token. */
export function normalizeMoney(s) {
  return String(s).replace(/\s+/g, "").replace(/,/g, "").toUpperCase();
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const lineTextAt = (text, index) => {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? undefined : end).trim();
};

/** Walk the client-facing documents and collect every money figure, with its file, line and line text. */
export function collectFigures({ root = process.cwd(), dirs = CLIENT_FACING_DIRS } = {}) {
  const figures = [];
  const walked = [];

  const walk = (abs, rel) => {
    if (!fs.existsSync(abs)) return;
    for (const name of fs.readdirSync(abs).sort()) {
      const childAbs = path.join(abs, name);
      const childRel = `${rel}/${name}`;
      const st = fs.statSync(childAbs);
      if (st.isDirectory()) { walk(childAbs, childRel); continue; }
      if (!name.endsWith(".md")) continue;
      walked.push(childRel);
      const text = fs.readFileSync(childAbs, "utf8");
      MONEY.lastIndex = 0;
      let m;
      while ((m = MONEY.exec(text)) !== null) {
        figures.push({
          found: m[0].trim(),
          token: normalizeMoney(m[0]),
          file: childRel,
          line: lineOf(text, m.index),
          context: lineTextAt(text, m.index).slice(0, 160),
        });
      }
    }
  };

  for (const dir of dirs) walk(path.join(root, dir), dir);
  return { figures, documents: walked };
}

/**
 * Parse the declarations file. The format is a markdown table so a person reads and edits it without
 * a tool: | figure | where | why it is quoted outside the published table |
 */
export function readFigureDeclarations({ root = process.cwd(), file = DECLARATIONS_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { readable: false, file, entries: [], malformed: [] };
  const text = fs.readFileSync(abs, "utf8");
  const entries = [];
  const malformed = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const row = lines[i];
    if (!/^\s*\|/.test(row)) continue;
    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (/^-+$/.test(cells[0].replace(/[:\s]/g, "-"))) continue;          // separator row
    if (!/\$/.test(cells[0])) continue;                                   // header row
    const figureCell = cells[0].replace(/`/g, "").trim();
    const where = cells[1].replace(/`/g, "").trim();
    const why = cells[2].replace(/`/g, "").trim();
    // One row may account for several figures that share a reason ("$60K `$95K` — a salary band").
    // Each is its own entry, so a row can never silently cover a figure it does not name.
    MONEY.lastIndex = 0;
    const tokens = (figureCell.match(MONEY) || []).map((t) => t.trim());
    if (!tokens.length) continue;
    for (const figure of tokens) {
      const entry = { figure, token: normalizeMoney(figure), where, why, line: i + 1, file };
      if (!why || EMPTY_REASON.test(why) || normalizeMoney(why) === entry.token) {
        entry.refused = "a declaration must carry a reason with content; this one states nothing";
        malformed.push(entry);
        continue;
      }
      entries.push(entry);
    }
  }
  return { readable: true, file, entries, malformed };
}

/**
 * Reconcile. Returns every figure classified, the declarations that matched nothing, and the
 * declarations that were refused for having no real reason.
 */
export function reconcileQuotedFigures({ root = process.cwd(), dirs = CLIENT_FACING_DIRS, declarationsFile = DECLARATIONS_FILE } = {}) {
  const { figures, documents } = collectFigures({ root, dirs });
  const published = publishedMoney({ root });
  const planTable = readPricingSources({ root });
  const declarations = readFigureDeclarations({ root, file: declarationsFile });

  const declaredTokens = new Map();
  for (const e of declarations.entries) {
    if (!declaredTokens.has(e.token)) declaredTokens.set(e.token, []);
    declaredTokens.get(e.token).push(e);
  }

  const classifyOne = (f) => {
    if (published.figures.has(f.token.toLowerCase()) || published.figures.has(f.token)) {
      return { ...f, class: CLASS.PUBLISHED, declaredBy: null };
    }
    const hits = declaredTokens.get(f.token);
    if (hits && hits.length) return { ...f, class: CLASS.DECLARED, declaredBy: `${hits[0].file}:${hits[0].line}` };
    return { ...f, class: CLASS.SILENT, declaredBy: null };
  };
  let classified = figures.map(classifyOne);

  // Contradictions are found on top of the classification, never instead of it: a figure can be both
  // silent AND contradictory, and collapsing the two would lose the more expensive fact.
  //
  // PRECISION IS THE WHOLE VALUE HERE. The first version of this matched any plan name anywhere on
  // the same line, and produced twenty-two findings of which most were noise — "$625K+ enterprise
  // contract" is the word enterprise as an adjective, and "$150-$300 per call-out" beside the word
  // Personal is a competitor comparison, not our price. A finding list an operator learns to ignore
  // is worse than no finding list, so a contradiction is only raised when the figure is presented AS
  // THE PRICE OF THAT PLAN: a table row whose first cell IS the plan name, or prose where the plan
  // name is immediately followed by the figure and a rate marker.
  const contradictions = [];
  if (planTable.ok) {
    // Plan names are compared with punctuation and case collapsed. "Mid-Size" in a sales document
    // and "Mid Size" in the plan table are the same plan, and a hyphen is not a reason to let a
    // second price for it go unreported.
    const norm = (s2) => String(s2).toLowerCase().replace(/[^a-z0-9]+/g, "");
    const planByName = new Map(planTable.figures.map((p) => [norm(p.plan), p]));
    const RATE = /\/\s?(mo|month|yr|year)\b|per\s+(month|year)\b/i;
    const stripMd = (s2) => String(s2).replace(/[*`_]/g, "").trim();
    const scaleOf = (tok) => (/K$/.test(tok) ? 1e3 : /M$/.test(tok) ? 1e6 : /B$/.test(tok) ? 1e9 : 1);
    const valueOf = (tok) => Number(String(tok).replace(/[$KMB]/g, "")) * scaleOf(tok);

    for (const f of classified) {
      const ctx = f.context;
      let plan = null;
      let presentedAsPrice = false;

      if (/^\s*\|/.test(ctx)) {
        const cells = ctx.split("|").slice(1, -1).map(stripMd);
        const head = norm(cells[0] || "");
        if (planByName.has(head)) {
          const cell = cells.find((c) => c.includes(f.found.trim()));
          // A price cell is a cell that is essentially just the money, or money plus a rate marker.
          if (cell && (RATE.test(cell) || stripMd(cell).replace(/\s+/g, "") === f.found.replace(/\s+/g, ""))) {
            plan = planByName.get(head);
            presentedAsPrice = true;
          }
        }
      } else {
        for (const [name, p] of planByName) {
          const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^$\\n]{0,20}\\${"$"}`, "i");
          const m = re.exec(ctx);
          if (!m) continue;
          const after = ctx.slice(m.index + m[0].length - 1);
          if (!after.startsWith(f.found.trim().slice(0, 4)) && !after.startsWith(f.found.trim())) continue;
          if (!RATE.test(after.slice(0, 40))) continue;
          plan = p; presentedAsPrice = true; break;
        }
      }

      if (!plan || !presentedAsPrice) continue;
      const value = valueOf(f.token);
      if (!Number.isFinite(value) || value === plan.amount) continue;
      if (value === plan.amount * 12) continue;   // the same monthly price stated annually is not a second price

      contradictions.push({
        found: f.found, file: f.file, line: f.line, context: f.context,
        plan: plan.plan, publishedAmount: plan.amount,
        publishedAt: `${plan.file}:${plan.line}`,
        class: CONTRADICTION,
      });
    }
  }

  // A contradiction is ACCOUNTED FOR — loudly, in its own class and its own list. It is not silent,
  // and it is deliberately not declarable in the register: declaring it there would use the register
  // to launder a second price for a published plan, which is the exact failure the register exists
  // to prevent. It reads as CONTRADICTS and it stays on NEEDS-AHMAD until a person decides.
  const contradicted = new Set(contradictions.map((c) => `${c.file}:${c.line}:${normalizeMoney(c.found)}`));
  classified = classified.map((f) =>
    contradicted.has(`${f.file}:${f.line}:${f.token}`) ? { ...f, class: CONTRADICTION, declaredBy: null } : f);

  const usedTokens = new Set(classified.filter((c) => c.class === CLASS.DECLARED).map((c) => c.token));
  const stale = declarations.entries.filter((e) => !usedTokens.has(e.token));
  const silent = classified.filter((c) => c.class === CLASS.SILENT);

  return {
    schema: QUOTED_FIGURES_SCHEMA,
    declarationsFile,
    declarationsReadable: declarations.readable,
    documents,
    figures: classified,
    silent,
    stale,
    contradictions,
    refusedDeclarations: declarations.malformed,
    summary: {
      documents: documents.length,
      figures: classified.length,
      distinct: new Set(classified.map((c) => c.token)).size,
      published: classified.filter((c) => c.class === CLASS.PUBLISHED).length,
      declared: classified.filter((c) => c.class === CLASS.DECLARED).length,
      contradictory: classified.filter((c) => c.class === CONTRADICTION).length,
      silent: silent.length,
      stale: stale.length,
      contradictions: contradictions.length,
      refusedDeclarations: declarations.malformed.length,
      ok: silent.length === 0 && declarations.malformed.length === 0,
    },
  };
}

export function statementFor(report) {
  const s = report.summary;
  const contra = s.contradictions
    ? ` · ${s.contradictions} figure(s) quote a published plan at a different amount: ` +
      report.contradictions.slice(0, 3).map((c) => `${c.plan} ${c.found} at ${c.file}:${c.line} vs $${c.publishedAmount} at ${c.publishedAt}`).join(" · ")
    : "";
  const head = `quoted figures: ${s.figures} across ${s.documents} client-facing document(s) — ` +
    `${s.published} published, ${s.declared} declared, ${s.silent} silent`;
  if (s.ok) return `${head} · ${s.stale} stale declaration(s)${contra}.`;
  const cites = report.silent.slice(0, 6).map((f) => `${f.found} ${f.file}:${f.line}`).join(" · ");
  return `${head}${s.refusedDeclarations ? `, ${s.refusedDeclarations} declaration(s) refused for stating nothing` : ""} — ${cites}${report.silent.length > 6 ? ` · +${report.silent.length - 6} more` : ""}${contra}.`;
}

export default { reconcileQuotedFigures, collectFigures, readFigureDeclarations, statementFor, normalizeMoney, CLASS, CONTRADICTION, CLIENT_FACING_DIRS, DECLARATIONS_FILE };
