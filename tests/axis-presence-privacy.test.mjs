// axis-presence-privacy.test.mjs — the login screen forgets the last session, and the globe grows
// while a turn is live.
//
// Ahmad, 2026-08-11: "the axis old prompt shows prior to logging into aperture-learning.html as
// well. it should only show the latest one after logging in", and "make the globe at the bottom
// automatically expand when it starts talking or when I talk to it to about 25% of the page and
// gets back to original size when I or it stops talking."
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'assets', 'axis-app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets', 'axis-tokens.css'), 'utf8');
const ok = (m) => console.log('  ok —', m);

// ---- 1. the public panel shows the CURRENT exchange, not a growing pile ----
const pub = app.slice(app.indexOf('async function pubAsk'), app.indexOf('async function pubAsk') + 800);
assert.ok(/log\.innerHTML = ''/.test(pub), 'the public log is cleared before the new question is shown');
assert.ok(pub.indexOf("log.innerHTML = ''") < pub.indexOf("class: 'axis-msg user'"),
  'it must clear BEFORE appending, or the question it just asked is wiped too');
ok('public panel shows only the latest exchange');

// ---- 2. signing out ends the conversation, not just the session ----
assert.ok(/function axisResetTranscripts/.test(app), 'there is a transcript reset');
const lo = app.slice(app.indexOf('function logout()'), app.indexOf('function logout()') + 400);
assert.ok(/axisResetTranscripts\(\)/.test(lo), 'logout calls it');
const reset = app.slice(app.indexOf('function axisResetTranscripts'), app.indexOf('function axisResetTranscripts') + 900);
assert.ok(/dockLog\.length = 0/.test(reset), 'the authed transcript is emptied');
assert.ok(/axisPubLog/.test(reset) && /hidden = true/.test(reset), 'the public log is emptied and re-hidden');
for (const id of ['axisLog', 'axisDirectorLog']) {
  assert.ok(reset.includes(id), `the rendered ${id} is cleared from the DOM, not just the array`);
}
// The authed half can name clients. Leaving it in a display:none subtree is still disclosure.
assert.ok(/innerHTML = ''/.test(reset), 'clearing must touch the DOM, not only the in-memory log');
ok('logout clears both transcripts, in memory and in the DOM');

// ---- 3. the globe keeps ONE resting size ----
// SUPERSEDED, deliberately. This section used to assert the globe grew to ~25vh on a live turn,
// which was Ahmad's request on 2026-08-11. On 2026-08-12 he reversed it: "take it back to how the
// globe was initially center and bottom middle and small, but increase the size by 15%." Growing to
// a quarter of the viewport always read as "big, then suddenly small" when a sentence ended, because
// any return to rest looks like a collapse at that scale.
//
// The liveliness did not disappear — it moved into the canvas (axis-globe.js), where an eased
// envelope swells the sphere and a halo widens per syllable. That is asserted in
// tests/axis-globe-voice.test.mjs. Here we guard the footprint: it must not change.
// Check DECLARATIONS, not prose: the comment above the rules explains that the 25vh growth was
// removed, and an absence-check run against the raw file matches that explanation and fails. Every
// "this must no longer exist" assertion has to run on comment-stripped CSS.
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
assert.ok(/\.axis-orbit \.axis-globe \{ width:120px; height:120px;/.test(cssCode),
  'one resting size, 15% up from the original 104px');
for (const st of ['listening', 'speaking', 'thinking']) {
  const re = new RegExp(`:root\\[data-axis-state="${st}"\\] \\.axis-orbit \\.axis-globe \\{[^}]*(?:width|height):`);
  assert.ok(!re.test(cssCode), `${st} must NOT resize the orbit globe`);
}
assert.ok(!/25vh|38vw/.test(cssCode), 'the viewport-relative growth is gone');
ok('the globe holds one resting size; state drives motion, never footprint');

// ---- 4. a quarter of the screen must not arrive unannounced under reduced motion ----
// Find the reduced-motion block by what it GOVERNS, not by an exact literal first line. The previous
// anchor pinned that line verbatim, so merely adding a rule to the block made indexOf return -1 and
// the assertion then ran against the tail of the file instead of the block it meant to check —
// passing for the wrong reason.
// Brace-match each block. Slicing to the next "\n}" looks right but breaks on single-line media
// queries — their closing brace has no newline before it, so the slice runs on into whatever CSS
// follows and produces a block that matches things it does not actually contain.
function mediaBlocks(src, at) {
  const out = [];
  for (let i = src.indexOf(at); i !== -1; i = src.indexOf(at, i + 1)) {
    const open = src.indexOf('{', i);
    if (open === -1) continue;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) { out.push(src.slice(i, j + 1)); break; }
    }
  }
  return out;
}
const rmBlocks = mediaBlocks(css, '@media (prefers-reduced-motion:reduce)');
const rm = rmBlocks.find((b) => /axis-orbit \.axis-globe/.test(b) && /data-axis-state/.test(b)) || '';
assert.ok(rm, 'a reduced-motion block governs the orbit globe');
assert.ok(/transition:none/.test(rm), 'no animated growth under reduced motion');
// Growth is now accompanied by a speaking swell; reduced motion must kill that too, and it has to do
// so at the SAME specificity as the state rules or it silently loses to them.
assert.ok(/animation:none/.test(rm), 'no speaking swell under reduced motion');
assert.ok(/:root\[data-axis-state="speaking"\] \.axis-orbit \.axis-globe/.test(rm),
  'the reduced-motion override matches the state-scoped specificity');
// There is no longer a reduced-size "signal" to keep, because there is no size change at all — the
// globe holds one footprint in every state. Reduced motion's job here is now only to still the
// motion, which the two assertions above cover.
assert.ok(!/width:\d+px/.test(rm),
  'reduced motion must not reintroduce a size change the normal path no longer has');
ok('reduced motion keeps the feedback without the sweep');

console.log('ok — the login screen forgets, and the globe breathes with the turn');
