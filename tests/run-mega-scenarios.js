'use strict';
const { classify, looksLikeResolution } = require('./aria-classifier-mirror');
const corpus = require('./scenario-corpus-mega');
<<<<<<< HEAD
const { isPass, evaluate } = require('./mega-eval');

const t0 = Date.now();
// Disposition logic lives in mega-eval.js (shared with the iis-tester ACC-1 check + the regression test).
const ev = evaluate(corpus, classify, looksLikeResolution);
const results = { total: ev.total, pass: ev.pass, fail: ev.fail, failures: [], by_intent: ev.by_intent };
for (const item of corpus) {
  if (results.failures.length >= 3000) break;
  if (!isPass(item, classify, looksLikeResolution)) {
    results.failures.push({ q: item.q.slice(0, 120), expected: item.expect, got: classify(item.q) });
  }
}
=======

const t0 = Date.now();
const results = { total: corpus.length, pass: 0, fail: 0, failures: [], by_intent: {} };

corpus.forEach((item) => {
  const q = item.q, expected = item.expect;
  let got, pass = false;
  if (expected === 'resolution') {
    pass = looksLikeResolution(q) === true; got = pass ? 'resolution' : 'NOT-resolution';
  } else if (expected === 'not-resolution') {
    pass = looksLikeResolution(q) === false; got = pass ? 'NOT-resolution' : 'resolution';
  } else if (expected === 'edge') {
    got = classify(q); pass = got === 'default';
  } else if (expected === 'weather/news') {
    got = classify(q); pass = got === 'weather' || got === 'news';
  } else {
    got = classify(q); pass = got === expected;
  }
  if (pass) results.pass++; else { results.fail++; if (results.failures.length < 3000) results.failures.push({ q: item.q.slice(0,120), expected, got }); }
  results.by_intent[expected] = results.by_intent[expected] || { total: 0, pass: 0, fail: 0 };
  results.by_intent[expected].total++;
  if (pass) results.by_intent[expected].pass++; else results.by_intent[expected].fail++;
});
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])

const dt = Date.now() - t0;
console.log('========== ARIA MEGA-SCENARIO RESULTS ==========');
console.log('Total:', results.total, 'in', dt, 'ms  (' + (results.total/dt*1000).toFixed(0) + ' scen/sec)');
console.log('Pass:', results.pass, '(' + ((results.pass/results.total)*100).toFixed(1) + '%)');
console.log('Fail:', results.fail, '(' + ((results.fail/results.total)*100).toFixed(1) + '%)');
console.log('\n--- By expected intent (sorted by volume) ---');
const sorted = Object.entries(results.by_intent).sort((a,b) => b[1].total - a[1].total);
for (const [k, v] of sorted) console.log('  ' + k.padEnd(25), v.pass + '/' + v.total, '(' + ((v.pass/v.total)*100).toFixed(0) + '%)');

require('fs').writeFileSync(__dirname + '/last-mega-report.json', JSON.stringify(results, null, 2));
