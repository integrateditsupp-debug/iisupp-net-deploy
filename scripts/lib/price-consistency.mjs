// price-consistency.mjs — RUN-BF / BF1. THE PRICE A STRANGER IS QUOTED.
//
// RUN-AV's `quoted-figures` proved every money figure in a client-facing DOCUMENT either appears in
// the published plan table or is declared as deliberately outside it. That checked documents against
// the table. It never checked that the SURFACES agree with each other — and a stranger does not read
// a document first. They read a page.
//
// WHAT RUNNING IT FOUND (2026-08-12, read first-hand from the files, never inferred):
//
//   The two Sentinel price surfaces AGREE on every number. `plans/index.html` publishes the five
//   plan cards and the comparison matrix; `pricing-experiments.html` publishes the same five tiers;
//   all five monthly figures match, and the savings calculator's annual bands divide by twelve into
//   exactly those monthly figures. That is worth stating rather than passing over in silence: this
//   audit exists to find disagreement and the price NUMBERS do not disagree.
//
//   What disagrees is WHO EACH TIER IS FOR. `pricing-experiments.html` tells a reader Small Business
//   is a "1-20 staff org", Mid Size is "21-100", Enterprise is "100+". The savings calculator on
//   `plans/index.html` routes by headcount too — and routes a 300-person company to Small Business
//   (`max:500`), where the other page routes the same company to Enterprise. Same company, same
//   week, two surfaces, **$19,500/mo versus $78,125/mo**. Neither surface is lying; nobody ever
//   compared them. This is the class of defect that surfaces as a customer quoting your own site
//   back at you during a renewal.
//
//   And the retainer decks on `index.html` publish BANDS — $6,000–$10,000, $14,000–$24,000,
//   $30,000–$60,000 per month — which no buyer can select. A band is a legitimate way to publish a
//   quote-based service and an illegitimate way to publish a subscription, so it is its own class
//   with a declared reason, never rounded into either "consistent" or "broken".
//
// THE DISCIPLINE, stated so it cannot drift:
//
//   1. A price is read from a DECLARED MARKER or a DECLARED PATTERN on a declared surface. Never
//      from "the first dollar figure near a tier name". RUN-BE's audit read the cost calculator as
//      a product table on its first run because it scanned for a nearby table; the remedy there was
//      declared markers, and the same remedy applies here on its first day rather than its second.
//
//   2. SELECTABLE and BAND are different classes and never merge. A selectable price is one a buyer
//      can click and be charged. A band ends in a conversation. Reporting them as one number would
//      make a quote-based service look like an unbacked claim, and a subscription look like a
//      negotiation.
//
//   3. Software does not pick which number is right, and does not pick which surface moves. Whether
//      a 300-person company is Small Business or Enterprise is a decision about what this company
//      sells and to whom. It belongs to Ahmad. Until a direction is declared IN THE TREE the verdict
//      is UNDECIDED and every disagreement is reported with file:line and the source text. After it
//      is declared, drift from it is DIVERGENT and the suite goes red.
//
//   4. Two figures compare equal only after being normalised to cents on a stated PERIOD. A monthly
//      figure and an annual figure are never compared without dividing, and the division is reported
//      so it can be checked. A figure whose period cannot be read is UNREADABLE, never assumed
//      monthly — assuming the period is how a $234,000 annual plan becomes a $234,000 monthly one.
//
//   5. No forecast, no attach rate, no "average deal size". This module reports figures that are
//      PUBLISHED on a surface in this tree and nothing derived from them beyond the arithmetic in
//      (4), which is stated. A number this program invented is a fabricated metric no matter how
//      reasonable it looks (Rule 14).
//
//   6. Nothing here writes to a customer-facing surface and nothing here deletes one (Rule 15). It
//      reads, classes, and cites.

import fs from "node:fs";
import path from "node:path";
import { LINE, SURFACE_CLASS, resolve as resolveTier, tiersOfLine } from "./tier-registry.mjs";

export const PRICE_SCHEMA = "price-consistency/1";

/** Where a declared direction would live. Absent = undecided. Never written by software. */
export const DECISION_FILE = "senior-director-state/decisions/price-list.json";

export const VERDICT = Object.freeze({
  CONSISTENT: "consistent",     // every selectable tier is quoted the same on every surface that quotes it
  DISAGREES: "disagrees",       // two surfaces quote the same tier differently
  UNDECIDED: "undecided",       // disagreements exist and no direction has been declared
  DIVERGENT: "divergent",       // a direction exists and the tree has drifted from it
  UNREADABLE: "unreadable",     // no surface could be read at all
});

export const KIND = Object.freeze({
  SELECTABLE: "selectable-a-buyer-can-choose-this-and-be-charged-it",
  BAND: "band-a-published-range-that-ends-in-a-quote",
  UNATTACHED: "unattached-a-published-figure-with-no-tier-beside-it",
});

export const PERIOD = Object.freeze({
  MONTH: "per-month",
  YEAR: "per-year",
});

/**
 * The surfaces that quote a price, each with the way its prices are found.
 *
 * `extract` is named rather than generic: a surface gets a reader that knows its shape. That is
 * more code than one clever regex and it is the reason this cannot silently start reading a cost
 * calculator as a product table.
 */
export const PRICE_SURFACES = Object.freeze([
  Object.freeze({
    file: "plans/index.html",
    reader: "plan-cards",
    line: LINE.SENTINEL,
    why: "the five plan cards a buyer clicks SUBSCRIBE on — the canonical published price",
  }),
  Object.freeze({
    file: "plans/index.html",
    reader: "sentinel-matrix",
    line: LINE.SENTINEL,
    why: "the comparison matrix the same page opens in a modal, between declared SENTINEL_MATRIX markers",
  }),
  Object.freeze({
    file: "plans/index.html",
    reader: "tier-bands",
    line: LINE.SENTINEL,
    why: "the savings calculator's TIER_BANDS — annual figures plus the headcount at which a visitor is routed to each tier",
  }),
  Object.freeze({
    file: "pricing-experiments.html",
    reader: "experiment-boxes",
    line: LINE.SENTINEL,
    why: "a second page publishing the same five tiers with a staff-count band beside each",
  }),
  Object.freeze({
    file: "index.html",
    reader: "retainer-decks",
    line: LINE.RETAINER,
    why: "the human-MSP retainer decks — published as monthly bands that end in a quote",
  }),
]);

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * "$19,500" / "$78,125" / "$899" -> cents. Returns null for anything it cannot read exactly.
 *
 * Thousands grouping is VALIDATED, not stripped. Found by running the fixtures: the first version
 * matched `[0-9][0-9,]*` and then removed commas, so `$1,2` — a typo, or a figure truncated by a
 * bad edit — read as `$12`. A money parser that repairs malformed input is not reading the surface,
 * it is inventing a figure and then comparing other surfaces against the invention.
 */
export function parseMoney(raw) {
  const m = String(raw ?? "").trim().match(/^\$\s?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.([0-9]{2}))?$/);
  if (!m) return null;
  const whole = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(whole)) return null;
  return whole * 100 + (m[2] ? Number(m[2]) : 0);
}

/**
 * Normalise a figure to cents PER MONTH.
 *
 * The division is returned alongside the result so a reader can check it rather than trust it. A
 * figure with no readable period is refused, never assumed monthly (discipline 4).
 */
export function monthlyCents(cents, period) {
  if (!Number.isFinite(cents)) return null;
  if (period === PERIOD.MONTH) return { cents, how: "stated per month; no conversion" };
  if (period === PERIOD.YEAR) {
    if (cents % 12 !== 0) return { cents: cents / 12, how: `stated per year; ${cents} / 12 = ${cents / 12} (does not divide evenly)`, uneven: true };
    return { cents: cents / 12, how: `stated per year; ${cents} / 12 = ${cents / 12}` };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Readers. One per surface shape. Each returns { quotes[], unreadable[] }.
// ---------------------------------------------------------------------------------------------

function readPlanCards(text, file) {
  const quotes = [], unreadable = [];
  // The card block: a .pf-tier label followed by a .pf-price figure. Anchored on both classes, so a
  // price elsewhere on the page cannot be picked up as a plan card.
  const re = /<div class="pf-tier">([^<]+)<\/div>\s*<div class="pf-price">\s*(\$[0-9][0-9,]*)\s*<span class="pf-unit">\/mo<\/span>/g;
  let m;
  while ((m = re.exec(text))) {
    const label = m[1].trim();
    const cents = parseMoney(m[2]);
    const hit = resolveTier(label, { surface: SURFACE_CLASS.PUBLISHED, line: LINE.SENTINEL });
    if (!hit) { unreadable.push({ file, line: lineOf(text, m.index), why: `plan card label "${label}" is not a declared tier name`, text: m[0].slice(0, 120) }); continue; }
    if (cents == null) { unreadable.push({ file, line: lineOf(text, m.index), why: `plan card price "${m[2]}" could not be read exactly`, text: m[0].slice(0, 120) }); continue; }
    quotes.push({
      tier: hit.tier.id, label, file, line: lineOf(text, m.index), reader: "plan-cards",
      kind: KIND.SELECTABLE, period: PERIOD.MONTH, cents, source: m[0].replace(/\s+/g, " ").slice(0, 160),
    });
  }
  return { quotes, unreadable };
}

function readSentinelMatrix(text, file) {
  const quotes = [], unreadable = [];
  const start = text.indexOf("<!-- SENTINEL_MATRIX:START -->");
  const end = text.indexOf("<!-- SENTINEL_MATRIX:END -->");
  if (start < 0 || end < 0 || end < start) {
    // Refuse rather than fall back to "the first table on the page". RUN-BE's audit read a cost
    // calculator as a product table exactly once; a fallback is how that happens twice.
    unreadable.push({ file, line: 0, why: "SENTINEL_MATRIX markers absent — refusing to guess which table is the price matrix", text: "" });
    return { quotes, unreadable };
  }
  const block = text.slice(start, end);
  const heads = block.match(/<thead>[\s\S]*?<\/thead>/);
  if (!heads) { unreadable.push({ file, line: lineOf(text, start), why: "matrix carries no <thead> to read tier names from", text: "" }); return { quotes, unreadable }; }
  const headText = heads[0];

  const tierRow = headText.match(/<tr><th>Feature<\/th>([\s\S]*?)<\/tr>/);
  const priceRow = headText.match(/<tr class="price-row"><td>Price<\/td>([\s\S]*?)<\/tr>/);
  if (!tierRow || !priceRow) { unreadable.push({ file, line: lineOf(text, start), why: "matrix has no Feature header row or no Price row", text: "" }); return { quotes, unreadable }; }

  const labels = [...tierRow[1].matchAll(/<th>([^<]*)<\/th>/g)].map((x) => x[1].trim());
  const cells = [...priceRow[1].matchAll(/<td>([^<]*)<\/td>/g)].map((x) => x[1].trim());
  const at = lineOf(text, start + heads.index);

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const cell = cells[i] ?? "";
    const hit = resolveTier(label, { surface: SURFACE_CLASS.PUBLISHED, line: LINE.SENTINEL });
    if (!hit) { unreadable.push({ file, line: at, why: `matrix column "${label}" is not a declared tier name`, text: cell }); continue; }
    const mm = cell.match(/^(\$[0-9][0-9,]*)\/mo/);
    if (!mm) { unreadable.push({ file, line: at, why: `matrix price cell "${cell}" for ${label} is not a readable monthly figure`, text: cell }); continue; }
    const cents = parseMoney(mm[1]);
    if (cents == null) { unreadable.push({ file, line: at, why: `matrix price "${mm[1]}" could not be read exactly`, text: cell }); continue; }
    quotes.push({
      tier: hit.tier.id, label, file, line: at, reader: "sentinel-matrix",
      kind: KIND.SELECTABLE, period: PERIOD.MONTH, cents, source: cell,
      billedAnnually: /billed annually/i.test(cell),
    });
  }
  return { quotes, unreadable };
}

function readTierBands(text, file) {
  const quotes = [], unreadable = [];
  const idx = text.indexOf("var TIER_BANDS");
  if (idx < 0) return { quotes, unreadable };
  const block = text.slice(idx, idx + 900);
  const re = /\{\s*name:\s*'([^']+)'\s*,\s*max:\s*([0-9]+|Infinity)\s*,\s*yr:\s*([0-9]+)\s*\}/g;
  let m;
  while ((m = re.exec(block))) {
    const label = m[1].trim();
    const hit = resolveTier(label, { surface: SURFACE_CLASS.PUBLISHED, line: LINE.SENTINEL });
    const at = lineOf(text, idx + m.index);
    if (!hit) { unreadable.push({ file, line: at, why: `calculator band "${label}" is not a declared tier name`, text: m[0] }); continue; }
    quotes.push({
      tier: hit.tier.id, label, file, line: at, reader: "tier-bands",
      kind: KIND.SELECTABLE, period: PERIOD.YEAR, cents: Number(m[3]) * 100, source: m[0],
      headcountMax: m[2] === "Infinity" ? Infinity : Number(m[2]),
    });
  }
  return { quotes, unreadable };
}

function readExperimentBoxes(text, file) {
  const quotes = [], unreadable = [];
  const re = /<strong>([^<]+)<\/strong><br>(\$[0-9][0-9,]*)\/mo([^<]*)</g;
  let m;
  while ((m = re.exec(text))) {
    const label = m[1].trim();
    const at = lineOf(text, m.index);
    const hit = resolveTier(label, { surface: SURFACE_CLASS.PUBLISHED, line: LINE.SENTINEL });
    if (!hit) { unreadable.push({ file, line: at, why: `experiment box "${label}" is not a declared tier name`, text: m[0].slice(0, 120) }); continue; }
    const cents = parseMoney(m[2]);
    if (cents == null) { unreadable.push({ file, line: at, why: `experiment price "${m[2]}" could not be read exactly`, text: m[0].slice(0, 120) }); continue; }
    const tail = m[3] || "";
    // "1-20 staff org" / "100+ staff org" — the audience band, read only when literally present.
    const band = tail.match(/([0-9]+)\s*-\s*([0-9]+)\s*staff/) || tail.match(/([0-9]+)\+\s*staff/);
    quotes.push({
      tier: hit.tier.id, label, file, line: at, reader: "experiment-boxes",
      kind: KIND.SELECTABLE, period: PERIOD.MONTH, cents, source: `${m[1]} ${m[2]}/mo${tail}`.trim().slice(0, 160),
      headcountMin: band ? Number(band[1]) : null,
      headcountMax: band && band[2] ? Number(band[2]) : (band ? Infinity : null),
    });
  }
  return { quotes, unreadable };
}

function readRetainerDecks(text, file) {
  const quotes = [], unreadable = [];
  const re = /<span class="deck-badge"><span class="dot"><\/span>(Tier [0-9])[^<]*<\/span>\s*<h4 class="deck-name">([^<]+)<\/h4>[\s\S]{0,400}?<div class="deck-price">\s*(\$[0-9][0-9,]*)\s*[–-]\s*(\$[0-9][0-9,]*)\s*\/\s*mo\s*<\/div>/g;
  let m;
  while ((m = re.exec(text))) {
    const label = m[1].trim();
    const at = lineOf(text, m.index);
    const hit = resolveTier(label, { surface: SURFACE_CLASS.PUBLISHED, line: LINE.RETAINER });
    if (!hit) { unreadable.push({ file, line: at, why: `retainer deck badge "${label}" is not a declared tier name`, text: m[0].slice(0, 120) }); continue; }
    const lo = parseMoney(m[3]), hi = parseMoney(m[4]);
    if (lo == null || hi == null) { unreadable.push({ file, line: at, why: `retainer band "${m[3]}–${m[4]}" could not be read exactly`, text: m[0].slice(0, 120) }); continue; }
    quotes.push({
      tier: hit.tier.id, label, file, line: at, reader: "retainer-decks",
      kind: KIND.BAND, period: PERIOD.MONTH, cents: null, lowCents: lo, highCents: hi,
      name: m[2].trim(), source: `${label} · ${m[2].trim()} · ${m[3]} – ${m[4]} / mo`,
    });
  }
  return { quotes, unreadable };
}

const READERS = Object.freeze({
  "plan-cards": readPlanCards,
  "sentinel-matrix": readSentinelMatrix,
  "tier-bands": readTierBands,
  "experiment-boxes": readExperimentBoxes,
  "retainer-decks": readRetainerDecks,
});

/** Read every declared surface. */
export function readQuotes({ root = process.cwd(), surfaces = PRICE_SURFACES } = {}) {
  const quotes = [], unreadable = [];
  for (const s of surfaces) {
    const abs = path.join(root, s.file);
    let text;
    try { text = fs.readFileSync(abs, "utf8"); }
    catch { unreadable.push({ file: s.file, line: 0, why: `surface absent or unreadable (reader: ${s.reader})`, text: "" }); continue; }
    const fn = READERS[s.reader];
    if (!fn) { unreadable.push({ file: s.file, line: 0, why: `no reader named "${s.reader}"`, text: "" }); continue; }
    const out = fn(text, s.file);
    quotes.push(...out.quotes);
    unreadable.push(...out.unreadable);
  }
  return { quotes, unreadable };
}

/** A declared direction, if one exists. Never written by this module. */
export function readDirection({ root = process.cwd(), file = DECISION_FILE } = {}) {
  try {
    const raw = fs.readFileSync(path.join(root, file), "utf8");
    const parsed = JSON.parse(raw);
    return { declared: true, file, ...parsed };
  } catch { return { declared: false, file }; }
}

/**
 * The audit.
 *
 * Produces three separate findings, kept apart because the remedies differ:
 *   priceDisagreements    — two surfaces quote the same tier a different monthly figure
 *   audienceDisagreements — two surfaces route the same company size to different tiers
 *   bands                 — a published range no buyer can select, reported as its own class
 */
export function auditPrices({ root = process.cwd(), surfaces = PRICE_SURFACES, decisionFile = DECISION_FILE } = {}) {
  const { quotes, unreadable } = readQuotes({ root, surfaces });
  const direction = readDirection({ root, file: decisionFile });

  if (!quotes.length) {
    return {
      schema: PRICE_SCHEMA, verdict: VERDICT.UNREADABLE, direction,
      quotes: [], priceDisagreements: [], audienceDisagreements: [], bands: [], unreadable,
      summary: { quotes: 0, selectable: 0, bands: 0, priceDisagreements: 0, audienceDisagreements: 0, unreadable: unreadable.length },
      resolvedHere: false,
    };
  }

  const selectable = quotes.filter((q) => q.kind === KIND.SELECTABLE);
  const bands = quotes.filter((q) => q.kind === KIND.BAND);

  // ---- price agreement, per tier, normalised to cents per month --------------------------------
  const priceDisagreements = [];
  const byTier = new Map();
  for (const q of selectable) {
    const norm = monthlyCents(q.cents, q.period);
    if (!norm) { unreadable.push({ file: q.file, line: q.line, why: `figure for ${q.label} has no readable period — never assumed monthly`, text: q.source }); continue; }
    const rec = { ...q, monthlyCents: norm.cents, conversion: norm.how, uneven: !!norm.uneven };
    if (!byTier.has(q.tier)) byTier.set(q.tier, []);
    byTier.get(q.tier).push(rec);
  }
  for (const [tier, list] of byTier) {
    const distinct = [...new Set(list.map((r) => r.monthlyCents))];
    if (distinct.length > 1) {
      priceDisagreements.push({
        tier,
        values: distinct.slice().sort((a, b) => a - b),
        // Every citation carried, so the remedy names files rather than being a number to chase.
        cites: list.map((r) => ({ file: r.file, line: r.line, reader: r.reader, monthlyCents: r.monthlyCents, conversion: r.conversion, source: r.source })),
      });
    }
  }

  // ---- audience agreement: which tier a headcount routes to ------------------------------------
  // Only surfaces that actually STATE a headcount are compared. A surface that says nothing about
  // who a tier is for is silent, not in agreement and not in conflict.
  const routed = selectable.filter((q) => Number.isFinite(q.headcountMax) || q.headcountMax === Infinity || Number.isFinite(q.headcountMin));
  const audienceDisagreements = [];
  const audienceOverlaps = [];
  const routers = [...new Set(routed.map((q) => `${q.file}::${q.reader}`))];

  // A surface can disagree with ITSELF, and that is the cheaper defect to fix and the likelier one
  // to be found by a customer reading one page top to bottom (the AX1 lesson, applied here). Two
  // rows on ONE surface whose stated headcount ranges overlap are reported before any cross-surface
  // comparison, because "first row wins" is a rule this module invented, not one the page states.
  for (const key of routers) {
    const rows = routed.filter((q) => `${q.file}::${q.reader}` === key && Number.isFinite(q.headcountMin));
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j];
        const aHi = a.headcountMax === Infinity ? Infinity : a.headcountMax;
        const bHi = b.headcountMax === Infinity ? Infinity : b.headcountMax;
        const lo = Math.max(a.headcountMin, b.headcountMin);
        const hi = Math.min(aHi, bHi);
        if (lo <= hi) {
          audienceOverlaps.push({
            router: key, tiers: [a.tier, b.tier], from: lo, to: hi === Infinity ? null : hi,
            cites: [a, b].map((r) => ({ file: r.file, line: r.line, tier: r.tier, monthlyCents: monthlyCents(r.cents, r.period)?.cents ?? null, source: r.source })),
          });
        }
      }
    }
  }
  if (routers.length > 1) {
    // Probe headcounts drawn from the declared boundaries themselves, never invented: every stated
    // edge, plus one above it, is where two routing tables can first disagree.
    const edges = new Set();
    for (const q of routed) {
      if (Number.isFinite(q.headcountMax)) { edges.add(q.headcountMax); edges.add(q.headcountMax + 1); }
      if (Number.isFinite(q.headcountMin)) { edges.add(q.headcountMin); }
    }
    const routeOn = (key, n) => {
      const rows = routed.filter((q) => `${q.file}::${q.reader}` === key)
        .slice().sort((a, b) => (a.headcountMax === Infinity ? Number.MAX_SAFE_INTEGER : a.headcountMax) - (b.headcountMax === Infinity ? Number.MAX_SAFE_INTEGER : b.headcountMax));
      for (const r of rows) {
        const lo = Number.isFinite(r.headcountMin) ? r.headcountMin : 0;
        const hi = r.headcountMax === Infinity ? Infinity : r.headcountMax;
        if (n >= lo && n <= hi) return r;
      }
      return null;
    };
    for (const n of [...edges].sort((a, b) => a - b)) {
      const hits = routers.map((k) => ({ router: k, hit: routeOn(k, n) })).filter((x) => x.hit);
      if (hits.length < 2) continue;
      const tiers = [...new Set(hits.map((x) => x.hit.tier))];
      if (tiers.length > 1) {
        audienceDisagreements.push({
          headcount: n,
          tiers,
          cites: hits.map((x) => ({ router: x.router, file: x.hit.file, line: x.hit.line, tier: x.hit.tier, monthlyCents: monthlyCents(x.hit.cents, x.hit.period)?.cents ?? null, source: x.hit.source })),
        });
      }
    }
  }

  // ---- verdict ---------------------------------------------------------------------------------
  const anyDisagreement = priceDisagreements.length > 0 || audienceDisagreements.length > 0 || audienceOverlaps.length > 0;
  let verdict;
  if (!anyDisagreement) verdict = VERDICT.CONSISTENT;
  else if (direction.declared) verdict = VERDICT.DIVERGENT;
  else verdict = VERDICT.UNDECIDED;

  return {
    schema: PRICE_SCHEMA, verdict, direction,
    quotes, priceDisagreements, audienceDisagreements, audienceOverlaps,
    bands: bands.map((b) => ({
      tier: b.tier, file: b.file, line: b.line, lowCents: b.lowCents, highCents: b.highCents,
      name: b.name, source: b.source,
      why: "a human-delivered retainer is scoped before it is priced; the band ends in a quote and no buyer is charged it by clicking",
    })),
    unreadable,
    summary: {
      quotes: quotes.length,
      selectable: selectable.length,
      bands: bands.length,
      priceDisagreements: priceDisagreements.length,
      audienceDisagreements: audienceDisagreements.length,
      audienceOverlaps: audienceOverlaps.length,
      unreadable: unreadable.length,
      tiersQuoted: byTier.size,
      tiersDeclared: tiersOfLine(LINE.SENTINEL).length,
    },
    /** Asserted by the suite: which number is right is Ahmad's, never this module's (Rule 15). */
    resolvedHere: false,
  };
}

/** One line a person can read, with no verdict smoothing. */
export function statementFor(result) {
  const s = result.summary;
  if (result.verdict === VERDICT.UNREADABLE) return "No price surface could be read.";
  if (result.verdict === VERDICT.CONSISTENT) {
    return `${s.selectable} selectable quotes across ${s.tiersQuoted} tiers agree; ${s.bands} published as bands.`;
  }
  const bits = [];
  if (s.priceDisagreements) bits.push(`${s.priceDisagreements} tier(s) quoted a different price on different surfaces`);
  if (s.audienceDisagreements) bits.push(`${s.audienceDisagreements} company size(s) routed to a different tier on different surfaces`);
  if (s.audienceOverlaps) bits.push(`${s.audienceOverlaps} headcount range(s) claimed by two tiers on ONE surface`);
  return `${bits.join("; ")} — ${result.direction.declared ? "and a direction is declared, so the tree has drifted from it" : "no direction declared; reported, not resolved"}.`;
}
