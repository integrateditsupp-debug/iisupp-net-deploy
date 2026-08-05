// tests/claim-figures-render.test.mjs — RUN-AM / AM2. Staleness where the operator actually looks.
//
// Age and staleness have existed in the internal payload since RUN-AK and appeared on no screen. A
// figure read six cycles ago and one read this cycle rendered identically, so the annotation was a
// fact about a JSON file rather than a fact the operator could act on.
//
// What is asserted here:
//   R1  a stale figure renders a visible marker
//   R2  a fresh figure renders NO marker  (the negative half — a marker on everything is no marker)
//   R3  nothing is hidden by staleness: the stale figure is still rendered, with its value
//   R4  age is recomputed against NOW, so the same bytes go stale as the clock advances
//   R5  each kind's own window is honoured, not one global number
//   R6  a declared-unmeasurable figure is marked as such rather than shown as a reading
//   R7  values are escaped — this card renders operator-supplied strings
//   R8  the Director screen's own selector reads the same rows (the surface is wired, not just the lib)
//   R9  none of this machinery reaches the public headline feed
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MARKER, claimRows, staleCount, renderFiguresHTML, label, ageLabel,
} from '../assets/axis-claim-figures.js';
import { annotateStaleness } from '../scripts/lib/claim-evidence.mjs';
import { PUBLIC_ALLOWED_KEYS } from '../scripts/lib/axis-status-emit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t = (name, fn) => test(name, fn);

const NOW = new Date('2026-08-05T20:00:00.000Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();

const claims = annotateStaleness({
  testsPassedAfterWrites: { value: 563, measuredAt: hoursAgo(0.2), source: 'the registry exit code', kind: 'test' },
  commitsAheadOfSharedLine: { value: 45, measuredAt: hoursAgo(96), source: 'a revision count', kind: 'count' },
  pushCredentialRefused: { value: true, measuredAt: hoursAgo(48), source: 'a remote probe', kind: 'blocker' },
}, { now: NOW });

/* ── R1 / R2 · the marker, and its absence ─────────────────────────────────────────────────── */
t('R1 — a stale figure renders a visible marker', () => {
  const rows = claimRows(claims, { now: NOW });
  const ahead = rows.find((r) => r.name === 'commitsAheadOfSharedLine');
  assert.equal(ahead.stale, true, '96h old, count window is 24h');
  assert.equal(ahead.marker, MARKER);
  const html = renderFiguresHTML(claims, { now: NOW });
  assert.match(html, /cf-is-stale/);
  assert.match(html, new RegExp(`<span class="cf-stale">${MARKER}</span>`));
});

t('R2 — a fresh figure renders NO marker', () => {
  const rows = claimRows(claims, { now: NOW });
  const tests = rows.find((r) => r.name === 'testsPassedAfterWrites');
  assert.equal(tests.stale, false, '12 minutes old, test window is 24h');
  assert.equal(tests.marker, '');
  // the negative half at the HTML level: exactly one stale badge in a three-figure payload
  const html = renderFiguresHTML(claims, { now: NOW });
  assert.equal((html.match(/class="cf-stale"/g) || []).length, 1, 'a marker on everything is no marker at all');
  assert.match(html, /1 stale/);
});

/* ── R3 · nothing is hidden ────────────────────────────────────────────────────────────────── */
t('R3 — a stale figure is still rendered, value and all', () => {
  const html = renderFiguresHTML(claims, { now: NOW });
  assert.match(html, /45/, 'the stale value is present, accused rather than deleted');
  assert.match(html, /Commits Ahead Of Shared Line/);
  assert.equal(claimRows(claims, { now: NOW }).length, 3, 'no row is dropped for being stale');
});

/* ── R4 · the same bytes go stale as the clock advances ────────────────────────────────────── */
t('R4 — age is recomputed against now, so an untouched payload goes stale on its own', () => {
  const fresh = claimRows(claims, { now: NOW }).find((r) => r.name === 'testsPassedAfterWrites');
  assert.equal(fresh.stale, false);
  const later = new Date(NOW.getTime() + 30 * 3600000); // +30h, nobody touched the payload
  const same = claimRows(claims, { now: later }).find((r) => r.name === 'testsPassedAfterWrites');
  assert.equal(same.stale, true, 'the identical bytes are stale later — the annotation is not trusted');
  assert.equal(same.value, '563', 'and the value is unchanged: aging never edits the figure');
});

/* ── R5 · per-kind windows ─────────────────────────────────────────────────────────────────── */
t('R5 — a blocker at 48h is still fresh while a count at 48h is not', () => {
  const rows = claimRows(claims, { now: NOW });
  const blocker = rows.find((r) => r.name === 'pushCredentialRefused');
  assert.equal(blocker.maxAgeHours, 72);
  assert.equal(blocker.stale, false, 'blockers move slowly; 48h is inside the window');
  const countAt48 = claimRows(annotateStaleness({
    x: { value: 1, measuredAt: hoursAgo(48), source: 's', kind: 'count' },
  }, { now: NOW }), { now: NOW })[0];
  assert.equal(countAt48.stale, true, 'the same 48 hours is stale for a count');
});

/* ── R6 · unmeasurable is shown as unmeasurable, not as a reading ──────────────────────────── */
t('R6 — a declared-unmeasurable figure is marked, not presented as a fresh reading', () => {
  const c = annotateStaleness({
    meetingsHeld: {
      value: null, measuredAt: hoursAgo(0.1), source: 'no reply record is readable here',
      kind: 'count', provenance: 'declared-unmeasurable', unmeasurableReason: 'replies live in a mailbox this environment cannot read',
    },
  }, { now: NOW });
  const row = claimRows(c, { now: NOW })[0];
  assert.equal(row.unmeasured, true);
  assert.equal(row.value, '—', 'no value is invented for a figure nobody could read');
  const html = renderFiguresHTML(c, { now: NOW });
  assert.match(html, /not measurable here/);
  assert.match(html, /replies live in a mailbox/, 'the reason travels with the marker');
});

/* ── R7 · escaping ─────────────────────────────────────────────────────────────────────────── */
t('R7 — values and reasons are escaped', () => {
  const c = annotateStaleness({
    x: { value: '<img src=x onerror=alert(1)>', measuredAt: hoursAgo(1), source: 's', kind: 'fact' },
  }, { now: NOW });
  const html = renderFiguresHTML(c, { now: NOW });
  assert.ok(!html.includes('<img'), 'no raw tag survives into the card');
  assert.match(html, /&lt;img/);
});

t('R7b — empty input renders an honest empty state rather than a broken card', () => {
  assert.match(renderFiguresHTML({}, { now: NOW }), /No program figures published yet/);
  assert.deepEqual(claimRows(null, { now: NOW }), []);
  assert.equal(staleCount([]), 0);
  assert.equal(label('testsPassedAfterWrites'), 'Tests Passed After Writes');
  assert.equal(ageLabel(null), 'age unknown');
});

/* ── R8 · the surface is actually wired ────────────────────────────────────────────────────── */
t('R8 — the Director screen selects the same rows from its snapshot slice', async () => {
  const mod = await import('../assets/axis-director-screen.js');
  assert.equal(typeof mod.programFigures, 'function', 'the screen exposes its own selector');
  const rows = mod.programFigures({ program_status: { claims } }, NOW);
  assert.equal(rows.length, 3);
  assert.equal(rows.filter((r) => r.stale).length, 1);
  assert.deepEqual(mod.programFigures({}, NOW), [], 'no payload yields no rows rather than throwing');
});

t('R8b — the Director screen imports the renderer and paints the section', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/axis-director-screen.js'), 'utf8');
  assert.match(src, /from '\.\/axis-claim-figures\.js'/, 'the edge exists for the module-graph walk');
  assert.match(src, /root\.append\(figuresSection\(data\)\)/, 'the section is painted, not merely defined');
  const app = fs.readFileSync(path.join(ROOT, 'assets/axis-app.js'), 'utf8');
  assert.match(app, /program_status: state\.programStatus/, 'the payload reaches the screen');
  assert.match(app, /\/api\/axis-status/, 'and it comes from the authed endpoint');
});

/* ── R9 · the public feed never learns any of this ─────────────────────────────────────────── */
t('R9 — none of the figure machinery is publishable on the headline feed', () => {
  for (const k of ['claims', 'staleClaims', 'ageHours', 'provenance', 'unmeasuredFigures']) {
    assert.equal(PUBLIC_ALLOWED_KEYS.includes(k), false, `"${k}" must never be a public headline key`);
  }
  for (const rel of ['.well-known/axis/status.json', 'public/.well-known/axis/status.json']) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const served = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.equal('claims' in served, false, `${rel} must stay headline-only`);
    assert.equal('provenance' in served, false);
  }
});

