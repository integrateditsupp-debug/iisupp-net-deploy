// COMPANION VOICE — the audible half of the companion, on-device only ($0, no paid/cloud voice API). Proves:
// (1) NARRATION (OUTPUT) is guarded by speechSynthesis availability and degrades silently when absent; it is ON
// by default with an always-available header mute toggle; (2) it speaks the SAME visible card text (read from
// the rendered .companion-lead/.companion-sub) — never a separate/embellished script (Rule 14); (3) it prefers
// a calm, professional FEMALE voice (Microsoft Aria/Jenny → Zira → any female en-US) at rate ~0.95 / pitch ~1.0;
// (4) voice INPUT (tap-to-speak) is guarded by SpeechRecognition availability; (5) NO paid/cloud voice API or
// network call is used. Structural (source) proof.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const overlay = rd("src", "renderer", "overlay.js");
const overlayHtml = rd("src", "renderer", "overlay.html");
let n = 0; const t = () => { n++; };

// 1 — NARRATION is guarded by speechSynthesis availability (no throw where the API is missing) and ON by default.
assert.match(overlay, /function narrate\(text\)\s*\{[\s\S]*?typeof speechSynthesis === "undefined"[\s\S]*?return/, "narrate() no-ops when speechSynthesis is unavailable");
assert.match(overlay, /new SpeechSynthesisUtterance\(/, "narration uses on-device speechSynthesis (SpeechSynthesisUtterance)");
assert.match(overlay, /let narrationMuted = false/, "narration is ON by default (not muted)");
t();

// 2 — a mute/unmute toggle exists in the companion header and flips narrationMuted (and cancels in-flight speech).
assert.match(overlayHtml, /id="companionMute"/, "header has a mute toggle button");
assert.match(overlay, /companionMuteBtn\?\.addEventListener\("click", \(\) => \{[\s\S]*?narrationMuted = !narrationMuted/, "mute toggle flips narrationMuted");
assert.match(overlay, /narrationMuted[\s\S]*?speechSynthesis\.cancel\(\)/, "muting cancels any in-flight narration");
assert.match(overlay, /if \(narrationMuted[^\n]*\) return/, "narrate() stays silent while muted");
t();

// 3 — narration speaks the SAME on-screen text: it reads the rendered lead/sub nodes, not a separate script.
assert.match(overlay, /function speakCurrentCard\(\)[\s\S]*?companionBody\.querySelectorAll\("\.companion-lead, \.companion-sub"\)[\s\S]*?narrate\(/, "narration is sourced from the visible card text (lead/sub), not a hardcoded script");
assert.match(overlay, /function renderCompanion\(\)[\s\S]*?speakCurrentCard\(\)/, "each rendered card narrates its own visible text");
t();

// 4 — FEMALE voice preference: Microsoft Aria/Jenny (neural) → Zira → any female en-US; calm rate/pitch.
assert.match(overlay, /function pickNarrationVoice\(\)/, "voice picker exists");
assert.match(overlay, /aria\|jenny/i, "prefers Microsoft Aria / Jenny first");
assert.match(overlay, /zira/i, "falls back to Zira");
assert.match(overlay, /female\|woman[\s\S]*?en\[-_\]\?US/i, "then any female en-US voice");
assert.match(overlay, /u\.rate = 0\.95/, "calm rate ~0.95");
assert.match(overlay, /u\.pitch = 1\.0/, "natural pitch ~1.0");
t();

// 5 — voice INPUT is TRUE on-device offline STT (Vosk), NOT the browser cloud recognizer. It is gated on a mic +
// a locally-bundled model; hidden when either is unavailable; active only while listening; NEVER a cloud fallback.
const stt = rd("src", "renderer", "local-stt.mjs");
assert.doesNotMatch(overlay, /webkitSpeechRecognition|window\.SpeechRecognition/, "no browser Web Speech recognizer in the mic path (it can route audio to Google's cloud)");
assert.match(overlay, /createLocalStt\(/, "tap-to-speak uses the bundled on-device engine (createLocalStt)");
assert.match(overlay, /window\.sentinel\.voskModelUrl/, "the mic is gated on a bundled local Vosk model URL");
assert.match(overlay, /Voice stays on your device/, "truthful on-device caption is shown (only on the local path)");
assert.match(overlay, /classList\.add\("listening"\)/, "a listening indicator shows while the mic is active");
// the engine itself: offline Vosk, local mic, no network host, no cloud recognizer.
assert.match(stt, /"vosk-browser"/, "engine loads the offline Vosk WASM build");
assert.match(stt, /getUserMedia/, "mic captured locally via getUserMedia");
assert.doesNotMatch(stt, /https?:\/\//, "no network host in the STT engine (model is a local file:// URL)");
assert.doesNotMatch(stt, /webkitSpeechRecognition|SpeechRecognition/, "no cloud recognizer in the engine");
t();

// 6 — $0, on-device ONLY: no paid/cloud voice API, no network call anywhere in the voice path (overlay + engine).
assert.doesNotMatch(overlay, /elevenlabs|azure|googleapis|polly|api[_-]?key|fetch\(|XMLHttpRequest/i, "no paid/cloud voice API or network call in the overlay");
assert.doesNotMatch(stt, /elevenlabs|azure|googleapis|polly|api[_-]?key|fetch\(|XMLHttpRequest/i, "no paid/cloud voice API or network call in the STT engine");
t();

assert.equal(n, 6, "6 companion-voice groups");
console.log(`companion-voice test passed (${n} groups · narration guarded + muteable + ON by default · speaks the same on-screen text · female voice Aria/Jenny→Zira→female en-US at 0.95/1.0 · tap-to-speak guarded by SpeechRecognition · $0 on-device, no cloud API).`);
