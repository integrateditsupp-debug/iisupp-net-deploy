// RUN-BG / BG0 — THE FILE THAT DID NOT PARSE, AND THE 85 SUITES THAT COULD NOT TELL.
//
// Found by running it, not by reading it. Mid-cycle this run, `assets/axis-app.js` — the script that
// carries the entire AXIS console: the dock, the mic, the spoken reply, the board — read back with a
// RAW NEWLINE inside a single-quoted string on line 1580. `node --check` refused it outright. A
// browser would have refused it the same way: not a degraded console, a BLANK one, because a module
// that fails to parse never executes a single statement.
//
// The site suite read 82/84 while that was true, and the two suites that failed did so for an
// unrelated reason — a string they match on had moved. NOT ONE of the eighty-odd suites said the file
// does not parse, because every one of them asserts with a REGEX over the file's text, and a regex is
// perfectly happy to match inside a file no engine will load. Eighty-five green assertions about the
// contents of a file that could not run.
//
// The specific byte sequence turned out to be a concurrent writer caught mid-write — this tree is
// shared and another process was writing that file at the moment it was read; a later read parsed
// cleanly and both suites went green. That is the honest account and it does not change the finding.
// Whether the cause is a partial write, a bad edit, or a merge resolved into something that does not
// compile, the CLASS is the same and this repository had no gate for it. A defect seen once and
// explained away is a defect that comes back on a day nobody is looking.
//
// So: every JavaScript file this repository ships or runs is handed to a real parser. Not a
// heuristic, not a regex for balanced quotes — the engine that will actually load it.
//
// What this deliberately does NOT do: execute anything. Parsing is the whole assertion. Importing
// browser modules under node would fail on `window` and prove nothing about syntax.
//
// Run: node tests/asset-parse-gate.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ok = () => { n++; };

// Directories whose JavaScript either reaches a browser or runs a cycle. A file that parses is the
// floor for both; nothing here is about behaviour.
const SCOPES = [
  { dir: 'assets', ext: ['.js', '.mjs'], why: 'shipped to the browser' },
  { dir: 'scripts', ext: ['.mjs'], why: 'runs a cycle' },
  { dir: 'scripts/lib', ext: ['.mjs'], why: 'imported by the cycle' },
  { dir: 'netlify/functions', ext: ['.mjs'], why: 'runs on request' },
  { dir: 'tests', ext: ['.mjs'], why: 'the suites themselves' },
];

const scratch = makeScratchDir('parse-gate-');

/**
 * Hand a file's bytes to the engine. Copied to a `.mjs` name in scratch so module syntax is parsed
 * as module syntax — a `.js` file carrying `import` is parsed as CommonJS by default and reports a
 * misleading error that has nothing to do with the defect being hunted.
 *
 * @returns {null|string} null when it parses; the engine's own message when it does not.
 */
function parseFailure(absPath) {
  const probe = path.join(scratch, 'probe.mjs');
  fs.copyFileSync(absPath, probe);
  try {
    execFileSync(process.execPath, ['--check', probe], { stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (err) {
    const out = String(err.stderr || err.stdout || err.message);
    // Keep the engine's wording verbatim. A summarised parse error sends the reader to the wrong line.
    return out.split('\n').filter(Boolean).slice(0, 6).join(' | ');
  } finally {
    try { fs.rmSync(probe, { force: true }); } catch { /* a full volume can refuse unlink */ }
  }
}

function filesIn(scope) {
  const abs = path.join(root, scope.dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter(e => e.isFile() && scope.ext.includes(path.extname(e.name)))
    .map(e => path.join(scope.dir, e.name))
    .sort();
}

// ---- 1. the checker is proven against the exact defect it exists to catch, BEFORE it is trusted ----
// A gate that has only ever been run against files that pass has never been shown to fail.
{
  const planted = path.join(scratch, 'planted-raw-newline.mjs');
  // The literal shape observed this cycle: a single-quoted string interrupted by a real line break.
  fs.writeFileSync(planted, "export const spoken = 'a\n' + 'b';\n");
  const got = parseFailure(planted);
  assert.ok(got, 'the parse gate must REPORT a raw newline inside a string literal');
  assert.match(got, /SyntaxError/, 'the failure carries the engine\'s own diagnosis, not a paraphrase');

  // And a second class, because one planted failure proves one branch: a truncated file.
  const truncated = path.join(scratch, 'planted-truncated.mjs');
  fs.writeFileSync(truncated, 'export function half() {\n  const x = 1;\n');
  assert.ok(parseFailure(truncated), 'the parse gate must REPORT an unterminated block');

  // The inverse matters just as much: a valid module must NOT be reported, or the gate is noise and
  // will be switched off by the first person it inconveniences.
  const valid = path.join(scratch, 'planted-valid.mjs');
  fs.writeFileSync(valid, "import path from 'node:path';\nexport const ok = path.sep + '\\n';\n");
  assert.equal(parseFailure(valid), null, 'a valid ES module must pass — including an ESCAPED newline');
  ok();
}

// ---- 2. every file in scope parses ----
{
  const failures = [];
  let checked = 0;
  for (const scope of SCOPES) {
    for (const rel of filesIn(scope)) {
      checked++;
      const why = parseFailure(path.join(root, rel));
      if (why) failures.push(`${rel} (${scope.why}): ${why}`);
    }
  }
  assert.ok(checked > 0, 'the gate found no files at all — the scope list has rotted');
  assert.deepEqual(failures, [], `files that do not parse:\n  ${failures.join('\n  ')}`);
  // Recorded so a scope silently emptying (a directory renamed, a glob narrowed) is visible as a
  // number that fell rather than as a suite that stayed green.
  console.log(`asset-parse-gate: ${checked} files parsed`);
  ok();
}

// ---- 3. the console entry point is in scope BY NAME ----
// Scope lists rot. The one file whose failure this cycle motivated the gate is asserted explicitly,
// so narrowing the list later cannot quietly drop it.
{
  const mustCover = [
    'assets/axis-app.js',            // the AXIS console
    'assets/aperture-learning.js',   // the v1 console the voice contract came from
    'assets/axis-persona.js',        // the turn grammar axis-app imports
    'scripts/run-tests.mjs',         // the runner every suite passes through
    'scripts/plumbing-commit.mjs',   // the last thing that runs in a cycle
  ];
  const covered = new Set(SCOPES.flatMap(filesIn));
  for (const rel of mustCover) {
    assert.ok(fs.existsSync(path.join(root, rel)), `${rel} is asserted by name but is not in the tree`);
    assert.ok(covered.has(rel), `${rel} is not covered by any scope — the parse gate has a hole where the defect was`);
  }
  ok();
}

try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* refused unlink is not a test failure */ }

console.log(`asset-parse-gate: ${n}/3 groups green — every shipped and executed JavaScript file is handed to the engine that loads it, and the gate is proven against the defect it exists to catch.`);
