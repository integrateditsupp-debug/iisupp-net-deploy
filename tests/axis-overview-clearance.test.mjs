// tests/axis-overview-clearance.test.mjs — the globe must not sit on top of the page (2026-08-12).
//
// Ahmad: "move overview section lower so its not over the other content on the page and its between
// overview and Axis-director section."
//
// Moving the globe to top:70px put it where he wanted it — above the Overview deck it fronts —
// but .axis-orbit is position:fixed, so it reserves NO layout space. .content kept starting right
// under the 57px topbar, which meant the globe covered the command strip and the Overview heading.
// The globe was in the right place and the content was still underneath it.
//
// This asserts the INVARIANT rather than the pixel values: in every globe size state, the top of the
// content viewport must sit below the bottom of the globe. Pinning the numbers would just move the
// brittleness — a later size change would pass the test and re-break the layout, which is the
// blind-guard failure mode this repo has been bitten by repeatedly.
// Run: node tests/axis-overview-clearance.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = fs.readFileSync(path.join(root, 'assets', 'axis-tokens.css'), 'utf8');
// Absence- and value-checks run on declarations, never on prose: the comments here quote the very
// numbers being asserted.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0; const ok = (m) => { n++; console.log('  ok —', m); };

const TOPBAR = 57;      // .topbar: 10px padding top+bottom + content + 1px border, as measured
const num = (re, what) => {
  const m = css.match(re);
  assert.ok(m, `could not read ${what} from axis-tokens.css`);
  return Number(m[1]);
};

// ---- geometry, read out of the stylesheet rather than assumed ----
const orbitTop = num(/\.axis-orbit \{[^}]*top:(\d+)px/, 'orbit top offset');
const globe = num(/\.axis-orbit \.axis-globe \{ width:(\d+)px/, 'resting globe size');
const dockedGlobe = num(/:root\[data-axis-open="1"\] \.axis-orbit \.axis-globe \{ width:(\d+)px/, 'docked globe size');
const smallGlobe = num(/@media \(max-width:720px\) \{\s*\.axis-orbit \.axis-globe \{ width:(\d+)px/, 'small-screen globe size');

const contentMargin = num(/\.content \{[^}]*margin-top:(\d+)px/, 'resting content margin-top');
const dockedMargin = num(/:root\[data-axis-open="1"\] \.content \{ margin-top:(\d+)px/, 'docked content margin-top');
const smallMargin = num(/@media \(max-width:720px\) \{[\s\S]*?\.content \{ margin-top:(\d+)px/, 'small-screen content margin-top');

// ---- 1. The orbit is still fixed — that is why the reservation is needed at all ----
{
  assert.ok(/\.axis-orbit \{ position:fixed/.test(css), 'the orbit must stay position:fixed');
  ok('the globe is fixed, so its space has to be reserved explicitly');
}

// ---- 2. Every state clears the globe ----
{
  for (const [label, g, margin] of [
    ['resting', globe, contentMargin],
    ['docked', dockedGlobe, dockedMargin],
    ['<=720px', smallGlobe, smallMargin],
  ]) {
    const globeBottom = orbitTop + g;            // viewport coords
    const contentTop = TOPBAR + margin;          // viewport coords
    assert.ok(contentTop >= globeBottom,
      `${label}: content starts at ${contentTop}px but the globe ends at ${globeBottom}px — it would cover the page`);
    // …and not by an absurd amount, or the deck is pushed off screen to satisfy the test.
    assert.ok(contentTop - globeBottom <= 60,
      `${label}: ${contentTop - globeBottom}px of dead space above Overview is too much`);
  }
  ok(`all three states clear the globe (resting ${TOPBAR + contentMargin} vs ${orbitTop + globe})`);
}

// ---- 3. MARGIN, not padding ----
// .content is the scroll container. padding-top clears the globe on first paint and then lets the
// content scroll straight back up underneath it, which is the same complaint again after one flick
// of the wheel.
{
  const contentRule = css.match(/\.content \{[^}]*\}/)[0];
  assert.ok(/margin-top:/.test(contentRule),
    'the clearance must be margin-top — padding-top lets content scroll back under the globe');
  assert.ok(/overflow-y:auto/.test(contentRule), '.content is expected to be the scroll container');
  ok('reserved with margin, so scrolled content never passes under the globe');
}

// ---- 4. A smaller globe reserves less space ----
// Guards the states against drifting apart: the docked globe is smaller, so pinning all three to one
// number would leave a visible gap when docked.
{
  assert.ok(dockedGlobe < globe, 'the docked globe is expected to be smaller than the resting one');
  assert.ok(dockedMargin < contentMargin, 'a smaller docked globe must reserve less space, not the same');
  ok('each size state reserves its own clearance');
}

console.log(`axis-overview-clearance: ${n} checks passed`);
