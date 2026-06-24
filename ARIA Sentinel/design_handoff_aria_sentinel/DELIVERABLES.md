# ARIA Sentinel — Deliverables Manifest

Everything in this bundle, for the Codex build team and for stakeholder sharing.

## 1 · Build handoff (start here)
- **README.md** — full implementation spec: 21 UI surfaces with layout, measurements, colors, copy, interactions, state model, ServiceNow + governance behaviors, and the locked messaging rules. A developer who wasn't in the design sessions can build from this alone.
- **tokens.css** / **tokens.json** — design tokens (color, type, radius, gradient, motion timing, footprint constraints). Single source of truth for values.
- **copy.md** — all product UI strings + voice/tone rules, verbatim.

## 2 · Reusable assets
- **globe.html** — framework-agnostic gold globe, 6 states, working CSS animations + `setGlobeState()`. Drops directly into the Electron overlay and the browser extension.
- **globe-loop.html** — animated hero globe, self-driving 8-second loop. Use on the landing page / in the deck; screen-record for MP4 or Lottie.

## 3 · Visual source of truth
- **references/ARIA Sentinel Design Library.dc.html** — all 21 production-fidelity surfaces (globe, fix card, BSOD, ServiceNow escalation, ticket created, My tickets, routing, settings, knowledge/governance, installer, tray, privacy verifier, transparency log, restore point, browser globe, onboarding, multi-monitor, architecture). Open with the sibling `support.js` + `Globe.dc.html`.
- **references/Globe.dc.html**, **references/support.js**, **references/deck-stage.js** — runtime needed to open the `.dc.html` references.

## 4 · Presentation
- **presentation/ARIA Sentinel Deck.pptx** — editable PowerPoint (native text + shapes), 16 slides. **Slides 1–12 = internal alignment deck; 13–16 = investor/customer sections** (market timing, competition, distribution, pilot).
- **references/ARIA Sentinel Deck.dc.html** — the live HTML source of the deck (re-export or edit here).

## 5 · Commercial
- **references/ARIA Sentinel Commercial.dc.html** — ~56s business-first commercial (11 scenes, play/pause + scrubber). Flow: queue fills → meet ARIA → everyday-troubleshooting montage → live browser-support demo → researches the unknown / expert escalation → BSOD → ServiceNow routing → auto-updating knowledge → privacy → business+personal → multi-device "Stay tuned" + CTA. Interactive HTML; screen-record for a shareable MP4.

## 6 · Marketing one-pager
- **references/ARIA Sentinel One-Pager.dc.html** — print-ready single page. `@page` is Letter; change `size: Letter` → `size: A4` in the file's `<style>` for A4. Print to PDF.

## 7 · Original brief
- **references/brief/** — master brief, the Claude-Design prompt, and the 6 reference SVGs.

---

## Locked rules (do not break)
- Dark only · gold (#c5a059 / #f1dca7) on black (#050505) · Cinzel display + Inter UI + ui-monospace technical.
- **"15+ years" only — never "21+ years."** Experience claims use "decades of cross-sector experience." (If leadership approves the literal 21+, update copy.md + deck + commercial + library.)
- No testimonials / star ratings / "guarantee" / "money-back" / "risk-free". No Raymond James. No emojis in product UI.
- ServiceNow routing is automatic and **not user-editable** — ARIA picks the assignment group from the signal. Users may only add comments to their own tickets.
- Globe + card footprint ≤ 320×200px · 80px click-through hitbox · idle < 1% CPU.
- No external CDN runtime deps — bundle everything in the installer.

## Build order suggestion (Codex)
Sprint 0 (backend, in flight) → **Sprint 1: Electron app + globe (`globe.html`) + tray + watchers + fix card + ServiceNow escalation + My-tickets + Chrome extension** → Sprint 2 macOS → Sprint 3 Edge/Safari → Sprint 4 Autonomous + BSOD Tier A → Sprint 5 recipe expansion → Sprint 6 polish.

## Not yet generated (say the word)
- MP4 capture of the commercial; Lottie/GIF of the globe.
- PDF exports of the deck and one-pager.
- Real iisupp.net logo lockup / product screenshots spliced into the commercial + one-pager (need the assets).
