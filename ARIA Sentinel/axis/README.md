# AXIS — voice layer for the IIS operation

> **AXIS** = Augmented eXecution Intelligence System. Voice-first AI companion. The pivot around which Ahmad's operation rotates. Same brain as Cowork, same memory as the vault, same agent mesh — wrapped in a voice. Male voice. Wake-word "AXIS".

## What this directory is

Phase 1 (voice-in) scaffolding for AXIS. **Stubs only** — no runtime code, no installed dependencies yet (respecting the $20–70 CAD/mo spend cap; Whisper / ElevenLabs are NOT installed this run).

## Layout

```
axis/
├── voice-in/        Phase 1 — hotkey → local Whisper → transcript → route
│   ├── hotkey-listener.mjs    register a global hotkey (Win+Space default)
│   ├── whisper-wrapper.mjs    spawn local Whisper, return transcript
│   ├── transcript-router.mjs  classify transcript → brain region → dispatch
│   └── tests/hotkey.test.mjs  stub unit test
├── voice-out/       Phase 2 — TTS replies (empty for now)
├── brain-bridge/    read the vault + Cowork memory by region/query
│   ├── vault-reader.mjs
│   └── memory-reader.mjs
└── docs/ARCHITECTURE.md   full architecture (lifted from the vault)
```

## Read before any voice work (in the vault)

- `aria-vault/07_Cortex/AXIS.md` — full vision, phasing, architecture
- `aria-vault/00_Index/Brain-Map.md` — anatomical region layout
- `aria-vault/02_Hippocampus/RULES.md` — hard rules
- `aria-vault/07_Cortex/Ahmad.md` — founder profile
- `aria-vault/02_Hippocampus/DIRECTOR_AUTONOMY.md` — Standing Rule 12

## Phasing

| Phase | What |
|---|---|
| 0 | Vault reshape into brain regions + AXIS.md (DONE) |
| 1 | Voice-in: hotkey → Whisper → Cowork chat (**this scaffold**) |
| 2 | Voice-out: TTS replies |
| 3 | Wake-word "AXIS" + persistent listening + privacy LED |
| 4 | Productize as a tier ("AXIS Mode") |

## Admin truth

AXIS uses `SENTINEL_ADMIN_TOKEN` for any admin endpoints — the same single source of admin truth as ARIA Sentinel. No separate admin secret.
