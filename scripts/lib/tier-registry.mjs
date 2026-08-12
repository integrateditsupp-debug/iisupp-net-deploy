// tier-registry.mjs — RUN-BF / BF2. THE TIER VOCABULARY SETTLED ONCE.
//
// RUN-BE needed a declared map because the signable agreement says `SBA` and `Mid` while the buying
// page says `Small Business` and `Mid Size`. That map was written inline, in the module that needed
// it, which is fine exactly once. The second module that needs it — BF1, the price audit — would
// restate it, and two copies of a mapping is how two surfaces start disagreeing about which tier a
// customer is on without anybody editing either of them.
//
// So the vocabulary is declared ONCE, here, and every consumer resolves against it.
//
// WHAT RUNNING IT FOUND (2026-08-12, read first-hand, never inferred):
//
//   `legal/MSA-template.md` disagrees WITH ITSELF. Schedule A line 167 offers the customer a plan
//   name from `[Personal / Pro / Small Business / Mid-Size / Enterprise / Custom]`; Schedule B line
//   185 — the SLA table, in the same document, four pages later — heads its columns
//   `Personal | Pro | SBA | Mid | Enterprise`. One signature covers both. A customer who signs
//   Schedule A as "Small Business" has no row in Schedule B carrying that name.
//
//   `plans/index.html` disagrees with itself too, more quietly: the plan CARD a buyer clicks says
//   `Mid-Size` (line 173) and the comparison MATRIX the same page opens in a modal says `Mid Size`
//   (line 1002). Same page, same product, one hyphen apart — which is exactly the class of drift a
//   string-similarity match would paper over and a declared registry catches.
//
// THE DISCIPLINE:
//
//   1. A CANONICAL tier is declared here with a stable `id`. Everything else is an ALIAS with a
//      REASON somebody wrote. No alias is ever inferred from string similarity, lowercasing,
//      hyphen-stripping or edit distance. `Mid Size` and `Mid-Size` resolve to the same tier because
//      a person said so, not because a regex could not tell them apart. The day two genuinely
//      different products are one hyphen apart, an inferred map merges them silently.
//
//   2. An alias declares WHICH SURFACE CLASS it belongs to. A label that is legitimate in a signed
//      agreement is not automatically legitimate on a buying page, and knowing where a name is
//      allowed to appear is most of the value of having a registry.
//
//   3. UNKNOWN is a first-class answer. `resolve()` returns null for a label nobody has declared,
//      and callers report it. A registry that guesses is a registry that hides the finding it exists
//      to produce.
//
//   4. This file declares NAMES. It does not declare prices, response times, or entitlements —
//      those live with the surfaces and the audits that read them. A registry that also carried the
//      price would become a fourth place a price is published, which is the defect BF1 exists to
//      find.
//
//   5. Nothing here writes to a customer-facing surface and nothing here deletes one (Rule 15).

export const TIER_REGISTRY_SCHEMA = "tier-registry/1";

/** Where a name is allowed to be used. An alias is scoped to one of these. */
export const SURFACE_CLASS = Object.freeze({
  BINDING: "binding-a-signable-agreement-uses-this-name",
  PUBLISHED: "published-a-buyer-reads-this-name-before-they-sign",
  INTERNAL: "internal-operator-facing-only-never-shown-to-a-customer",
});

/**
 * Where, precisely, a name is printed.
 *
 * A surface class says a name is legitimate somewhere on a page or somewhere in an agreement. That
 * is not enough for a consumer that needs to join the SLA TABLE to the COMPARISON MATRIX: those two
 * artefacts each use exactly one of the several legitimate names, and picking the wrong one silently
 * produces an empty join that reads as "nothing to report".
 *
 * So the two artefacts that other audits join on are named here, and the derivation below REFUSES
 * when a tier carries two names for the same role rather than picking one.
 */
export const ROLE = Object.freeze({
  SLA_TABLE: "the-column-head-in-MSA-schedule-B",
  MATRIX: "the-column-head-in-the-published-comparison-matrix",
});

/** Which product line a tier belongs to. Two lines, deliberately kept apart. */
export const LINE = Object.freeze({
  SENTINEL: "aria-sentinel-a-subscription-a-buyer-selects",
  RETAINER: "human-msp-retainer-a-band-that-ends-in-a-quote",
});

/**
 * The canonical tiers. `id` is the stable key every consumer joins on; `label` is the name this
 * registry considers correct for a buyer-facing surface.
 *
 * Ordered cheapest to dearest within each line, because several consumers report in tier order and
 * an arbitrary order makes two reports of the same tree look different.
 */
export const TIERS = Object.freeze([
  Object.freeze({ id: "personal", line: LINE.SENTINEL, label: "Personal", rank: 1 }),
  Object.freeze({ id: "pro", line: LINE.SENTINEL, label: "Pro", rank: 2 }),
  Object.freeze({ id: "small-business", line: LINE.SENTINEL, label: "Small Business", rank: 3 }),
  Object.freeze({ id: "mid-size", line: LINE.SENTINEL, label: "Mid-Size", rank: 4 }),
  Object.freeze({ id: "enterprise", line: LINE.SENTINEL, label: "Enterprise", rank: 5 }),

  Object.freeze({ id: "retainer-tier-1", line: LINE.RETAINER, label: "Tier 1 — Operational Foundation", rank: 1 }),
  Object.freeze({ id: "retainer-tier-2", line: LINE.RETAINER, label: "Tier 2 — Business Continuity", rank: 2 }),
  Object.freeze({ id: "retainer-tier-3", line: LINE.RETAINER, label: "Tier 3 — Enterprise Operations", rank: 3 }),
]);

/**
 * Every name any surface in this tree actually uses, declared with the reason it is the same tier.
 *
 * Each row is a fact somebody asserted, not a rule software derived. Adding a row is a decision;
 * that is the point. If a new surface starts using a fifth name for a tier, the resolver returns
 * null and the consumer reports it rather than absorbing it.
 */
export const ALIASES = Object.freeze([
  // ---- Sentinel, published surfaces -------------------------------------------------------
  Object.freeze({ tier: "personal", alias: "Personal", surface: SURFACE_CLASS.PUBLISHED, role: ROLE.MATRIX, why: "canonical label; plan card and comparison matrix agree" }),
  Object.freeze({ tier: "pro", alias: "Pro", surface: SURFACE_CLASS.PUBLISHED, role: ROLE.MATRIX, why: "canonical label; plan card and comparison matrix agree" }),
  Object.freeze({ tier: "small-business", alias: "Small Business", surface: SURFACE_CLASS.PUBLISHED, role: ROLE.MATRIX, why: "canonical label; plan card and comparison matrix agree" }),
  Object.freeze({ tier: "mid-size", alias: "Mid-Size", surface: SURFACE_CLASS.PUBLISHED, why: "canonical label, as printed on the plan CARD a buyer clicks (plans/index.html:173)" }),
  Object.freeze({ tier: "mid-size", alias: "Mid Size", surface: SURFACE_CLASS.PUBLISHED, role: ROLE.MATRIX, why: "the comparison MATRIX on the same page drops the hyphen (plans/index.html:1002); declared rather than inferred, because one hyphen is not a licence to merge names automatically" }),
  Object.freeze({ tier: "enterprise", alias: "Enterprise", surface: SURFACE_CLASS.PUBLISHED, role: ROLE.MATRIX, why: "canonical label; plan card and comparison matrix agree" }),

  // ---- Sentinel, binding surfaces ---------------------------------------------------------
  Object.freeze({ tier: "personal", alias: "Personal", surface: SURFACE_CLASS.BINDING, role: ROLE.SLA_TABLE, why: "MSA Schedule A and Schedule B agree with the published label" }),
  Object.freeze({ tier: "pro", alias: "Pro", surface: SURFACE_CLASS.BINDING, role: ROLE.SLA_TABLE, why: "MSA Schedule A and Schedule B agree with the published label" }),
  Object.freeze({ tier: "small-business", alias: "Small Business", surface: SURFACE_CLASS.BINDING, why: "MSA Schedule A plan-name field (legal/MSA-template.md:167) uses the published label" }),
  Object.freeze({ tier: "small-business", alias: "SBA", surface: SURFACE_CLASS.BINDING, role: ROLE.SLA_TABLE, why: "MSA Schedule B SLA column head (legal/MSA-template.md:185) abbreviates it; same tier, same price row, and the document contradicts ITSELF between its two schedules" }),
  Object.freeze({ tier: "mid-size", alias: "Mid-Size", surface: SURFACE_CLASS.BINDING, why: "MSA Schedule A plan-name field (legal/MSA-template.md:167)" }),
  Object.freeze({ tier: "mid-size", alias: "Mid", surface: SURFACE_CLASS.BINDING, role: ROLE.SLA_TABLE, why: "MSA Schedule B SLA column head (legal/MSA-template.md:185) shortens it; same tier, same price row" }),
  Object.freeze({ tier: "enterprise", alias: "Enterprise", surface: SURFACE_CLASS.BINDING, role: ROLE.SLA_TABLE, why: "MSA Schedule A and Schedule B agree with the published label" }),

  // ---- Retainer line ----------------------------------------------------------------------
  Object.freeze({ tier: "retainer-tier-1", alias: "Tier 1", surface: SURFACE_CLASS.PUBLISHED, why: "index.html retainer deck badge (index.html:2415)" }),
  Object.freeze({ tier: "retainer-tier-1", alias: "Operational Foundation", surface: SURFACE_CLASS.PUBLISHED, why: "the deck name printed beside the badge (index.html:2416)" }),
  Object.freeze({ tier: "retainer-tier-2", alias: "Tier 2", surface: SURFACE_CLASS.PUBLISHED, why: "index.html retainer deck badge (index.html:2448)" }),
  Object.freeze({ tier: "retainer-tier-2", alias: "Business Continuity", surface: SURFACE_CLASS.PUBLISHED, why: "the deck name printed beside the badge (index.html:2449)" }),
  Object.freeze({ tier: "retainer-tier-3", alias: "Tier 3", surface: SURFACE_CLASS.PUBLISHED, why: "index.html retainer deck badge (index.html:2483)" }),
  Object.freeze({ tier: "retainer-tier-3", alias: "Enterprise Operations", surface: SURFACE_CLASS.PUBLISHED, why: "the deck name printed beside the badge (index.html:2484)" }),
]);

/**
 * Contradictions this registry KNOWS about and reports rather than resolves.
 *
 * A registry that maps `SBA` → `Small Business` makes the software work and makes the problem
 * invisible. Both are true at once: the mapping is needed so audits can run, AND the document
 * disagreeing with itself is a finding a person has to fix. Declaring the contradiction here keeps
 * the second fact from being swallowed by the first.
 *
 * `resolvedHere: false` on every row, asserted by the suite: naming what a customer signs is not a
 * software decision (Rule 15).
 */
export const KNOWN_CONTRADICTIONS = Object.freeze([
  Object.freeze({
    id: "msa-schedule-a-vs-schedule-b",
    tier: "small-business",
    statement: "legal/MSA-template.md offers the plan name `Small Business` in Schedule A (line 167) and heads the corresponding SLA column `SBA` in Schedule B (line 185). One signature covers both schedules.",
    decider: "Ahmad",
    resolvedHere: false,
  }),
  Object.freeze({
    id: "msa-schedule-a-vs-schedule-b-mid",
    tier: "mid-size",
    statement: "legal/MSA-template.md offers the plan name `Mid-Size` in Schedule A (line 167) and heads the corresponding SLA column `Mid` in Schedule B (line 185).",
    decider: "Ahmad",
    resolvedHere: false,
  }),
  Object.freeze({
    id: "plans-card-vs-matrix-hyphen",
    tier: "mid-size",
    statement: "plans/index.html prints `Mid-Size` on the plan card a buyer clicks (line 173) and `Mid Size` in the comparison matrix the same page opens (line 1002).",
    decider: "Ahmad",
    resolvedHere: false,
  }),
]);

const byId = new Map(TIERS.map((t) => [t.id, t]));

/** @returns {object|undefined} the canonical tier record for an id. */
export const tierById = (id) => byId.get(String(id || ""));

/** @returns {object[]} the canonical tiers of one product line, cheapest first. */
export const tiersOfLine = (line) => TIERS.filter((t) => t.line === line).slice().sort((a, b) => a.rank - b.rank);

/**
 * Resolve a label a surface actually used to a canonical tier.
 *
 * @param {string} label      the raw text on the surface
 * @param {object} [opts]
 * @param {string} [opts.surface]  restrict to aliases declared for this surface class
 * @param {string} [opts.line]     restrict to one product line
 * @returns {{tier: object, alias: object}|null}  null when nobody has declared this name — which is
 *          an answer, not a failure. Callers report UNKNOWN; they never guess.
 *
 * Matching is EXACT after trimming surrounding whitespace only. No case folding, no punctuation
 * stripping, no fuzzy distance: every one of those would have quietly merged `Mid Size` and
 * `Mid-Size` without anybody noticing the page disagreed with itself.
 */
export function resolve(label, { surface = null, line = null } = {}) {
  const raw = String(label ?? "").trim();
  if (!raw) return null;
  for (const alias of ALIASES) {
    if (alias.alias !== raw) continue;
    if (surface && alias.surface !== surface) continue;
    const tier = byId.get(alias.tier);
    if (!tier) continue;
    if (line && tier.line !== line) continue;
    return { tier, alias };
  }
  return null;
}

/** Every declared name for a tier, optionally scoped to a surface class. */
export function aliasesFor(tierId, { surface = null } = {}) {
  return ALIASES.filter((a) => a.tier === tierId && (!surface || a.surface === surface));
}

/**
 * The binding→published tier map RUN-BE's response-time audit needs, DERIVED from this registry
 * rather than restated in it.
 *
 * Shape is deliberately unchanged from the inline table BE1 carried — `{ binding, published, why }`,
 * one row per Sentinel tier — so this is a substitution, not a rewrite of a working audit. What
 * changes is that there is now one place a tier name is declared instead of two.
 *
 * REFUSES rather than guesses: a tier with no SLA-table name, no matrix name, or two of either
 * throws. An empty or half-built join in an audit about contractual obligations would report a clean
 * tree by not looking at it.
 */
export function slaToMatrixMap() {
  return Object.freeze(tiersOfLine(LINE.SENTINEL).map((t) => {
    const pick = (surface, role) => {
      const hits = ALIASES.filter((a) => a.tier === t.id && a.surface === surface && a.role === role);
      if (hits.length !== 1) {
        throw new Error(`tier-registry: tier "${t.id}" has ${hits.length} names declared for role ${role} on ${surface}; exactly one is required — refusing to pick`);
      }
      return hits[0];
    };
    const binding = pick(SURFACE_CLASS.BINDING, ROLE.SLA_TABLE);
    const published = pick(SURFACE_CLASS.PUBLISHED, ROLE.MATRIX);
    return Object.freeze({
      binding: binding.alias,
      published: published.alias,
      why: binding.alias === published.alias
        ? "identical label on both sides"
        : `${binding.why} — joined to the matrix column "${published.alias}"`,
    });
  }));
}

/**
 * Self-check the registry itself.
 *
 * A registry with an alias pointing at a tier that does not exist, or a reason nobody wrote, is a
 * worse foundation than no registry. This runs in the suite so the vocabulary cannot rot silently.
 *
 * @returns {{ok: boolean, problems: string[]}}
 */
export function auditRegistry() {
  const problems = [];
  const seen = new Set();

  for (const t of TIERS) {
    if (!t.id || !t.label || !t.line) problems.push(`tier ${JSON.stringify(t)} is missing id, label or line`);
    if (seen.has(t.id)) problems.push(`duplicate tier id: ${t.id}`);
    seen.add(t.id);
    if (!aliasesFor(t.id).length) problems.push(`tier ${t.id} has no declared alias — no surface can resolve to it`);
  }

  const pairs = new Set();
  for (const a of ALIASES) {
    if (!byId.has(a.tier)) problems.push(`alias "${a.alias}" points at unknown tier "${a.tier}"`);
    if (!Object.values(SURFACE_CLASS).includes(a.surface)) problems.push(`alias "${a.alias}" has an undeclared surface class`);
    // A reason has to be an argument, not a placeholder. Ten characters is not a high bar; a
    // rubber stamp like "same" clears nothing.
    if (!a.why || a.why.trim().length < 12) problems.push(`alias "${a.alias}" (${a.tier}) has no written reason`);
    const key = `${a.surface}::${a.alias}`;
    if (pairs.has(key)) problems.push(`alias "${a.alias}" is declared twice for the same surface class — one name cannot mean two tiers`);
    pairs.add(key);
  }

  for (const c of KNOWN_CONTRADICTIONS) {
    if (!byId.has(c.tier)) problems.push(`contradiction ${c.id} names unknown tier "${c.tier}"`);
    if (!c.decider) problems.push(`contradiction ${c.id} has no named decider`);
    if (c.resolvedHere !== false) problems.push(`contradiction ${c.id} claims to be resolved here — naming what a customer signs is not a software decision`);
    if (!c.statement || c.statement.trim().length < 40) problems.push(`contradiction ${c.id} has no written statement`);
  }

  return { ok: problems.length === 0, problems };
}
