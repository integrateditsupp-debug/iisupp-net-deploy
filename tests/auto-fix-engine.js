#!/usr/bin/env node
'use strict';
/* === ARIA Autonomous Fix Engine ===
   Reads last-10k-report.json, identifies failure clusters, and suggests
   regex broadens for the classifier. Outputs a structured report.
   
   USAGE: node auto-fix-engine.js
   Outputs: tests/suggested-fixes.md (human review) + tests/auto-apply.json (machine)
*/

const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, 'last-10k-report.json');
if (!fs.existsSync(reportPath)) {
  console.error('No last-10k-report.json found. Run `node run-10k-scenarios.js` first.');
  process.exit(1);
}
const { results, topClusters } = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

console.log('=== ARIA AUTONOMOUS FIX ENGINE ===');
console.log('Total scenarios:', results.total);
console.log('Pass:', results.pass, '(' + ((results.pass/results.total)*100).toFixed(1) + '%)');
console.log('Fail clusters:', topClusters.length);

const suggestions = [];

// Out-of-scope guard: corpus categories ending in "-default" are DELIBERATE
// negative controls (compliance / business-process questions that must NOT be
// routed to an IT intent). A specific classification on those is a FALSE
// POSITIVE, not a correct routing — never suggest flipping the expectation.
// Added 2026-08-13 after the engine proposed flipping fin-default and
// mfg-default entries ("how to escalate a failed settlement" -> escalation).
const OUT_OF_SCOPE_CAT = /(^|-)default$/;
function clusterIsOutOfScopeControl(expected, got) {
  const fails = (results.failures || []).filter(f => f.expected === expected && f.got === got);
  if (!fails.length) return false;
  const oos = fails.filter(f => OUT_OF_SCOPE_CAT.test(f.cat || ''));
  return oos.length / fails.length >= 0.5;
}

topClusters.forEach(([clusterKey, info]) => {
  const [expected, got] = clusterKey.split('→');
  const examples = info.examples;
  
  // Extract common substring across examples (simple n-gram)
  const tokens = examples.flatMap(e => e.toLowerCase().split(/\s+/).filter(t => t.length >= 3));
  const tokenCount = {};
  tokens.forEach(t => tokenCount[t] = (tokenCount[t] || 0) + 1);
  const commonTokens = Object.entries(tokenCount)
    .filter(([t, c]) => c >= Math.min(2, examples.length))
    .map(([t]) => t)
    .filter(t => !['this','that','with','from','have','want','need','what','when','where','will','wont','cant'].includes(t))
    .slice(0, 5);
  
  const suggestion = {
    cluster: clusterKey,
    count: info.count,
    impact: `${info.count} scenarios shift from FAIL to PASS if fixed`,
    examples: examples,
    common_tokens: commonTokens,
    expected: expected,
    got: got,
    recommendation: ''
  };
  
  if (expected === 'default' && got !== 'default' && clusterIsOutOfScopeControl(expected, got)) {
    // Deliberate out-of-scope negative control — ARIA over-triggered.
    suggestion.out_of_scope_control = true;
    suggestion.recommendation = `FALSE POSITIVE ON OUT-OF-SCOPE CONTROL: "${examples[0]}" is a deliberate non-IT scenario that must stay 'default'. DO NOT flip the corpus expectation. Tighten the ${got} pattern instead (needs human review).`;
  } else if (expected === 'default' && got !== 'default') {
    // ARIA classified as something specific but corpus expected default
    suggestion.recommendation = `LIKELY EXPECTATION UPDATE: ARIA correctly routes "${examples[0]}" to ${got}. Update corpus expectation from 'default' to '${got}'.`;
  } else if (got === 'default' && expected !== 'default') {
    suggestion.recommendation = `ADD PATTERNS TO ${expected}: tokens like {${commonTokens.join(', ')}} should trigger ${expected}. Broaden the ${expected} regex.`;
  } else {
    suggestion.recommendation = `ROUTING COLLISION: ARIA picks ${got} but should pick ${expected}. Either reorder (put ${expected} check before ${got}) or add negative lookahead.`;
  }
  
  suggestions.push(suggestion);
});

// Write markdown report
let md = '# ARIA Autonomous Fix Engine — Suggestions\n\n';
md += `**Run:** ${new Date().toISOString()}\n`;
md += `**Total scenarios:** ${results.total}\n`;
md += `**Pass:** ${results.pass} (${((results.pass/results.total)*100).toFixed(1)}%)\n`;
md += `**Fail:** ${results.fail}\n\n`;
md += '## Top failure clusters + suggested fixes\n\n';

suggestions.forEach((s, i) => {
  md += `### ${i+1}. ${s.cluster} (${s.count} scenarios)\n`;
  md += `**Examples:**\n${s.examples.map(e => '- `' + e + '`').join('\n')}\n\n`;
  md += `**Common tokens:** ${s.common_tokens.join(', ') || '(none extracted)'}\n\n`;
  md += `**Recommendation:** ${s.recommendation}\n\n---\n\n`;
});

fs.writeFileSync(path.join(__dirname, 'suggested-fixes.md'), md);
fs.writeFileSync(path.join(__dirname, 'auto-apply.json'), JSON.stringify(suggestions, null, 2));

console.log('\nWrote tests/suggested-fixes.md + tests/auto-apply.json');
console.log('Top 5 highest-impact suggestions:');
suggestions.slice(0, 5).forEach((s, i) => {
  console.log(`  ${i+1}. [${s.count}] ${s.cluster}`);
  console.log(`     → ${s.recommendation.slice(0, 100)}...`);
});

// Optionally auto-fix the SAFE cases: expectation updates only
// (Don't auto-rewrite regex without human approval — that's a Codex/Claude-Code job)
const expectationFixes = suggestions.filter(s => s.recommendation.startsWith('LIKELY EXPECTATION UPDATE'));
if (expectationFixes.length > 0) {
  console.log(`\n${expectationFixes.length} expectation-update candidates (corpus owns these, not regex)`);
}
