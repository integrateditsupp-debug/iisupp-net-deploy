# On-device speech model (Vosk) — bundled, not committed

Tap-to-speak in the ARIA Companion runs **100% on the user's device**. It uses the open-source, offline
**Vosk** engine (`vosk-browser` WASM) against a small English model. At runtime the app makes **no network
call** for speech — it loads the locally-bundled model as a `file://` URL and transcribes in-process
(`src/renderer/local-stt.mjs`). There is **no cloud recognizer fallback**: if the model isn't present, the mic
button hides and typing still works.

## How the model gets there
- `npm run fetch:vosk-model` (also run automatically by `prepackage`) downloads the official small en-US model
  from Vosk's distribution into `resources/models/vosk-model-small-en-us/`.
- `electron-builder` bundles that folder into the installer via `build.extraResources`
  (`{ from: "resources/models/vosk-model-small-en-us", to: "vosk-model-small-en-us" }`).
- The model directory is **git-ignored** (`resources/models/`) — it's ~40 MB and would bloat the repo.

## Honest size note
The bundled model adds roughly **40–50 MB** to the installer / OTA download. That is the cost of true on-device
speech (nothing leaves the machine). Track it when quoting the app's download size.

Model: `vosk-model-small-en-us` — https://alphacephei.com/vosk/models (Apache-2.0).
