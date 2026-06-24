# Handoff: ARIA Sentinel — desktop agent, BSOD recovery, ServiceNow escalation

**For: Codex (build team).** Source of truth for implementing the ARIA Sentinel UI.
**From: design.** Brand: Integrated IT Support Inc. · iisupp.net. Date: 2026-06-19.

---

## Overview
ARIA Sentinel is a Windows-first (then all-OS / all-browser) ambient on-device IT-support agent. It manifests as a **floating gold globe** that hugs viewport edges and dodges the cursor. It watches for errors (BSOD, crashes, browser failures, slow PC), and either fixes them automatically (Autonomous), proposes a fix (Confirmed), or walks the user through it (Manual — the default at install). When it cannot resolve an issue locally, it raises a **routed ServiceNow incident** to the correct assignment group. Before acting or advising, it consults an on-device **company-policy knowledge corpus**. Strict privacy: nothing about the user leaves the device to iisupp.net.

This extends the existing live ARIA L1–L3 chat/voice product (`iisupp.net/aria`) onto the desktop as an autonomous agent.

## About the design files
The files in `references/` are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly**. The main reference (`ARIA Sentinel Design Library.dc.html`) is authored in a streaming "Design Component" format and needs its runtime (`support.js`, included) to open in a browser.

**Your task:** recreate these designs in the target stack. Per the master brief the runtime is **Electron (HTML/CSS/JS)** for the desktop agent, **Manifest V3** for browser extensions, **Three.js or SVG** for the globe, **Lottie** for animations. `globe.html` is already framework-agnostic and drops straight in. Use `tokens.css` / `tokens.json` for all values and `copy.md` for all strings.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy and motion are specified. Recreate pixel-accurately using the tokens. Where a value isn't in this README, read it off `tokens.css` or measure from the reference file.

---

## Global system

**Theme — dark only, gold on black, never inverted** (even when Windows is in light mode).
- Type: **Cinzel** (display/headlines/logo/CTAs), **Inter** (all UI/body), **ui-monospace** (timestamps, stop codes, log lines). Load Cinzel 500/600/700 + Inter 400/500/600/700, bundled in the installer (no runtime CDN).
- Section eyebrow pattern: Cinzel, 12px, letter-spacing .28em, uppercase, color `#c5a059`.
- Card pattern: background `linear-gradient(180deg,#141414,#0a0a0a)`, border `1px #2a2a2a`, radius 14px.
- Primary CTA: `linear-gradient(90deg,#c5a059,#f1dca7)`, text `#1a1410`, Cinzel 700, ~12px, letter-spacing .12–.16em, radius 8px, padding ~12px.
- Ghost button: transparent, 1px border in the accent color at ~45% alpha, accent text, radius 8px.
- Status chips: 5px radius, `#0a0a0a` bg, 1px accent border at ~50% alpha, 10px label, letter-spacing .14–.18em, weight 600, accent text.

**Hard constraints (locked):**
- Globe 64px idle / 96px active. **80px clickable hitbox; globe is click-through everywhere else.** The card region IS clickable.
- **Globe + card max footprint 320 × 200px** — never design wider chrome that can't render in the transparent overlay window.
- DPI: assets at 1×/2×/3×; prefer SVG. Multi-monitor: globe positions on the focused display, snaps to nearest corner, card never spans monitors.
- Idle globe < 1% CPU on a modern laptop; drop from 60fps to 30fps after 5s idle. No continuous 60fps when idle.
- No external CDN deps at runtime.

**Globe motion** (see `globe.html` for the working implementation):
- Idle: drift ~10px/s along nearest edge, ±3px vertical bob, glow opacity .5↔.92 over 4.2s. Rotation ~34s.
- Cursor approach (mouse within 80px): move along the edge away from cursor, ~200ms linear, 30% corner-snap magnetism. Never moves into the screen area.
- Diagnosing: rotation ~2×, counter-rotating dashed scan ring. Fixing: rotation ~4×, gold particles rise, glow intensifies. Done: single gold flash + cyan checkmark draw (~.55s) then return to idle; fix card slides up. Escalation: amber glow (`#ffcb6b`), slower pulse.
- Card slide-up: 260ms `cubic-bezier(.16,1,.3,1)`.

---

## Screens / views

> Copy for every screen is in `copy.md` (verbatim). Below are layout, structure, and component specs. The library file renders all of these — keep it open alongside this README.

### 1. Floating globe — 6 states
Reusable component. Use `globe.html` directly. `data-state` ∈ idle/listening/diagnosing/fixing/done/escalation. viewBox 0 0 120 120; center 60,60; core radius 22; rings r=22/15/8; crosshair lines ±24 from center; glow circle r=56. Core fill = radial `#f1dca7→#c5a059→transparent`. Escalation recolors strokes + glow to amber.

### 2. Fix card — 4 states (detected / in-progress / done / escalation)
320px wide card. Globe perches at top center, overlapping the top edge by ~26px (translateY up). Order top→bottom: globe → status chip → Cinzel title (~17px) → Inter body (~12.5px, color `#aaa`) → action row. In-progress replaces the body with a 6px progress track (`#1a1410`) + gold fill, plus a `#666` restore-point footnote. Done uses cyan (`#7afbff`) border + chip + checkmark globe. Escalation uses amber border/chip and a single full-width ghost button "VIEW INCIDENT INC…".

### 3. Recipe-applied done variants
Same done template, family-specific chip + title + outcome line, for DISK / NETWORK / BROWSER / APP / BSOD families. 25 recipes in MVP (list in the master brief §9), expanding to 75+.

### 4. Manual chat overlay
392px window. Header: small globe (listening) + "ARIA" (Cinzel, gold) + "MANUAL MODE · WALKTHROUGH" + cyan online dot. Body: ARIA bubbles `#141414`/border `#222`, radius 4/13/13/13; user bubbles gold-tinted `linear-gradient(180deg,#1c1710,#15110a)`, border `#38301d`, gold-light text, radius 13/4/13/13. Inline action chips (gold CTA + ghost). Typing indicator = 3 gold dots at decreasing opacity. Footer input + gold send button (arrow icon).

### 5. BSOD takeover (recovery screen)
Full-bleed Microsoft blue `#0078D4`. Large `:(` (Segoe UI light, ~110px), the standard recovery copy, stopcode URL + mono stop-code line. Below it: the ARIA card — `rgba(0,0,0,.34)` fill, **2px `rgba(197,160,89,.85)` border**, radius 16px, padding ~24px, flex row: globe (diagnosing, 92px) → text block (eyebrow + Cinzel "Solve it for me" 24px + 2-line body) → CTA column ("SOLVE IT FOR ME" solid gold + hint "Press F8 → Recovery menu → ARIA"). Footer "0% complete". Tier A = BCD boot menu entry; Tier C = crash-on-resume detection fallback.

### 6. ServiceNow escalation (compose) — routing is AUTOMATIC
368px card, amber border/chip. Title "Routing to Desktop Support". A read-only field block (`#0c0c0c`, border `#222`, radius 10px) with rows: **Assignment group → value + small cyan "AUTO" tag**, Short description, Caller, Priority (amber). **No "change team" control** — ARIA selects the assignment group from the signal; the user cannot override it. Footnote about auto-assignment + attachments + no PII. Single full-width gold "RAISE INCIDENT" button. Beside it, a short explainer + a mono signal block (`signal / confidence / group / priority`).

### 7. Ticket created (confirmation)
368px card, gold border, done-globe. Chip "INCIDENT CREATED", big Cinzel number (e.g. INC0042781). 2×2 stat grid (`#0c0c0c` cells): STATE (cyan "New"), PRIORITY (amber), ASSIGNMENT GROUP, RESPONSE SLA. Attachment row with document icon. Buttons "VIEW IN SERVICENOW" (gold) / "COPY #" (ghost).

### 8. My tickets (incident list)
Full-width panel, `#0a0a0a`/border `#1c1c1c`, radius 16px. Header bar (`#0c0c0c`): small globe + "My incidents" + "Synced with ServiceNow · newest first" (cyan). Body: stacked incident cards **sorted newest first**, each `#0c0c0c`/border `#1f1f1f`, radius 12px:
- Header row: Cinzel number + status pill (NEW=cyan / IN PROGRESS=amber / RESOLVED=cyan) + priority + spacer + "{group} · {relative time}".
- Issue title (13px `#ddd`, 600) + "Issue described: …" (12px `#9a9a9a`).
- **WORK NOTES** block: left border `#242424`, eyebrow, rows of `mono timestamp (60px) + author/note`. Pulled from ServiceNow.
- On open tickets, a **YOUR COMMENTS** block (left border `#38301d`, gold-tinted text) + a composer row: input "Ask for an update…" + gold "POST" button + note. Posting writes the comment to the ServiceNow incident (additional comments / customer-visible) so the assigned team sees the user is engaged.
Data source: ServiceNow Table API GET on `incident` filtered by caller, ordered by `sys_updated_on` DESC; comment POST writes `comments` (customer-visible).

### 9. Routing logic — assignment groups
Diagram. Left column: "LOCAL FIX FAILS (confidence < 0.5, or 2 attempts)" → "ARIA CLASSIFIER (signal class → group + priority)". Right: 2-col grid of 6 assignment-group cards, each with a left accent bar (gold, or red for Security, cyan for Service Desk) + name + example triggers. See `copy.md` "Routing targets". Footer states the vision (collapse L1–L3 ticket flood; 70–80% self-heal).

### 10. Settings window
~760px window with title bar (small globe + "ARIA Sentinel — Settings" + window controls). Left rail tabs (184px): **Mode · Recipes · ServiceNow · Knowledge & policy · Privacy verifier · Hotkeys · About**. Mode pane = 3 stacked selectable rows (radio + title + badge + desc); Manual selected (gold-tinted `#15110a`, border `#c5a059`, filled radio). Plus two side panels: **ServiceNow connection** (instance URL, OAuth 2.0, default caller, "Connected" cyan status, "TEST CONNECTION") and **Assignment group mapping** (signal → group table; admin-managed policy, this is where routing rules are defined).

### 11. Company knowledge & policy
Two columns. Left: "Knowledge sources" panel — dashed dropzone ("Drop documents or browse", PDF/DOCX/MD/TXT) + status rows (Procedures & runbooks, IT policies & workflows, Security & compliance, Audit & regulatory = "Indexed · N docs" cyan dot; Culture & tone = "Processing…" amber dot). Right: "Governance gate" mini-flow (Detect → Check against policy corpus → Allowed/Restricted). Corpus stored encrypted on-device; consulted before any fix/suggestion; culture/tone docs shape ARIA's phrasing.

### 12. Installer flow (4 steps)
2×2 grid of step cards (welcome / permissions / mode select / done). Step 2 lists the 3 permissions with the BSOD-boot-entry rationale. See `copy.md` "Installer".

### 13. First-run explainers
Two cards (SmartScreen, UAC), each with a warning/diamond glyph tile + Cinzel title + body + a faux system-dialog excerpt. Copy in `copy.md`.

### 14. Tray icon menu
Mock taskbar strip (`#0c0c0c`, top border) bottom-right with tray glyphs + small globe + clock. Context menu (248px, `#0c0c0c`, border `#2a2a2a`, radius 11px, shadow): header (globe + "ARIA Sentinel" / "Manual mode · watching"), then Mode ▸ / Pause for 24 hours / Update knowledge / divider / Open settings / Privacy verifier / divider / Quit. Hover = gold-tinted row. **Pausing never disables BSOD takeover.**

### 15. Privacy verifier
Left panel "Outbound paths in binary": 3 allowed rows (2 cyan inbound GETs from iisupp.net; 1 gold POST to the customer's own ServiceNow) + 1 dashed "no such path" row for user-data→iisupp.net. Right stat panel: huge cyan "0" + "data-upload paths to iisupp.net". "SOURCE-AVAILABLE HARNESS" badge.

### 16. Transparency log
Full-width mono log, rows = `timestamp (78px) + tag (DETECT/RESTORE PT/RUN/DONE) + text`, divided by `#141414` rules. Local audit only.

### 17. Restore point indicator
360px card: circular-arrow icon tile + "Restore point created" + mono name + body + ghost "ROLL BACK THIS FIX".

### 18. Browser-extension globe (in-page)
Browser-window chrome (traffic lights, URL bar, small globe in the toolbar). Page area is a **light** mock site (`#f5f5f7`) to show contrast. Bottom-right: a 280px dark in-page fix card ("This page looks stale", BROWSER · CACHE.STALE, "CLEAR & RELOAD" / "Not now") above a 64px diagnosing globe that bobs.

### 19. Onboarding tour (4 cards)
4 coachmark cards, each a globe (idle/diagnosing/fixing/escalation) + Cinzel title + short calm line. Copy: "Meet the globe" / "It watches quietly" / "You're in control" / "Even on a blue screen".

### 20. Multi-monitor placement
Diagram of two monitor rectangles; globe in the bottom-right corner of the focused primary display; secondary display dimmed. Card never spans monitors.

### 21. Four-layer architecture
Stacked layer bands: L4 Brand (gold border) · L3 Backend pull-only (cyan, 3 endpoint cells) · L2 Browser extensions (gold, Chrome/Edge/Safari/Localhost WS) · L1 Desktop agent (gold-light, 6 cells incl. amber "BSOD/WinRE integration" and amber "ServiceNow incident bridge"). ServiceNow is the one intentional outbound integration, to the customer's own instance.

---

## Interactions & behavior
- **Globe**: edge-hugging drift, cursor dodge (200ms), corner snap; click within 80px hitbox opens chat (Manual) or the current card. State machine: idle → listening → diagnosing → fixing → done → idle; escalation branch from diagnosing.
- **Fix card**: slides up from the globe (260ms ease). Confirmed: [Fix it now] runs the recipe → in-progress → done. [Details] expands the recipe. [Not now] dismisses.
- **Mode**: Manual (chat only) / Confirmed (propose+confirm) / Autonomous (silent low-risk + post-fix card). High-risk recipes always confirm regardless of mode.
- **Escalation**: on local-fix failure (confidence < 0.5 or 2 attempts), ARIA classifies the signal → auto-selects assignment group (no user override) → composes incident → [Raise incident] POSTs to the customer's ServiceNow → ticket-created confirmation.
- **My tickets**: list pulled from ServiceNow (caller-filtered, newest first). User comment composer POSTs a customer-visible comment to the incident.
- **Governance gate**: every fix/suggestion is checked against the policy corpus first; restricted actions escalate instead of executing.
- **Tray pause**: 24h pause or global hotkey; BSOD takeover stays active.

## State management
- `globeState` (enum, drives the component), `mode` (manual|confirmed|autonomous), `currentIssue` / `recipe` / `recipeStep`, `restorePointId`, `incidents[]` (from ServiceNow), `knowledgeSources[]` + ingest status, `serviceNowConnection` (instance, auth, status), `paused` (with expiry).
- Data: GET `iisupp.net/.netlify/functions/aria-recipes` + `aria-stop-codes` (inbound only). ServiceNow Table API for incident create / list / comment (customer instance only). Local KB in encrypted SQLite at `%APPDATA%\AriaSentinel\kb.db`. Telemetry OFF by default.

## Design tokens
See `tokens.css` (CSS custom properties) and `tokens.json`. Colors, type, radii, gradients, motion timing, and the footprint constraints are all there. Do not invent values.

## Assets
- `globe.html` — framework-agnostic gold globe, 6 states, working CSS animations + `setGlobeState()`. Primary reusable asset.
- Globe geometry/gradients also documented inline in `globe.html` and `tokens.css`.
- Reference SVGs from the original brief in `references/brief/` (globe states, fix card, BSOD, architecture, sprints, user flow).
- No stock illustrations/icons — everything is custom SVG or from the existing iisupp.net library.

## Files
- `tokens.css`, `tokens.json` — design tokens.
- `copy.md` — all UI strings + voice rules.
- `globe.html` — drop-in globe (6 states, manual control).
- `globe-loop.html` — animated hero globe, self-driving 8s loop (idle→…→done→idle). Recommended over hand-authored Lottie; screen-record at 30fps for MP4/Lottie.
- `references/ARIA Sentinel Design Library.dc.html` — the full visual source of truth (21 surfaces). Open with `references/support.js` + `references/Globe.dc.html` present.
- `references/Globe.dc.html` — globe as authored in the design environment (prefer `globe.html` for the build).
- `references/brief/` — master brief, prompt, and the 6 reference SVGs.

### Marketing & executive deliverables (in `references/`, open with the sibling `support.js` / `Globe.dc.html` / `deck-stage.js`)
- `ARIA Sentinel Deck.dc.html` — 16-slide deck. **Slides 1–12 are the internal alignment deck; 13–16 add the investor/customer sections** (market timing, competition, distribution, pilot). Export to PPTX/PDF via the deck tools; print one page per slide.
- `ARIA Sentinel Commercial.dc.html` — ~56s business-first commercial (11 scenes, play/pause + scrubber, persisted playhead). Flow: queue fills → meet ARIA → everyday-troubleshooting montage (browser cache, Task Manager, printer spooler, add printers/network drives, restore network files, Adobe/corrupt-file repair, how-tos, setup guides) → live browser-support demo → researches the unknown / expert escalation → BSOD → ServiceNow routing → "new fixes arrive automatically" → privacy → business+personal → multi-device close (macOS/Linux/iPhone/iPad/Android · "Stay tuned") + CTA. Screen-record for a shareable MP4.
- `ARIA Sentinel One-Pager.dc.html` — print-ready marketing one-pager. `@page` is set to **Letter**; for **A4** change `size: Letter` → `size: A4` in the file's `<style>`. Print to PDF.

## Messaging notes (locked rules)
- **"15+ years" only — never "21+ years"** (resume-honest rule from the brief). The "researches new issues / expert escalation" beat uses **"IT experts with decades of cross-sector experience"** to stay compliant. If leadership approves the literal "21+ years," swap it in `copy.md`, the deck recipes slide, the commercial scene S3.5, and the library routing footer.
- No testimonials / star ratings / "guarantee" / "money-back" / "risk-free". No Raymond James. No emojis in product UI. Dark only.
- ServiceNow routing is **automatic and not user-editable** — the assignment group is chosen by ARIA from the signal; users can only add comments to their own tickets.
