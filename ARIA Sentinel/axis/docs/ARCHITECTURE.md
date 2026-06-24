# AXIS — Architecture

> Source of truth: `aria-vault/07_Cortex/AXIS.md`. This doc lifts that vision into the Sentinel repo so voice work has the architecture beside the code. If the two diverge, the vault note wins.

**AXIS** = Augmented eXecution Intelligence System. A voice-first companion: same brain as Cowork, same memory as the vault, same agent mesh — wrapped in a voice Ahmad can talk to instead of typing. Mature male voice. Wake-word **"AXIS"** (distinct from the customer-facing female ARIA orb, so they never cross-fire).

## Personality + voice
- Mature male, refined English. Tone: sharp + composed (Jarvis-calm). Addresses "Ahmad".
- Caveman comms — spoken replies under ~12 words by default; long-form goes to the vault.
- Push-back allowed: if a request is off-strategy, AXIS says so before executing.

## Brain-region model (how AXIS maps to the vault)

The vault is organized like a brain; AXIS routes each query to the right region the way a brain routes input through the thalamus.

| Region | Vault folder | `brain_region` | Function |
|---|---|---|---|
| Frontal cortex | `01_Frontal/` | `frontal` (+ `-iis`/`-aria`/`-sentinel`) | Strategy, planning, product decisions |
| Hippocampus | `02_Hippocampus/` | `hippocampus` | Long-term memory — RULES, VOICE, STACK, DIRECTOR_AUTONOMY |
| Basal ganglia | `03_BasalGanglia/` | `basal-ganglia` | Habits, recurring campaigns |
| Short-term | `04_ShortTerm/` | `short-term` | Daily notes, recent context |
| Thalamus | `05_Thalamus/` | `thalamus` | Inbox + capture — relays raw input |
| Cerebellum | `06_Cerebellum/` | `cerebellum` | Templates / motor skeletons |
| Cortex | `07_Cortex/` | `cortex` (+ `-frontal` planners) | Ahmad + agents + AXIS |
| Amygdala | `08_Amygdala/` | `amygdala` | Threat detection, alerts |
| Decisions | `09_Decisions/` | `frontal-decisions` | Decision records |
| Brainstem | `10_Brainstem/` | `brainstem` | Vital signs — Netlify / Stripe / infra |
| Corpus callosum | `11_CorpusCallosum/` | `corpus-callosum` | Cross-agent handoffs |
| Glia | `12_Glia/` | `glia` | Maintenance (Cleaning, Backup) + support infra |
| Index | `00_Index/` | `cortex-association` | Wayfinding (Brain-Map, _HOME) |

## Pipeline (Phase 1 — voice-in)

```
hotkey (Win+Space)
   → record audio (local)
   → whisper-wrapper  (local Whisper, offline, no cloud)
   → transcript-router.classifyRegion → brain region
   → brain-bridge.vault-reader.readByRegion + memory-reader
   → dispatch to Cowork's brain (existing API)
   → reply (Phase 1: text; Phase 2: TTS male voice)
```

## Stack
- **Front:** reuse the Electron Sentinel shell (OTA-capable) OR a standalone PWA — decision pending.
- **Speech-to-text:** local Whisper (privacy-preserving, no cloud transcription).
- **Text-to-speech (Phase 2):** ElevenLabs premium male (~$5–22/mo, inside the cap) **or** Web Speech `SpeechSynthesis` (free) — decision pending Ahmad.
- **Brain:** Claude (Sonnet/Opus) via the existing Cowork API.
- **Memory bridge:** direct read of `aria-vault/` markdown + Cowork's `memory/MEMORY.md`.
- **Action layer / agent dispatch:** the same MCPs + RUN-packet pattern Cowork already uses.
- **Admin:** any admin endpoint uses `SENTINEL_ADMIN_TOKEN` — single source of admin truth, shared with Sentinel.

## Phasing

| Phase | What |
|---|---|
| 0 | Vault reshape into brain regions + AXIS.md + Brain-Map (DONE) |
| 1 | Voice-in: hotkey → Whisper → Cowork chat (**scaffolded this run**) |
| 2 | Voice-out: TTS male-voice replies |
| 3 | Wake-word "AXIS" + persistent listening + privacy LED indicator |
| 4 | Productize as a tier ("AXIS Mode") |

## What AXIS reads on first boot
`Ahmad` → `RULES` → `VOICE` → `STACK` → `DIRECTOR_AUTONOMY` → `Cowork` → `Brain-Map` → `_ARIA`/`_Sentinel`/`_IIS` → `OTA-pipeline` → Cowork's `memory/MEMORY.md`.

## Hard rules AXIS inherits
- Spend cap $20–70 CAD/mo (no Whisper/ElevenLabs install until budgeted).
- Caveman comms — spoken replies short by default.
- Preview-before-push for visual changes; don't-ask-just-do for safe work.
- Never break ARIA / Aperture / Sentinel runtime.

## Open decisions (Ahmad to confirm)
1. TTS provider: ElevenLabs (premium) or SpeechSynthesis (free)?
2. Shell: bundle inside Sentinel (reuse OTA) or standalone AXIS app?
3. Phase-1 trigger: hotkey-only (recommended) or always-on?
4. Privacy LED indicator UI for the listening state?
