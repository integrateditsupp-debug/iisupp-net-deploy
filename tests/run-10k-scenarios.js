'use strict';
const { classify, looksLikeResolution } = require('./aria-classifier-mirror');
const corpus = require('./scenario-corpus-10k');

const t0 = Date.now();
const results = { total: corpus.length, pass: 0, fail: 0, failures: [], by_intent: {} };

corpus.forEach((item, idx) => {
  const q = item.q, expected = item.expect;
  let got, pass = false;
  if (expected === 'resolution') {
    got = looksLikeResolution(q) ? 'resolution' : 'NOT-resolution';
    pass = looksLikeResolution(q) === true;
  } else if (expected === 'not-resolution') {
    got = looksLikeResolution(q) ? 'resolution' : 'NOT-resolution';
    pass = looksLikeResolution(q) === false;
  } else if (expected === 'edge') {
    got = classify(q); pass = got === 'default';
  } else if (expected === 'weather/news') {
    got = classify(q); pass = got === 'weather' || got === 'news';
  } else {
    got = classify(q); pass = got === expected;
  }
  if (pass) results.pass++; else { results.fail++; results.failures.push({ q, expected, got, cat: item.cat || '' }); }
  results.by_intent[expected] = results.by_intent[expected] || { total: 0, pass: 0, fail: 0 };
  results.by_intent[expected].total++;
  if (pass) results.by_intent[expected].pass++; else results.by_intent[expected].fail++;
});

const dt = Date.now() - t0;
console.log('========== ARIA 10K-SCENARIO RESULTS ==========');
console.log('Total:', results.total, 'in', dt, 'ms  (' + (results.total/dt*1000).toFixed(0) + ' scen/sec)');
console.log('Pass:', results.pass, '(' + ((results.pass/results.total)*100).toFixed(1) + '%)');
console.log('Fail:', results.fail, '(' + ((results.fail/results.total)*100).toFixed(1) + '%)');
console.log('\n--- By expected intent ---');
const sorted = Object.entries(results.by_intent).sort((a,b) => b[1].total - a[1].total);
for (const [k, v] of sorted) {
  console.log('  ' + k.padEnd(25), v.pass + '/' + v.total, '(' + ((v.pass/v.total)*100).toFixed(0) + '%)');
}

// Auto-cluster top failure patterns
const clusters = {};
results.failures.forEach(f => {
  const key = f.expected + '→' + f.got;
  clusters[key] = clusters[key] || { count: 0, examples: [] };
  clusters[key].count++;
  if (clusters[key].examples.length < 3) clusters[key].examples.push(f.q.slice(0, 60));
});
const topClusters = Object.entries(clusters).sort((a,b) => b[1].count - a[1].count).slice(0, 25);
console.log('\n--- Top 25 failure clusters ---');
topClusters.forEach(([k, v]) => {
  console.log('  [' + String(v.count).padStart(4) + '] ' + k + '   e.g. "' + v.examples.join('" / "') + '"');
});

require('fs').writeFileSync(__dirname + '/last-10k-report.json', JSON.stringify({results, topClusters}, null, 2));
