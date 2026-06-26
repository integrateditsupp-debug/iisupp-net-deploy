# AXIS — Voice Director · Build Spec & Sellable Setup Guide
**Date:** 2026-06-25  **Author:** Cowork (Director)  **Owner build:** CC  **Theme:** cyan + black  **Name/wake word:** AXIS

> Internal R&D + sellable product. A hands-free voice front-end to the director agent. Speak → it understands → acts/answers → speaks back. Build documented step-by-step WITH screenshots so it becomes a client setup doc (one-time package) + continuous phone support (recurring).

## Identity & look
- **Name / wake word:** AXIS. Wake: "AXIS". Resume: "AXIS, continue."
- **Theme:** black canvas (#08090c), cyan accent (#36e0c8), silver text (#cdd2da). Minimal, calm, techy. One breathing ring (concentric), hairline borders, generous space. NO busy bars, glow, or clutter (per Ahmad's redesign).

## Core behaviors (the spec)
1. **Wake-gated listening.** Mic stays closed until the wake word "AXIS" is detected. Nothing is transcribed or stored before wake. Visual: ring idle/dim until wake.
2. **Speaker lock (your voice only).** On first run, enroll Ahmad's voiceprint (on-device). Every utterance is verified against it; non-matching voices are NOT transcribed, NOT stored, NOT acted on. Privacy by design — others are ignored entirely.
3. **Pause / resume.** "hold on" (or "AXIS, pause") → silent Paused state: mic effectively muted, nothing recorded, ring frozen, veil shows "Paused — say 'AXIS, continue'." Stays paused until "AXIS, continue."
4. **Background-noise rejection.** Voice-activity detection + speaker match; ambient noise and other people are discarded, never logged.
5. **The brain (compact private memory).** Local, AES-encrypted store. Memories written as compressed binary/embeddings ("bits"), NOT plaintext — only AXIS's local key reads them. Compression + dedupe keep size tiny; show a live size meter. Obsidian-like structure but encrypted + small.
6. **Safety gates inherited from the director.** Voice is input, not new authority. No destructive/financial/send/publish action by voice without an explicit spoken confirm + the same approval gates as text.

## Architecture (MVP → premium)
- **Wake word:** MVP = lightweight browser keyword spotter (e.g. Porcupine/wasm or Web Speech heuristic) → premium on-device model.
- **Speaker verification:** MVP = browser speaker-embedding match (enroll + cosine threshold) → premium = robust on-device model. Voiceprint stored encrypted, local only.
- **STT:** MVP = Web Speech API (free) → premium = Whisper/Deepgram for accuracy.
- **Brain:** local encrypted file (AES-GCM); entries = compressed embeddings + short keys; size meter; export/wipe controls.
- **Voice out (TTS):** MVP = browser SpeechSynthesis → premium = ElevenLabs/Azure for a signature AXIS voice.
- **Brain of brains:** the director agent (Claude) — same reasoning + gates as the text director.
- **Phone variant (later):** Twilio Voice ↔ agent ↔ TTS = recurring managed product.

## Build slices (screenshot each → feeds the sellable guide)
- **S1 — Shell + wake gate:** the AXIS panel (cyan/black, breathing ring) + wake-word detection opens the mic; transcript shows live text only after "AXIS". Screenshot: idle vs woken.
- **S2 — Speaker lock:** enroll Ahmad's voiceprint; verify per-utterance; demo a second voice being ignored (no transcript). Screenshot: "voice locked" + rejected-voice case.
- **S3 — Pause/resume:** "hold on" → silent paused veil → "AXIS, continue" resumes. Screenshot: paused state.
- **S4 — Round trip:** transcript → director agent → text reply → spoken reply (TTS). Screenshot: full exchange.
- **S5 — The brain:** encrypted compact memory write/read + size meter + wipe. Screenshot: brain panel.
- **S6 — Action gating demo:** a safe spoken command runs; a risky one asks for confirm. Screenshot.
- **S7 — Package:** assemble screenshots + config into the client **Setup Doc**.

## MVP scope for CC (S1–S4, local only)
Browser MVP, no publish, no paid APIs: wake gate, basic speaker-lock enroll+match, live transcript, director round-trip, browser TTS reply, pause/resume. Stub premium pieces cleanly. Capture screenshots S1–S4.

## Sellable packaging
- **Setup package (one-time):** stand up the client's AXIS + hand over the documented setup. Quote-based ($10–60K by scope; tie to implementation add-on model).
- **Continuous phone support (recurring):** managed AXIS voice/phone assistant — monthly.
- **Website:** a service card on the redesigned services page + Book an Appointment CTA.

## Gates (STOP — Ahmad)
- No publish, no paid SDK/API, no external sends. Build local in /tmp clone (mount index corrupt).
- Voiceprint/biometric is Ahmad's OWN voice, on-device, encrypted — never uploaded; AXIS never handles third-party biometrics (IDV stays delegated to PingOne/RSA).

---
## CANONICAL VISUAL (locked 2026-06-25) — "Dark Matter"
Build AXIS around this look (original dark-matter version):
- **White space** background (#ffffff), generous padding, calm + minimal.
- **Core:** a soft dark sphere (radial #26303d → #141a23 → #080b11 → transparent edge), ~138px, gently breathing. Soft vignette edge, NOT a hard circle.
- **One faint ring** orbiting the core (single ring — not two), thin, low-opacity cyan/grey, slow breathe.
- **Particle field:** ~80 sparse drifting specks around the sphere; mostly dark grey, ~30% cyan; subtle twinkle.
- **Accent:** cyan (#36e0c8 / #1fb2a0). **Header:** "A X I S" dark, letter-spaced. State dot + label top-right.
- **States:** idle = slow/dim; wake = particles speed + brighten, ring brightens; paused = calm + veil "Paused — say 'AXIS, continue'".
- Below the stage: hint line, transcript (thin cyan left border), meta row (locked to your voice · others ignored · brain size), three controls (wake · "hold on" · continue).
Keep it elegant and understated — no tendrils, no second ring, no busy lines inside the sphere.

---
## DESIGN HANDOFF — AXIS panel tokens (FINAL, locked 2026-06-25)
Build the AXIS shell to these exact values (polished dark-matter reference).

**Canvas / layout**
- Panel: bg #ffffff, border 0.5px rgba(10,12,17,.08), radius 16px (xl), padding 26px 32px 24px.
- Stage height 286px; core sphere 140px centered.

**Core sphere** (radial): `radial-gradient(circle at 37% 33%, #283341 0%, #151b25 38%, #080b12 66%, rgba(6,8,14,0) 100%)` — soft vignette edge (not hard). Gentle breathe (scale ±3%, ~3s).

**Ring (one)**: ellipse scaleY 0.94, radius ~164px, stroke rgba(40,170,168,0.26→0.54 by energy), 1px. Breathe ±4px.

**Aura**: radial cyan rgba(54,224,200,0.05→0.11) fading to 0 at r≈210 — depth only, behind everything.

**Particles**: ~120, ~60% in a band r=140–176 (hugging ring), rest r=78–198. Dark #1a2430 (α≈.42) + ~32% cyan #18968c (α≈.32→.7), twinkle. Drift speed scales with energy.

**State pill** (top-right): text #0f8a90 on bg rgba(54,224,200,.10), radius 999px, 11px/500. Live 3-bar meter animates ONLY while Listening/Speaking.

**Type / contrast (WCAG-checked)**
- Wordmark "A X I S" 15px/500 #0a0c11, letter-spacing .36em.
- Hint 12px #6b7280; emphasis #3a4150/500. Transcript 13px #3a4150, left border 1px rgba(15,138,144,.4). Meta 11px #6b7280.
- Cyan text ONLY as #0f8a90 (never #36e0c8 on white). #36e0c8 reserved for non-text accents/particles.

**States**: idle=slow/dim energy≈.4; wake→energy 1 (particles+ring brighten, meter animates); pause→energy .1, veil "Paused — say 'AXIS, continue'", meter stops.

**Controls**: 3 pill buttons (wake · "hold on" · continue), 0.5px border, active scale .97. ≥36px tap target.
