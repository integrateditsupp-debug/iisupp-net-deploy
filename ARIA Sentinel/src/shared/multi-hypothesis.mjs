// STAGE 3 S3 — brain-audit F3: multi-hypothesis disambiguation.
// The reasoner (diagnostic-reasoner.diagnose) ranks the top-3 symptom matches but then acts on
// matches[0] only — if the top-2 are near-tied, the whole fix chain rides on a coin-flip. This is a
// PURE, INJECTABLE decision layer that sits BETWEEN diagnose() and any action: when the top-2 real
// matches are close, it asks ONE disambiguating question built strictly from the real candidate titles
// (real-or-empty — never invents an option), and otherwise clears the top hypothesis to proceed.
//
// It NEVER executes, fixes, or claims success. Its only outputs are: proceed | disambiguate | gather.
// diagnostic-reasoner.mjs, supervisor-agent.mjs, action-countdown.mjs, tier-0-executor.mjs are all
// left UNCHANGED — this composes on top of their output. No I/O, no paths cross this layer.

export const DEFAULT_CLOSENESS = 0.15; // top1.score - top2.score <= this (and both real) => ambiguous
export const DEFAULT_MIN_SCORE = 0.001; // a "real" match must clear this; below it the match is noise

const STOP = new Set(["the","a","an","is","it","my","to","of","on","in","and","or","no","not","cant",
  "cannot","wont","keeps","very","so","this","that","with","for","issue","issues","problem","error"]);

function tokens(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
}

// R11 / input-guard is check #1 at this new layer. No filesystem path is a valid input here, so any
// non-array shape (or a bogus/path-bearing candidate) is rejected to a SAFE empty result rather than
// trusted. This is the honest failure mode: unknown input => gather more info, never guess-and-run.
function safeMatches(matches, minScore) {
  if (!Array.isArray(matches)) return [];
  return matches
    .filter((m) => m && typeof m === "object" && !Array.isArray(m))
    .map((m) => ({
      id: typeof m.id === "string" ? m.id : null,
      title: typeof m.title === "string" ? m.title : (typeof m.id === "string" ? m.id : ""),
      score: Number.isFinite(Number(m.score)) ? Number(m.score) : 0
    }))
    .filter((m) => m.score > minScore)
    .sort((a, b) => b.score - a.score);
}

/** Words that appear in exactly one of the two real candidate titles — the honest distinguisher. */
export function distinguishingTerms(aTitle, bTitle) {
  const a = new Set(tokens(aTitle));
  const b = new Set(tokens(bTitle));
  const onlyA = [...a].filter((t) => !b.has(t));
  const onlyB = [...b].filter((t) => !a.has(t));
  return { onlyA, onlyB };
}

/**
 * Decide what to do with a ranked hypothesis list (as returned by diagnostic-reasoner:
 * [{ id, title, score }, ...], highest first — re-sorted defensively here).
 *
 * Returns one of:
 *  - { decision: "gather", ... }       no real match => hand back to broader intake (never a fabricated Q)
 *  - { decision: "proceed", top, ... } one real match, or a clear score gap => act on top (unchanged behavior)
 *  - { decision: "disambiguate", ... } top-2 real matches are close => ONE question, options = the two reals
 *
 * Injectable: closeness, minScore. No clock, no I/O.
 */
export function assessHypotheses(matches, { closeness = DEFAULT_CLOSENESS, minScore = DEFAULT_MIN_SCORE } = {}) {
  const real = safeMatches(matches, minScore);

  if (real.length === 0) {
    return { decision: "gather", ambiguous: false, top: null, runnerUp: null, question: null,
      options: [], reason: "no-real-match", isFix: false };
  }
  if (real.length === 1) {
    return { decision: "proceed", ambiguous: false, top: real[0], runnerUp: null, question: null,
      options: [], reason: "single-match", isFix: false };
  }

  const [top, runnerUp] = real;
  const gap = Number((top.score - runnerUp.score).toFixed(6));
  const ambiguous = gap <= closeness;

  if (!ambiguous) {
    return { decision: "proceed", ambiguous: false, top, runnerUp, question: null, options: [],
      gap, reason: "clear-gap", isFix: false };
  }

  // Ambiguous: build ONE question from the REAL candidate titles only (real-or-empty).
  const options = [
    { id: top.id, title: top.title, score: top.score },
    { id: runnerUp.id, title: runnerUp.title, score: runnerUp.score }
  ];
  const { onlyA, onlyB } = distinguishingTerms(top.title, runnerUp.title);
  const hasDistinct = onlyA.length > 0 && onlyB.length > 0;
  const question = hasDistinct
    ? `A couple of causes look about equally likely. Is this more about "${top.title}" or "${runnerUp.title}"?`
    : `Two causes look about equally likely: "${top.title}" or "${runnerUp.title}". Which fits better?`;

  return {
    decision: "disambiguate",
    ambiguous: true,
    top,
    runnerUp,
    gap,
    question,
    options,                 // strictly the two real candidates + caller may append an "unsure" escape
    distinguishers: { onlyA, onlyB },
    reason: "near-tie",
    isFix: false             // disambiguation is NEVER a resolution/success — it only asks
  };
}

/**
 * Apply a user's answer (a chosen candidate id, or null/"unsure") to a prior disambiguation result.
 * Real-or-empty: only an id that was actually offered is accepted; anything else => re-gather, never
 * silently pick. Pure.
 */
export function resolveDisambiguation(assessment, chosenId) {
  if (!assessment || assessment.decision !== "disambiguate") {
    return { decision: "gather", chosen: null, reason: "nothing-to-resolve" };
  }
  const match = (assessment.options || []).find((o) => o.id != null && o.id === chosenId);
  if (!match) {
    return { decision: "gather", chosen: null, reason: "no-valid-choice" };
  }
  return { decision: "proceed", chosen: match, reason: "user-disambiguated" };
}
