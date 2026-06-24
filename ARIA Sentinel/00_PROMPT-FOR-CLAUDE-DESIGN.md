# PROMPT FOR CLAUDE DESIGN — ARIA Sentinel

Paste this entire message into your Claude Design session. Attach the 6 SVG files in this folder.

---

You are the senior product designer on a new product: **ARIA Sentinel**.

ARIA Sentinel is a Windows-first (then all-OS, all-browser) ambient AI tech-support agent that lives on the user's machine, watches for errors (BSOD, crashes, browser failures, login loops, slow PC), and either fixes them automatically (Autonomous mode), proposes a fix (Confirmed mode), or walks the user through it (Manual mode, default at install). It shows up as a floating gold globe that hugs viewport edges and dodges the cursor. Strict privacy — nothing leaves the device.

I need you to design the full product experience and produce the deliverables listed below.

## Inputs you have

1. **Master brief** — `01_master-brief-for-claude-design.md` in this folder. Read it in full. It is the source of truth for product positioning, brand foundations, modes, BSOD integration, architecture, build sprints, copy rules, and engineering constraints.

2. **Six reference SVG mockups** — already drafted to set the visual direction:
   - `02_globe-states.svg` — the 5 states of the floating globe (idle / listening / diagnosing / fixing / done)
   - `03_fix-card.svg` — the card that slides up from the globe (detected / fixing / done / escalation)
   - `04_bsod-takeover.svg` — the BSOD recovery screen with the "ARIA — Solve it for me" option
   - `05_architecture-diagram.svg` — the 4-layer architecture (brand / backend / browser ext / desktop agent)
   - `06_sprint-stages.svg` — the 7-sprint build timeline with AI hour estimates
   - `07_user-flow.svg` — linear user flow from download to first fix + BSOD edge lane

   Use these as the visual starting point. You are free to elevate them (richer rendering, motion specs, finer typography) but **do not change the gold/black color system, the Cinzel + Inter typography, or the globe geometry**.

3. **Existing brand reference**: visit `https://iisupp.net` (live homepage) and `https://iisupp.net/aria` (live ARIA demo) for typography, globe motif, color palette, dark-only design language. Match these.

## What I need from you

### Deliverable 1 — Figma file
- All design tokens (colors, typography, spacing, motion timing) as variables
- Component library: globe, fix card, escalation card, tray menu, settings panel, installer step, in-browser globe, BSOD card
- Auto-layouted variants for every component
- Annotations on motion timing + easing curves

### Deliverable 2 — 20 high-fidelity mockups
Cover everything in Section 6 of the master brief. Critical-priority must ship in v1:
1. Floating globe (refine the 5 states with cleaner rendering + richer glow)
2. Fix card (4 states: detected / fixing / done / escalation) at production fidelity
3. BSOD takeover screen (full Windows recovery composition)
4. Tray icon right-click menu
5. Settings window (Mode selector, Recipe tab, Privacy verifier, Hotkeys, About)
6. Installer flow (4 screens: welcome, permissions explainer, mode select, done)
7. First-run UAC + SmartScreen explainer cards
8. Manual mode chat overlay (ARIA chatbot UI)
9. Browser extension globe rendered over a real webpage screenshot
10. Recipe-applied done state — variants by recipe family (disk / network / browser / app crash / BSOD)
11. Escalation card (hardware failure / "Contact Desktop Support")
12. Landing page hero for `iisupp.net/aria-sentinel/`
13. Landing page supporting sections (modes / BSOD demo / privacy / recipes carousel / IT teams / pricing / FAQ)
14. Autonomous mode opt-in flow (trust upgrade UX)
15. Recipe transparency log view
16. Restore point indicator
17. Multi-monitor globe placement diagram
18. Onboarding tour (4 cards)
19. macOS port adapter view (Sprint 2 reference)
20. Privacy verifier panel (proves no upload paths)

### Deliverable 3 — Internal alignment deck (12 slides, Google Slides / Keynote)
Layout per Section 10 of master brief. Include the 6 reference mockups as exhibits. Slide structure:
1. Cover — ARIA Sentinel logo + tagline
2. The problem (4 stats)
3. The product in one sentence + globe screenshot
4. Three modes (Manual default, Confirmed, Autonomous)
5. 4-layer architecture diagram
6. Privacy by engineering, not by promise
7. BSOD integration — the wow moment
8. Top 25 recipes visualized in a grid
9. Demo flow — install → first detection → fix → done
10. Pricing model (B2B-first standalone product)
11. Roadmap by sprint
12. CTA + contact

### Deliverable 4 — Customer / investor demo deck (16 slides)
Internal deck above plus:
13. Market timing — why ambient agents now
14. Competitive landscape (no real strict-privacy competitor)
15. Distribution strategy
16. Pilot offer + booking link

### Deliverable 5 — Animated globe demo
- Lottie JSON or MP4
- Loop: idle → listening → diagnosing → fixing → done → idle
- 8 second loop, 30fps, < 500KB
- Used in landing page hero + investor deck

### Deliverable 6 — Marketing one-pager (PDF, single page)
- Hero CTA at top, 3 modes mid, BSOD demo bottom-third, footer with privacy verifier link
- Print-ready (8.5×11 + A4 versions)

## Constraints you must honor

- **Dark only.** Gold (#c5a059, #f1dca7) on black (#050505). Never light mode.
- **Cinzel for display + headlines. Inter for body. ui-monospace for technical.**
- **No emojis in product UI.**
- **No testimonials, no fake proof, no "guarantee" / "money-back" / "risk-free" language.**
- **No mention of "21+ years" — only "15+ years" if referenced.**
- **No mention of Raymond James anywhere.**
- **Globe must feel calm.** Never chatty. Animates only when needed.
- **All assets at 1×/2×/3× scales.**
- **No external CDN runtime deps.** All shipped in installer.
- **Maximum globe+card footprint:** 320×200px.
- **Globe is click-through except its 80px hitbox.**

## Approval gate

Before exporting production files, send Ahmad a gated preview of:
- All 20 mockups at v1
- The Lottie globe animation
- The two decks at draft fidelity

Ahmad reviews. Approves or requests revisions. Approved set becomes the source of truth — the build team (Cowork × Codex) cannot deviate.

## Hand off after approval

When approved:
- Export Figma → Code Connect mappings (Cowork × Codex use these)
- Export all assets to `iisupp.net/assets/sentinel/` directory naming
- Export decks as PDF + editable source
- Export Lottie JSON for the animated globe

Build begins immediately after approval. Sprint 0 (backend) is already in flight.

## Background on the founder + company

- Founder: Ahmad Wasee (15+ years IT operations, Integrated IT Support Inc., Whitby ON)
- D-U-N-S: 241726397
- Product company: Integrated IT Support Inc., trading as `iisupp.net`
- Existing live SaaS: ARIA voice/chat support at `iisupp.net/aria`
- Brand built around premium gold/black aesthetic with Cinzel typography
- B2B-first positioning (Personal/Pro/SMB/Mid/Enterprise tiers exist for the ARIA web product, separate pricing for Sentinel TBD)

## What to ask if unclear

Send back questions in a numbered list. Don't proceed silently on assumptions. The product positioning is locked, but design execution decisions (animation specifics, exact spacing, deck slide layouts) are yours to make.

---

Begin with: read the master brief in full, study the 6 reference SVGs, then come back to me with (a) any blocking questions, (b) your proposed approach, (c) a delivery timeline. After alignment, ship the Figma file first.

Total expected design time: 12-20 focused hours. Delivery target: 5 elapsed days.

Go.
