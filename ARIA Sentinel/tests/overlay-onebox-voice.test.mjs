// P1 OVERLAY — ONE box (no separate #companionPanel layer) + on-device tap-to-speak voice loop. Structural
// proof of the wiring (the visible one-box behaviour is boot-verified in tests/boot-smoke.mjs). Rule 14:
// no cloud recognizer, no fabricated reply.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const html = rd("src", "renderer", "overlay.html");
const js = rd("src", "renderer", "overlay.js");
let n = 0; const t = () => { n++; };

// 1 — #companionPanel (the ugly layer) is GONE; the single #overlayCard hosts everything (incl. a mute toggle,
// a Back/Close, and a 🎤 Tap-to-speak in its head), and companion content renders into the card's #overlayBody.
assert.doesNotMatch(html, /id="companionPanel"/, "#companionPanel element is deleted");
assert.doesNotMatch(html, /class="companion-panel"|\.companion-panel\s*\{/, "the .companion-panel layer CSS is gone");
assert.match(html, /id="overlayCard"[\s\S]*?id="overlayBody"/, "the single #overlayCard contains #overlayBody");
assert.match(html, /id="overlayCardHead"[\s\S]*?id="overlaySpeak"[\s\S]*?id="companionMute"/, "the card head has 🎤 speak + mute controls");
assert.match(js, /const companionBody = copy;/, "the companion renders into the ONE card body (#overlayBody), not a separate panel");
t();

// 2 — setMode guarantees ONE box: opening the card cancels/hides #overlayConfirm AND the greeting (no overlap).
const setMode = js.match(/function setMode\(mode\)[\s\S]*?\n}/)[0];
assert.match(setMode, /const showCard = mode === "card" \|\| companion;/, "card + companion both use the ONE #overlayCard");
assert.match(setMode, /if \(showCard\) \{[\s\S]*?confirmEl[\s\S]*?hidden = true;[\s\S]*?greeting[\s\S]*?hidden = true;/, "opening the card hides the confirm bubble AND the greeting");
assert.match(setMode, /clearTimeout\(confirmTimer\)[\s\S]*?clearTimeout\(greetingTimer\)/, "their auto-show timers are cancelled so they can't reappear on top of the card");
t();

// 3 — tap-to-speak: hide the box (globe-only), listen ON-DEVICE (Vosk), NEVER a cloud fallback.
assert.match(js, /overlaySpeakBtn\?\.addEventListener\("click", \(\) => \{ startVoiceAsk\(\); \}\)/, "🎤 button starts the voice ask");
const startVoice = js.match(/async function startVoiceAsk\(\)[\s\S]*?\n}/)[0];
assert.match(startVoice, /setMode\("globe"\)/, "tap-to-speak HIDES the box (globe only)");
assert.match(startVoice, /voskModelUrl/, "uses the bundled on-device Vosk model");
assert.match(startVoice, /createLocalStt\(/, "transcribes with the local engine");
assert.match(startVoice, /setGlobeState\("listening"\)/, "puts the globe in the listening state");
assert.match(startVoice, /if \(!modelUrl\)[\s\S]*?openCompanion\(\)/, "no on-device model → fall back to the typeable menu (NEVER a cloud recognizer)");
assert.doesNotMatch(js, /webkitSpeechRecognition|window\.SpeechRecognition/, "no browser cloud recognizer anywhere in the overlay");
t();

// 4 — stop → route the transcript to ARIA's KB-first answer engine and NARRATE the reply; real-or-empty.
const stopVoice = js.match(/async function stopVoiceAndAnswer\(\)[\s\S]*?\n}/)[0];
assert.match(stopVoice, /sentinel\.chat\?\.\(q, \{\}\)/, "the transcript is sent to ARIA's KB-first answer engine (sentinel.chat)");
assert.match(stopVoice, /narrate\(reply\)/, "the reply is narrated");
assert.match(stopVoice, /if \(!reply\) \{ setGlobeState\("idle"\); return; \}/, "no answer → stay quiet (real-or-empty, never fabricate)");
// tapping the globe controls the voice loop (stop+answer while listening; stop while speaking).
assert.match(js, /if \(voiceActive\) \{ await stopVoiceAndAnswer\(\); return; \}/, "globe tap while listening → stop + answer");
assert.match(js, /speechSynthesis\.speaking\) \{ cancelVoice\(\); return; \}/, "globe tap while speaking → stop");
t();

// 5 — narration drives the globe speaking/idle states and stays the calm female voice, on-device, $0.
const narrate = js.match(/function narrate\(text\)[\s\S]*?\n}/)[0];
assert.match(narrate, /u\.onstart = \(\) => setGlobeState\("speaking"\)/, "globe shows 'speaking' while ARIA talks");
assert.match(narrate, /u\.onend = \(\) => setGlobeState\("idle"\)/, "globe returns to idle when the reply ends");
assert.match(html, /data-state="speaking"/, "the globe has a speaking visual state");
assert.match(js, /aria\|jenny/i, "narration keeps the female voice preference (Aria/Jenny)");
assert.doesNotMatch(js, /elevenlabs|azure|googleapis|polly|api[_-]?key|fetch\(|XMLHttpRequest/i, "no paid/cloud voice API or network call");
t();

assert.equal(n, 5, "5 overlay-onebox-voice groups");
console.log(`overlay-onebox-voice test passed (${n} groups · #companionPanel deleted · ONE #overlayCard · setMode shows one box · tap-to-speak on-device (Vosk, no cloud) → sentinel.chat → narrate · globe speaking/idle · real-or-empty).`);
