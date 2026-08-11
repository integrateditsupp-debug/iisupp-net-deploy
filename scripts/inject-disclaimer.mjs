#!/usr/bin/env node
/**
 * Site-wide fine-print injector.
 *
 * Adds one small disclaimer strip to the foot of every public HTML page, plus the
 * stylesheet link that renders it. Idempotent: re-running rewrites the marked
 * block in place, so changing the wording here and re-running updates the whole
 * site in one pass. Never hand-edit the injected block in a page.
 *
 *   npm run disclaimer:inject          apply to every public page
 *   npm run disclaimer:inject -- --dry show what would change, write nothing
 *
 * Coverage is enforced by scripts/check-disclaimer-coverage.mjs (site:hygiene).
 * The full legal notice lives at /disclaimer.html.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DRY = process.argv.includes('--dry');

/** Bump when iis-fineprint.css changes so browsers pick it up. */
export const ASSET_VERSION = '20260729a';

export const HEAD_START = '<!-- iis-fineprint:head:start -->';
export const HEAD_END = '<!-- iis-fineprint:head:end -->';
export const BODY_START = '<!-- iis-fineprint:start -->';
export const BODY_END = '<!-- iis-fineprint:end -->';

/**
 * The fine print itself. Small, factual, and the same on every page.
 * Keep it to two sentences plus the call — longer reads as panic, not policy.
 */
export function fineprintBlock() {
  return [
    BODY_START,
    '<div class="iis-fineprint" role="note" aria-label="Site content disclaimer">',
    '  <div class="iis-fineprint__inner">',
    '    <span class="iis-fineprint__label">Disclaimer</span>',
    '    <p class="iis-fineprint__text">Content on iisupp.net and its sub-sites is general information only. Any troubleshooting step, instruction, tool, estimate or data taken from this site is <strong style="color:rgba(255,255,255,.5);font-weight:600">used at your own risk</strong>, and information may be out of date &mdash; please do your own due diligence before acting on it.</p>',
    '    <p class="iis-fineprint__text">No published guide can account for every factor in a live environment. If the system matters, don&rsquo;t guess &mdash; call <a href="tel:+16475813182">(647) 581-3182</a> and have it done safely. Full <a href="/disclaimer.html">disclaimer</a> &middot; <a href="/terms.html">terms</a> &middot; <a href="/governance/privacy">privacy</a>.</p>',
    '  </div>',
    '</div>',
    BODY_END,
  ].join('\n');
}

export function headBlock() {
  return `${HEAD_START}<link rel="stylesheet" href="/assets/iis-fineprint.css?v=${ASSET_VERSION}">${HEAD_END}`;
}

/** netlify.toml 404s these, or they are build/vendor noise. Nothing here is served. */
export const NON_PUBLIC_DIRS = new Set([
  '.git', 'node_modules', 'docs', 'scripts', 'data', 'tests', 'archive', 'backups',
  'artifacts', 'outputs', 'netlify', 'apps', '.github', 'senior-director-state',
  'ARIA Sentinel', 'aria_brain_pack', 'case-study-templates', 'procurement-downloads',
]);

/**
 * Public but deliberately skipped, with the reason. These are internal consoles,
 * transient states and fragments — a legal strip on them is noise, not cover.
 * Anything NOT listed here gets the fine print, including every content page.
 */
export const SKIP = new Map([
  ['admin-console.html', 'internal operator console, not public content'],
  ['agent-command-center.html', 'internal operator console'],
  ['ceo-action-console.html', 'internal operator console'],
  ['command-center.html', 'internal operator console'],
  ['growth-command-center.html', 'internal operator console'],
  ['revenue-dashboard.html', 'internal operator console'],
  ['cost-dashboard.html', 'internal operator console'],
  ['leads-admin.html', 'internal operator console'],
  ['forums-admin.html', 'internal operator console'],
  ['lead-radar.html', 'internal operator console'],
  ['analytics.html', 'internal operator console'],
  ['pricing-experiments.html', 'internal operator console'],
  ['offline.html', 'service-worker offline shell, renders with no network'],
  ['checkout-success.html', 'transient post-payment confirmation'],
  ['ai-bot-index.html', 'machine-readable index for crawlers, not a human page'],
  ['aperture-office-view.html', 'HTML fragment, not a page — no <head>/<body>; it is embedded into aperture-learning.html which carries the notice'],
]);

/**
 * DEFECT-223 — scope fix. The site is deployed from git, so a directory that git
 * ignores is never published and can never carry (or need) the fine print. Local
 * scratch/vendor trees (`_branch-src/`, `_shipped-src/`, `odysseus/venv/`, …) were
 * being scanned as if they were public pages, which drowned the gate in ~268 false
 * violations and hid the real ones. Rather than hardcode a list that rots, read the
 * top-level directory entries out of `.gitignore` and treat them as non-public.
 * Purely additive: nothing that git tracks is ever skipped by this.
 */
function gitIgnoredDirs() {
  const out = new Set();
  try {
    const raw = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('!')) continue;
      if (t.includes('*') || t.includes('?')) continue;   // patterns: too broad to trust here
      if (!t.endsWith('/')) continue;                     // directories only
      const name = t.replace(/^\/+/, '').replace(/\/+$/, '');
      if (name && !name.includes('/')) out.add(name);     // top-level dir names only
    }
  } catch { /* no .gitignore -> nothing extra to skip */ }
  return out;
}

const IGNORED_DIRS = gitIgnoredDirs();

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (NON_PUBLIC_DIRS.has(entry) || IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.html?$/i.test(entry)) out.push(full);
  }
  return out;
}

export function listPublicPages() {
  return walk(ROOT)
    .map((f) => relative(ROOT, f).split(sep).join('/'))
    .filter((rel) => !SKIP.has(rel))
    .sort();
}

/** Replace an existing marked region, or return null if it isn't there yet. */
function replaceRegion(html, start, end, replacement) {
  const a = html.indexOf(start);
  if (a === -1) return null;
  const b = html.indexOf(end, a);
  if (b === -1) return null;
  return html.slice(0, a) + replacement + html.slice(b + end.length);
}

/** Case-insensitive index of the last occurrence of a closing tag. */
function lastTagIndex(html, tag) {
  return html.toLowerCase().lastIndexOf(tag);
}

export function applyToHtml(html) {
  let out = html;
  let changed = false;

  // ---- head: the stylesheet link -----------------------------------------
  const head = headBlock();
  const headReplaced = replaceRegion(out, HEAD_START, HEAD_END, head);
  if (headReplaced !== null) {
    if (headReplaced !== out) changed = true;
    out = headReplaced;
  } else {
    const i = lastTagIndex(out, '</head>');
    if (i === -1) return { html: out, changed: false, reason: 'no </head>' };
    out = `${out.slice(0, i)}  ${head}\n${out.slice(i)}`;
    changed = true;
  }

  // ---- body: the fine print strip ----------------------------------------
  const body = fineprintBlock();
  const bodyReplaced = replaceRegion(out, BODY_START, BODY_END, body);
  if (bodyReplaced !== null) {
    if (bodyReplaced !== out) changed = true;
    out = bodyReplaced;
  } else {
    const i = lastTagIndex(out, '</body>');
    if (i === -1) return { html: out, changed: false, reason: 'no </body>' };
    out = `${out.slice(0, i)}${body}\n${out.slice(i)}`;
    changed = true;
  }

  return { html: out, changed, reason: null };
}

function main() {
  const pages = listPublicPages();
  const added = [];
  const updated = [];
  const unchanged = [];
  const failed = [];

  for (const rel of pages) {
    const abs = join(ROOT, rel);
    const before = readFileSync(abs, 'utf8');
    const had = before.includes(BODY_START);
    const { html, changed, reason } = applyToHtml(before);

    if (reason) { failed.push({ file: rel, reason }); continue; }
    if (!changed) { unchanged.push(rel); continue; }
    if (!DRY) writeFileSync(abs, html, 'utf8');
    (had ? updated : added).push(rel);
  }

  console.log(JSON.stringify({
    mode: DRY ? 'dry-run' : 'write',
    assetVersion: ASSET_VERSION,
    pagesConsidered: pages.length,
    added: added.length,
    updated: updated.length,
    unchanged: unchanged.length,
    // Never let a skip be silent — a page with no disclaimer should be a decision.
    skippedByDesign: [...SKIP.entries()].map(([f, why]) => `${f} — ${why}`),
    failed,
  }, null, 2));

  if (failed.length) {
    console.error('\nSome pages could not be processed (missing </head> or </body>). Fix the markup and re-run.\n');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
