// PROD 2026-10-14 (audit R19 / R2 / R11 / R18) — the renderer promises only what the code does. A short list of
// over-promises a non-technical buyer would test on day one is forbidden in every customer-facing renderer
// surface, and the honest replacements are asserted present.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0; const t = () => { n++; };

const html = rd("src", "renderer", "index.html");
const renderer = rd("src", "renderer", "renderer.js");
const overlay = rd("src", "renderer", "overlay.js");
const overlayHtml = rd("src", "renderer", "overlay.html");
const all = html + renderer + overlay + overlayHtml;

// 1 — forbidden over-promises (the walk-through cannot open apps; updates are manual; CPU/24-7 unmeasured; fixes are not applied before anything ran).
const FORBIDDEN = [
  [/opens each page or app/, "the walk-through opens web pages, not apps"],
  [/Auto-updates included/, "updates are manual in this version (the badge now reads state.updates)"],
  [/<\s?1% idle CPU|&lt;1% idle CPU/, "no unmeasured CPU claim"],
  [/24\/7/, "no 24/7 promise without a staffed on-call"],
  [/fixes them before they slow you down/, "nothing is fixed before the person allows it"],
  [/never sleeps/, "the agent can be stopped, paused and killed — it does sleep"],
  [/Running now — the verified outcome lands/, "no 'running' before a result"],
  [/Fix applied \(reversible\)\./, "no 'applied' before it ran"],
  [/Enable live fixes to apply\./, "no pointer at a control that did not exist (the switch is real now: Settings → Autonomy)"],
  [/lives in the corner of your screen/, "the globe roams and parks at the top when it needs you"],
  [/Open chrome:\/\/extensions</, "the app cannot open chrome:// pages"],
  [/Trial active · \$\{result\.status\.daysRemaining\}/, "no undefined days left"]
];
for (const [re, why] of FORBIDDEN) assert.doesNotMatch(all, re, why);
t();

// 2 — the honest replacements are present.
assert.match(renderer, /opens the right web page for you in your browser and pauses whenever you need to type, choose, sign in or pay/, "walk-through launcher copy says web pages");
assert.match(renderer, /Updates: manual in this version/, "the updates badge is honest");
assert.match(html, /Updates: manual in this version/);
assert.match(html, /After-hours coverage depends on your plan's support terms\./, "support hours say what is staffed");
assert.match(html, /applies the vetted fixes you allow — without sending your data anywhere/, "About says what the product does");
assert.match(html, /How to install \(copy path\)/, "the extension control is labelled by what it does");
assert.match(html, /id="routingNote"[^>]*>Example mapping — it becomes active only after ServiceNow is connected/, "the routing rows are labelled as an example");
assert.match(html, /In Manual mode the globe stays out of your way \(clicks pass through it\); press Ctrl\+Alt\+G/, "the globe's click-through behaviour is explained where the toggle is");
assert.match(renderer, /When it needs you it moves to the top of your screen; click it, or press Ctrl\+Alt\+G/, "tour step 1 says where the globe goes");
assert.match(html, /Pause anytime from Control Center → Pause 1 hour, or Stop ARIA\./, "the Autonomous modal points at a control that exists");
assert.match(html, /id="killSwitchBtn"/, "an on-screen kill switch exists for people who do not know Ctrl+Alt+K");
assert.match(renderer, /bindClick\("killSwitchBtn"/);
assert.match(renderer, /Voice isn't available on this install — typing works/, "a failed voice start explains itself instead of hiding the mic");
assert.match(overlay, /sttUnavailableReason\(err\)/, "the globe's tap-to-speak explains itself too");
t();

// 3 — pending-card targets resolve to a tab or redirect that exists (R24), and the Walk-through tab's note is true.
assert.match(renderer, /const pending = \(d\.pending \|\| \[\]\)\.map\(\(p\) => \(\{ \.\.\.p, tab: p && \(TAB_TITLES\[p\.tab\] \|\| TAB_REDIRECTS\[p\.tab\]\) \? p\.tab : "about" \}\)\)/, "a pending card never deep-links into nothing");
assert.match(html, /This is guidance only — nothing changes on your PC unless you approve a gated fix/);
t();

assert.equal(n, 3, "3 copy-claims groups");
console.log(`copy-claims test passed (${n} groups · ${FORBIDDEN.length} over-promises forbidden · honest replacements present · pending cards resolve).`);
