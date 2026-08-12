// tests/axis-overview-clearance.test.mjs — the page order: topbar, director field, globe, then the
// deck. Nothing sits on top of anything (2026-08-12).
//
// Ahmad: "move overview section lower so its not over the other content on the page", then
// "no you moved it above axis-director. Leave axis-director field where it was, place axis below that
// and make axis larger."
//
// The first attempt kept the orbit position:fixed and reserved a margin-top band on .content. That
// cleared the globe, but a fixed box reserves no space of its own, so the clearance had to be
// re-derived by hand for each of three globe sizes — and because the director field lives at the top
// of .content, reserving the band shoved the field down below the globe along with everything else.
//
// The fix is structural, not arithmetic: the director field and the globe both moved OUT of .content
// into a flex:none .axis-head band, in that order. .content is flex:1, so the browser subtracts the
// band's height for us. That is what these checks defend — the ORDER and the flex contract, never a
// pixel value, because a pixel value is exactly the thing that went stale last time.
// Run: node tests/axis-overview-clearance.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = fs.readFileSync(path.join(root, 'assets', 'axis-tokens.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'aperture-learning.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets', 'axis-app.js'), 'utf8');
// Absence-checks run on declarations, never on prose: the comments in these files quote the very
// patterns being asserted gone.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
const js = app.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
let n = 0; const ok = (m) => { n++; console.log('  ok —', m); };

// ---- 1. document order: topbar, then the head band, then the scrolling page ----
{
  const main = html.slice(html.indexOf('<div class="main">'));
  const iTop = main.indexOf('class="topbar"');
  const iHead = main.indexOf('class="axis-head"');
  const iContent = main.indexOf('class="content"');
  assert.ok(iTop >= 0 && iHead >= 0 && iContent >= 0, 'topbar, axis-head and content all exist in .main');
  assert.ok(iTop < iHead, 'the head band comes after the topbar');
  assert.ok(iHead < iContent, 'the head band comes BEFORE the scrolling content, or the globe is over the page again');
  ok('topbar → head band → content, in that order');
}

// ---- 2. inside the band: the director field first, the globe under it ----
// This is the literal ask. Reversing these two is the regression.
{
  const head = html.slice(html.indexOf('class="axis-head"'));
  const band = head.slice(0, head.indexOf('class="content"'));
  const iSlot = band.indexOf('id="axisStripSlot"');
  const iOrbit = band.indexOf('class="axis-orbit"');
  assert.ok(iSlot >= 0, 'the director field has a mount slot in the head band');
  assert.ok(iOrbit >= 0, 'the orbit lives in the head band');
  assert.ok(iSlot < iOrbit, 'the director field must come BEFORE the globe — "place axis below that"');
  // And it must not ALSO exist as a floating overlay outside .main, or AXIS appears twice.
  assert.equal((html.match(/class="axis-orbit"/g) || []).length, 1, 'exactly one orbit in the document');
  ok('director field above, globe below it, one orbit only');
}

// ---- 3. the orbit is in the flow — that is what makes the ordering real ----
// A position:fixed orbit reserves no space, so content ends up underneath it no matter where the
// `top` is set. Every pin property is checked, not just `position`.
{
  const rule = css.match(/\.axis-orbit \{[^}]*\}/);
  assert.ok(rule, '.axis-orbit has a rule');
  for (const prop of ['position:fixed', 'position:absolute', 'top:', 'bottom:', 'left:', 'z-index:']) {
    assert.ok(!rule[0].includes(prop),
      `.axis-orbit must not carry ${prop} — a pinned orbit reserves no layout space and content slides under it`);
  }
  ok('the orbit is a normal in-flow block, so it occupies its own height');
}

// ---- 4. the flex contract: the band keeps its height, the page takes the rest ----
{
  const headRule = css.match(/\.axis-head \{[^}]*\}/);
  assert.ok(headRule, '.axis-head has a rule');
  assert.ok(/flex:none/.test(headRule[0]),
    '.axis-head must be flex:none — a shrinking band would let the globe be squeezed instead of the page');
  const contentRule = css.match(/\.content \{[^}]*\}/);
  assert.ok(/flex:1/.test(contentRule[0]), '.content takes the remaining height');
  assert.ok(/overflow-y:auto/.test(contentRule[0]), '.content is the scroll container');
  assert.ok(/min-height:0/.test(contentRule[0]),
    '.content needs min-height:0 or the flex child refuses to shrink and the column overflows');
  ok('flex:none band + flex:1 scroll pane — the browser does the arithmetic');
}

// ---- 5. no hand-reserved clearance survives anywhere ----
// The three margin-top numbers are the thing that went stale. If any of them come back, so does the
// job of keeping them in step with the globe size.
{
  for (const m of css.match(/\.content \{[^}]*\}/g) || []) {
    assert.ok(!/margin-top/.test(m), `.content must not reserve clearance by hand: ${m.trim()}`);
  }
  for (const m of css.match(/[^{}]*\.content \{[^}]*margin-top[^}]*\}/g) || []) {
    assert.fail(`a .content margin-top override came back: ${m.trim()}`);
  }
  ok('no reserved-pixel band left to keep in step');
}

// ---- 6. the field mounts into the band, and every screen starts with it empty ----
// It used to be appended to the content pane. If that comes back it scrolls under the globe again.
{
  assert.ok(/mountAxisHead\(axisStrip\(k\)\)/.test(js), 'Overview mounts the director field into the head band');
  assert.ok(!/c\.append\(axisStrip/.test(js), 'the field must not be appended into the scroll pane any more');
  const render = js.slice(js.indexOf('function renderModule()'), js.indexOf('function clearOverlays()'));
  assert.ok(/mountAxisHead\(null\)/.test(render),
    'renderModule must clear the band, or a screen with no director field inherits the last one');
  // …and the empty band must not leave a gap on those screens.
  assert.ok(/\.axis-head-strip:empty \{ display:none/.test(css),
    'an empty slot collapses, so non-Overview screens carry no stray gap');
  ok('mounted in the band, cleared per render, collapses when unused');
}

// ---- 7. the dock must not sit on top of the globe ----
// The band is outside .content now, so the padding that clears the open transcript has to be applied
// to it too — otherwise the globe stays centred on the full width and hides behind the dock.
{
  const padded = (css.match(/:root\[data-axis-open="1"\]\[data-axis-dock="open"\][^{]*\{[^}]*padding-right[^}]*\}/g) || []).join('');
  assert.ok(/\.axis-head/.test(padded),
    'the head band must clear the open transcript the same way .content does');
  ok('the globe re-centres clear of the open transcript');
}

console.log(`axis-overview-clearance: ${n} checks passed`);
