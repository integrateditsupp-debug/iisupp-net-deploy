#!/usr/bin/env node
/**
 * Disclaimer coverage gate.
 *
 * Fails the build if any public HTML page is missing the site-wide fine print,
 * its stylesheet link, or (on the pages that need one) the contextual risk
 * notice. This is what stops the disclaimer from silently rotting off pages as
 * the site grows: a new page ships with no notice -> `npm run site:hygiene`
 * goes red -> run `npm run disclaimer:inject`.
 *
 * It imports its expectations from the injectors themselves so the gate and the
 * injector can never drift apart.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  listPublicPages,
  BODY_START,
  BODY_END,
  HEAD_START,
  HEAD_END,
  ASSET_VERSION,
  SKIP,
} from './inject-disclaimer.mjs';

import {
  TARGETS as RISK_TARGETS,
  RISK_START,
  RISK_END,
  riskbarBlock,
} from './inject-riskbar.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const STYLESHEET = 'assets/iis-fineprint.css';
const NOTICE_PAGE = 'disclaimer.html';

const violations = [];

function fail(file, problem, fix) {
  violations.push({ file, problem, fix });
}

// --- the assets the whole thing depends on ---------------------------------
for (const required of [STYLESHEET, NOTICE_PAGE]) {
  if (!existsSync(join(ROOT, required))) {
    fail(required, 'required file is missing', 'restore it — every page links to it');
  }
}

// --- site-wide fine print on every public page ------------------------------
const pages = listPublicPages();
for (const rel of pages) {
  const html = readFileSync(join(ROOT, rel), 'utf8');

  if (!html.includes(BODY_START) || !html.includes(BODY_END)) {
    fail(rel, 'no site-wide fine print', 'npm run disclaimer:inject');
    continue;
  }
  if (!html.includes(HEAD_START) || !html.includes(HEAD_END)) {
    fail(rel, 'fine print present but stylesheet link missing — it will render unstyled', 'npm run disclaimer:inject');
    continue;
  }
  if (!html.includes(`/assets/iis-fineprint.css?v=${ASSET_VERSION}`)) {
    fail(rel, `stale stylesheet version (expected v=${ASSET_VERSION})`, 'npm run disclaimer:inject');
  }
  if (!html.includes('href="/disclaimer.html"')) {
    fail(rel, 'fine print does not link to the full disclaimer', 'npm run disclaimer:inject');
  }
}

// --- contextual notice on the do-something pages ---------------------------
for (const target of RISK_TARGETS) {
  const abs = join(ROOT, target.file);
  if (!existsSync(abs)) {
    fail(target.file, 'riskbar target page no longer exists', 'remove it from TARGETS in scripts/inject-riskbar.mjs');
    continue;
  }
  const html = readFileSync(abs, 'utf8');
  if (!html.includes(RISK_START) || !html.includes(RISK_END)) {
    fail(target.file, `no contextual "${target.kind}" risk notice`, 'npm run riskbar:inject');
    continue;
  }
  const expected = riskbarBlock(target.kind);
  const a = html.indexOf(RISK_START);
  const b = html.indexOf(RISK_END, a) + RISK_END.length;
  if (html.slice(a, b) !== expected) {
    fail(target.file, 'contextual risk notice was hand-edited and no longer matches the injector', 'npm run riskbar:inject');
  }
}

// --- report -----------------------------------------------------------------
if (violations.length === 0) {
  console.log(JSON.stringify({
    ok: true,
    publicPagesChecked: pages.length,
    contextualNotices: RISK_TARGETS.length,
    assetVersion: ASSET_VERSION,
    // Skips are always listed. A page without a disclaimer must be a decision,
    // never an accident nobody noticed.
    skippedByDesign: [...SKIP.entries()].map(([f, why]) => `${f} — ${why}`),
  }, null, 2));
  process.exit(0);
}

console.error(`\n✗ Disclaimer coverage: ${violations.length} problem(s) across ${pages.length} public pages.\n`);
for (const v of violations) {
  console.error(`  ${v.file}`);
  console.error(`      ${v.problem}`);
  console.error(`      fix: ${v.fix}\n`);
}
console.error('Every public page must carry the fine print. Do not hand-edit the injected blocks.\n');
process.exit(1);
