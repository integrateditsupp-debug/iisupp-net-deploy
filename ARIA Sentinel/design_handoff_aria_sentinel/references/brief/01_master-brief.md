# ARIA Sentinel — Design Handoff Master Brief

**Recipient:** Claude Design session (or any senior product designer)
**Author:** Cowork × Ahmad Wasee · Integrated IT Support Inc.
**Date:** 2026-06-19
**Status:** Approved scope, awaiting design execution

---

## 0 · TL;DR for the designer

ARIA Sentinel is a **persistent on-device error-resolver** for Windows desktops + all major browsers. It watches the user's machine for crashes, errors, and friction (BSOD, app crash, browser cache stale, repeated login fails, slow PC) — and either applies the fix automatically (Autonomous mode), asks first (Confirmed mode), or walks the user through it via chat (Manual mode, default at install).

It manifests as a **floating gold globe** that hugs the viewport edges, dodges the cursor, and surfaces fix proposals via a branded card that slides up from the globe.

**Hard product positioning:**
- B2B-first. Built for businesses.
- **Strict privacy.** Nothing leaves the device. KB recipes come DOWN from `iisupp.net/aria-recipes`, all matching + execution happens locally.
- Standalone product, separate pricing from existing ARIA SaaS tiers.
- Windows desktop first. Chrome + Edge + Safari (within macOS app) extensions all parts of v1.
- Mobile deferred.

**Deliverables you (designer) need to produce:**
1. Brand-aligned high-fidelity mockups for every UI surface listed in §6
2. Presentation deck (12-16 slides) for internal alignment + investor/customer demo
3. Stage-by-stage build visualization (Sprint 0 through Sprint 6)
4. Figma file with components, color tokens, typography tokens, motion specs
5. Marketing one-pager + landing page concept for `iisupp.net/aria-sentinel/`

---

## 1 · Product positioning

**Name:** ARIA Sentinel
**Tagline:** *Resident IT support that never sleeps.*
**One-liner:** ARIA Sentinel lives on your PC, watches for tech problems, and fixes them before they slow you down — without sending your data anywhere.

**Audience:** SMB owners, mid-market IT leads, and enterprise procurement teams who want to reduce help-desk ticket volume without giving up data sovereignty.

**Pricing model:** Standalone subscription. Pricing tiers TBD (separate from ARIA Personal/Pro/SMB/Mid/Enterprise tiers already live on iisupp.net/plans). Manual mode = free trial / freemium. Autonomous + Confirmed modes = paid.

**Why now:** Tech support is moving from "ticket → human" to "agent → ambient fix." First mover wins customer retention + recurring revenue.

---

## 2 · Brand foundations (use the same system as iisupp.net)

### Colors
| Role | Hex | Use |
|---|---|---|
| Background primary | `#050505` | App chrome, dark surfaces |
| Background secondary | `#0a0a0a` | Cards, modals |
| Background tertiary | `#141414` | Inset panels |
| Border | `#2a2a2a` | Divider lines |
| Accent gold | `#c5a059` | Primary brand, globe core, CTA |
| Accent gold light | `#f1dca7` | Highlights, hover state |
| Accent gold dark | `#8b6d2f` | Pressed state |
| Text primary | `#ffffff` | Primary text |
| Text secondary | `#aaaaaa` | Secondary text |
| Text muted | `#666666` | Disclaimers |
| Success | `#7afbff` | Fix-applied confirmation |
| Warning | `#ffcb6b` | Action required from user |
| Error | `#ff7e7e` | Fatal / contact support |

### Typography
- **Display / Headings:** `Cinzel` (serif, used for ARIA logo, hero text, modal headlines)
- **Body / UI:** `Inter` (sans-serif, all UI labels, copy, buttons)
- **Mono / Code:** `ui-monospace, SF Mono, Monaco, Menlo` (timestamps, log excerpts, technical detail)

### Globe identity
- A gold sphere with concentric circles + crosshair lines (same geometry as iisupp.net hero globe)
- Slowly rotates (~30s per full rotation)
- Soft inner glow + outer haze
- See SVG mockup `02_globe-states.svg` for 5 states
- Size: 64px diameter default, 96px when active/diagnosing

### Voice & tone (UI copy)
- Calm, competent, never alarmed
- Short sentences. CEO/operator voice.
- Never use "Oops" / "Whoops" / exclamation marks
- Never apologize for system errors that aren't ARIA's fault
- Confirmation language: "I detected X. Fixing now." / "Done. Refresh to finish."
- Manual mode: "I think this is a printer driver issue. Want me to walk you through it?"

---

## 3 · Modes (3 + edge case)

### Manual (default at install)
- Globe present, watches for issues
- When error detected → globe pulses + prompt: *"I see a printer issue. Open chat for steps?"*
- User clicks → opens chat overlay → ARIA walks through it step by step
- No fixes applied automatically

### Confirmed (paid)
- Globe detects error → fix card slides up: *"I detected disk almost full (3% free). Clear temp files + cache to recover ~4GB?"*
- Buttons: **[Yes, fix it]** **[Tell me more]** **[Not now]**
- On confirm → animation → done card

### Autonomous (paid, opt-in setting)
- Globe detects + fixes silently for low-risk recipes (cache clear, DNS flush, etc.)
- Post-fix card appears: *"I cleared your Chrome cache for [domain]. Refresh the page."*
- Higher-risk fixes (driver reinstall, registry edit) still confirm regardless of mode

### Pause / panic
- Tray icon → "Pause ARIA for 24 hours"
- Global hotkey to pause
- Important: this never disables the BSOD takeover (that's safety, not convenience)

---

## 4 · CRITICAL feature — Blue Screen of Death (BSOD) integration

Ahmad's quote (lock this requirement):
> *"For blue screen issues, once ARIA is installed on the system somehow find a way to make ARIA solutions available as an option on every and any blue screen. When user clicks 'ARIA — Solve it for me' it looks up the error codes in MS database and applies the fix or suggests, and if no other options available then tells user this will need to be looked at by Desktop Support."*

### How this actually works on Windows

Windows BSODs run in **kernel error state**, not user mode. Apps don't run there normally. Three integration points solve this:

**Tier A — Boot Configuration Data (BCD) entry** (achievable in MVP)
- Installer adds an entry to BCD via `bcdedit /create` pointing to a custom WinRE bootmgr menu item: *"ARIA — Solve it for me"*
- When a BSOD occurs, on next boot the user sees the standard Recovery screen AND ARIA's option
- Selecting it boots into WinRE-mode ARIA Sentinel Recovery, which reads the dump file from `C:\Windows\Minidump\`, matches the stop code against the local KB + Microsoft's published BSOD code list, applies the fix
- This is what the UI mockup `04_bsod-takeover.svg` represents

**Tier B — Reagentc + custom recovery image** (Sprint 4)
- Installer modifies `winre.wim` to include ARIA Sentinel Recovery binary
- `reagentc /setreimage` points recovery agent to the modified image
- On crash → automatic boot into ARIA Recovery → fix attempt → resume normal boot
- Requires elevation at install (UAC), one-time

**Tier C — Crash-on-resume detection** (always-on fallback)
- ARIA Sentinel reads `HKLM\SYSTEM\CurrentControlSet\Control\CrashControl\LastBSODTimestamp` on every start
- If last BSOD was < 5 minutes ago, immediately shows fix card on next normal boot
- This catches ANY BSOD even if the boot menu / WinRE customization fails
- No system modification required → safer fallback

**Recommended for MVP:** Ship Tier A + Tier C. Tier B as Sprint 4 polish.

### BSOD fix-or-handoff logic

```
1. ARIA reads stop code (e.g. CRITICAL_PROCESS_DIED / 0x000000EF)
2. Looks up against local KB → matches "Outlook PST corruption" recipe
3. If recipe has confidence > 0.8 → applies fix
4. If 0.5 < confidence < 0.8 → presents fix as suggestion, asks user
5. If confidence < 0.5 → escalation message:
   "This BSOD looks like it may need hardware inspection (RAM, disk, or driver).
    Please contact your local Desktop Support team to get this resolved.
    Error: 0xC000021A — Critical system process terminated."
6. Logs the event locally for next-boot reporting (no upload, just local audit log)
```

### Hardware-failure escalation copy (Ahmad's wording, locked):
> *"This will need to be looked at by Desktop Support as it may need replacement parts or reimaging. Please contact your local Desktop support team to get this resolved."*

---

## 5 · Architecture (4 layers)

```
+--------------------------------------------------------------+
|  L4 - BRAND LAYER                                            |
|  Gold globe, Cinzel/Inter, ARIA voice (existing TTS)         |
+--------------------------------------------------------------+
|  L3 - BACKEND (iisupp.net Netlify Functions - PULL-ONLY)     |
|  /aria-recipes        <- versioned KB recipes (signed)       |
|  /aria-stop-codes     <- Windows BSOD code lookup index      |
|  /aria-recipe-feedback (optional, opt-in, anon)              |
|  No user data EVER uploads from device                       |
+--------------------------------------------------------------+
|  L2 - BROWSER EXTENSIONS (Manifest V3)                       |
|  Chrome -> Edge -> Safari (bundled in macOS app, Sprint 2)   |
|  Service worker watcher + content-script globe               |
|  Localhost WebSocket -> desktop agent for OS-level fixes     |
+--------------------------------------------------------------+
|  L1 - DESKTOP AGENT (Electron, Windows-first)                |
|  Globe UI (transparent Electron window, Three.js globe)      |
|  Background watcher (Event Viewer, Reliability Monitor,      |
|   WMI, registry watchers, perf counters)                     |
|  Fix runner (PowerShell elevated, sandboxed)                 |
|  Local KB cache (SQLite, encrypted at rest)                  |
|  BSOD/WinRE integration (Tier A + Tier C above)              |
|  Tray icon + settings UI                                     |
|  System Restore point creation before risky fixes            |
+--------------------------------------------------------------+
```

See `05_architecture-diagram.svg` for the visual.

### Privacy guarantee — engineered, not promised
- **No upload paths exist in the binary.** Verifiable by network monitor.
- Only HTTP traffic: GET requests to `iisupp.net/.netlify/functions/aria-recipes?v=…` (recipe pulls) and `aria-stop-codes` (BSOD lookup table).
- Recipe pulls happen on a daily schedule; user-triggered "Update knowledge" button forces a pull.
- KB stored in encrypted SQLite at `%APPDATA%\AriaSentinel\kb.db`, key derived from machine-bound credential vault.
- Crash reports + telemetry: OFF by default. Opt-in toggle in settings.
- Open-source the privacy verification harness so customers (esp. enterprise) can audit it.

---

## 6 · UI surfaces to design (the actual work)

### High priority (MVP)
| # | Surface | Purpose | Reference mockup |
|---|---|---|---|
| 1 | Floating globe (5 states) | Always-on idle / listening / diagnosing / fixing / done | `02_globe-states.svg` |
| 2 | Fix card | Slides up from globe with detected issue + action | `03_fix-card.svg` |
| 3 | BSOD takeover screen | "ARIA — Solve it for me" recovery option | `04_bsod-takeover.svg` |
| 4 | Tray icon menu | Right-click options: pause / settings / quit / mode | (designer to draft) |
| 5 | Settings window | Mode selector, recipe categories, privacy verification, hotkeys | (designer to draft) |
| 6 | Installer flow | 4 steps: welcome → permissions → mode select → done | (designer to draft) |
| 7 | First-run permission prompts | UAC explanation, Windows defender warning explanation | (designer to draft) |
| 8 | Manual mode chat window | ARIA chat overlay invoked from globe | (designer to draft) |
| 9 | Browser extension globe (in-page) | Same gold globe overlaid on web pages | (designer to draft) |
| 10 | Recipe applied / done state card | Confirmation that fix worked | (designer to draft) |
| 11 | Escalation card (hardware failure) | "Contact Desktop Support" with copy from §4 | (designer to draft) |
| 12 | Landing page hero — `iisupp.net/aria-sentinel/` | Marketing + buy CTA | (designer to draft) |

### Medium priority (Sprint 4-5)
| 13 | Autonomous mode opt-in flow | Trust upgrade UX |
| 14 | Recipe transparency view | "Here's exactly what I did" log |
| 15 | Restore point indicator | "I created a System Restore point first" badge |
| 16 | Crash-recovery flow | What user sees after a BSOD |

### Low priority (Sprint 6+ polish)
| 17 | Edge-hugging globe demo | Animated GIF showing globe physics |
| 18 | Onboarding tour (4-5 cards) | First-time experience |
| 19 | Settings → Recipes tab | Per-recipe enable/disable |
| 20 | macOS adapter (Sprint 2) | macOS-specific UI parity |

---

## 7 · Globe motion specs

### Idle state
- Drift slowly along nearest edge (~10px per second)
- Slight bob (±3px vertical sine wave)
- Inner glow pulse: opacity 0.6 → 0.9 over 4s loop

### Cursor approach (mouse within 80px)
- Smoothly move along the edge AWAY from cursor (linear interp, ~200ms response)
- Stick to corners (corner-snap with 30% magnetism)
- Never move INTO the screen area — always remains on edges

### Diagnosing state
- Globe rotates at 2x speed
- Inner concentric circles pulse outward
- Small text below: "Diagnosing…" in Cinzel italic 11px

### Fixing state
- Globe rotation accelerates to 4x speed
- Particles emit upward in gold trails
- Inner glow intensifies (opacity 0.9 → 1.0)
- Optional sound: subtle "fff" whoosh (only if user enabled audio)

### Done state
- Single bright pulse (gold flash)
- Checkmark forms inside globe for 1.5s
- Returns to idle
- Fix card slides up from globe for confirmation

### Error/escalation state
- Globe inner glow shifts amber (#ffcb6b)
- Soft pulse pattern (slower than idle)
- Escalation card slides up — same template as fix card but with warning chip

---

## 8 · Build stages (sprint diagram — designer should visualize)

| Sprint | Title | Scope | Status |
|---|---|---|---|
| 0 | Backend foundations | `/aria-recipes` + `/aria-stop-codes` + recipe registry + KB expansion to ~150 codes | Ready to start |
| 1 | Windows + Chrome MVP | Electron app + 8 desktop detectors + 8 fixes + Chrome extension + 6 browser detectors + 6 fixes + globe UI + tray + BSOD Tier C detection | Sprint 0 must finish first |
| 2 | macOS port | Same Electron codebase, macOS-specific detectors + permissions UX | After Sprint 1 ships beta |
| 3 | Edge + Safari extensions | Manifest tweaks, Safari packaged into macOS app | Parallel with Sprint 2 |
| 4 | Autonomous mode + BSOD Tier A + safety guards | Restore point creation, recipe versioning, rollback, BCD boot entry | After v1 beta tested |
| 5 | Recipe expansion to 75+ | KB-agent autonomous improvement loop adds recipes | Continuous |
| 6 | Polish + animations + multi-monitor + DPI | Production hardening | Pre-launch |
| 7 | iOS Safari extension + Android (deferred) | After v1 ships and produces revenue | Not in this brief |

See `06_sprint-stages.svg` for the visual.

---

## 9 · Top 25 detection→fix recipes shipping in MVP

Designer doesn't need to design these individually but should know they exist for the Recipe tab UI.

**Desktop (Windows):**
1. DISK.FULL — clear temp + browser caches + downloads >30d
2. NET.DNS.FAIL — `ipconfig /flushdns` + adapter reset
3. NET.WIFI.DROP — disconnect/reconnect adapter
4. OUTLOOK.CRASH — clear OST + repair profile
5. PRINT.OFFLINE — restart Print Spooler service
6. WIN.UPDATE.STUCK — reset Windows Update components
7. SLOW.PC — identify top resource hog + suggest kill
8. BLUE.SCREEN — read minidump + match stop code → recipe (BSOD path above)
9. TEAMS.STUCK — clear Teams cache
10. ONEDRIVE.SYNC.STUCK — reset OneDrive (`onedrive.exe /reset`)
11. AUDIO.MUTE — restart audiosrv
12. BLUETOOTH.OFF — re-enable BT stack
13. VPN.DROP — reconnect last VPN profile

**Browser:**
14. CACHE.STALE — clear cache for current origin
15. COOKIE.JAR.STUCK — clear cookies for current origin
16. PASSWORD.RETRY.2 — clear saved password for domain after 2 failed attempts
17. SERVICE.WORKER.STUCK — unregister SW + hard reload
18. AUTOFILL.WRONG — clear autofill for domain
19. CERT.EXPIRED — diagnose device clock vs cert validity
20. MIXED.CONTENT — clear mixed-content state + reload
21. EXT.CONFLICT — identify conflicting extension + offer disable
22. TAB.HANG — kill + reopen tab preserving URL
23. ZOOM.WEIRD — reset per-origin zoom to 100%
24. AD.BLOCK.BREAK — offer whitelist current site
25. SLOW.LOAD — trace TTFB + diagnose DNS/network

---

## 10 · Presentation deck outline (designer to build)

**Internal alignment deck — 12 slides:**

1. Cover — ARIA Sentinel logo + tagline
2. The problem (4 stats: IT ticket volume, repeat issues, cost per ticket, user friction time)
3. The product in one sentence + globe screenshot
4. How it works (3 modes — Manual default, Confirmed, Autonomous)
5. The 4-layer architecture diagram
6. Privacy by engineering, not by promise
7. BSOD integration (the wow moment)
8. Top recipes (visual grid of 25)
9. Demo flow — install → first detection → fix → done
10. Pricing model (separate product, B2B-first)
11. Roadmap by sprint
12. CTA + contact (founder direct)

**Investor / customer demo deck — 16 slides:**
- All of above plus:
13. Market timing — why ambient agents now
14. Competitive landscape (no real competitors at this strict-privacy positioning)
15. Distribution strategy (direct download MVP → store listings later)
16. Pilot offer + booking link

---

## 11 · Landing page concept — `iisupp.net/aria-sentinel/`

**Hero:**
- H1: *"Resident IT support that never sleeps."*
- Sub: *"ARIA Sentinel lives on your Windows machine and fixes problems before they slow you down. Your data never leaves your device."*
- CTA: **[Download for Windows]** (gold pill, Cinzel) + small *"or book a 15-min demo"* link
- Hero visual: gold globe floating, fix card sliding up

**Sections:**
1. The 3 modes (Manual / Confirmed / Autonomous) — 3 cards
2. BSOD demo — animated mockup of recovery option
3. Privacy by engineering — verification path explanation
4. Recipe library — scrolling carousel of fix scenarios
5. For IT teams — GPO/MSI/SCCM deployment one-pager link
6. Pricing — single plan card (TBD)
7. FAQ — does it slow my PC, will it brick something, what about my data, etc.
8. Footer — security.txt, privacy verification harness, source-available privacy module link

---

## 12 · Engineering constraints the designer must respect

- **Electron is the runtime.** All UI is HTML/CSS/JS. SVG + Three.js for globe. Lottie for animations.
- **Maximum surface real estate the globe + card can occupy at once:** 320px × 200px (don't design wider chrome that can't render in the transparent overlay window).
- **Globe is click-through except its 80px hitbox.** Card region IS clickable.
- **DPI awareness:** all assets at 1×, 2×, 3× scales. Use SVG where possible.
- **Multi-monitor:** globe must position correctly. Card must not span monitors.
- **Light/dark:** **Dark only.** Globe theme is gold-on-black regardless of Windows theme.
- **No external CDN dependencies at runtime.** All assets shipped in the installer.
- **Animation budget:** total CPU/GPU usage of idle globe < 1% of a modern Intel laptop CPU. No 60fps continuous animation when idle — drop to 30fps after 5s of no activity.

---

## 13 · What the designer MUST NOT do

- Don't change the gold-on-black color system (matches existing iisupp.net brand)
- Don't use stock illustrations / icons — everything custom or from the existing iisupp.net library
- Don't add testimonials or 5-star ratings (Rule 7 — no fake proof, locked in our memory)
- Don't use the word "guarantee" / "money-back" / "risk-free" anywhere (Rule 7 also)
- Don't mention 21+ years of experience — only 15+ (Rule 5 — resume-honest)
- Don't include Raymond James anywhere (HARD rule)
- Don't include emojis in the product UI
- Don't make the globe distracting — it must feel calm, not chatty
- Don't ship without verification: every state mocked, every animation timed, every flow tested

---

## 14 · Deliverables checklist

- [ ] Figma file with components + tokens (color, typography, spacing, motion)
- [ ] 20 high-fidelity mockups (all surfaces in §6 plus presentation slides)
- [ ] Sprint-stage visualization (timeline, see `06_sprint-stages.svg` as starting reference)
- [ ] Architecture diagram (use `05_architecture-diagram.svg` as starting reference)
- [ ] Globe state library (use `02_globe-states.svg` as starting reference)
- [ ] Animated globe demo (Lottie JSON or MP4)
- [ ] Landing page hero mockup + 6 supporting sections
- [ ] Marketing one-pager (PDF, 1 page)
- [ ] Internal alignment deck (12 slides, Google Slides or Keynote)
- [ ] Customer/investor demo deck (16 slides)
- [ ] BSOD takeover screen mockup (use `04_bsod-takeover.svg` as starting reference)
- [ ] First-run installer flow mockups (4 screens)
- [ ] Globe edge-hugging behavior spec (motion timing, easing curves)

---

## 15 · Approval gate

Before any production design files are exported:

1. Designer ships v1 of all critical-priority mockups + animation specs
2. Ahmad reviews via the gated preview pattern (iisupp.net/preview/aria-sentinel-design)
3. Approved mockups become the source of truth — devs do not improvise
4. Each sprint references the approved Figma file at handoff

---

## 16 · Builder handoff after design

When design is approved, the build is split:
- **Backend (Cowork)** — Sprint 0 work, already started: `/aria-recipes`, `/aria-stop-codes`, KB expansion
- **Electron desktop app (Codex)** — Sprint 1-2 work
- **Browser extensions (Codex)** — Sprint 1-3 work
- **Recipe registry expansion (KB-agent)** — Sprint 5 continuous loop
- **Polish + animations (Cowork)** — Sprint 6

Each builder gets a packet referencing the Figma + this brief.

---

*End of brief.*

For questions or scope clarifications, contact Ahmad Wasee (ahmad.wasee@iisupp.net).
