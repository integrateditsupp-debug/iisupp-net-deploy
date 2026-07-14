// STAGE 3 S3 / BRAIN-AUDIT F3 — MULTI-HYPOTHESIS REASONING.
// The old brain used matches[0] and threw #2 and #3 away. If the top fuzzy match was wrong, the whole
// fix chain was wrong — and the user watched us confidently break the wrong thing. Fix: when the top-2
// hypotheses are CLOSE, we do not guess and we do not run three fixes hoping one lands. We ask ONE
// disambiguating question. One good question beats three wrong fixes.
//
// Rules: exactly ONE question (never an interrogation) · we only ask when it actually changes the plan
// (a clear winner is never questioned) · options are the REAL top-2 matches, never invented ·
// 🔒 R11 — the user's raw text is never echoed back into the question; options are KB titles only.
import { isBlockedPath, redactPrivate } from "./path-guard.mjs";

// Below this absolute gap the top-2 are "too close to call" (fuzzy scores are 0..1).
export const AMBIGUITY_GAP = 0.15;
// Below this, even the winner is a weak guess — say so instead of pretending.
export const WEAK_MATCH_MAX = 0.25;

/** Normalise ranked matches → hypotheses with an honest relative confidence. */
export function hypotheses(matches = []) {
  const list = (Array.isArray(matches) ? matches : []).filter((m) => m && m.id).slice(0, 3);
  const total = list.reduce((s, m) => s + (Number(m.score) || 0), 0);
  return list.map((m) => ({
    id: String(m.id),
    title: redactPrivate(String(m.title || m.id)),
    score: Number(m.score) || 0,
    // Share of the matched mass. Honest and bounded — NOT a probability we cannot justify.
    confidence: total > 0 ? Number(((Number(m.score) || 0) / total).toFixed(3)) : 0
  }));
}

/** Are the top-2 too close to act on? (One match, or a clear winner, is never ambiguous.) */
export function isAmbiguous(matches = [], gap = AMBIGUITY_GAP) {
  const h = hypotheses(matches);
  if (h.length < 2) return false;
  return (h[0].score - h[1].score) < gap;
}

/**
 * The ONE question. Returns null when there is nothing worth asking — the caller must then proceed
 * with the top hypothesis exactly as before (this module never blocks a confident diagnosis).
 * @returns {null | {ask:true, question:string, options:Array<{id,title,label}>, reason:string}}
 */
export function disambiguationQuestion(matches = [], { gap = AMBIGUITY_GAP } = {}) {
  const h = hypotheses(matches);
  if (!h.length) return null;
  if (h[0].score <= WEAK_MATCH_MAX) {
    // Honest weak-match path: we do not pretend to two good theories when we have none.
    return {
      ask: true,
      reason: "weak-match",
      question: "I'm not confident I've understood the problem yet — which of these is closest to what you're seeing?",
      options: h.map((x) => ({ id: x.id, title: x.title, label: x.title })).concat([{ id: "none-of-these", title: "None of these", label: "None of these — let me describe it again" }])
    };
  }
  if (!isAmbiguous(matches, gap)) return null; // clear winner → no question, no delay
  const [a, b] = h;
  return {
    ask: true,
    reason: "top-2-too-close",
    question: `Two things could explain this and the fixes are different — which fits better: "${a.title}" or "${b.title}"?`,
    options: [
      { id: a.id, title: a.title, label: a.title },
      { id: b.id, title: b.title, label: b.title },
      { id: "unsure", title: "Not sure", label: "Not sure — investigate before changing anything" }
    ]
  };
}

/**
 * Resolve the user's answer back to a hypothesis id.
 * "unsure"/"none-of-these" → NO fix is chosen (investigate-first), never a silent fall-back to top-1.
 */
export function resolveAnswer(answerId, matches = []) {
  const id = String(answerId || "");
  if (isBlockedPath(id)) return { chosen: null, action: "blocked" };                 // 🔒 R11
  if (!id || id === "unsure" || id === "none-of-these") return { chosen: null, action: "investigate" };
  const h = hypotheses(matches).find((x) => x.id === id);
  return h ? { chosen: h.id, action: "proceed" } : { chosen: null, action: "investigate" };
}

/** The decision the reasoner attaches to a diagnosis: act, or ask ONE question first. */
export function hypothesisDecision(matches = [], { gap = AMBIGUITY_GAP } = {}) {
  const q = disambiguationQuestion(matches, { gap });
  const h = hypotheses(matches);
  if (!h.length) return { action: "need-info", hypotheses: h, question: null };
  if (q) return { action: "ask-one-question", hypotheses: h, question: q };
  return { action: "proceed", hypotheses: h, question: null, chosen: h[0].id };
}
