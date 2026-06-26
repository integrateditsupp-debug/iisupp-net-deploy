# AXIS MVP — Codex (CC) Task Packet
**Date:** 2026-06-26  
**Author:** AXIS 24/7 Dispatcher  
**Target:** Claude Code / Codex (CC)  
**Status:** READY TO RUN — Ahmad approval to start  
**Scope:** S1–S4 browser MVP (local only, no publish, no paid APIs)  
**Spec source:** `ARIA Sentinel/dev-docs/axis-voice-director-spec.md` (CANONICAL VISUAL locked 2026-06-25)

---

## Objective

Build AXIS browser MVP slices S1–S4 as a standalone local HTML/JS panel inside the ARIA Sentinel project. No paid APIs. No external sends. No deploy to production. Build in /tmp clone (mount index corrupt — R16 rule).

AXIS is a voice-front-end to the director agent. Speak → wake word → transcribe → director → reply → TTS. Local, private, on-device, encrypted memory planned for S5+.

---

## Context CC Must Read First

1. `ARIA Sentinel/dev-docs/axis-voice-director-spec.md` — full spec + CANONICAL VISUAL + design tokens (FINAL)
2. This packet — task slices, constraints, screenshot targets
3. `senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md` — hard rules

---

## Files to Create / Touch

| File | Action |
|---|---|
| `ARIA Sentinel/renderer/axis.html` | NEW — AXIS panel (standalone page, linked from main nav) |
| `ARIA Sentinel/renderer/axis.js` | NEW — wake gate, speaker match, transcript, TTS, director round-trip |
| `ARIA Sentinel/renderer/axis.css` | NEW — dark-matter panel tokens (or inline in axis.html) |
| `ARIA Sentinel/main.mjs` | ADD — `axis` window route (if nav link needed) |
| `ARIA Sentinel/renderer/renderer.js` | ADD — nav link "AXIS" to axis.html (if nav exists) |
| `ARIA Sentinel/dev-docs/axis-voice-director-spec.md` | READ ONLY — do not edit |

Keep changes minimal outside the AXIS files. Do not touch existing Sentinel recipes, privacy-audit, or suites unless a test requires it.

---

## Slice S1 — Shell + Wake Gate

**Goal:** Render the AXIS panel with the dark-matter visual. Wake word "AXIS" (typed or basic keyword) opens the mic gate; idle state is dim/slow; woken state brightens the ring + particles.

**Build steps:**

1. Create `axis.html` with the full dark-matter panel:
   - Canvas bg #ffffff, panel border 0.5px rgba(10,12,17,.08), radius 16px, padding 26px 32px 24px
   - Stage 286px height, core sphere 140px centered
   - Sphere: `radial-gradient(circle at 37% 33%, #283341 0%, #151b25 38%, #080b12 66%, rgba(6,8,14,0) 100%)` — gentle CSS `@keyframes breathe` (scale ±3%, ~3s, ease-in-out infinite)
   - One ring: ellipse scaleY 0.94, radius ~164px, `stroke: rgba(40,170,168,0.26)`, 1px, CSS breathe ±4px
   - Aura: radial pseudo behind sphere, `rgba(54,224,200,0.05)` fading to 0 at r≈210
   - Particles: ~120 canvas dots (use `<canvas>` overlay), ~60% at r=140–176 hugging ring, rest r=78–198. Colors: `#1a2430` (α≈.42) + ~32% `#18968c` (α≈.5). Slow drift by default.
   - State pill top-right: idle text = "Idle", bg `rgba(54,224,200,.10)`, text `#0f8a90`
   - Wordmark "A X I S" 15px/500 `#0a0c11`, letter-spacing .36em
   - Hint line 12px `#6b7280`, transcript area (13px `#3a4150`, left border 1px `rgba(15,138,144,.4)`)
   - Meta row (11px `#6b7280`): "locked to your voice · others ignored · brain: — KB"
   - 3 controls: pill buttons (wake · "hold on" · continue), 0.5px border `rgba(40,170,168,0.4)`, min 36px tap target

2. Implement wake gate in `axis.js`:
   - MVP: listen for typed keyword "AXIS" in a text input OR use `webkitSpeechRecognition` with keyword matching
   - On wake: set energy = 1 (particles speed up, ring brightens to `rgba(40,170,168,0.54)`, state pill → "Listening")
   - On idle/stop: energy = 0.4 (particles slow, ring dims back)
   - Transcript area shows live text only AFTER wake gate opens (nothing before)

3. **Screenshot target S1:** two states side-by-side — Idle (dim sphere, slow ring) and Woken (bright ring, fast particles, state pill "Listening"). Capture with Electron `screenshot()` or browser screenshot tool.

**Acceptance:** Panel renders correctly in Electron (or browser). Wake toggles visual state. No console errors.

---

## Slice S2 — Speaker Lock (Enroll + Verify)

**Goal:** On first run, enroll Ahmad's voiceprint. Every subsequent utterance is verified against it. A second voice is NOT transcribed.

**Build steps:**

1. Add enrollment flow (first-run only):
   - Show "Enroll your voice" prompt when no voiceprint exists in localStorage
   - Record 3–5 seconds of Ahmad speaking → extract a simple speaker embedding (mean MFCC vector is sufficient for MVP; use WebAudio API's `AnalyserNode` + frequency data as a proxy voiceprint)
   - Store embedding as base64 JSON in `localStorage['axis_voiceprint']`
   - Show "Voice locked — re-enroll" button in meta row

2. Add per-utterance verification:
   - When mic is open (post-wake), compare real-time audio embedding to stored voiceprint using cosine similarity
   - If similarity < threshold (e.g. 0.65): audio is discarded; transcript area shows nothing; particle pulse shows a brief dim/red flash (non-match visual); state pill → "Ignored"
   - If similarity >= threshold: transcript proceeds normally

3. Demo path (for screenshot):
   - Simulate a "second voice" by playing a tone or injecting noise at low cosine score
   - Screenshot: "voice locked" badge in meta row + "Ignored" pill state when second voice speaks

**Acceptance:** Enrollment runs once. Voiceprint stored. Subsequent verify cycle runs per utterance. Rejected audio produces no transcript text.

**Note:** MVP speaker lock is a heuristic (frequency envelope similarity). Good enough to demo and screenshot. Premium replaces with a proper speaker-diarization model (S5+).

---

## Slice S3 — Pause / Resume

**Goal:** "Hold on" (spoken or button click) → silent Paused state, nothing recorded. "AXIS, continue" (spoken or button) resumes.

**Build steps:**

1. Pause state:
   - On "hold on" (button or keyword match in transcript): close mic, stop WebAudio capture, set energy = 0.1
   - Overlay a semi-transparent veil (#fff at 0.4 opacity) over the stage with text: "Paused — say 'AXIS, continue'"
   - State pill → "Paused". Particle drift stops. Ring dims to near-invisible.
   - Nothing is transcribed or stored during paused state.

2. Resume:
   - "AXIS, continue" spoken (if speech recognition is still running in wake-word-only mode with minimal processing) OR clicking "continue" button
   - Remove veil, restore energy = 0.4 idle (or 1 if still within a session), re-open mic capture
   - State pill → "Listening" or "Idle" depending on session state

3. **Screenshot target S3:** paused veil clearly visible over the sphere, state pill showing "Paused", controls visible below.

**Acceptance:** Pause closes audio capture with no transcript. Resume restores all. No race conditions between wake/pause/resume states.

---

## Slice S4 — Director Round Trip (Transcript → Agent → TTS Reply)

**Goal:** Post-wake transcript → send to director (Claude via existing ARIA Sentinel agent channel or a stub) → receive text reply → speak reply via browser TTS.

**Build steps:**

1. Transcript → director:
   - On final utterance (silence detection or user stops speaking), take accumulated transcript string
   - POST to existing ARIA chat endpoint (check `ARIA Sentinel/main.mjs` for the `/api/chat` or similar route) OR stub with a mock handler that returns a test reply
   - Show "Thinking…" state during round-trip (state pill → "Thinking", ring slow pulse)

2. Display + speak reply:
   - On response: display reply text in transcript area (with a distinct AXIS-prefix styling, e.g. `>` prefix or `#0f8a90` text color)
   - Speak reply using `window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply))` (browser SpeechSynthesis API)
   - State pill → "Speaking" during TTS output. Ring brightens slightly. 3-bar meter animates.
   - After TTS finishes: state pill → "Idle". Mic gate closes. Ready for next "AXIS" wake.

3. If ARIA Sentinel's API is not accessible in the current /tmp clone environment: use a local stub handler:
   ```js
   function stubDirector(input) {
     return `AXIS received: "${input}". Director is offline — connect agent for live responses.`;
   }
   ```
   Stub must be clearly labeled in UI as "Stub mode — connect director for live responses."

4. **Screenshot target S4:** full exchange visible — user transcript + AXIS reply in transcript area. State pill showing "Speaking". Ring brightened.

**Acceptance:** Round trip completes (real or stub). TTS reply is audible in Electron. Screenshot captures the full exchange visible in panel.

---

## Safety Gates (Do Not Cross)

- No publish to Netlify / production
- No paid STT, TTS, or speaker-model APIs (use Web Speech API and WebAudio only)
- No biometric data uploads or external sends
- No deletion of existing Sentinel files
- No git push to origin (mount index corrupt — write to /tmp clone; Cowork merges after Ahmad approves)
- No changes to existing suites or recipe engine

---

## Risks

| Risk | Mitigation |
|---|---|
| WebSpeechRecognition not available in Electron | Use `chrome.runtime` polyfill or `SpeechRecognition` shim; or accept keyboard-trigger for MVP demo |
| Speaker cosine similarity too crude for demo | Set threshold low (0.3) for MVP; label as "heuristic MVP" in UI |
| `/api/chat` endpoint unavailable in /tmp clone | Use stub director; label clearly |
| WCAG contrast failure on white bg | All cyan text must be `#0f8a90` not `#36e0c8`; check against spec |

---

## Next Prompt (After S1–S4 Done)

> "AXIS MVP S1–S4 complete. Screenshots in [path]. Ready for S5 (encrypted brain) or package into Setup Doc (S7). Ahmad to review screenshots and approve next slice."

---

## Revenue Context

AXIS is:
1. An R&D proof for IIS/ARIA (voice agent capability)
2. A sellable setup package ($10–60K per client implementation)
3. A managed recurring product (phone support variant, monthly)

Building S1–S4 clean + documented is the foundation for both. Every screenshot = a page in the client setup guide (S7).

---

*Task packet produced by AXIS 24/7 Dispatcher. No external action taken. Awaiting Ahmad approval to hand to CC.*
