// response-time-consistency.mjs — RUN-BE / BE1. THE PROMISE A BUYER CANNOT SEE BEFORE THEY SIGN.
//
// RUN-BA answered the retention half of "the decisions a paying stranger runs into" and stopped, in
// writing, where the answer became Ahmad's. RUN-AV closed the currency half the same way. This is the
// third: RESPONSE TIMES. It is the one with a signature under it.
//
// WHAT RUNNING IT FOUND (2026-08-11, read first-hand, never assumed):
//
//   The signable agreement binds a response time for every tier. `legal/MSA-template.md` Schedule B
//   carries a P1 and a P2 row across five tiers, with service credits attached to missing them.
//
//   The page a buyer buys from does not state a single one of those numbers. `plans/index.html`
//   publishes a five-column comparison matrix with a row reading "SLA tracking ✓ / —" — the fact that
//   an SLA is TRACKED, never the SLA. A customer therefore learns the number the company is bound to
//   at the moment they sign it, not at the moment they choose.
//
//   That is not a formatting gap. A response-time commitment is the single term most likely to be
//   the reason a support contract is bought, and it is the term most likely to be argued about later.
//   Discovering it after signature is how a good sale becomes a dispute.
//
// THE DISCIPLINE, stated so it cannot drift:
//
//   1. BINDING vs PUBLISHED are different classes and are never merged. A number in the agreement
//      creates an obligation. A number on the page creates an expectation. This module reports them
//      separately and names which one is missing, because the remedy differs: an unpublished binding
//      is a disclosure gap, a published-but-unbound number is an unbacked claim.
//
//   2. Software does not pick the numbers, and it does not pick which side moves. Whether Personal
//      carries an SLA at all, and whether the retainer decks map onto matrix tiers, are decisions
//      about what this company owes people. They belong to Ahmad. Until a direction is declared IN
//      THE TREE the verdict is UNDECIDED and every gap is reported with file:line. After it is
//      declared, drift from it is DIVERGENT and the suite goes red. The same module reports honestly
//      before the decision and enforces it after, so the decision is only made once.
//
//   3. A tier name is not a tier. The agreement says `SBA`; the matrix says `Small Business`. Those
//      are the same product only because someone says so, so the mapping is DECLARED DATA below with
//      a reason per row — never inferred from string similarity. A tier on either side with no
//      declared partner is UNMAPPED and is reported, never quietly dropped. An audit that silently
//      discards what it cannot match reports a clean tree by not looking at the dirty part of it.
//
//   4. "Next business day" is not a number and is not converted into one. It is a distinct, ordered
//      class. Comparing it to 240 minutes by inventing a business-day length would be a fabricated
//      metric with arithmetic in front of it (Rule 14). Two symbolic commitments compare equal only
//      when they are the same symbol.
//
//   5. Nothing here writes to a customer-facing surface and nothing here deletes one (Rule 15). It
//      reads, classes, and cites.

import fs from "node:fs";
import path from "node:path";

export const RESPONSE_TIME_SCHEMA = "response-time-consistency/1";

/** Where a declared direction would live. Absent = undecided. Never written by software. */
export const DECISION_FILE = "senior-director-state/decisions/response-times.json";

export const VERDICT = Object.freeze({
  CONSISTENT: "consistent",             // every bound tier is published, with the same commitment
  BOUND_UNPUBLISHED: "bound-unpublished", // the agreement binds a commitment the buying surface never states
  PUBLISHED_UNBOUND: "published-unbound", // a surface states a commitment no agreement row supports
  CONTRADICTS: "contradicts",           // both state it, and they are not the same commitment
  UNDECIDED: "undecided",               // gaps exist and no direction has been declared — reported, never smoothed
  DIVERGENT: "divergent",               // a direction exists and the tree has drifted from it
  UNREADABLE: "unreadable",             // neither side could be read at all
});

export const CLASS = Object.freeze({
  BINDING: "binding-a-signable-agreement-creates-this-obligation",
  PUBLISHED: "published-a-buyer-can-read-this-before-they-sign",
});

export const KIND = Object.freeze({
  MINUTES: "a-duration-in-minutes",
  SYMBOLIC: "a-named-window-that-is-not-a-duration",
});

/**
 * The binding source. One entry, deliberately: an obligation comes from a document someone signs,
 * and if a second one ever appears it is a finding, not a convenience.
 */
export const BINDING_SURFACES = Object.freeze([
  Object.freeze({
    file: "legal/MSA-template.md",
    what: "Schedule B — Service Level Agreement",
    why: "the response-time rows a customer's signature is applied to, with service credits attached",
  }),
]);

/**
 * The published surfaces a buyer can reach without signing anything.
 * `matrixRow` names the row this module expects to carry the commitment; its ABSENCE is the finding.
 */
export const PUBLISHED_SURFACES = Object.freeze([
  Object.freeze({
    file: "plans/index.html",
    what: "the five-tier comparison matrix",
    why: "the surface a buyer compares tiers on and the only place a tier's terms are set out side by side",
    kind: "matrix",
    // The page carries more than one table — a cost calculator sits above this one. The matrix is
    // read ONLY from between its own markers. Found by running it: without this, the audit read the
    // calculator's header and reported "Headcount" and "Annual cost" as product tiers. An audit that
    // reads the first table it finds is confidently auditing the wrong thing.
    region: Object.freeze(["<!-- SENTINEL_MATRIX:START -->", "<!-- SENTINEL_MATRIX:END -->"]),
  }),
  Object.freeze({
    file: "index.html",
    what: "the retainer decks",
    why: "the home page states a response commitment in prose, attached to a price band rather than to a matrix tier",
    kind: "prose",
  }),
]);

/** MSA tier label → published tier label. Declared, with a reason. Never inferred. */
export const TIER_MAP = Object.freeze([
  Object.freeze({ binding: "Personal", published: "Personal", why: "identical label on both sides" }),
  Object.freeze({ binding: "Pro", published: "Pro", why: "identical label on both sides" }),
  Object.freeze({ binding: "SBA", published: "Small Business", why: "the agreement abbreviates the tier the matrix spells out; same price row" }),
  Object.freeze({ binding: "Mid", published: "Mid Size", why: "the agreement shortens the tier the matrix spells out; same price row" }),
  Object.freeze({ binding: "Enterprise", published: "Enterprise", why: "identical label on both sides" }),
]);

/** The rows Schedule B carries that this module treats as response commitments. */
export const COMMITMENT_ROWS = Object.freeze(["P1 response time", "P2 response time"]);

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Parse one commitment cell.
 *
 * Returns null for a cell that states no commitment. A cell this cannot read is NOT silently
 * dropped by the caller — it is carried as unreadable, because an unreadable obligation is worse
 * than an absent one.
 */
export function parseCommitment(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "—" || s === "-" || s === "None" || s === "N/A") return null;

  const min = s.match(/^(\d+)\s*(?:min|minute)s?$/i);
  if (min) return { kind: KIND.MINUTES, minutes: Number(min[1]), text: s };

  const hr = s.match(/^(\d+)\s*(?:hr|hour)s?$/i);
  if (hr) return { kind: KIND.MINUTES, minutes: Number(hr[1]) * 60, text: s };

  // "Next biz day", "Next business day" — a named window, never converted to minutes (discipline 4).
  if (/^next\s+(?:biz|business)\s+day$/i.test(s)) {
    return { kind: KIND.SYMBOLIC, symbol: "next-business-day", text: s };
  }
  // "5 biz day", "5 business days" — also symbolic: a count of business days is not a duration
  // until someone declares how long a business day is, and nobody here may declare that.
  const days = s.match(/^(\d+)\s*(?:biz|business)\s+days?$/i);
  if (days) return { kind: KIND.SYMBOLIC, symbol: `business-days-${days[1]}`, text: s };

  return undefined; // present, but not readable as a commitment
}

/** True when two commitments are the same promise. Symbolic never equals numeric. */
export function sameCommitment(a, b) {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === KIND.MINUTES) return a.minutes === b.minutes;
  return a.symbol === b.symbol;
}

/** Read the binding commitments out of the signable agreement's SLA schedule. */
export function readBindings({ root = process.cwd(), surfaces = BINDING_SURFACES } = {}) {
  const bindings = [];
  const unreadable = [];

  for (const s of surfaces) {
    const abs = path.join(root, s.file);
    let text;
    try { text = fs.readFileSync(abs, "utf8"); }
    catch (err) { unreadable.push({ file: s.file, what: s.what, reason: String((err && err.message) || err) }); continue; }

    const lines = text.split("\n");
    // The header row names the tiers; every commitment row below is positioned against it.
    let tiers = null, headerLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const cells = splitRow(lines[i]);
      if (!cells) continue;
      if (/^tier$/i.test(cells[0] || "")) { tiers = cells.slice(1); headerLine = i + 1; continue; }
      if (!tiers) continue;
      const row = cells[0] || "";
      if (!COMMITMENT_ROWS.some((r) => r.toLowerCase() === row.toLowerCase())) continue;
      const values = cells.slice(1);
      for (let c = 0; c < tiers.length; c++) {
        const tier = tiers[c];
        const parsed = parseCommitment(values[c]);
        if (parsed === undefined) {
          unreadable.push({ file: s.file, what: `${row} · ${tier}`, reason: `the cell reads ${JSON.stringify(String(values[c] || "").trim())} and this module cannot class it as a commitment` });
          continue;
        }
        if (parsed === null) continue;
        bindings.push({
          class: CLASS.BINDING, file: s.file, line: i + 1, tier, row,
          commitment: parsed, evidence: lines[i].trim().slice(0, 160), headerLine,
        });
      }
    }
    if (!bindings.some((b) => b.file === s.file)) {
      unreadable.push({ file: s.file, what: s.what, reason: "the file is present but carries no SLA table this module can read" });
    }
  }
  return { bindings, unreadable };
}

function splitRow(line) {
  const t = String(line || "").trim();
  if (!t.startsWith("|") || !t.endsWith("|")) return null;
  const cells = t.slice(1, -1).split("|").map((c) => c.trim());
  if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return null; // the markdown separator row
  return cells;
}

/**
 * Read what the published surfaces state.
 *
 * Two shapes, kept apart on purpose:
 *   - `matrix`   the comparison table. A commitment here is attached to a NAMED TIER.
 *   - `prose`    a sentence. A commitment here is attached to whatever the sentence says, which is
 *                usually a price band, which is why it cannot be checked against a tier row without
 *                a declared mapping — and none exists. It is reported UNATTACHED rather than guessed.
 */
export function readPublished({ root = process.cwd(), surfaces = PUBLISHED_SURFACES } = {}) {
  const published = [];
  const unattached = [];
  const unreadable = [];

  for (const s of surfaces) {
    const abs = path.join(root, s.file);
    let text;
    try { text = fs.readFileSync(abs, "utf8"); }
    catch (err) { unreadable.push({ file: s.file, what: s.what, reason: String((err && err.message) || err) }); continue; }

    if (s.kind === "matrix") {
      // Scope to the declared region before anything is parsed. A missing region is reported, never
      // silently widened to "the whole file" — widening is how the wrong table gets audited.
      let offset = 0;
      const full = text; // citations stay absolute against the real file, never relative to the slice
      if (s.region) {
        const [open, close] = s.region;
        const a = text.indexOf(open), z = text.indexOf(close, a + 1);
        if (a < 0 || z < 0) {
          unreadable.push({ file: s.file, what: s.what, reason: `the declared matrix markers ${JSON.stringify(open)} … ${JSON.stringify(close)} are not both present, and this module will not fall back to any other table on the page` });
          continue;
        }
        offset = a;
        text = text.slice(a, z + close.length);
      }
      const head = text.match(/<thead>[\s\S]*?<\/thead>/i);
      if (!head) { unreadable.push({ file: s.file, what: s.what, reason: "no comparison matrix header could be read" }); continue; }
      const headers = [...head[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => stripTags(m[1]));
      const tiers = headers.slice(1).filter(Boolean);
      const absLine = (i) => lineOf(full, offset + i);
      const headLine = absLine(head.index);

      // Every row whose label mentions a response commitment. The finding is that there are none.
      const rowRe = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>([\s\S]*?)<\/tr>/gi;
      let m, found = 0;
      while ((m = rowRe.exec(text)) !== null) {
        const label = stripTags(m[1]);
        if (!/response|reply|sla/i.test(label)) continue;
        const cells = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
        for (let i = 0; i < tiers.length; i++) {
          const parsed = parseCommitment(cells[i]);
          if (!parsed) continue; // "✓" and "—" are not commitments; that IS the point
          found++;
          published.push({
            class: CLASS.PUBLISHED, file: s.file, line: absLine(m.index), tier: tiers[i],
            row: label, commitment: parsed, evidence: label + " · " + cells[i],
          });
        }
      }
      if (!found) {
        published.push({
          class: CLASS.PUBLISHED, file: s.file, line: headLine, tier: null, row: null,
          commitment: null, tiers,
          evidence: `the matrix publishes ${tiers.length} tiers and no row stating a response commitment`,
        });
      }
      continue;
    }

    // prose
    const proseRe = /([^<>\n]{0,80}?(?:response|respond|reply)[^<>\n]{0,80})/gi;
    let p, seen = 0;
    while ((p = proseRe.exec(text)) !== null) {
      const frag = p[1].trim();
      const num = frag.match(/(\d+)\s*(hour|hr|minute|min)s?/i);
      if (!num) continue;
      const parsed = parseCommitment(`${num[1]} ${num[2]}`);
      if (!parsed) continue;
      seen++;
      unattached.push({
        class: CLASS.PUBLISHED, file: s.file, line: lineOf(text, p.index),
        tier: null, row: null, commitment: parsed,
        evidence: frag.slice(0, 160),
        why: "stated against a price band rather than a matrix tier, so no tier row can be checked against it",
      });
    }
    if (!seen) unreadable.push({ file: s.file, what: s.what, reason: "the file is present and states no readable response commitment" });
  }
  return { published, unattached, unreadable };
}

/** The direction, if declared. Absent is a first-class answer, not an error. */
export function readDirection({ root = process.cwd(), file = DECISION_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { declared: false, file, reason: "no direction has been declared in the tree" };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(abs, "utf8")); }
  catch (err) { return { declared: false, file, reason: `unparseable: ${String((err && err.message) || err)}` }; }
  const publish = parsed && parsed.publish;
  if (publish !== true && publish !== false) {
    return { declared: false, file, reason: "the file exists but does not answer whether the bound commitments are published" };
  }
  return {
    declared: true, file, publish,
    personalCarriesSla: parsed.personalCarriesSla ?? null,
    decidedBy: parsed.decidedBy || null, decidedOn: parsed.decidedOn || null,
  };
}

const stripTags = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/**
 * Audit the response-time promise end to end.
 *
 * There is deliberately no branch below that can return CONSISTENT while a binding exists that no
 * published surface states. That is the invariant this module exists to hold.
 */
export function auditResponseTimes({
  root = process.cwd(), bindingSurfaces = BINDING_SURFACES,
  publishedSurfaces = PUBLISHED_SURFACES, tierMap = TIER_MAP, decisionFile = DECISION_FILE,
} = {}) {
  const b = readBindings({ root, surfaces: bindingSurfaces });
  const p = readPublished({ root, surfaces: publishedSurfaces });
  const direction = readDirection({ root, file: decisionFile });
  const unreadable = [...b.unreadable, ...p.unreadable];

  if (!b.bindings.length && !p.published.length) {
    return {
      schema: RESPONSE_TIME_SCHEMA, verdict: VERDICT.UNREADABLE, direction,
      bindings: [], published: [], unattached: p.unattached, unmapped: [], gaps: [], unreadable,
      summary: { bindings: 0, published: 0, gaps: 0, unmapped: 0, unattached: p.unattached.length, unreadable: unreadable.length },
    };
  }

  const toPublished = new Map(tierMap.map((t) => [t.binding, t.published]));
  const publishedTiers = new Set(p.published.filter((x) => x.tier).map((x) => x.tier));
  const matrixTiers = new Set(p.published.flatMap((x) => x.tiers || []));

  // A tier on either side with no declared partner is reported, never dropped (discipline 3).
  const unmapped = [];
  for (const bind of b.bindings) {
    if (!toPublished.has(bind.tier)) {
      unmapped.push({ side: "binding", tier: bind.tier, file: bind.file, line: bind.line, why: "the agreement binds a tier no declared mapping names" });
    }
  }
  for (const tier of matrixTiers) {
    if (![...toPublished.values()].includes(tier)) {
      unmapped.push({ side: "published", tier, why: "the matrix publishes a tier no declared mapping names" });
    }
  }

  // The gaps, one per binding, each classed by WHICH side is missing or wrong.
  const gaps = [];
  for (const bind of b.bindings) {
    const wantTier = toPublished.get(bind.tier);
    const match = wantTier
      ? p.published.find((x) => x.tier === wantTier && x.commitment && rowsAlign(x.row, bind.row))
      : null;
    if (!match) {
      gaps.push({
        kind: VERDICT.BOUND_UNPUBLISHED, tier: bind.tier, publishedTier: wantTier || null, row: bind.row,
        binding: { file: bind.file, line: bind.line, text: bind.commitment.text },
        published: null,
        why: "a customer's signature is applied to this commitment and no surface they can read before signing states it",
      });
      continue;
    }
    if (!sameCommitment(bind.commitment, match.commitment)) {
      gaps.push({
        kind: VERDICT.CONTRADICTS, tier: bind.tier, publishedTier: wantTier, row: bind.row,
        binding: { file: bind.file, line: bind.line, text: bind.commitment.text },
        published: { file: match.file, line: match.line, text: match.commitment.text },
        why: "the page and the agreement both state a commitment for this tier and they are not the same commitment",
      });
    }
  }
  // A published commitment with no binding behind it is the other failure, and it is worse in kind.
  for (const pub of p.published) {
    if (!pub.commitment || !pub.tier) continue;
    const bindTier = tierMap.find((t) => t.published === pub.tier)?.binding;
    const backing = bindTier && b.bindings.find((x) => x.tier === bindTier && rowsAlign(pub.row, x.row));
    if (!backing) {
      gaps.push({
        kind: VERDICT.PUBLISHED_UNBOUND, tier: pub.tier, publishedTier: pub.tier, row: pub.row,
        binding: null, published: { file: pub.file, line: pub.line, text: pub.commitment.text },
        why: "the page states a commitment no signable agreement row backs",
      });
    }
  }

  let verdict;
  if (!gaps.length) {
    verdict = VERDICT.CONSISTENT;
  } else if (direction.declared) {
    verdict = VERDICT.DIVERGENT;
  } else if (gaps.every((g) => g.kind === VERDICT.BOUND_UNPUBLISHED)) {
    verdict = VERDICT.UNDECIDED;
  } else {
    verdict = gaps.some((g) => g.kind === VERDICT.CONTRADICTS) ? VERDICT.CONTRADICTS : VERDICT.PUBLISHED_UNBOUND;
  }

  return {
    schema: RESPONSE_TIME_SCHEMA, verdict, direction,
    bindings: b.bindings, published: p.published, unattached: p.unattached,
    unmapped, gaps, unreadable,
    summary: {
      bindings: b.bindings.length,
      published: p.published.filter((x) => x.commitment).length,
      publishedTiers: publishedTiers.size,
      gaps: gaps.length,
      boundUnpublished: gaps.filter((g) => g.kind === VERDICT.BOUND_UNPUBLISHED).length,
      contradicts: gaps.filter((g) => g.kind === VERDICT.CONTRADICTS).length,
      publishedUnbound: gaps.filter((g) => g.kind === VERDICT.PUBLISHED_UNBOUND).length,
      unmapped: unmapped.length,
      unattached: p.unattached.length,
      unreadable: unreadable.length,
    },
  };
}

/** P1 is compared with P1. A row label that cannot be aligned never counts as a match. */
function rowsAlign(a, b) {
  const key = (s) => {
    const m = String(s || "").match(/\bP([12])\b/i);
    return m ? `P${m[1]}` : null;
  };
  const ka = key(a), kb = key(b);
  if (ka && kb) return ka === kb;
  // A published row that does not name a priority cannot be proven to answer a P1 obligation.
  return false;
}

/** One line an operator can act on at 11pm, citations attached rather than summarised away. */
export function statementFor(report) {
  const s = report.summary;
  if (report.verdict === VERDICT.UNREADABLE) return "response times: neither the agreement nor the published surfaces could be read.";
  if (report.verdict === VERDICT.CONSISTENT) {
    return `response times: every one of the ${s.bindings} bound commitment(s) is stated on a surface a buyer can read before signing.`;
  }
  const cites = report.gaps.slice(0, 6).map((g) => {
    const where = g.binding ? `${g.binding.file}:${g.binding.line}` : `${g.published.file}:${g.published.line}`;
    return `${g.tier} ${g.row || ""} ${g.binding ? g.binding.text : g.published.text} (${where})`.replace(/\s+/g, " ").trim();
  }).join(" · ");
  return `response times: ${report.verdict.toUpperCase()} — ${s.boundUnpublished} commitment(s) bound by the agreement and published nowhere` +
    `${s.contradicts ? `, ${s.contradicts} contradicting` : ""}${s.publishedUnbound ? `, ${s.publishedUnbound} published with nothing behind them` : ""}` +
    `${s.unattached ? `, ${s.unattached} stated in prose against a price band rather than a tier` : ""}` +
    ` — ${cites}${report.gaps.length > 6 ? ` · +${report.gaps.length - 6} more` : ""}.`;
}

export default {
  auditResponseTimes, readBindings, readPublished, readDirection, statementFor, parseCommitment, sameCommitment,
  BINDING_SURFACES, PUBLISHED_SURFACES, TIER_MAP, COMMITMENT_ROWS, VERDICT, CLASS, KIND, DECISION_FILE,
};
