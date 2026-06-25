'use strict';
/* Single source of truth for how a corpus item is judged. Used by run-mega-scenarios.js, the
   iis-tester ACC-1 check, and the per-intent regression test, so "accuracy" is computed the SAME
   way everywhere — no drift between the reporting harness and the CI gate. (Q-QA1 / C-1 + H-1.) */

function isPass(item, classify, looksLikeResolution) {
  const q = item.q, expected = item.expect;
  if (expected === 'resolution') return looksLikeResolution(q) === true;
  if (expected === 'not-resolution') return looksLikeResolution(q) === false;
  if (expected === 'edge') return classify(q) === 'default';
  if (expected === 'weather/news') { const g = classify(q); return g === 'weather' || g === 'news'; }
  return classify(q) === expected;
}

function evaluate(corpus, classify, looksLikeResolution) {
  const by_intent = {};
  let pass = 0;
  for (const item of corpus) {
    const ok = isPass(item, classify, looksLikeResolution);
    const k = item.expect;
    (by_intent[k] = by_intent[k] || { total: 0, pass: 0, fail: 0 }).total++;
    if (ok) { by_intent[k].pass++; pass++; } else { by_intent[k].fail++; }
  }
  return { total: corpus.length, pass, fail: corpus.length - pass, by_intent };
}

module.exports = { isPass, evaluate };
