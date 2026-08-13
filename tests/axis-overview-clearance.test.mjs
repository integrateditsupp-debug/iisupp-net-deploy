// tests/axis-overview-clearance.test.mjs — the page order: topbar, globe, then the deck. Nothing
// sits on top of anything, and there is ONE AXIS surface (2026-08-12).
//
// Ahmad: "move overview section lower so its not over the other content on the page", then
// "no you moved it above axis-director. Leave axis-director field where it was, place axis below that
// and make axis larger.", then finally: "Remove the one above the globe and ensure all its existing
// data, knowledge and knows is added to the Axis (globe) one." The director field was a second door
// into the same room — same dock transcript, same brain queue — so removing it lost nothing; its
// honest-counts line and quick chips moved onto the orbit.
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

// ---- 2. inside the band: ONE surface — the globe, with the strip's inheritance on it ----
// This is the literal ask. A second input field mounted above the globe is the regression.
{
  const head = html.slice(html.indexOf('class="axis-head"'));
  const band = head.slice(0, head.indexOf('class="content"'));
  assert.equal(band.indexOf('id="axisStripSlot"'), -1,
    'the director-field slot must be gone — "Remove the one above the globe"');
  const iOrbit = band.indexOf('class="axis-orbit"');
  assert.ok(iOrbit >= 0, 'the orbit lives in the head band');
  assert.ok(band.indexOf('id="axisOrbStatus"') >= 0, 'the honest-counts line lives ON the orbit now');
  assert.ok(band.indexOf('data-orb-q=') >= 0, 'the quick chips live ON the orbit now');
  // And it must not ALSO exist as a floating overlay outside .main, or AXIS appears twice.
  assert.equal((html.match(/class="axis-orbit"/g) || []).length, 1, 'exactly one orbit in the document');
  ok('one surface: the globe carries the counts line and the chips');
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

// ---- 6. the strip is gone from the code, and its knowledge lives on the orbit ----
// axisStrip built a SECOND input above the globe. If it comes back, AXIS has two doors again.
{
  assert.ok(!/function axisStrip\(/.test(js), 'axisStrip must not exist — no second input above the globe');
  assert.ok(!/mountAxisHead/.test(js), 'nothing mounts into a band above the globe any more');
  const render = js.slice(js.indexOf('function renderModule()'), js.indexOf('function clearOverlays()'));
  assert.ok(/renderOrbStatus\(\)/.test(render),
    'renderModule refreshes the orbit counts line on every render, every screen');
  assert.ok(/All quiet\. AXIS is watching\./.test(js), 'the honest-counts line survived the move');
  assert.ok(/data-orb-q/.test(js), 'the quick chips are wired to askAxis');
  // …and the counts line collapses when empty, so the pre-snapshot paint carries no stray gap.
  assert.ok(/\.axis-orb-status:empty \{ display:none/.test(css),
    'an empty counts line collapses instead of leaving a gap under the globe');
  ok('strip gone; counts line and chips live on the orbit');
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
