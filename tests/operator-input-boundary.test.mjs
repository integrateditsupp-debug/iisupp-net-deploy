/**
 * RUN-BM · BM0 — the reading a clone cannot take.
 *
 * Established by RUNNING it this cycle, not by reading two files and assuming they meet:
 * the desktop registry reads 56 failures in a fresh clone of the exact commit that reads 0 on the
 * operator's machine, and every one of the 56 traces to `.gitignore:104` keeping
 * `/senior-director-state/` out of the tree — correctly, because `netlify.toml` publishes `.` and a
 * tracked file is a served file. The boundary is right. What was missing is the ability to say which
 * reds it causes, so a genuine code failure cannot hide among them.
 *
 * These tests hold that distinction. The inverse is the point: with the inputs present the held-open
 * count must be zero, or this module is a rubber stamp that excuses every red.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';
import {
  classify,
  isOperatorInternal,
  normaliseReference,
  pathsReferencedBy,
  readIgnoredRoots,
} from '../scripts/lib/operator-inputs.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

// BL3's gate exists because `os.tmpdir()` on this machine is a full volume; scratch space is
// obtained through the probed helper, never assumed.
function scratch() {
  return makeScratchDir('operator-input-');
}

function writeSuite(dir, name, body) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return file;
}

test('the boundary is read from .gitignore, never typed here', () => {
  const roots = readIgnoredRoots(repoRoot);
  assert.ok(roots.includes('senior-director-state/'),
    'the operator-internal root this whole reading is about must come out of .gitignore');
  const declared = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
  for (const r of roots) {
    assert.ok(declared.includes(`/${r}`), `${r} was reported as a boundary but is not written in .gitignore`);
  }
});

test('a missing .gitignore is refused, never read as "nothing is internal"', () => {
  const dir = scratch();
  assert.throws(() => readIgnoredRoots(dir), /\.gitignore is missing/);
});

test('a .gitignore with no rooted directory rule is refused rather than reported as an empty boundary', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, '.gitignore'), '# comment\n*.log\nnode_modules\n');
  assert.throws(() => readIgnoredRoots(dir), /refusing to report a boundary that was not found/);
});

test('a negation line never widens the boundary', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, '.gitignore'), '/secret-state/\n!/public-state/\n');
  assert.deepEqual(readIgnoredRoots(dir), ['secret-state/']);
});

test('a suite two directories down still resolves to the same input', () => {
  const roots = ['senior-director-state/'];
  assert.equal(
    normaliseReference('../../senior-director-state/outbound/x.json', roots),
    'senior-director-state/outbound/x.json',
  );
  assert.ok(isOperatorInternal('../../senior-director-state/outbound/x.json', roots));
});

test('an unrelated relative path is left exactly as written — no path is invented', () => {
  const roots = ['senior-director-state/'];
  assert.equal(normaliseReference('../fixtures/thing.json', roots), '../fixtures/thing.json');
  assert.equal(isOperatorInternal('../fixtures/thing.json', roots), false);
  assert.equal(isOperatorInternal('senior-director-state-other/x', roots), false,
    'a directory whose name merely starts with the boundary is not inside it');
});

test('only string-literal paths are read — a path built at runtime is never guessed at', () => {
  const dir = scratch();
  const f = writeSuite(dir, 'a.test.mjs',
    `const base = 'senior-director-state';\nread(base + '/guessed.json');\nread('senior-director-state/literal.json');\n`);
  const found = pathsReferencedBy(f);
  assert.ok(found.includes('senior-director-state/literal.json'));
  assert.ok(!found.some((p) => p.includes('guessed')), 'an assembled path must not appear as an input');
});

test('RED: an input the tree does not have names its suite and is not rounded away', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, '.gitignore'), '/senior-director-state/\n');
  const suite = writeSuite(dir, 'tests/reads-state.test.mjs',
    `read('senior-director-state/real-record.json');\n`);
  const clone = scratch(); // has the suite's expectations but not the operator's state

  const reading = classify({ repoRoot: dir, tree: clone, suiteFiles: [suite] });
  assert.equal(reading.readable, false);
  assert.deepEqual(reading.suitesHeldOpen, ['tests/reads-state.test.mjs']);
  assert.equal(reading.absent.length, 1);
  assert.match(reading.statement, /1 suite\(s\) cannot be read/);
});

test('GREEN, and this is the inverse that stops it being a rubber stamp: present inputs hold nothing open', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, '.gitignore'), '/senior-director-state/\n');
  const suite = writeSuite(dir, 'tests/reads-state.test.mjs',
    `read('senior-director-state/real-record.json');\n`);
  fs.mkdirSync(path.join(dir, 'senior-director-state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'senior-director-state/real-record.json'), '{}');

  const reading = classify({ repoRoot: dir, tree: dir, suiteFiles: [suite] });
  assert.equal(reading.readable, true);
  assert.deepEqual(reading.suitesHeldOpen, []);
  assert.equal(reading.present, 1);
  assert.match(reading.statement, /A red here is a code failure and nothing else/);
});

test('a fixture naming a file nothing creates is never counted as an input the boundary withheld', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, '.gitignore'), '/senior-director-state/\n');
  const suite = writeSuite(dir, 'tests/absence.test.mjs',
    `expectMissing('senior-director-state/NOT-A-REAL-FILE.md');\n`);
  const clone = scratch();

  const withRef = classify({ repoRoot: dir, tree: clone, referenceTree: dir, suiteFiles: [suite] });
  assert.equal(withRef.fixtures.length, 1);
  assert.equal(withRef.absent.length, 0);
  assert.equal(withRef.readable, true);

  const withoutRef = classify({ repoRoot: dir, tree: clone, suiteFiles: [suite] });
  assert.equal(withoutRef.absent.length, 1,
    'with no reference tree the fixture is reported as absent — true, and never silently assumed to be a fixture');
});

test('a path outside the boundary is never classified, however absent it is', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, '.gitignore'), '/senior-director-state/\n');
  const suite = writeSuite(dir, 'tests/ordinary.test.mjs',
    `read('docs/PLAIN-DOC.md');\nread('scripts/lib/thing.mjs');\n`);
  const reading = classify({ repoRoot: dir, tree: scratch(), suiteFiles: [suite] });
  assert.equal(reading.inputs.length, 0);
  assert.equal(reading.readable, true,
    'a tracked file that is merely missing is a code problem, not a boundary problem, and this module must stay silent about it');
});

test('an empty reading is refused rather than rendered as zero problems', () => {
  assert.throws(() => classify({ repoRoot, suiteFiles: [] }), /an empty reading is refused/);
});

test('THE REAL TREE — every reference is accounted for, and a tree that cannot read one says so', () => {
  const suites = [];
  const walk = (d, depth = 0) => {
    if (depth > 4) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (/\.test\.mjs$/.test(e.name)) suites.push(full);
    }
  };
  walk(path.join(repoRoot, 'tests'));
  walk(path.join(repoRoot, 'ARIA Sentinel', 'tests'));
  assert.ok(suites.length > 100, 'the real suite set must be found, not an empty list read as clean');

  const reading = classify({ repoRoot, tree: repoRoot, referenceTree: repoRoot, suiteFiles: suites });

  // Deliberately NOT asserted green. This suite runs both on the operator's machine, where every
  // input is present, and inside a clone, where by design none of them are — and a clone reading red
  // here would be this module reporting its own subject as a defect. What must hold in BOTH trees is
  // that the reading is complete and that an unreadable tree NAMES what it is missing.
  assert.ok(reading.inputs.length > 0,
    'the suites that read operator-internal state must be found — an empty reading proves nothing');
  assert.equal(
    reading.present + reading.absent.length + reading.fixtures.length,
    reading.inputs.length,
    'every reference must land in exactly one state — an unaccounted reference is a silent hole',
  );
  if (reading.readable) {
    assert.equal(reading.absent.length, 0);
    assert.match(reading.statement, /A red here is a code failure and nothing else/);
  } else {
    assert.ok(reading.suitesHeldOpen.length > 0,
      'a tree that is missing an input must name the suites it holds open, never report a bare failure');
    for (const s of reading.suitesHeldOpen) {
      assert.ok(reading.absent.some((a) => a.suite === s), `${s} was held open with no absent input named`);
    }
  }
});
