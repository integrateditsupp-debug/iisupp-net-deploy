// tests/axis-blind-guards.test.mjs — guard the guards (2026-08-12).
//
// Memory already carries this as `source-grep-guards-go-blind`: "fixed-offset/literal test anchors
// rot into no-ops that still report green". It recurred three times in a single session, always the
// same way — an assertion written to forbid something matched the COMMENT explaining why the thing
// was absent:
//
//   assert.ok(!/\*>> \$Log/.test(runner))        // matched "...rather than `*>> $Log`, because..."
//   assert.ok(!/shell:\s*true/.test(runner))     // matched "...with shell:true Node concatenates..."
//   assert.ok(!/--mcp-config/.test(worker))      // matched "...with no --mcp-config means..."
//
// Each was unfixable-by-construction: the better the comment, the more certainly the guard failed.
// The mirror-image case is worse and silent — a guard that matches ONLY a comment passes forever
// while asserting nothing about the code.
//
// This test scans every axis test for source-grep assertions and reports any whose pattern matches
// the target file's comments but not its code. A green test that asserts nothing is the purest form
// of the bug it was meant to prevent.
//
// Run: node tests/axis-blind-guards.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(root, 'tests');
const self = path.basename(fileURLToPath(import.meta.url));

// Strip line comments, block comments, and markdown-ish prose lines. Deliberately conservative:
// a false "this is code" reading only makes the check quieter, never noisier.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/)
    .map((l) => (/^\s*(\/\/|#|\*)/.test(l) ? '' : l.replace(/\s\/\/.*$/, '')))
    .join('\n');
}

// Which repo files does this test read? Matches the readFileSync(path.join(root, 'a', 'b')) shape
// used throughout the suite.
function targetsOf(testSrc) {
  const out = new Set();
  const re = /readFileSync\(\s*path\.join\(\s*(?:root|ROOT)\s*,\s*([^)]*?)\)\s*,/g;
  let m;
  while ((m = re.exec(testSrc))) {
    const parts = [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] || x[2]);
    if (parts.length) out.add(path.join(root, ...parts));
  }
  return [...out];
}

// Regex and string literals used inside an assert on the same line.
function assertionLiterals(testSrc) {
  const lits = [];
  const lines = testSrc.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/assert\b/.test(line)) continue;
    if (/^\s*(\/\/|\*)/.test(line)) continue;
    // POSITIVE assertions only. A negative guard (`assert.ok(!/x/.test(src))`) that matches a
    // comment fails immediately and loudly — it announces itself and gets fixed, as all three
    // instances this session did. The dangerous class is the positive assertion that matches only
    // a comment: it passes forever while checking nothing, and nobody ever looks at it again.
    const negated = /assert\.ok\(\s*!/.test(line);
    if (negated) continue;
    for (const m of line.matchAll(/\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/[gimsuy]*/g)) {
      lits.push({ line: i + 1, kind: 'regex', body: m[1] });
    }
    for (const m of line.matchAll(/\.includes\(\s*'([^']{4,})'\s*\)/g)) {
      lits.push({ line: i + 1, kind: 'string', body: m[1] });
    }
  }
  return lits;
}

function matches(kind, body, text) {
  try {
    if (kind === 'regex') return new RegExp(body).test(text);
    return text.includes(body);
  } catch { return false; }
}

const files = fs.readdirSync(testsDir).filter((f) => /^axis-.*\.test\.mjs$/.test(f) && f !== self);
const blind = [];
let scanned = 0, checked = 0;

for (const f of files) {
  const testSrc = fs.readFileSync(path.join(testsDir, f), 'utf8');
  const targets = targetsOf(testSrc).filter((p) => fs.existsSync(p));
  if (!targets.length) continue;
  scanned++;
  const lits = assertionLiterals(testSrc);
  for (const lit of lits) {
    // Ignore trivially generic patterns; they match everything and prove nothing either way.
    if (lit.body.length < 6) continue;
    // A pattern containing `//` is deliberately anchoring on a comment — usually a code line plus
    // its trailing note. The author knew; that is not an accident to report. Inside a regex literal
    // the slashes arrive escaped (`\/\/`), so both spellings have to be recognised.
    if (lit.body.includes('//') || lit.body.includes('\\/\\/')) continue;
    // A test often reads several files. Attributing the literal to the FIRST one that happens to
    // contain it produced false positives — the assertion may be aimed at a different target
    // entirely. Only flag when the pattern is comments-only in EVERY file it appears in at all;
    // if any target has it in real code, the guard is doing its job somewhere.
    const hits = [];
    for (const t of targets) {
      const raw = fs.readFileSync(t, 'utf8');
      if (!matches(lit.kind, lit.body, raw)) continue;
      hits.push({ t, inCode: matches(lit.kind, lit.body, stripComments(raw)) });
    }
    if (!hits.length) continue;
    checked++;
    if (hits.every((h) => !h.inCode)) {
      blind.push({
        test: f, line: lit.line, pattern: lit.body.slice(0, 70),
        target: hits.map((h) => path.relative(root, h.t)).join(', '),
      });
    }
  }
}

// RATCHET, not a big-bang cleanup. These four already existed when the check was introduced on
// 2026-08-12. Rewriting other people's assertions was outside the brief that added this file, and a
// lint that fails on day one gets disabled rather than obeyed. New instances fail immediately;
// these are visible and should be tightened by whoever owns each test.
//
//   axis-globe-voice:40      — /talking halo/ asserts a comment exists; the &&-ed ctx.arc() check
//                              beside it is the one doing real work
//   axis-jarvis-flow:68      — /all quiet/ is Rule-14 prose, not a code token
//   axis-status-emitter:74   — /axis-status-emit/ names a module only mentioned in a comment there
//   axis-voice-hearing:58    — /knowledge base/ lives in axis-persona.js, which that test IMPORTS
//                              rather than reads, so this checker cannot see the real match
const BASELINE = new Set([
  'axis-globe-voice.test.mjs:talking halo',
  'axis-jarvis-flow.test.mjs:all quiet',
  'axis-status-emitter.test.mjs:axis-status-emit',
  'axis-voice-hearing.test.mjs:knowledge base',
]);

const fresh = blind.filter((b) => !BASELINE.has(`${b.test}:${b.pattern}`));
if (fresh.length) {
  const lines = fresh.map((b) => `  ${b.test}:${b.line} — /${b.pattern}/ matches only comments in ${b.target}`);
  assert.fail(
    `${fresh.length} NEW blind guard(s) — positive assertions matching comments, not code.\n`
    + 'Each will pass forever while checking nothing. Point the assertion at real code, or delete it.\n'
    + lines.join('\n'));
}

assert.ok(scanned >= 5, `expected to scan several source-grepping tests, scanned ${scanned}`);
console.log(`axis-blind-guards: ${scanned} tests scanned, ${checked} source-grep assertions verified against code (not comments)`);
