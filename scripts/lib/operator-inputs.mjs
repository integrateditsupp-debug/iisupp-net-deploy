/**
 * operator-inputs.mjs — RUN-BM · BM0
 *
 * Why this exists.
 *
 * `.gitignore` ignores `/senior-director-state/` on purpose: `netlify.toml` publishes `.`, so every
 * TRACKED file is served to the anonymous web. Operator-internal build state — the ledger, the queue,
 * the staged asks, the outbound records — must never become a tracked file. That boundary is correct
 * and this module does not move it.
 *
 * The consequence nobody had written down: a number of tracked suites READ those operator-internal
 * files. On the operator's machine they are present and the suites are green. In any clone they are
 * absent and the same suites go red — not because an assertion about code failed, but because an
 * input the clone was never allowed to receive is missing. The harness reports both as `not ok`, so
 * a reading of "56 failures" cannot be told apart from 56 broken behaviours.
 *
 * This module makes that distinction machine-readable. It derives the boundary FROM `.gitignore`
 * rather than from a list typed here, so the two can never drift apart, and it classifies each
 * referenced path as PRESENT or ABSENT against the tree it is pointed at.
 *
 * It never decides that a red is excusable. It only says which inputs a given tree does not have.
 * A suite that fails with every input present is a code failure and this module says nothing about it.
 */

import fs from 'node:fs';
import path from 'node:path';

export const BOUNDARY_REASON =
  'operator-internal: .gitignore keeps it out of the tree because netlify publishes "." and every tracked file is served';

/**
 * Read the directory prefixes `.gitignore` excludes wholesale (`/name/` form).
 * Only rooted directory rules are read — a rooted directory is the only ignore shape that can make a
 * whole class of suite input unavailable to a clone, and guessing at globs would invent a boundary.
 */
export function readIgnoredRoots(repoRoot) {
  const file = path.join(repoRoot, '.gitignore');
  if (!fs.existsSync(file)) {
    throw new Error('.gitignore is missing — the operator boundary cannot be derived, and must not be assumed');
  }
  const roots = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    if (!line.startsWith('/') || !line.endsWith('/')) continue;
    roots.push(line.slice(1));
  }
  if (roots.length === 0) {
    throw new Error('.gitignore declares no rooted directory exclusion — refusing to report a boundary that was not found');
  }
  return roots.sort();
}

/**
 * Normalise a path as written in a suite to one relative to the repo root.
 * A suite two directories down writes `../../senior-director-state/...`; the leading hops are the
 * suite's location, not part of the input's identity, so they are stripped. Stripping happens only
 * when what remains actually begins at an ignored root — otherwise the path is left exactly as
 * written, because turning an unrelated relative path into a repo path would invent an input.
 */
export function normaliseReference(relPath, roots) {
  const raw = String(relPath).replace(/\\/g, '/').replace(/^\.\//, '');
  const stripped = raw.replace(/^(?:\.\.\/)+/, '');
  const startsAtRoot = (p) => roots.some((r) => p === r.replace(/\/$/, '') || p.startsWith(r));
  if (startsAtRoot(raw)) return raw;
  if (stripped !== raw && startsAtRoot(stripped)) return stripped;
  return raw;
}

/** Is this repo-relative path inside one of the ignored roots? */
export function isOperatorInternal(relPath, roots) {
  const p = normaliseReference(relPath, roots);
  return roots.some((r) => p === r.replace(/\/$/, '') || p.startsWith(r));
}

const PATH_IN_SOURCE = /['"`]([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+)['"`]/g;

/**
 * Every repo-relative path a suite file mentions as a string literal.
 * A literal is the only form that can be resolved without executing the suite; a path assembled at
 * runtime is deliberately NOT guessed at, because a guessed input would put a name in this report
 * that the suite may never open.
 */
export function pathsReferencedBy(suiteFile) {
  const src = fs.readFileSync(suiteFile, 'utf8');
  const out = new Set();
  for (const m of src.matchAll(PATH_IN_SOURCE)) out.add(m[1]);
  return [...out].sort();
}

/**
 * Classify every operator-internal path referenced by the given suite files against `tree`.
 *
 * Returns one object per referenced path: { suite, path, state: 'PRESENT' | 'ABSENT' }.
 * `suitesHeldOpen` names only the suites with at least one ABSENT input — a suite whose inputs are
 * all present is not held open, whatever its assertions then do.
 */
export function classify({ repoRoot, tree = repoRoot, referenceTree = null, suiteFiles }) {
  if (!Array.isArray(suiteFiles) || suiteFiles.length === 0) {
    throw new Error('classify() needs the suite files to read — an empty reading is refused, never rendered as zero');
  }
  const roots = readIgnoredRoots(repoRoot);
  const inputs = [];
  for (const suite of suiteFiles) {
    const rel = path.relative(repoRoot, suite).replace(/\\/g, '/');
    for (const p of pathsReferencedBy(suite)) {
      if (!isOperatorInternal(p, roots)) continue;
      const norm = normaliseReference(p, roots);
      const here = fs.existsSync(path.join(tree, norm));
      // A path absent from the operator's own tree as well is a fixture asserting absence — the
      // suite names it precisely because nothing is there. It is never counted as an input the
      // boundary withheld, and saying so requires a reference tree; without one it is not guessed.
      const fixture = !here && referenceTree ? !fs.existsSync(path.join(referenceTree, norm)) : false;
      inputs.push({
        suite: rel,
        path: norm,
        asWritten: p,
        state: here ? 'PRESENT' : fixture ? 'FIXTURE' : 'ABSENT',
      });
    }
  }
  const absent = inputs.filter((i) => i.state === 'ABSENT');
  const fixtures = inputs.filter((i) => i.state === 'FIXTURE');
  const suitesHeldOpen = [...new Set(absent.map((i) => i.suite))].sort();
  return {
    schema: 'operator-input-reading.v1',
    boundary: roots,
    boundaryReason: BOUNDARY_REASON,
    inputs,
    absent,
    fixtures,
    referenceTree,
    suitesHeldOpen,
    readable: absent.length === 0,
    present: inputs.filter((i) => i.state === 'PRESENT').length,
    // Counted separately on purpose: a fixture is not an input this tree has, so folding it into a
    // present count would overstate what the tree can read by exactly the number of fixtures.
    statement: absent.length === 0
      ? `Every operator-internal input a suite reads is present in this tree: ${inputs.filter((i) => i.state === 'PRESENT').length} present, ${fixtures.length} fixture(s) that name a file nothing creates. A red here is a code failure and nothing else.`
      : `${suitesHeldOpen.length} suite(s) cannot be read in this tree: ${absent.length} of ${inputs.length} operator-internal reference(s) are absent, ${fixtures.length} further are fixtures. Their reds say nothing about the code. Every other red does.`,
  };
}
