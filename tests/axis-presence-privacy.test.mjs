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

// ---- 3. the globe expands on a live turn and returns on idle ----
// Sizing must be driven by the shared state machine, so it behaves the same whether Ahmad is
// talking or AXIS is.
for (const st of ['listening', 'speaking']) {
  const re = new RegExp(`:root\\[data-axis-state="${st}"\\] \\.axis-orbit \\.axis-globe`);
  assert.ok(re.test(css), `${st} resizes the orbit globe`);
}
// "about 25% of the page"
assert.ok(/width:clamp\(120px, 25vh, 38vw\)/.test(css), 'the live size is ~25% of the viewport height');
// No idle rule needed — absence of the state attribute falls back to the 104px base, which IS the
// "returns to original size" behaviour. Assert the base still exists so that fallback is real.
assert.ok(/\.axis-orbit \.axis-globe \{ width:104px; height:104px;/.test(css),
  'the base size survives — that is what idle falls back to');

// Source order carries the override here: :root[data-axis-open] and :root[data-axis-state] have
// identical specificity (0,4,0), so the state rules only win by coming later in the file.
const openIdx = css.indexOf(':root[data-axis-open="1"] .axis-orbit .axis-globe');
const stateIdx = css.indexOf(':root[data-axis-state="listening"] .axis-orbit .axis-globe');
assert.ok(openIdx !== -1 && stateIdx !== -1, 'both rules are present');
assert.ok(stateIdx > openIdx,
  'the state rules must come AFTER [data-axis-open] — equal specificity means source order decides');
ok('globe expands to ~25vh while listening or speaking, and outranks the docked size');

// ---- 4. a quarter of the screen must not arrive unannounced under reduced motion ----
const rm = css.slice(css.indexOf('@media (prefers-reduced-motion:reduce) {\n  .axis-orbit .axis-globe { transition:none;'));
assert.ok(/transition:none/.test(rm), 'no animated growth under reduced motion');
assert.ok(/width:132px/.test(rm), 'the size signal is kept, just small and instant');
ok('reduced motion keeps the feedback without the sweep');

console.log('ok — the login screen forgets, and the globe breathes with the turn');
