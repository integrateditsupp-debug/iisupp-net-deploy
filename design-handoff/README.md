# ARIA — Handoff Package

Cinematic web prototype + comparison demo for **ARIA — Enterprise AI Assistant**.

## Files (final, no drafts)

| File | Purpose |
|---|---|
| `ARIA Demo.html` | Cinematic 2:30 product trailer with sound + record-to-video button |
| `ARIA vs Human Desk.html` | Live KPI / cost comparison vs a 7-agent team |
| `ARIA Concept.html` | Reference design canvas — 7 static scenes |
| `aria-tokens.css` | Design tokens (color, type, components) |
| `aria-shared.jsx` | Globe, browser frame, icons, primitives |
| `aria-motion.jsx` | Animated panels, mic, stats, waveform |
| `aria-cinematic.jsx` | Scene compositions (intro · search · choice · resolve · voice · ops · outro) |
| `aria-audio.jsx` | Web-Audio ambient pad + ARIA voice + cue table |
| `aria-artboards.jsx` | Static reference scenes for Concept canvas |
| `animations.jsx` · `design-canvas.jsx` | Stage / canvas runtime |

## Brand system
- **Type**: Cormorant Garamond (display, italic accents) · Inter (UI) · JetBrains Mono (labels, numbers)
- **Palette**: warm-tinted black `#0B0907` / `#050402`, cream `#EDE6D6`, gold `#C9A567` → `#E8C988`
- **Voice**: female, calm, sophisticated — "let's solve this together"

## To record an MP4
Open `ARIA Demo.html`, click **● RECORD VIDEO** (bottom-right), grant screen capture, watch the demo through, click **■ STOP & DOWNLOAD**. Browsers that support `video/mp4` will save MP4 directly; otherwise WebM downloads (any free converter → MP4).

## To build the apps (Claude Code instructions)
Targets: **iOS · Android · iPadOS · Windows**. Use this prototype as the visual + interaction reference.

Recommended stack:
- **Mobile / tablet**: React Native + Expo (single codebase iOS / Android / iPad)
- **Windows**: Electron *or* React Native Windows
- Share design tokens (`aria-tokens.css` → JS theme object)
- Voice: native SpeechRecognition + on-device TTS; fallback to cloud
- Globe: Three.js (web) / react-native-skia (mobile)
- Audit/auth: signed action ledger as shown in the Resolve scene

Lift these specifically from the prototype:
1. **Onboarding** — globe materialize → tagline → CTA (intro scene)
2. **Search/research mode** — browser pane + ARIA suggestion chips
3. **Support flow** — Walk-me-through vs Resolve-it-for-me cards
4. **Remote execution UI** — process list + audit trail + signed checksum
5. **Voice console** — large globe + waveform + live transcript + caller card
6. **Ops dashboard** — L1/L2/L3 tiered grid with live counter
7. **Compare/ROI screen** — KPI parity + cost delta (vs-desk file)

Total runtime of the trailer: **2:30**. Comparison demo: **2:00**.

— Integrated IT Support, Inc. · iisupport.net
