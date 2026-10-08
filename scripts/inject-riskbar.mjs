#!/usr/bin/env node
/**
 * Contextual risk notice injector.
 *
 * The site-wide fine print (scripts/inject-disclaimer.mjs) sits at the foot of
 * every page. This adds a second, smaller notice IN CONTEXT on the handful of
 * pages where a visitor actually *does* something — follows troubleshooting
 * steps, runs a calculator, takes a readiness score, or reads community
 * answers. Same visual weight as fine print, just close enough to be read
 * before someone acts on it.
 *
 *   npm run riskbar:inject          apply
 *   npm run riskbar:inject -- --dry show what would change, write nothing
 *
 * Anchors are explicit, not heuristic. If an anchor string is missing or
 * ambiguous the script FAILS loudly rather than guessing a position — a legal
 * notice landing in the wrong place is worse than one that didn't ship.
 *
 * Coverage is enforced by scripts/check-disclaimer-coverage.mjs.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not new URL().pathname — this repo lives under "ARIA — Real-Time AI Assistant",
// so the raw pathname arrives percent-encoded ("%20", "%E2%80%94") and every fs call misses.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry');

export const RISK_START = '<!-- iis-riskbar:start -->';
export const RISK_END = '<!-- iis-riskbar:end -->';

const TEL = '<a href="tel:+16475813182">(647)&nbsp;581-3182</a>';
const FULL = '<a href="/disclaimer.html">Full disclaimer</a>.';

/** One line of copy per kind of risk. Small, factual, no shouting. */
export const COPY = {
  troubleshooting:
    `<b>Before you follow these steps.</b> These are general instructions. They may be out of date, and no written guide can account for every factor in a live environment. ` +
    `Back up first, verify against your own systems, and proceed <b>at your own risk</b>. Not sure it is safe? Call ${TEL} and have it done properly. ${FULL}`,

  tool:
    `<b>About this tool.</b> Your result is a general indication based only on what you enter here &mdash; it is not an audit, an assessment, or professional advice. ` +
    `Inputs and benchmarks may be out of date, so do your own due diligence and use the result <b>at your own risk</b>. Want a real assessment of your environment? Call ${TEL}. ${FULL}`,

  estimate:
    `<b>About these numbers.</b> Figures here are illustrative estimates. They can go out of date and your real cost depends on your environment, so verify before you budget or commit and use them <b>at your own risk</b>. ` +
    `Want a firm number for your setup? Call ${TEL}. ${FULL}`,

  compliance:
    `<b>Not a compliance opinion.</b> This self-assessment is a general readiness indicator &mdash; not legal advice, not a certification, and not an audit against the standard. ` +
    `Standards and interpretations change and this content may be out of date, so do your own due diligence and confirm with a qualified auditor or counsel. Use <b>at your own risk</b>. Questions? Call ${TEL}. ${FULL}`,

  community:
    `<b>Community content.</b> Posts, replies and AI-generated answers here come from many sources, are not verified by IIS, and may be out of date or wrong for your environment. ` +
    `Anything you try from this site is <b>at your own risk</b> &mdash; do your own due diligence, and if the system matters, call ${TEL}. ${FULL}`,

  library:
    `<b>About this material.</b> Packs and guidance in the Library are general information, may be out of date, and are used <b>at your own risk</b> &mdash; do your own due diligence before applying them in a live environment. ` +
    `Want it implemented properly? Call ${TEL}. ${FULL}`,
};

export function riskbarBlock(kind) {
  const copy = COPY[kind];
  if (!copy) throw new Error(`unknown riskbar kind: ${kind}`);
  return [
    RISK_START,
    `<div class="iis-riskbar" role="note" aria-label="Risk notice">${copy}</div>`,
    RISK_END,
  ].join('\n');
}

/**
 * file -> { kind, anchor, where }
 *
 * `anchor` must appear EXACTLY ONCE in the file. `where` is 'after' or 'before'.
 * Anchors are chosen to land the notice above the first thing the visitor acts on.
 */
export const TARGETS = [
  // --- troubleshooting -----------------------------------------------------
  { file: 'support-faq.html', kind: 'troubleshooting', where: 'after',
    anchor: '<main>\n  <div class="wrap">' },

  // --- community -----------------------------------------------------------
  { file: 'forums/commons.html', kind: 'community', where: 'before',
    anchor: '<div class="rule"></div>' },
  { file: 'forums/index.html', kind: 'community', where: 'after',
    anchor: '<p>Search verified IIS solutions, ask the community, or drop a screenshot and let ARIA diagnose it — free, no account required to read.</p>' },

  // --- interactive tools / scores -----------------------------------------
  { file: 'health-check.html', kind: 'tool', where: 'before',
    anchor: '<div class="cta-row"><button class="cta-btn" id="startBtn">' },
  { file: 'scorecard.html', kind: 'tool', where: 'before',
    anchor: '<div id="root"></div>' },
  { file: 'compliance-gap.html', kind: 'tool', where: 'before',
    anchor: '<div id="panel" class="panel"></div>' },
  { file: 'copilot-oversharing-check.html', kind: 'tool', where: 'after',
    anchor: '<div class="privacy-pill">Runs 100% in your browser · no network calls · no signup · nothing stored</div>' },
  { file: 'switching-it-provider-checklist.html', kind: 'tool', where: 'after',
    anchor: '<div class="privacy-pill">Runs 100% in your browser · no network calls · no signup · nothing stored</div>' },

  // --- money -------------------------------------------------------------
  { file: 'cost-calculator.html', kind: 'estimate', where: 'before',
    anchor: '<div class="form-card">' },
  { file: 'managed-it-cost-toronto.html', kind: 'estimate', where: 'after',
    anchor: '<div class="privacy-pill">● Runs in your browser · nothing sent anywhere · no signup to see the estimate</div>' },

  // --- compliance ---------------------------------------------------------
  { file: 'compliance/iso-27001-readiness.html', kind: 'compliance', where: 'before',
    anchor: '<div class="score-tile">' },
  { file: 'compliance/pipeda-readiness.html', kind: 'compliance', where: 'before',
    anchor: '<div class="score-tile">' },

  // --- library ------------------------------------------------------------
  { file: 'growth-library.html', kind: 'library', where: 'after',
    anchor: 'You don’t rise by consuming more — you rise by operating better. This is where that starts.</p>' },
];

export function riskbarFiles() {
  return TARGETS.map((t) => t.file).sort();
}

function replaceRegion(html, replacement) {
  const a = html.indexOf(RISK_START);
  if (a === -1) return null;
  const b = html.indexOf(RISK_END, a);
  if (b === -1) return null;
  return html.slice(0, a) + replacement + html.slice(b + RISK_END.length);
}

/** @returns {{html:string, status:'added'|'updated'|'unchanged', error:string|null}} */
export function applyToHtml(html, target) {
  const block = riskbarBlock(target.kind);

  const replaced = replaceRegion(html, block);
  if (replaced !== null) {
    return { html: replaced, status: replaced === html ? 'unchanged' : 'updated', error: null };
  }

  const first = html.indexOf(target.anchor);
  if (first === -1) {
    return { html, status: 'unchanged', error: `anchor not found: ${JSON.stringify(target.anchor.slice(0, 70))}` };
  }
  if (html.indexOf(target.anchor, first + 1) !== -1) {
    return { html, status: 'unchanged', error: `anchor is ambiguous (appears more than once): ${JSON.stringify(target.anchor.slice(0, 70))}` };
  }

  const out = target.where === 'before'
    ? `${html.slice(0, first)}${block}\n  ${html.slice(first)}`
    : `${html.slice(0, first + target.anchor.length)}\n${block}${html.slice(first + target.anchor.length)}`;

  return { html: out, status: 'added', error: null };
}

function main() {
  const added = [];
  const updated = [];
  const unchanged = [];
  const failed = [];

  for (const target of TARGETS) {
    const abs = join(ROOT, target.file);
    let before;
    try {
      before = readFileSync(abs, 'utf8');
    } catch {
      failed.push({ file: target.file, reason: 'file not found' });
      continue;
    }

    const { html, status, error } = applyToHtml(before, target);
    if (error) { failed.push({ file: target.file, reason: error }); continue; }
    if (status === 'unchanged') { unchanged.push(target.file); continue; }
    if (!DRY) writeFileSync(abs, html, 'utf8');
    (status === 'added' ? added : updated).push(`${target.file} [${target.kind}]`);
  }

  console.log(JSON.stringify({
    mode: DRY ? 'dry-run' : 'write',
    targets: TARGETS.length,
    added,
    updated,
    unchanged,
    failed,
  }, null, 2));

  if (failed.length) {
    console.error('\nSome anchors did not resolve. Fix the anchor in TARGETS — do NOT hand-place the notice.\n');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
