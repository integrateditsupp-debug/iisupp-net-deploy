'use strict';
const { classify, looksLikeResolution } = require('./aria-classifier-mirror');
const corpus = require('./scenario-corpus-mega');
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

const dt = Date.now() - t0;
console.log('========== ARIA MEGA-SCENARIO RESULTS ==========');
console.log('Total:', results.total, 'in', dt, 'ms  (' + (results.total/dt*1000).toFixed(0) + ' scen/sec)');
console.log('Pass:', results.pass, '(' + ((results.pass/results.total)*100).toFixed(1) + '%)');
console.log('Fail:', results.fail, '(' + ((results.fail/results.total)*100).toFixed(1) + '%)');
console.log('\n--- By expected intent (sorted by volume) ---');
const sorted = Object.entries(results.by_intent).sort((a,b) => b[1].total - a[1].total);
for (const [k, v] of sorted) console.log('  ' + k.padEnd(25), v.pass + '/' + v.total, '(' + ((v.pass/v.total)*100).toFixed(0) + '%)');

require('fs').writeFileSync(__dirname + '/last-mega-report.json', JSON.stringify(results, null, 2));
