// COMPANION GLOBE-BOX FIX — the golden globe stays a globe and is never covered. The companion is a SMALL card
// BELOW it (mirroring #overlayCard / .globe-confirm), NOT a full-window inset:0 takeover. Proves: (a) the panel
// is anchored below the globe (top ~104px), bounded width, internal scroll — and is NOT inset:0/full-window;
// (b) #overlayGlobe stays present/visible when the companion is open (the panel is a sibling, never wraps it);
// (c) steps render into #companionBody; (d) input-text exposes a .companion-input field + an optional,
// on-device-STT-guarded tap-to-speak button (typing always works). Structural (source) proof.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const overlay = rd("src", "renderer", "overlay.js");
const overlayHtml = rd("src", "renderer", "overlay.html");
let n = 0; const t = () => { n++; };

// Extract the `.companion-panel { ... }` rule block so we can assert on its actual declarations.
const panelRule = (overlayHtml.match(/\.companion-panel\s*\{[\s\S]*?\}/) || [""])[0];
assert.ok(panelRule, "found the .companion-panel CSS rule");

// 1 — the panel is NOT a full-window takeover: no `inset: 0` (or inset:0) that would cover the globe.
assert.doesNotMatch(panelRule, /inset\s*:\s*0/, "companion-panel must NOT be inset:0 / full-window (that hid the globe)");
t();

// 2 — the panel is anchored as a card BELOW the globe: top ~104px, centered, bounded width, capped height.
assert.match(panelRule, /position\s*:\s*absolute/, "panel is absolutely positioned (a card, not a flow block)");
assert.match(panelRule, /top\s*:\s*104px/, "panel anchored just below the globe (top ~104px, like .globe-confirm)");
assert.match(panelRule, /left\s*:\s*50%/, "panel horizontally centered");
assert.match(panelRule, /transform\s*:\s*translateX\(-50%\)/, "panel centered via translateX(-50%)");
assert.match(panelRule, /width\s*:\s*300px/, "panel has a bounded (~300px) width, not full-window");
assert.match(panelRule, /max-height\s*:/, "panel has a max-height so it fits the window");
// internal scroll: the body scrolls inside the bounded card.
assert.match(overlayHtml, /\.companion-body\s*\{[^}]*overflow-y\s*:\s*auto/, "companion body scrolls internally (overflow-y:auto)");
t();

// 3 — the globe stays present + visible when the companion is open: #overlayGlobe exists and the companion is a
// SEPARATE sibling <section> (it never wraps/replaces the globe), and overlay.js only toggles the PANEL hidden.
assert.match(overlayHtml, /id="overlayGlobe"/, "the golden globe button is present in the overlay");
assert.match(overlayHtml, /id="companionPanel"[\s\S]*class="companion-panel"/, "companion is its own panel element");
// the globe button is declared before the companion panel and neither nests the other (siblings under <body>).
const globeIdx = overlayHtml.indexOf('id="overlayGlobe"');
const panelIdx = overlayHtml.indexOf('id="companionPanel"');
assert.ok(globeIdx > -1 && panelIdx > -1 && globeIdx < panelIdx, "globe and companion are separate siblings (globe first)");
// overlay.js shows/hides ONLY the companion panel — it never hides the globe when companion opens.
assert.match(overlay, /companionPanel\.hidden = !showCompanion/, "setMode toggles only the companion panel, not the globe");
assert.doesNotMatch(overlay, /overlayGlobe[^\n]*(hidden = true|style\.display = "none")/, "the globe is never hidden for the companion");
t();

// 4 — steps render INTO #companionBody (the box below the globe), through the same content engine.
assert.match(overlay, /const companionBody = document\.getElementById\("companionBody"\)/, "companionBody is the render target");
assert.match(overlay, /function renderCompanion\(\)[\s\S]*?companionBody\.innerHTML = ""/, "renderCompanion clears + fills companionBody");
assert.match(overlay, /companionBody\.appendChild/, "steps are appended into companionBody");
t();

// 5 — an input-text step exposes a .companion-input field AND an optional tap-to-speak button; the button is
// guarded by SpeechRecognition availability (hidden gracefully when absent) so typing ALWAYS works.
assert.match(overlay, /step\.type === "input-text"[\s\S]*?el\("input", "companion-input"\)/, "input-text renders a .companion-input field");
assert.match(overlay, /step\.type === "input-text"[\s\S]*?addTapToSpeak\(input/, "input-text offers the optional tap-to-speak affordance");
assert.match(overlay, /function addTapToSpeak\(input[\s\S]*?createLocalStt\(/, "tap-to-speak uses the bundled on-device offline engine (createLocalStt), not a cloud recognizer");
assert.match(overlay, /function addTapToSpeak\(input[\s\S]*?if \(!canMic \|\| !window\.sentinel \|\| !window\.sentinel\.voskModelUrl\) return null/, "no mic / no bundled model → button hidden gracefully (typing still works)");
// typing path is unconditional: the input + its input-listener exist regardless of the mic.
assert.match(overlay, /input\.addEventListener\("input", \(\) => \{ comp\.answers\[step\.key\] = input\.value/, "typing always updates the answer, independent of voice");
t();

assert.equal(n, 5, "5 companion-globe-box groups");
console.log(`companion-globe-box test passed (${n} groups · panel is a below-globe card, not inset:0 · bounded width + internal scroll · globe stays a visible sibling · steps render in #companionBody · input-text = field + guarded tap-to-speak, typing always works).`);
