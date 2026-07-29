// candidate-fit.mjs — RUN-Q Q2: THE FIT SCORE THAT CAN SAY "NO IDEA".
//
// WHY (RUN-Q, 2026-07-28): a list of candidates with no order is a list nobody works. But a ranked
// list built on guesses is worse than no list: it sends a human to spend the scarcest thing they
// have - an hour - on a name a model felt good about. Q2 ranks ONLY on facts a human already
// recorded in Q1, and when a fact is missing it says so instead of averaging around the hole.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - SCORED ONLY ON RECORDED FACTS. Never a market average, never a model impression, never a
//     "similar companies usually" prior. A dimension with no recorded input scores UNKNOWN.
//   - A MISSING DIMENSION REFUSES THE WHOLE SCORE. There is no partial score, no "score so far",
//     no confidence band around a hole. This is the program-truth UNKNOWN pattern applied to a
//     candidate: silence never becomes a number (see program-truth.mjs `UNKNOWN`).
//   - DETERMINISTIC AND REPRODUCIBLE. Same input, same order, always. No clock, no randomness, no
//     iteration-order dependency - ties break on the stable local handle.
//   - EVERY POSITION EXPLAINS ITSELF, and carries THE SINGLE FACT THAT WOULD MOST CHANGE IT, so the
//     list tells a human what to go and find out rather than only what to believe.
//   - AN UNSCOREABLE CANDIDATE IS VISIBLE, NOT BURIED. It surfaces FIRST, as work to do, because a
//     candidate one question away from being scoreable is the cheapest move on the board.
//   - PURE. No fs, no net, no spawn, no env, no clock in the ranking.
//   - Rule 15 additive: Q1 records are read-only inputs and are never mutated.

import { CANDIDATE_RECORD_SCHEMA } from "./candidate-record.mjs";
import { UNKNOWN } from "./program-truth.mjs";

export const CANDIDATE_FIT_SCHEMA = "candidate-fit.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export { UNKNOWN };

export const NO_GUESSING_NOTE =
  "Scored only on what a human recorded. No market average, no model impression, no prior. " +
  "A dimension with nothing recorded behind it reads '" + UNKNOWN + "' and refuses the whole score.";

export const EMPTY_STATEMENT =
  "0 candidates to score. Ranking nothing produces nothing - and that is the correct output, " +
  "not an error.";

/**
 * The dimensions. Each states EXACTLY what recorded fact it reads and what a human must go and find
 * out if it is missing. `weight` is fixed and visible so the ranking is auditable by hand.
 */
export const DIMENSIONS = Object.freeze([
  Object.freeze({
    key: "reachable",
    label: "Reachable",
    weight: 3,
    reads: "candidate.contact - an address observed somewhere real",
    missing: "no observed contact address, so there is no one to reach",
    findOut: "Find one real, observed address - not one built from the name or the domain.",
  }),
  Object.freeze({
    key: "problemStated",
    label: "Problem stated by them",
    weight: 3,
    reads: "candidate.problemBasis - and whether the basis is something THEY said or did",
    missing: "no recorded basis, so the fit is a feeling",
    findOut: "Write down the one thing they actually said or published about the problem.",
  }),
  Object.freeze({
    key: "firstHand",
    label: "First-hand provenance",
    weight: 2,
    reads: "the provenance sentences on name, contact and problemBasis",
    missing: "no provenance recorded to judge",
    findOut: "Record where each fact came from, in a sentence, per field.",
  }),
  Object.freeze({
    key: "sizeKnown",
    label: "Size or spend known",
    weight: 2,
    reads: "candidate.observed.seats / candidate.observed.currentSpendCad - if a human recorded them",
    missing: "neither seats nor current spend has been observed",
    findOut: "Ask, or find published, one of: how many people, or what they spend on IT today.",
  }),
]);

export const DIMENSION_KEYS = Object.freeze(DIMENSIONS.map((d) => d.key));
export const MAX_SCORE = DIMENSIONS.reduce((a, d) => a + d.weight, 0);

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

function posNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// A basis is FIRST-PARTY only when the provenance says they said/wrote/published/showed it. This is
// a deliberately narrow test: "their website looked old" is an observation about them, not from them.
const FIRST_PARTY = ["they said", "he said", "she said", "told me", "said to me", "unprompted",
  "in their own", "their own tender", "published", "wrote", "posted", "stated in their",
  "on the call", "at the meeting", "asked us", "asked me", "emailed"];

/**
 * Score ONE dimension. Returns { key, established, points, max, reason } where `established:false`
 * means the input for it was never recorded - that is the ONLY reason a dimension is unknown. It is
 * never unknown because a rule was uncertain.
 */
function scoreDimension(dim, c) {
  const observed = c && typeof c.observed === "object" && c.observed ? c.observed : {};

  if (dim.key === "reachable") {
    const has = !!(c.contact && nonEmpty(c.contact.value) && nonEmpty(c.contact.source, 8));
    if (!has) return { key: dim.key, established: false, points: null, max: dim.weight, reason: dim.missing };
    return { key: dim.key, established: true, points: dim.weight, max: dim.weight,
      reason: "an observed contact address is recorded with its own provenance" };
  }

  if (dim.key === "problemStated") {
    const has = !!(c.problemBasis && nonEmpty(c.problemBasis.value) && nonEmpty(c.problemBasis.source, 8));
    if (!has) return { key: dim.key, established: false, points: null, max: dim.weight, reason: dim.missing };
    const src = String(c.problemBasis.source).toLowerCase();
    const firstParty = FIRST_PARTY.some((p) => src.includes(p));
    return { key: dim.key, established: true, points: firstParty ? dim.weight : 1, max: dim.weight,
      reason: firstParty
        ? "the basis is something they themselves said or published"
        : "a basis is recorded, but it is our observation of them rather than something they said" };
  }

  if (dim.key === "firstHand") {
    const sources = ["name", "contact", "problemBasis"]
      .map((k) => (c[k] && nonEmpty(c[k].source, 8) ? String(c[k].source).toLowerCase() : null))
      .filter(Boolean);
    if (sources.length === 0) {
      return { key: dim.key, established: false, points: null, max: dim.weight, reason: dim.missing };
    }
    // "First-hand" = the operator was there. Second-hand provenance is still real, just worth less.
    const firstHandMarks = ["i met", "i saw", "i spoke", "he handed", "she handed", "at the",
      "on the call", "told me", "asked me", "emailed me", "in person", "i attended"];
    const firstHand = sources.filter((s) => firstHandMarks.some((m) => s.includes(m))).length;
    const points = firstHand >= 2 ? dim.weight : (firstHand === 1 ? 1 : 0);
    return { key: dim.key, established: true, points, max: dim.weight,
      reason: firstHand >= 2 ? `${firstHand} of ${sources.length} facts were observed first-hand`
        : (firstHand === 1 ? "one fact was observed first-hand, the rest second-hand"
          : "every fact is second-hand - real, but nobody here was in the room") };
  }

  if (dim.key === "sizeKnown") {
    const seats = posNum(observed.seats);
    const spend = posNum(observed.currentSpendCad);
    if (seats === null && spend === null) {
      return { key: dim.key, established: false, points: null, max: dim.weight, reason: dim.missing };
    }
    return { key: dim.key, established: true, points: (seats !== null && spend !== null) ? dim.weight : 1,
      max: dim.weight,
      reason: (seats !== null && spend !== null)
        ? "both headcount and current spend were observed"
        : `one of the two size facts was observed (${seats !== null ? "seats" : "current spend"})` };
  }

  return { key: dim.key, established: false, points: null, max: dim.weight, reason: dim.missing };
}

/**
 * Score ONE candidate. A missing dimension is STATED and the overall score REFUSES TO EXIST.
 * Deterministic: no clock, no randomness, no external read.
 */
export function scoreCandidate(candidate) {
  const c = candidate && typeof candidate === "object" ? candidate : {};
  const dims = DIMENSIONS.map((d) => {
    const r = scoreDimension(d, c);
    return { ...r, label: d.label, weight: d.weight, findOut: d.findOut,
      display: r.established ? `${r.points}/${r.max}` : UNKNOWN };
  });

  const notEstablished = dims.filter((d) => !d.established);
  const scoreable = notEstablished.length === 0;

  // The single fact that would most change this candidate's position. When the score is refused it
  // is the heaviest MISSING dimension; when it is scored it is the heaviest dimension still short of
  // full marks. Either way it is one concrete errand, not advice.
  const heaviestMissing = notEstablished.slice().sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key))[0] || null;
  const heaviestShort = dims.filter((d) => d.established && d.points < d.max)
    .sort((a, b) => (b.max - b.points) - (a.max - a.points) || a.key.localeCompare(b.key))[0] || null;
  const lever = heaviestMissing || heaviestShort;

  const score = scoreable ? dims.reduce((a, d) => a + d.points, 0) : null;

  return {
    schema: CANDIDATE_FIT_SCHEMA,
    key: nonEmpty(c.key) ? String(c.key).trim() : null,
    scoreable,
    score,
    max: MAX_SCORE,
    // Never a percentage of a partial total. If it is not scoreable there is no number at all.
    display: scoreable ? `${score}/${MAX_SCORE}` : UNKNOWN,
    dimensions: dims,
    notEstablished: notEstablished.map((d) => d.key),
    reason: scoreable
      ? dims.slice().sort((a, b) => b.points - a.points || a.key.localeCompare(b.key))
        .map((d) => `${d.label} ${d.points}/${d.max} - ${d.reason}`).join("; ")
      : `Not scoreable. ${notEstablished.length} dimension(s) were never recorded: ` +
        notEstablished.map((d) => `${d.label} (${d.reason})`).join("; ") +
        ". The score is refused rather than averaged around the gap.",
    mostChangingFact: lever
      ? { dimension: lever.key, label: lever.label, weight: lever.weight, findOut: lever.findOut }
      : null,
    guessing: false,
    honest: true,
    sent: SENT,
  };
}

/**
 * Rank a list. Deterministic, explainable, and unscoreable candidates surface FIRST as work to do -
 * never sorted quietly to the bottom where a human stops reading.
 */
export function rankCandidates(candidates = [], list = null) {
  const src = Array.isArray(candidates) ? candidates.filter((c) => c && nonEmpty(c.key)) : [];
  const scored = src.map((c) => scoreCandidate(c));

  const ranked = scored.filter((s) => s.scoreable)
    .sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)))
    .map((s, i) => ({ ...s, position: i + 1 }));

  const needsOneFact = scored.filter((s) => !s.scoreable)
    .sort((a, b) => {
      const aw = a.mostChangingFact ? a.mostChangingFact.weight : 0;
      const bw = b.mostChangingFact ? b.mostChangingFact.weight : 0;
      return bw - aw || a.notEstablished.length - b.notEstablished.length || String(a.key).localeCompare(String(b.key));
    })
    .map((s, i) => ({ ...s, position: null, visible: true, queuePosition: i + 1 }));

  const listOk = list && list.schema === CANDIDATE_RECORD_SCHEMA;

  return {
    schema: CANDIDATE_FIT_SCHEMA,
    honest: true,
    deterministic: true,
    guessing: false,
    total: scored.length,
    scoredCount: ranked.length,
    unscoreableCount: needsOneFact.length,
    // Visible, first, by name.
    needsOneFact,
    ranked,
    empty: scored.length === 0,
    statement: scored.length === 0
      ? EMPTY_STATEMENT
      : `${scored.length} candidate(s): ${ranked.length} scored, ${needsOneFact.length} not scoreable ` +
        "until one recorded fact is added. An unscoreable candidate is shown first, not buried - it is " +
        "usually the cheapest move on the board.",
    note: NO_GUESSING_NOTE,
    sourceListCount: listOk ? list.count : null,
    sent: SENT,
  };
}

export function candidateFitMarkdown(rank) {
  if (!rank || rank.schema !== CANDIDATE_FIT_SCHEMA || !Array.isArray(rank.ranked)) return "_no ranking_\n";
  const out = ["## Candidate fit", "", rank.statement, ""];
  if (rank.needsOneFact.length) {
    out.push("### One fact away", "");
    for (const s of rank.needsOneFact) {
      out.push(`- **${s.key}** - ${UNKNOWN}. Go and find out: ${s.mostChangingFact ? s.mostChangingFact.findOut : "the missing fact"}`);
    }
    out.push("");
  }
  if (rank.ranked.length) {
    out.push("### Scored", "");
    for (const s of rank.ranked) {
      out.push(`${s.position}. **${s.key}** - ${s.display}. ${s.reason}`);
      if (s.mostChangingFact) out.push(`   - Biggest lever: ${s.mostChangingFact.findOut}`);
    }
    out.push("");
  }
  out.push(`_${NO_GUESSING_NOTE}_`, "");
  return out.join("\n");
}
