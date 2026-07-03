// COMPANION GLOBE-BOX — the golden globe stays a globe and is never covered, and there is now ONE box (2026-07-02
// refactor: the separate #companionPanel layer is DELETED; the companion renders into the single #overlayCard,
// anchored BELOW the globe, bounded + internally scrolling, never a full-window takeover). Proves: (a) no
// #companionPanel; (b) #overlayCard is a below-globe card (top clears the globe, not inset:0); (c) #overlayGlobe
// stays a visible sibling; (d) steps render into the ONE card body; (e) input-text = field + guarded on-device
// tap-to-speak, typing always works. Structural (source) proof; the visible one-box is boot-verified in boot-smoke.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const overlay = rd("src", "renderer", "overlay.js");
const overlayHtml = rd("src", "renderer", "overlay.html");
let n = 0; const t = () => { n++; };

// 1 — the ugly separate layer is GONE: no #companionPanel element and no .companion-panel CSS rule.
assert.doesNotMatch(overlayHtml, /id="companionPanel"/, "#companionPanel element is deleted");
assert.doesNotMatch(overlayHtml, /\.companion-panel\s*\{/, "the .companion-panel CSS layer is deleted");
t();

// 2 — the SINGLE #overlayCard is a below-globe card: anchored under the globe (top clears it), NOT inset:0, and
// bounded with internal scroll so nothing is cut off.
const cardRule = (overlayHtml.match(/#overlayCard\s*\{[^}]*top:[^}]*\}/) || [""])[0];
assert.ok(cardRule, "found the #overlayCard sizing rule (with top/max-height/overflow)");
assert.doesNotMatch(cardRule, /inset\s*:\s*0/, "#overlayCard must NOT be inset:0 / full-window (that would hide the globe)");
assert.match(cardRule, /top\s*:\s*9\dpx/, "#overlayCard is anchored BELOW the globe (top clears the ~84px globe)");
assert.match(cardRule, /max-height\s*:/, "#overlayCard has a max-height so it fits the window");
assert.match(cardRule, /overflow-y\s*:\s*auto/, "#overlayCard scrolls internally (nothing cut off)");
t();

// 3 — the globe stays present + a visible sibling; setMode toggles the CARD, never the globe.
assert.match(overlayHtml, /id="overlayGlobe"/, "the golden globe button is present in the overlay");
const globeIdx = overlayHtml.indexOf('id="overlayGlobe"');
const cardIdx = overlayHtml.indexOf('id="overlayCard"');
assert.ok(globeIdx > -1 && cardIdx > -1 && globeIdx < cardIdx, "globe and card are separate siblings (globe first)");
assert.match(overlay, /function setMode\(mode\)[\s\S]*?card\.hidden = !showCard/, "setMode toggles the single card, not the globe");
assert.doesNotMatch(overlay, /overlayGlobe[^\n]*(hidden = true|style\.display = "none")/, "the globe is never hidden for the companion");
t();

// 4 — steps render INTO the ONE card body (#overlayBody, aliased as companionBody) via the same content engine.
assert.match(overlay, /const companionBody = copy;/, "companionBody IS the single card body (#overlayBody), not a separate panel");
assert.match(overlay, /const copy = document\.getElementById\("overlayBody"\)/, "the card body is #overlayBody");
assert.match(overlay, /function renderCompanion\(\)[\s\S]*?companionBody\.innerHTML = ""/, "renderCompanion clears + fills the card body");
assert.match(overlay, /companionBody\.appendChild/, "steps are appended into the card body");
t();

// 5 — an input-text step exposes a .companion-input field AND an optional on-device tap-to-speak button (guarded);
// typing ALWAYS works regardless of the mic.
assert.match(overlay, /step\.type === "input-text"[\s\S]*?el\("input", "companion-input"\)/, "input-text renders a .companion-input field");
assert.match(overlay, /step\.type === "input-text"[\s\S]*?addTapToSpeak\(input/, "input-text offers the optional tap-to-speak affordance");
assert.match(overlay, /function addTapToSpeak\(input[\s\S]*?createLocalStt\(/, "in-field tap-to-speak uses the bundled on-device engine (createLocalStt), not a cloud recognizer");
assert.match(overlay, /function addTapToSpeak\(input[\s\S]*?if \(!canMic \|\| !window\.sentinel \|\| !window\.sentinel\.voskModelUrl\) return null/, "no mic / no bundled model → button hidden gracefully (typing still works)");
assert.match(overlay, /input\.addEventListener\("input", \(\) => \{ comp\.answers\[step\.key\] = input\.value/, "typing always updates the answer, independent of voice");
t();

assert.equal(n, 5, "5 companion-globe-box groups");
console.log(`companion-globe-box test passed (${n} groups · #companionPanel deleted · ONE #overlayCard below the globe, not inset:0 · bounded + internal scroll · globe stays a visible sibling · steps render into the card body · input-text = field + guarded tap-to-speak).`);
