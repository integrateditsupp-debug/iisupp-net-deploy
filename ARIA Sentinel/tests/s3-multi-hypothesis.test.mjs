// STAGE 3 S3 / BRAIN-AUDIT F3 — MULTI-HYPOTHESIS. The old brain acted on matches[0] and threw #2 away;
// when the top guess was wrong it confidently fixed the wrong thing. Contract locked here:
//   • top-2 too close → ONE disambiguating question (never two, never an interrogation, never a guess);
//   • a clear winner is NEVER questioned (we do not add friction to a confident diagnosis);
//   • a weak top match says so honestly instead of pretending to a theory;
//   • "not sure" → investigate, never a silent fall-back to the top guess;
//   • 🔒 R11 — the user's raw text is never echoed into the question, and a blocked answer is refused.
import assert from "node:assert/strict";
import { hypotheses, isAmbiguous, disambiguationQuestion, resolveAnswer, hypothesisDecision, AMBIGUITY_GAP } from "../src/shared/multi-hypothesis.mjs";
import { diagnose } from "../src/shared/diagnostic-reasoner.mjs";

const close = [
  { id: "printer-issues", title: "Printer not printing", score: 0.52 },
  { id: "no-internet", title: "No internet connection", score: 0.47 },
  { id: "audio-issues", title: "No sound", score: 0.10 }
];
const clear = [
  { id: "printer-issues", title: "Printer not printing", score: 0.81 },
  { id: "no-internet", title: "No internet connection", score: 0.22 }
];

// 1 — #2 and #3 are KEPT, with an honest, bounded confidence (share of the matched mass).
const h = hypotheses(close);
assert.equal(h.length, 3, "the runners-up are no longer discarded");
assert.ok(h[0].confidence > 0 && h[0].confidence < 1);
assert.ok(Math.abs(h.reduce((s, x) => s + x.confidence, 0) - 1) < 0.01);

// 2 — close → ambiguous; clear → not. One match is never "ambiguous".
assert.equal(isAmbiguous(close), true);
assert.equal(isAmbiguous(clear), false);
assert.equal(isAmbiguous([clear[0]]), false);
assert.ok(AMBIGUITY_GAP > 0);

// 3 — exactly ONE question, built from the REAL top-2, plus an honest escape hatch.
const q = disambiguationQuestion(close);
assert.equal(q.ask, true);
assert.equal(q.reason, "top-2-too-close");
assert.equal(typeof q.question, "string");
assert.equal((q.question.match(/\?/g) || []).length, 1, "ONE question mark — one question, not three");
assert.ok(q.question.includes("Printer not printing") && q.question.includes("No internet connection"));
assert.equal(q.options.length, 3);
assert.deepEqual(q.options.map((o) => o.id), ["printer-issues", "no-internet", "unsure"]);

// 4 — a clear winner is never questioned: no friction on a confident diagnosis.
assert.equal(disambiguationQuestion(clear), null);
const dec = hypothesisDecision(clear);
assert.equal(dec.action, "proceed");
assert.equal(dec.chosen, "printer-issues");

// 5 — a weak top match is admitted, not dressed up.
const weak = disambiguationQuestion([{ id: "a", title: "Something vague", score: 0.12 }]);
assert.equal(weak.reason, "weak-match");
assert.ok(weak.options.some((o) => o.id === "none-of-these"));

// 6 — "not sure" → INVESTIGATE. Never a silent fall-back to the top guess.
assert.deepEqual(resolveAnswer("unsure", close), { chosen: null, action: "investigate" });
assert.deepEqual(resolveAnswer("none-of-these", close), { chosen: null, action: "investigate" });
assert.deepEqual(resolveAnswer("no-internet", close), { chosen: "no-internet", action: "proceed" });
assert.deepEqual(resolveAnswer("made-up-id", close), { chosen: null, action: "investigate" });
// 🔒 R11
assert.deepEqual(resolveAnswer("C:\\Private pics and Vids", close), { chosen: null, action: "blocked" });

// 7 — the reasoner now carries it, ADDITIVELY (every field it returned before still means what it meant).
{
  const kb = [
    { id: "slow-performance", title: "Computer is slow", phrasings: ["computer is slow"], causes: [{ detection: "memory", probability: 60 }] },
    { id: "app-hang", title: "Computer freezes", phrasings: ["computer freezes"], causes: [{ detection: "cpu", probability: 55 }] }
  ];
  // Genuinely ambiguous phrasing: it matches BOTH KB entries equally well.
  const d = diagnose("computer slow and freezes", kb, {});
  assert.ok(Array.isArray(d.matches) && d.topSymptom, "the old contract is intact");
  assert.ok(Array.isArray(d.hypotheses) && d.hypotheses.length >= 2, "and the runners-up now come with it");
  assert.equal(d.ambiguous, true);
  assert.equal(d.nextAction, "ask-one-question");
  assert.equal((d.question.question.match(/\?/g) || []).length, 1);
  // R11: the raw user text never comes back out inside the question.
  const d2 = diagnose("computer slow and freezes in C:\\Private pics and Vids", kb, {});
  assert.ok(!/Private pics and Vids/i.test(JSON.stringify(d2.question || {})));

  const dClear = diagnose("computer freezes", kb, {});
  assert.equal(dClear.ambiguous, false);
  assert.equal(dClear.nextAction, "proceed");
  assert.equal(dClear.question, null);
}

console.log("s3-multi-hypothesis test passed (runners-up kept · ONE question only when it changes the plan · weak match admitted · unsure → investigate · reasoner additive · R11 first).");
