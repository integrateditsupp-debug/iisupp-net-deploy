'use strict';
const { classify, looksLikeResolution } = require('./aria-classifier-mirror');
const corpus = require('./scenario-corpus');

const results = {
  total: corpus.length,
  pass: 0,
  fail: 0,
  failures: [],
  by_intent: {}
};

corpus.forEach((item, idx) => {
  const q = item.q;
  const expected = item.expect;
  let got;
  let pass = false;

  if (expected === 'resolution') {
    got = looksLikeResolution(q) ? 'resolution' : 'NOT-resolution';
    pass = looksLikeResolution(q) === true;
  } else if (expected === 'not-resolution') {
    got = looksLikeResolution(q) ? 'resolution' : 'NOT-resolution';
    pass = looksLikeResolution(q) === false;
  } else if (expected === 'edge') {
    // Edge cases: classifier should return 'default' on empty/punctuation only
    got = classify(q);
    pass = got === 'default';
  } else if (expected === 'weather/news') {
    got = classify(q);
    pass = got === 'weather' || got === 'news';
  } else {
    got = classify(q);
    pass = got === expected;
  }

  if (pass) results.pass++;
  else {
    results.fail++;
    results.failures.push({ idx, q, expected, got });
  }

  results.by_intent[expected] = results.by_intent[expected] || { total: 0, pass: 0, fail: 0 };
  results.by_intent[expected].total++;
  if (pass) results.by_intent[expected].pass++;
  else results.by_intent[expected].fail++;
});

console.log('\n========== ARIA 1000-SCENARIO TEST RESULTS ==========');
console.log('Total scenarios:', results.total);
console.log('Pass:', results.pass, '(' + ((results.pass/results.total)*100).toFixed(1) + '%)');
console.log('Fail:', results.fail, '(' + ((results.fail/results.total)*100).toFixed(1) + '%)');

console.log('\n--- By expected intent ---');
const sorted = Object.entries(results.by_intent).sort((a,b) => (b[1].total - a[1].total));
for (const [intent, stats] of sorted) {
  const pct = ((stats.pass / stats.total) * 100).toFixed(0);
  console.log(`  ${intent.padEnd(25)} ${stats.pass}/${stats.total} (${pct}%)`);
}

console.log('\n--- Top 50 failures (first 50) ---');
for (const f of results.failures.slice(0, 50)) {
  console.log(`  expected=${f.expected.padEnd(20)} got=${f.got.padEnd(20)} q="${f.q}"`);
}

if (results.failures.length > 50) {
  console.log(`  ... and ${results.failures.length - 50} more failures`);
}

// Save JSON report
require('fs').writeFileSync(
  __dirname + '/last-run-report.json',
  JSON.stringify(results, null, 2)
);
console.log('\nFull report saved to tests/last-run-report.json');
