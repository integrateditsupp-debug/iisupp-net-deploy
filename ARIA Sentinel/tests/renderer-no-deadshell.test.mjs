// P1 DEAD-SHELL REGRESSION (renderer wiring) — proves the two blockers are gone: (1) renderState no longer
// force-opens the full-screen #planModal as an interaction-blocking wall; (2) the plan modal is DISMISSIBLE
// (a "Maybe later" close, wired) so an intentionally-opened upsell never traps the user; and the DIAGNOSE
// controls route to the navigable ARIA tab. Structural (source) proof — jsdom is not a dependency here.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const renderer = rd("src", "renderer", "renderer.js");
const indexHtml = rd("src", "renderer", "index.html");
let n = 0; const t = () => { n++; };

// 1 — THE WALL IS GONE: renderState no longer auto-shows #planModal for the free/expired/unentitled state.
assert.doesNotMatch(renderer, /if \(!gate\.unlocked && !planModalShown && !gate\.walkthroughEntitled\)\s*\{[\s\S]*?#planModal[\s\S]*?hidden = false/,
  "renderState does NOT force-open the full-app plan modal (the dead-shell wall)");
// belt-and-suspenders: the whole renderState body never sets planModal.hidden=false.
const renderStateBody = renderer.match(/function renderState\(next\)[\s\S]*?\n}/)[0];
assert.doesNotMatch(renderStateBody, /planModal[\s\S]*?hidden = false/, "renderState never opens the plan modal at all");
assert.doesNotMatch(renderStateBody, /planModalShown = true/, "renderState never latches the plan-modal-shown wall");
t();

// 2 — the plan modal is DISMISSIBLE: a close control exists in markup AND is wired to close (never a trap).
assert.match(indexHtml, /id="planModalClose"/, "#planModal has a dismiss button");
assert.match(renderer, /bindClick\("planModalClose",[\s\S]*?closePlanModal\(\)/, "the dismiss button closes the plan modal");
assert.match(renderer, /function closePlanModal\(\)\s*\{[\s\S]*?planModalShown = false/, "closePlanModal clears the shown flag");
// Escape also closes it.
assert.match(renderer, /#planModal[\s\S]*?Escape[\s\S]*?closePlanModal/, "Escape closes the plan modal");
t();

// 3 — the nav handler still routes to activateTab, and only the PAID tabs (not the baseline) hit the locked
// upsell; the locked overlay + plan modal both have a close (dismissible, not a pointer-trap).
assert.match(renderer, /function wireNavigation\(\)[\s\S]*?activateTab\(button\.dataset\.tab\)/, "nav handler activates the clicked tab");
assert.match(renderer, /currentTabGate\[button\.dataset\.tab\] === false/, "only a locked tab diverts to the upsell (baseline tabs are never locked in tabGateMap)");
assert.match(renderer, /function closeLockedTabOverlay\(\)/, "the locked-tab overlay is dismissible");
assert.match(indexHtml, /id="lockedTabClose"/, "the locked-tab overlay has a Close control");
t();

// 4 — DIAGNOSE ISSUE fires its handler and routes to the (always-navigable) ARIA chat.
assert.match(renderer, /bindClick\("diagnoseIssue", \(\) => \{ activateTab\("aria"\)/, "Diagnose-issue routes to the ARIA tab");
assert.match(renderer, /bindClick\("dashDiagnose", \(\) => \{ activateTab\("aria"\)/, "Dashboard diagnose routes to the ARIA tab");
t();

assert.equal(n, 4, "4 renderer-no-deadshell groups");
console.log(`renderer-no-deadshell test passed (${n} groups · no force-opened plan-modal wall · plan modal dismissible (Maybe later + Esc) · nav handler intact + overlays closeable · Diagnose routes to ARIA).`);
