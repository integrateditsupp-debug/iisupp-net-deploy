// chargeable-amounts.mjs — RUN-BK / BI2. THE AMOUNT A BUYER IS ACTUALLY CHARGED.
//
// RUN-BF's `price-consistency` checked the figures a stranger READS against each other. This checks
// the figures a stranger is CHARGED against the figures they read on the same card. That is a
// stronger claim and a different one: a published price is a statement, a chargeable amount is a
// transaction. Nothing in this tree had ever compared the two.
//
// WHAT RUNNING IT FOUND (2026-08-12, read first-hand from `index.html`, never inferred):
//
//   Eleven chargeable amounts live in six `data-buy-options` attributes. Seven of them are the exact
//   LOWER BOUND of a band published on the same card, which is the strongest possible result and is
//   stated rather than passed over: a buyer who clicks is charged the number they were reading.
//
//   The other four are DEPOSITS — $2,000, $4,000, $10,000 and $750 — and not one of them appears
//   anywhere on the surface a buyer reads. The card says "$6,000 – $10,000 / mo"; the button says
//   "Deposit to start"; the amount first appears inside the checkout. A deposit is a legitimate way
//   to start a retainer. An UNPUBLISHED deposit is a figure a buyer meets for the first time at the
//   moment of payment.
//
//   And the four deposits follow no stated rule. Against the lower bound of their own card they are
//   33.33%, 28.57%, 33.33% and 50.00%. That arithmetic is REPORTED, not corrected — three cards at a
//   third and one at a half may be exactly what Ahmad intends, and it is not software's decision.
//
// THE DISCIPLINE, stated so it cannot drift:
//
//   1. A chargeable amount is read from a DECLARED attribute (`data-buy-options`) on a DECLARED
//      surface, and its band is read from DECLARED markers inside the SAME deck. Never "the nearest
//      dollar figure". RUN-BE's first run read a cost calculator as a product table; RUN-BF's first
//      run read `$1,2` as `$12`. Both were fallbacks. There is no fallback here.
//
//   2. A charge amount is parsed STRICTLY — `1234` or `1234.56`, nothing else. A grouped figure
//      (`2,000.00`) is UNREADABLE and reported as such, never repaired. A parser that repairs a
//      malformed charge amount is inventing the number a buyer's card is debited for.
//
//   3. DEPOSIT and RETAINER never merge. A deposit below a band's floor is not "outside the band" —
//      it is a different kind of charge, and reporting it as a mismatch would bury the finding that
//      actually matters (the amount is published nowhere) under a false one.
//
//   4. Software does not pick the direction. Whether a deposit should be a third, a half, or a flat
//      figure, and whether it should be printed on the card, are decisions about what this company
//      sells. Until a direction is declared IN THE TREE the verdict is UNDECIDED; after it is
//      declared, drift from it is DIVERGENT and the suite goes red.
//
//   5. No forecast, no attach rate, no expected revenue. The deposit percentages are arithmetic over
//      two published figures and the division is reported so it can be checked rather than trusted.
//      A number this program invented is a fabricated metric however reasonable it looks (Rule 14).
//
//   6. Nothing here writes to a customer-facing surface and nothing here deletes one (Rule 15). It
//      reads, classes, and cites file:line.

import fs from "node:fs";
import path from "node:path";

export const CHARGE_SCHEMA = "chargeable-amounts/1";

/** Where a declared direction lives once Ahmad states one. Absent today, and that is the verdict. */
export const DECISION_FILE = "senior-director-state/decisions/chargeable-amounts.json";

export const VERDICT = Object.freeze({
  UNDECIDED: "UNDECIDED",   // no direction declared in the tree; findings reported, nothing failed
  ALIGNED: "ALIGNED",       // a direction is declared and every charge matches it
  DIVERGENT: "DIVERGENT",   // a direction is declared and a charge drifts from it
  UNREADABLE: "UNREADABLE", // a surface or an attribute could not be read; never treated as clean
});

export const CLASS = Object.freeze({
  LOWER_BOUND: "LOWER_BOUND",   // exactly the floor of a band published on the same card
  IN_BAND: "IN_BAND",           // strictly between a published band's floor and ceiling
  DEPOSIT_UNPUBLISHED: "DEPOSIT_UNPUBLISHED", // named a deposit; the amount appears on no card
  DEPOSIT_PUBLISHED: "DEPOSIT_PUBLISHED",     // named a deposit and the amount IS on the card
  UNPUBLISHED: "UNPUBLISHED",   // not a deposit, and matches no band on its card
  QUOTE: "QUOTE",               // no amount at all; ends in a conversation
  UNREADABLE: "UNREADABLE",     // an amount that would not parse strictly
});

/**
 * The surfaces that carry chargeable amounts. Declared, never discovered — a checker that scans for
 * its own inputs cannot tell a surface that lost its charges from a surface it stopped finding.
 */
export const CHARGE_SURFACES = Object.freeze([
  Object.freeze({ id: "home", file: "index.html", reason: "retainer decks and private-engagement decks carry data-buy-options" }),
]);

/** A price is a deposit when the option SAYS so. Never inferred from the amount being small. */
const DEPOSIT_RE = /\bdeposit\b/i;

/**
 * Parse a charge amount exactly as it must appear in the attribute: `1234` or `1234.56`.
 * Grouping separators, currency symbols, spaces and signs are all UNREADABLE (discipline 2).
 */
export function parseChargeAmount(raw) {
  const s = String(raw ?? "");
  if (!/^[0-9]+(\.[0-9]{2})?$/.test(s)) return null;
  const [whole, frac] = s.split(".");
  const cents = Number(whole) * 100 + (frac ? Number(frac) : 0);
  return Number.isFinite(cents) ? cents : null;
}

/** Parse a published figure as it appears on a card: `$6,000` or `$1,250.50`. Grouping validated. */
export function parsePublished(raw) {
  const m = String(raw ?? "").trim().match(/^\$\s?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{1,3})(?:\.([0-9]{2}))?$/);
  if (!m) return null;
  const whole = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(whole)) return null;
  return whole * 100 + (m[2] ? Number(m[2]) : 0);
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Every published band inside one deck block, read only from declared markers:
 *   `class="deck-price"` · `class="deck-price-sm"` · `<li>` items on the reverse face.
 * A single figure is a band whose floor and ceiling are equal, so a flat price and a range compare
 * through one code path rather than two.
 */
export function readBands(deckHtml, { offset = 0, fileText = "" } = {}) {
  const bands = [];
  const push = (lo, hi, source, at) => {
    if (lo == null) return;
    bands.push({ floorCents: lo, ceilingCents: hi == null ? lo : hi, source: source.replace(/\s+/g, " ").trim().slice(0, 160), line: fileText ? lineOf(fileText, offset + at) : null });
  };
  const scan = (chunk, at) => {
    const text = chunk.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
    // A range: two figures separated by an en dash or hyphen. Read as a pair or not at all.
    const range = text.match(/(\$\s?[0-9][0-9,]*(?:\.[0-9]{2})?)\s*[–—-]\s*(\$\s?[0-9][0-9,]*(?:\.[0-9]{2})?)/);
    if (range) { push(parsePublished(range[1]), parsePublished(range[2]), text, at); return; }
    const single = text.match(/(\$\s?[0-9][0-9,]*(?:\.[0-9]{2})?)/);
    if (single) push(parsePublished(single[1]), null, text, at);
  };
  for (const re of [/<div class="deck-price"[^>]*>([\s\S]*?)<\/div>/g, /<div class="deck-price-sm"[^>]*>([\s\S]*?)<\/div>/g, /<li>([\s\S]*?)<\/li>/g]) {
    let m; while ((m = re.exec(deckHtml)) !== null) scan(m[1], m.index);
  }
  return bands;
}

/** Split a surface into deck blocks by the declared `deck-slot` marker. */
function readDecks(html) {
  const decks = [];
  const marker = /<div class="deck-slot"[^>]*>/g;
  const starts = [];
  let m; while ((m = marker.exec(html)) !== null) starts.push(m.index);
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : html.length;
    decks.push({ start, end, html: html.slice(start, end) });
  }
  return decks;
}

/**
 * Read every chargeable amount on every declared surface and class it against the bands published on
 * its own card. Returns findings; it does not decide.
 */
export function readCharges({ root = process.cwd(), surfaces = CHARGE_SURFACES } = {}) {
  const charges = [];
  const unreadable = [];
  for (const surface of surfaces) {
    const abs = path.join(root, surface.file);
    let html;
    try { html = fs.readFileSync(abs, "utf8"); }
    catch (err) { unreadable.push({ surface: surface.id, file: surface.file, why: `could not read: ${err.code || err.message}` }); continue; }

    const decks = readDecks(html);
    const attr = /data-buy-options='([^']*)'/g;
    let m;
    while ((m = attr.exec(html)) !== null) {
      const line = lineOf(html, m.index);
      let parsed;
      try { parsed = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")); }
      catch (err) { unreadable.push({ surface: surface.id, file: surface.file, line, why: `data-buy-options is not JSON: ${err.message}` }); continue; }

      const deck = decks.find((d) => m.index >= d.start && m.index < d.end);
      const bands = deck ? readBands(deck.html, { offset: deck.start, fileText: html }) : [];
      if (!deck) unreadable.push({ surface: surface.id, file: surface.file, line, why: "chargeable button sits inside no declared deck-slot; its band cannot be read" });

      for (const opt of Array.isArray(parsed.options) ? parsed.options : []) {
        const base = { surface: surface.id, file: surface.file, line, group: String(parsed.title || ""), id: String(opt.id || ""), name: String(opt.name || ""), description: String(opt.description || "") };
        if (opt.quote === true && opt.price == null) { charges.push({ ...base, cents: null, class: CLASS.QUOTE, why: "publishes no amount; ends in a conversation" }); continue; }
        const cents = parseChargeAmount(opt.price);
        if (cents == null) { charges.push({ ...base, cents: null, class: CLASS.UNREADABLE, raw: String(opt.price ?? ""), why: "amount does not parse strictly as 1234 or 1234.56; never repaired" }); continue; }

        const isDeposit = DEPOSIT_RE.test(base.name) || DEPOSIT_RE.test(base.id) || DEPOSIT_RE.test(base.description);
        const onCard = bands.find((b) => cents === b.floorCents || cents === b.ceilingCents);
        const inside = bands.find((b) => cents > b.floorCents && cents < b.ceilingCents);

        let klass, why;
        if (isDeposit) {
          klass = onCard ? CLASS.DEPOSIT_PUBLISHED : CLASS.DEPOSIT_UNPUBLISHED;
          why = onCard ? `named a deposit and the amount appears on the card ("${onCard.source}")`
                       : "named a deposit; this amount appears on no band published on its own card";
        } else if (onCard && cents === onCard.floorCents) {
          klass = CLASS.LOWER_BOUND; why = `exactly the floor of a band published on the same card ("${onCard.source}")`;
        } else if (onCard) {
          klass = CLASS.IN_BAND; why = `exactly the ceiling of a band published on the same card ("${onCard.source}")`;
        } else if (inside) {
          klass = CLASS.IN_BAND; why = `inside a band published on the same card ("${inside.source}")`;
        } else {
          klass = CLASS.UNPUBLISHED; why = bands.length
            ? `matches none of the ${bands.length} bands published on its own card`
            : "its card publishes no band at all";
        }

        // Arithmetic, reported so it can be checked (discipline 5). Never a target, never a fix.
        const floors = bands.map((b) => b.floorCents).filter((c) => c > 0);
        const lowest = floors.length ? Math.min(...floors) : null;
        const share = isDeposit && lowest ? { ofFloorCents: lowest, pct: Math.round((cents / lowest) * 10000) / 100, how: `${cents} / ${lowest} = ${Math.round((cents / lowest) * 10000) / 100}%` } : null;

        charges.push({ ...base, cents, class: klass, why, bandsOnCard: bands.length, share });
      }
    }
  }
  return { charges, unreadable };
}

/** Read a declared direction, if one exists. Absence is the answer today, not an error. */
export function readDirection({ root = process.cwd(), file = DECISION_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { declared: false, file, why: "no direction declared in the tree" };
  try {
    const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
    return { declared: true, file, depositPolicy: raw.depositPolicy ?? null, publishDeposits: raw.publishDeposits ?? null, raw };
  } catch (err) {
    return { declared: false, file, why: `direction file did not parse: ${err.message}` };
  }
}

/**
 * The audit. Reports; never picks. `resolvedHere` is asserted false whenever the direction is
 * undeclared so no caller can read a finding as a decision.
 */
export function auditCharges({ root = process.cwd(), surfaces = CHARGE_SURFACES, decisionFile = DECISION_FILE } = {}) {
  const { charges, unreadable } = readCharges({ root, surfaces });
  const direction = readDirection({ root, file: decisionFile });

  const counts = {};
  for (const k of Object.values(CLASS)) counts[k] = charges.filter((c) => c.class === k).length;

  let verdict;
  if (unreadable.length || counts[CLASS.UNREADABLE]) verdict = VERDICT.UNREADABLE;
  else if (!direction.declared) verdict = VERDICT.UNDECIDED;
  else {
    const wantsPublished = direction.publishDeposits === true;
    verdict = (wantsPublished && counts[CLASS.DEPOSIT_UNPUBLISHED] > 0) || counts[CLASS.UNPUBLISHED] > 0
      ? VERDICT.DIVERGENT : VERDICT.ALIGNED;
  }

  return {
    schema: CHARGE_SCHEMA,
    verdict,
    resolvedHere: false,          // never true: this module reports, Ahmad decides (discipline 4)
    directionDeclared: direction.declared,
    direction,
    surfaces: surfaces.map((s) => s.file),
    chargeCount: charges.length,
    counts,
    charges,
    unreadable,
  };
}

/** One sentence a person can read, carrying no verdict the audit did not reach. */
export function statementFor(result) {
  const c = result.counts || {};
  const parts = [
    `${result.chargeCount} chargeable amounts read from ${result.surfaces.length} declared surface(s)`,
    `${c[CLASS.LOWER_BOUND] || 0} exactly the floor of a band on their own card`,
    `${c[CLASS.DEPOSIT_UNPUBLISHED] || 0} deposits published nowhere a buyer reads`,
    `${c[CLASS.UNPUBLISHED] || 0} amounts matching no band`,
  ];
  const tail = result.directionDeclared ? `direction declared; verdict ${result.verdict}` : "no direction declared in the tree; nothing resolved here";
  return `${parts.join(" · ")} — ${tail}.`;
}
