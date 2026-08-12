#!/usr/bin/env node
/**
 * report-clone-readability.mjs — RUN-BM · BM0
 *
 * Answers one question, by measurement, against whatever tree it is pointed at:
 * how much of this suite can this tree actually read?
 *
 * Usage:  node scripts/report-clone-readability.mjs [--tree <dir>] [--json]
 *
 * `--tree` defaults to the repo it is run from. Pointed at a fresh clone it names exactly the suites
 * a clone was never given the inputs for; pointed at the operator's machine it should report zero.
 * A red that survives a zero reading is a code failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './lib/operator-inputs.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const treeArg = argv.includes('--tree') ? argv[argv.indexOf('--tree') + 1] : null;
const tree = treeArg ? path.resolve(treeArg) : repoRoot;
const asJson = argv.includes('--json');
// The operator's own tree, used only to tell a withheld input apart from a fixture that names a file
// nothing ever creates. Without it a fixture is reported as absent, which is true but unhelpful.
const refArg = argv.includes('--reference') ? argv[argv.indexOf('--reference') + 1] : null;
const referenceTree = refArg ? path.resolve(refArg) : null;

function suiteFiles(root) {
  const found = [];
  const walk = (dir, depth = 0) => {
    if (depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('_')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (/\.test\.mjs$/.test(e.name)) found.push(full);
    }
  };
  walk(path.join(root, 'tests'));
  walk(path.join(root, 'ARIA Sentinel', 'tests'));
  return found.sort();
}

const files = suiteFiles(repoRoot);
if (files.length === 0) {
  console.error('No suite files found — refusing to report a readability of zero problems on a reading that never happened.');
  process.exit(2);
}

const reading = classify({ repoRoot, tree, referenceTree, suiteFiles: files });
const out = { ...reading, tree, suitesRead: files.length, readAt: new Date().toISOString() };

if (asJson) {
  console.log(JSON.stringify(out, null, 1));
} else {
  console.log(`tree: ${tree}`);
  console.log(`suites read: ${files.length}`);
  console.log(`operator boundary (from .gitignore): ${reading.boundary.join(' ')}`);
  console.log('');
  console.log(reading.statement);
  if (reading.fixtures.length) {
    console.log(`${reading.fixtures.length} further reference(s) are fixtures — absent from the operator's tree too, which is what the suite asserts.`);
  } else if (!referenceTree) {
    console.log('No reference tree given, so a fixture naming a file nothing creates is counted above as absent. Pass --reference <operator tree> to separate them.');
  }
  if (!reading.readable) {
    console.log('');
    console.log('held open by an input this tree does not have:');
    for (const s of reading.suitesHeldOpen) {
      const missing = reading.absent.filter((a) => a.suite === s).map((a) => a.path);
      console.log(`  ${s}`);
      for (const m of missing) console.log(`      absent: ${m}`);
    }
  }
}

process.exit(reading.readable ? 0 : 1);
