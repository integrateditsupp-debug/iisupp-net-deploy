#!/usr/bin/env node
/**
 * measure-kb-selftest.mjs — ARIA offline-KB self-test (reproducible, auditable).
 *
 * WHAT THIS MEASURES — three separate numbers, because one number would lie:
 *
 *   1. IN-SCOPE DEFLECTION
 *      Of real IT-support questions, how many does ARIA's OFFLINE knowledge base
 *      answer instantly — zero AI calls, zero network, zero human?
 *      Higher is better.
 *
 *   2. OUT-OF-SCOPE FALSE-ANSWER RATE
 *      Of questions that are NOT IT support ("bitcoin price", "what's the weather"),
 *      how many did the KB wrongly answer anyway?
 *      MUST be 0%. A support bot confidently answering a stock-price question is a
 *      defect, not coverage.
 *
 *   3. CONTROL FALSE-FIRE RATE (hijacks)
 *      Of dialogue-layer turns ("solved", "still not working", "talk to a human"),
 *      how many did the KB answer with the WRONG intent — e.g. firing a printer fix
 *      at someone who said "thanks, that worked"?
 *      MUST be 0%.
 *
 * WHAT THIS DOES **NOT** MEASURE:
 *   - End-to-end ticket resolution (that is KB + LLM + recipes + human).
 *   - Endpoint remediation (ARIA Sentinel actually changing the machine).
 *   - Customer-validated production outcomes. This is a SELF-TEST on a public corpus.
 *
 * Rule 14: the numbers this prints are the numbers we publish. Nothing else.
 *
 * Inputs (both committed, both auditable, both in this repo):
 *   assets/aria-knowledge-base.js   — the exact regex KB shipped to the browser
 *   tests/scenario-corpus.js        — real-phrased user inputs + expected intent
 *
 * Usage:
 *   node tools/measure-kb-selftest.mjs
 *   node tools/measure-kb-selftest.mjs --write     (updates tests/kb-selftest-result.json)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

const KB_PATH = join(ROOT, 'assets', 'aria-knowledge-base.js');
const CORPUS_PATH = join(ROOT, 'tests', 'scenario-corpus.js');
const OUT_PATH = join(ROOT, 'tests', 'kb-selftest-result.json');

// ── Scope map ───────────────────────────────────────────────────────────────
// IN_SCOPE      : real IT-support questions. KB answering = deflection (good).
// OUT_OF_SCOPE  : not IT support at all.     KB answering = false answer (bad).
// CONTROL       : dialogue-layer turns.      KB answering with the WRONG intent = hijack (bad).
// MIXED         : the corpus `default` bucket — reported, never scored. See below.
//
// SCORING CORRECTION 2026-07-14 — two bugs found, BOTH in this harness, not in the KB:
//
//   BUG 1 — `default` was scored as CONTROL. It is not a control bucket. It is the corpus's
//   unlabelled grab-bag and it provably holds BOTH dialogue turns ("hi", "yo") AND real
//   support questions ("laptop won't turn on", "taskbar missing", "keyboard not typing").
//   When the KB answers a real support question sitting in there, that is CORRECT — yet it
//   was counted as a defect. Neither firing nor abstaining is provably right for a mixed
//   bucket, so scoring it in the headline in EITHER direction would be dishonest. It is now
//   reported in full, separately, and excluded from the headline. Nothing is hidden.
//
//   BUG 2 — any KB hit on a `resolution` turn was counted as a false fire, even though the
//   KB's resolution entry replies with intent 'resolution' (resolved: true) — the exactly
//   correct response to "thanks, that worked". A false fire is a HIJACK: answering a dialogue
//   turn with the WRONG intent. We now score intent-match, not merely fired/didn't-fire.
//
// This does NOT flatter the KB: the one genuine defect the harness caught (out-of-scope
// "bitcoin price" answered with our pricing sheet) was FIXED in the KB, not scored away.
const OUT_OF_SCOPE = new Set(['shopping', 'weather/news', 'news', 'trade', 'quote']);
const CONTROL = new Set(['resolution', 'not-resolution', 'escalation', 'edge', 'voice']);
const MIXED = new Set(['default']);
const scopeOf = (intent) =>
  OUT_OF_SCOPE.has(intent) ? 'out_of_scope'
    : CONTROL.has(intent) ? 'control'
    : MIXED.has(intent) ? 'mixed'
    : 'in_scope';

// A KB hit on a control turn is a FALSE FIRE only if the KB replied with the wrong intent.
//   "thanks that worked" -> intent 'resolution'  = correct
//   "thanks that worked" -> a printer fix        = hijack
const CORRECT_CONTROL_INTENT = { resolution: 'resolution' };
const isHijack = (expect, hit) => CORRECT_CONTROL_INTENT[expect] !== (hit.intent || 'fix');

// ── 1. Load the REAL browser KB in a sandbox. No mocks of the logic.
const kbSource = readFileSync(KB_PATH, 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(kbSource, sandbox, { filename: 'aria-knowledge-base.js' });
const ARIA_KB = sandbox.window.ARIA_KB;
if (!ARIA_KB || typeof ARIA_KB.lookup !== 'function') {
  console.error('FAIL: window.ARIA_KB.lookup not found in assets/aria-knowledge-base.js');
  process.exit(1);
}

// ── 2. Load corpus, dedupe case-insensitively.
//      The corpus deliberately pads itself with ALL-CAPS / Capitalised copies of every
//      entry. Counting those as distinct questions would inflate n without adding a single
//      new phrasing. We measure on UNIQUE questions only; casing robustness is asserted
//      separately below.
const rawCorpus = require(CORPUS_PATH);
const seen = new Set();
const corpus = [];
for (const item of rawCorpus) {
  const key = String(item.q).trim().toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  corpus.push({ q: item.q, expect: item.expect, scope: scopeOf(item.expect) });
}

// ── 3. Measure.
const scopes = {
  in_scope: { total: 0, fired: 0 },
  out_of_scope: { total: 0, fired: 0 },
  control: { total: 0, fired: 0 },
  mixed: { total: 0, fired: 0 },
};
const byIntent = new Map();
const inScopeAnswered = [];
const falseAnswers = []; // out-of-scope answered, or control hijacked = real defects
const mixedFired = [];   // corpus `default` grab-bag: reported, never scored

for (const { q, expect, scope } of corpus) {
  const hit = ARIA_KB.lookup(q);
  scopes[scope].total++;

  const b = byIntent.get(expect) || { intent: expect, scope, total: 0, fired: 0, misses: [] };
  b.total++;

  if (hit) {
    scopes[scope].fired++;
    b.fired++;
    if (scope === 'in_scope') {
      inScopeAnswered.push({ q, expect });
    } else if (scope === 'out_of_scope') {
      falseAnswers.push({ q, expect, scope, wronglyMatchedCategory: hit.category, kbIntent: hit.intent });
    } else if (scope === 'control' && isHijack(expect, hit)) {
      falseAnswers.push({ q, expect, scope, wronglyMatchedCategory: hit.category, kbIntent: hit.intent });
    } else if (scope === 'mixed') {
      mixedFired.push({ q, kbIntent: hit.intent, category: hit.category });
    }
  } else if (scope === 'in_scope') {
    b.misses.push(q);
  }
  byIntent.set(expect, b);
}

const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : 0);

const controlHijacks = falseAnswers.filter((d) => d.scope === 'control').length;
const deflectionPct = pct(scopes.in_scope.fired, scopes.in_scope.total);
const falseAnswerPct = pct(scopes.out_of_scope.fired, scopes.out_of_scope.total);
const falseFirePct = pct(controlHijacks, scopes.control.total);

// ── 4. Case-stability: every KB regex is /i, so an ALL-CAPS restatement of an answered
//      question must still be answered.
const caseStable = inScopeAnswered.every(({ q }) => !!ARIA_KB.lookup(q.toUpperCase()));

const intents = [...byIntent.values()]
  .map((b) => ({
    intent: b.intent,
    scope: b.scope,
    total: b.total,
    fired: b.fired,
    pct: pct(b.fired, b.total),
    sampleMisses: b.scope === 'in_scope' ? b.misses.slice(0, 3) : [],
  }))
  .sort((a, b) => b.total - a.total);

const inScopeIntents = intents.filter((i) => i.scope === 'in_scope');
const zeroCoverage = inScopeIntents.filter((i) => i.fired === 0).map((i) => i.intent);

const result = {
  measuredAt: new Date().toISOString(),
  harness: 'tools/measure-kb-selftest.mjs',
  measures:
    'offline-KB instant deflection + false-answer safety. NOT end-to-end resolution, NOT endpoint remediation, NOT customer-validated.',
  inputs: {
    kb: 'assets/aria-knowledge-base.js',
    kbPatternCount: ARIA_KB.KB.length,
    corpus: 'tests/scenario-corpus.js',
    corpusRawEntries: rawCorpus.length,
    uniqueQuestions: corpus.length,
  },
  headline: {
    inScopeDeflectionPct: deflectionPct,
    inScopeN: scopes.in_scope.total,
    inScopeAnswered: scopes.in_scope.fired,
    outOfScopeFalseAnswerPct: falseAnswerPct,
    outOfScopeN: scopes.out_of_scope.total,
    controlFalseFirePct: falseFirePct,
    controlN: scopes.control.total,
    caseStable,
  },
  unscoredMixedBucket: {
    why: "corpus intent 'default' is an unlabelled grab-bag holding BOTH dialogue turns ('hi') and real support questions ('laptop won't turn on'). Neither firing nor abstaining is provably correct for it, so it is reported here and EXCLUDED from the headline rather than scored in either direction.",
    n: scopes.mixed.total,
    kbFired: scopes.mixed.fired,
    firedExamples: mixedFired.slice(0, 12),
  },
  defects: falseAnswers,
  intents,
  zeroCoverageInScopeIntents: zeroCoverage,
};

const line = '-'.repeat(70);
console.log(line);
console.log('ARIA OFFLINE-KB SELF-TEST - three numbers, because one would lie');
console.log(line);
console.log(`KB patterns          : ${ARIA_KB.KB.length}`);
console.log(`Unique questions     : ${corpus.length}  (from ${rawCorpus.length} raw corpus entries)`);
console.log('');
console.log(`1. IN-SCOPE DEFLECTION      : ${deflectionPct}%  (${scopes.in_scope.fired}/${scopes.in_scope.total})   higher = better`);
console.log(`2. OUT-OF-SCOPE FALSE ANSWER: ${falseAnswerPct}%  (${scopes.out_of_scope.fired}/${scopes.out_of_scope.total})   MUST be 0`);
console.log(`3. CONTROL FALSE FIRE       : ${falseFirePct}%  (${controlHijacks}/${scopes.control.total})   MUST be 0`);
console.log(`   Case-stable (ALL-CAPS)   : ${caseStable ? 'yes' : 'NO - regression'}`);
console.log('');
console.log(`UNSCORED mixed bucket       : corpus 'default' n=${scopes.mixed.total}, KB fired on ${scopes.mixed.fired}.`);
console.log(`   Excluded from the headline: it holds BOTH dialogue turns and real support questions,`);
console.log(`   so neither firing nor abstaining is provably correct. Reported, never scored.`);
console.log('');
console.log('IN-SCOPE COVERAGE BY INTENT (lowest first):');
for (const i of inScopeIntents.slice().sort((a, b) => a.pct - b.pct)) {
  console.log(`  ${String(i.pct + '%').padStart(7)}  ${String(i.fired + '/' + i.total).padEnd(7)} ${i.intent}`);
}
if (zeroCoverage.length) {
  console.log('');
  console.log(`In-scope intents with ZERO coverage (${zeroCoverage.length}): ${zeroCoverage.join(', ')}`);
}
console.log('');
if (falseAnswers.length) {
  console.log(`DEFECTS - KB wrongly fired on ${falseAnswers.length} non-support input(s):`);
  for (const d of falseAnswers.slice(0, 12)) {
    console.log(`  [${d.scope}/${d.expect}] "${d.q}"  -> wrongly matched '${d.wronglyMatchedCategory}'`);
  }
  if (falseAnswers.length > 12) console.log(`  ... and ${falseAnswers.length - 12} more (see tests/kb-selftest-result.json)`);
} else {
  console.log('DEFECTS: none. 0 out-of-scope false answers, 0 control hijacks.');
}
console.log(line);
console.log('This measures the offline instant-answer layer ONLY.');
console.log('It is a self-test on a public corpus, not a customer-validated resolution rate.');
console.log(line);

if (process.argv.includes('--write')) {
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n');
  console.log(`wrote ${OUT_PATH}`);
}
