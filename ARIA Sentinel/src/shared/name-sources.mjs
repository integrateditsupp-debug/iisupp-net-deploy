// name-sources.mjs — RUN-T T1: WHERE THE FIRST NAMES ALREADY ARE.
//
// WHY (RUN-T, 2026-07-28): the loop is built, one minute long, and has never been walked, and the
// honest reason is not that the software is missing a feature — it is that nobody has written down
// where the first real name would come from. Every previous answer to that question in this industry
// is a purchase: a lead database, an enrichment seat, a scraped export. All three are closed to us
// (free-only is a HARD LAW, and scraping against a site's rules is a rules violation regardless of
// cost). T1 is the honest list of what is left, and it is deliberately short.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - AN UNKNOWN YIELD IS SAID OUT LOUD. Nothing here has ever been run, so every yield is
//     `not established`. A number nobody measured is never invented to make a source look ranked.
//   - AN EXCLUDED SOURCE IS NAMED WITH ITS REASON. A source we cannot use is listed as excluded and
//     WHY, never quietly dropped — quietly dropping it is how it gets re-proposed next cycle.
//   - RANKED BY SPEED TO A REAL CONVERSATION, NOT BY LIST SIZE. A thousand cold names is worse than
//     three warm ones, and the ranking says so in words rather than leaving it implied.
//   - IT IS NOT A LEAD DATABASE. Stated by name, because that is exactly what it will be mistaken for.
//   - PURE. No fs, no net, no spawn, no env, no persistence — static-scanned by the T-series tests.
//   - Rule 11 privacy: this module holds SOURCE KINDS, never a real person's name. Real names live
//     only in untracked operator state via S1.
//   - Rule 15 additive: adds a surface, replaces nothing.

import { momentumSafe, UNKNOWN } from "./program-truth.mjs";

export const NAME_SOURCES_SCHEMA = "name-sources.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const COSTS_MONEY = false;
export const SCRAPES = false;
export const HOLDS_REAL_NAMES = false;

export const PRIVACY_NOTE =
  "This module records SOURCE KINDS only. No real person's name, address, employer or contact " +
  "detail belongs in it (vault Rule 11). A real name is entered through S1 into untracked operator " +
  "state and never travels back into a tracked file.";

/** What this is not. Stated first, because it is exactly what it will be mistaken for. */
export const IS_NOT = Object.freeze([
  "not a lead database",
  "not a scraper and not a scraped export",
  "not an enrichment service and not an enriched record",
  "not a purchased or rented list",
  "not a contact list - it holds no names at all",
  "not a guarantee that any of these produce anyone",
]);

/**
 * Sources we CANNOT use, named with the reason. Rule 14: a source excluded silently is a source
 * that gets proposed again next cycle by someone who never saw why it was dropped.
 */
export const EXCLUDED_SOURCES = Object.freeze([
  Object.freeze({
    key: "paid-lead-database",
    label: "A paid lead database (bought contact records by filter)",
    reason: "costs money - free-only is a HARD LAW, and no seat, credit pack or trial-that-converts is taken",
    violates: "cost",
  }),
  Object.freeze({
    key: "paid-enrichment",
    label: "Paid contact enrichment (turning a company into an email and a phone number)",
    reason: "costs money per record, and the record it returns is one nobody in this company observed",
    violates: "cost",
  }),
  Object.freeze({
    key: "scraped-professional-network",
    label: "Scraping a professional network's profiles or search results",
    reason: "against the site's rules - a rules violation does not become acceptable because it is free",
    violates: "rules",
  }),
  Object.freeze({
    key: "scraped-directory",
    label: "Bulk-scraping a business directory or association member list",
    reason: "against the rules of every directory worth scraping; membership lists are published to be read, not harvested",
    violates: "rules",
  }),
  Object.freeze({
    key: "purchased-email-list",
    label: "A purchased or rented email list",
    reason: "costs money AND the recipients never agreed to hear from us - it is the definition of the thing we refuse to be",
    violates: "cost-and-consent",
  }),
  Object.freeze({
    key: "harvested-public-records",
    label: "Bulk-harvesting public filings into a contact list",
    reason: "free and legal to read one at a time, but bulk-harvesting is the scraped-list pattern wearing a clean shirt",
    violates: "rules",
  }),
]);

export const EXCLUDED_KEYS = Object.freeze(EXCLUDED_SOURCES.map((s) => s.key));

/**
 * Warmth tiers. The ONLY ranking input. Deliberately not "list size", because ranking by size is
 * how a program ends up with a thousand names and no conversations.
 */
export const WARMTH = Object.freeze({
  "already-know-them": 1,
  "worked-with-them": 2,
  "they-contacted-us": 3,
  "one-introduction-away": 4,
  "same-room-regularly": 5,
  "never-met": 6,
});

export const RANKING_NOTE =
  "Ranked by how fast a real conversation could plausibly follow - nothing else. List size is not an " +
  "input and never will be: a thousand names nobody has met is worse than three names who would take " +
  "the call, because only one of those two can produce an hour this week.";

/**
 * The sources. Every field is a recorded fact about the SOURCE, not a claim about anyone in it.
 * `yieldPerHour` is `null` everywhere it has never been run — it renders as `not established`, never
 * as a number. Nothing here has been run yet, so that is everywhere, and it should stay visible.
 */
export const SOURCES = Object.freeze([
  Object.freeze({
    key: "people-already-known",
    label: "People Ahmad already knows who run or support a business",
    warmth: "already-know-them",
    canSupply: "a name, a real basis for the problem heard first-hand, and a conversation that needs no introduction",
    cannotSupply: "volume - this list is as long as it is and does not grow on demand",
    firstMove: "write down every one of them, today, in one sitting - S1 takes about a minute each",
    costs: false,
    scrapes: false,
  }),
  Object.freeze({
    key: "past-employers-and-colleagues",
    label: "Past employers and colleagues from 15+ years of IT operations",
    warmth: "worked-with-them",
    canSupply: "people who have seen the work first-hand, which is the only credential we can honestly claim",
    cannotSupply: "anyone at a company that has since changed hands or moved on - the relationship is with the person, not the logo",
    firstMove: "list the ones still in touch; ask nothing on the first contact except how they are",
    costs: false,
    scrapes: false,
  }),
  Object.freeze({
    key: "existing-inbound",
    label: "Anyone who has already contacted us - email, the site, a form, a phone call",
    warmth: "they-contacted-us",
    canSupply: "the warmest possible start: they opened the conversation, so there is nothing to justify",
    cannotSupply: "anything at all if the number of them is zero, which is a fact to check before ranking it high",
    firstMove: "read the actual inbox and count them - if the count is zero, say zero and rank it accordingly",
    costs: false,
    scrapes: false,
  }),
  Object.freeze({
    key: "introductions",
    label: "An introduction asked for from someone already known",
    warmth: "one-introduction-away",
    canSupply: "a name that arrives pre-vouched, which is the cheapest trust that exists",
    cannotSupply: "speed on its own - it costs the other person a favour, so it cannot be spent often",
    firstMove: "ask one person for one introduction, naming the kind of business, never a quota",
    costs: false,
    scrapes: false,
  }),
  Object.freeze({
    key: "local-business-association",
    label: "Local business association / chamber events in Durham Region",
    warmth: "same-room-regularly",
    canSupply: "repeated presence in a room of owners - the same faces, which is what turns a hello into a conversation",
    cannotSupply: "a member list to work through; showing up is the mechanism, the roster is not ours to take",
    firstMove: "attend one event and speak to three people - recording zero candidates from it is still a recorded hour",
    costs: false,
    scrapes: false,
  }),
  Object.freeze({
    key: "community-and-trade-groups",
    label: "Community and trade groups where owners already gather and talk",
    warmth: "same-room-regularly",
    canSupply: "context - what owners are actually complaining about, in their words, which S2 needs and cannot invent",
    cannotSupply: "a right to pitch; a group joined to sell into is a group that removes you",
    firstMove: "read for a week and answer one question usefully without mentioning what we sell",
    costs: false,
    scrapes: false,
  }),
]);

export const SOURCE_KEYS = Object.freeze(SOURCES.map((s) => s.key));

export const ZERO_STATEMENT =
  "No source has been worked yet. Every yield below reads `not established` because none of them " +
  "have been run once - that is an honest empty instrument, not a low score.";

function warmthRank(key) {
  const n = WARMTH[key];
  return Number.isFinite(n) ? n : 99;
}

function nonNegInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Build the ranked source list.
 * `observed`: optional real, first-hand yields — `{ [sourceKey]: { candidates, hours } }`.
 * Anything absent stays `not established`. Nothing is defaulted into a number.
 */
export function buildSourceList({ observed = null } = {}, { now = Date.now() } = {}) {
  const obs = observed && typeof observed === "object" ? observed : {};

  const ranked = SOURCES
    .map((s) => {
      const o = obs[s.key] && typeof obs[s.key] === "object" ? obs[s.key] : null;
      const candidates = o ? nonNegInt(o.candidates) : null;
      const hours = o ? nonNegInt(o.hours) : null;
      return {
        ...s,
        rank: warmthRank(s.warmth),
        worked: candidates !== null || hours !== null,
        observedCandidates: candidates,
        observedHours: hours,
        // The whole point: a yield nobody measured says so.
        yieldStatement: candidates === null
          ? `Yield ${UNKNOWN} - this source has not been worked once.`
          : `${candidates} candidate(s) recorded from ${hours === null ? `an ${UNKNOWN} number of` : hours} hour(s) spent on this source.`,
      };
    })
    .sort((a, b) => (a.rank - b.rank) || a.key.localeCompare(b.key));

  const workedCount = ranked.filter((s) => s.worked).length;

  return {
    schema: NAME_SOURCES_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    costsMoney: COSTS_MONEY,
    scrapes: SCRAPES,
    holdsRealNames: HOLDS_REAL_NAMES,
    isNot: [...IS_NOT],
    privacyNote: PRIVACY_NOTE,
    rankingNote: RANKING_NOTE,
    sources: ranked,
    excluded: EXCLUDED_SOURCES.map((s) => ({ ...s })),
    workedCount,
    statement: workedCount === 0
      ? ZERO_STATEMENT
      : `${workedCount} of ${ranked.length} source(s) have been worked at least once; the rest read ${UNKNOWN}.`,
  };
}

export function sourceListIsMomentumSafe(list) {
  return !!list && momentumSafe(sourceListMarkdown(list));
}

export function sourceListMarkdown(list) {
  if (!list || list.schema !== NAME_SOURCES_SCHEMA) return "_no source list_";
  const L = [
    "# Where the first names already are",
    "",
    `_${list.statement}_`,
    "",
    "## What this is not",
    "",
    ...list.isNot.map((n) => `- ${n}`),
    "",
    `_${list.privacyNote}_`,
    "",
    "## Ranked by how fast a real conversation could follow",
    "",
    `_${list.rankingNote}_`,
    "",
  ];
  for (const s of list.sources) {
    L.push(
      `### ${s.rank}. ${s.label}`,
      "",
      `- Can supply: ${s.canSupply}`,
      `- Cannot supply: ${s.cannotSupply}`,
      `- First move: ${s.firstMove}`,
      `- ${s.yieldStatement}`,
      "",
    );
  }
  L.push("## Excluded, and why", "");
  for (const e of list.excluded) {
    L.push(`- **${e.label}** - ${e.reason}`);
  }
  L.push("", "_No source above requires a payment, a seat, a scrape, or a rules violation. Any that did is in the excluded list with its reason._", "");
  return L.join("\n");
}

export { UNKNOWN };
