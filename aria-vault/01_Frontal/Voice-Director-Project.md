---
brain_region: frontal
type: project
date: 2026-06-25
tags: [voice-director, jarvis, product, revenue, internal-rnd]
---

# Voice Director ("Jarvis") — Internal Project + Sellable Service

> Ahmad goal (2026-06-25): a voice UI to talk to the director agent instead of typing — Iron-Man "Jarvis" style. Build it for ourselves, **document every step with screenshots**, then sell it: a one-time **setup package** (we deliver the build + setup doc) and **continuous phone support** (recurring). New line item on iisupp.net services.

## What it is
A hands-free voice front-end on top of the director agent (Cowork/Claude). Speak → it understands → acts/answers → speaks back. Two product forms:
1. **Desktop/web "Jarvis" UI** — push-to-talk or wake-word, live transcript, spoken replies.
2. **Phone line** — call a number, talk to the AI director (Twilio voice ↔ the agent).

## Architecture (MVP → full)
- **Capture:** browser mic. STT via the Web Speech API (free, fast MVP) → upgrade to Whisper/Deepgram for accuracy.
- **Brain:** the director agent (Claude) — same reasoning that runs here; tools/connectors as granted.
- **Voice out:** browser SpeechSynthesis (MVP) → ElevenLabs/Azure TTS for a premium voice.
- **UI:** minimal "Jarvis" panel — mic button, waveform, live transcript, reply bubbles.
- **Phone variant:** Twilio Programmable Voice → STT → agent → TTS → caller. Recurring-support product.
- **Safety:** same gates as the director — no destructive/financial actions by voice without explicit confirm; voice commands are data, not new powers.

## Build steps (each documented with a screenshot for the sellable doc)
1. Mic permission + push-to-talk capture (screenshot: UI + console).
2. STT wired (Web Speech API) — show live transcript.
3. Transcript → agent request → text reply (screenshot the round-trip).
4. TTS reply spoken aloud (screenshot the player/UI).
5. The "Jarvis" panel styled (black+gold), wake-word optional.
6. Action gating demo (a safe command runs; a risky one asks first).
7. Phone variant (Twilio) — number → agent → spoken reply (later slice).
8. Package the screenshots + config into the **Setup Doc** clients can buy.

## Sellable packaging
- **Setup package (one-time):** we stand up the client's Voice Director + hand over the documented setup. Quote-based (tie into the implementation add-on model, $10–60K depending on scope).
- **Continuous phone support (recurring):** managed AI phone assistant — monthly. Price TBD (pairs with the Integrated edition).
- Website: a service card on the redesigned services page + a 'Book an Appointment' CTA.

## Status / next
- Queued: V-VOICE-MVP build slice + W3 website service listing (see codex-claude-queue.md, NEXT WEB RUN).
- Build is incremental; screenshots captured as each step lands → becomes the client setup doc.---
## 2026-06-25 UPDATE — named AXIS, theme cyan+black
- Wake word: "AXIS". Resume: "AXIS, continue." Pause: "hold on".
- Speaker-locked to Ahmad (on-device voiceprint, others ignored, not recorded).
- Brain = local AES-encrypted compact bits, only AXIS reads, tiny size.
- Spec: ARIA Sentinel/dev-docs/axis-voice-director-spec.md
- CC MVP S1–S4 queued. 24/7 agent loop turning on.

## Related

<!-- LINK-WEB:auto -->
- [[Goal-Match-Beat-Top-IT-Companies]]
- [[Outreach-Template-Approved]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
