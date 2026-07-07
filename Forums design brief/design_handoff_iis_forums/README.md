# Handoff: IIS Forums (iisupp.net/forums)

## Overview
An AI-native IT support forum for IIS — the "trust front door" that must feel **10-years-ahead, enterprise-grade, and honest** the moment a user lands. It blends a Google-like solution search (ranked #1 + confidence), a Stack-Overflow-style community, and an ARIA/Fable-5 AI concierge (screenshot → diagnosis, one-click "Fix with ARIA"). **The forum is free with no paywalls or upgrade nags in the MVP.**

Visual language: the **"dark-matter"** aesthetic — deep near-black surfaces, soft depth/glow, a single **cyan** accent (primary / AI) and a warm **gold** accent (accepted answers / "graduated to KB" / premium), generous whitespace, crisp neutral-grotesque type, restrained motion.

## About the design files
The files in this bundle are **design references created as streaming HTML "Design Components" (`.dc.html`)** — working prototypes that show the intended look, states, and interactions. **They are not production code to copy directly.** The task is to **recreate these designs in the target codebase's environment** (React/Next, Vue, etc.) using its established patterns, component library, and data layer. If no frontend exists yet, pick the most appropriate framework and implement there.

Each `.dc.html` opens directly in a browser (it loads a sibling `support.js` runtime, included here). Open `IIS Forums Prototype.dc.html` to click through the whole product; open `IIS Forums — Handoff.dc.html` for the visual token/component/interaction spec.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, elevation, motion, copy, and interactions are all specified below and demonstrated in the prototype. Recreate the UI faithfully using the codebase's existing primitives. Where the prototype fakes a backend (canned data + timers), wire the real integrations noted under **Backend wiring**.

---

## Design tokens
Bind these to variables — **do not hardcode**. (Names are suggestions; values are canonical.)

### Color
**Surfaces**
- `--bg-void` `#07080B` — app background
- `--surface-1` `#0A0D12` — panels, wells, code insets (`#05060A` for the darkest code wells)
- `--surface-2` `#0C0F15` — cards, inputs
- `--surface-3` `#12161D` (hover `#171B24` / `#0E1219`) — raised, hover

**Text & hairlines**
- `--text-primary` `#EEF2F6`
- `--text-secondary` `#9AA6B4`
- `--text-tertiary` `#5B6672`
- `--text-muted` `#8B95A2`
- `--on-accent` `#04262B` (text on cyan)
- `--hairline` `rgba(255,255,255,0.07)`
- `--hairline-strong` `rgba(255,255,255,0.12)`

**Cyan — primary / AI**
- `--cyan-400` `#67E8F9` (links, hover text)
- `--cyan-500` `#22D3EE` (primary, AI, CTAs)
- `--cyan-600` `#0E9CB8` (deep, meter fill)
- `--cyan-glow` `rgba(34,211,238,0.35)`

**Gold — accepted / premium / graduated**
- `--gold-400` `#F5D199`
- `--gold-500` `#E9B872`
- `--gold-600` `#C9973F`
- `--gold-glow` `rgba(233,184,114,0.16)`

**Semantic & confidence**
- `--success` `#34D399` (verified; confidence ≥ 85)
- `--warning` `#F5B34A`
- `--danger` `#FB7185` (errors, BSOD)
- `--conf-low` `#7C8794` (confidence < 65 → route to escalate)
- Confidence scale: **high ≥85 → `#34D399`** · **medium 65–84 → `#E9B872`** · **low <65 → `#7C8794`** (meter fill uses a gradient `#0E9CB8→#34D399` for high, `#C9973F→#E9B872` for medium, flat muted for low).

**Ambient background glow** (fixed, non-interactive, `z-index:0`):
`radial-gradient(1200px 620px at 12% -12%, rgba(34,211,238,.10), transparent 60%), radial-gradient(1000px 520px at 100% -6%, rgba(233,184,114,.055), transparent 55%), radial-gradient(900px 700px at 50% 120%, rgba(34,211,238,.05), transparent 60%)`

### Typography
- **UI & display:** `Hanken Grotesk` (weights 400/500/600/700/800), neutral grotesque, tight tracking on large sizes.
- **Mono:** `JetBrains Mono` (400/500/600) for code, error signatures, confidence values, kbd.
- Scale (size / weight / letter-spacing / line-height):
  - Display `clamp(34,5.4vw,60)` / 800 / -0.035em / 1.02 — hero (gradient text `#FFFFFF→#B9C2CE` via `background-clip:text`)
  - H1 (page) 30–40 / 750 / -0.025em / 1.18
  - H2 (section) 24–28 / 700 / -0.02em
  - H3 19–20 / 700
  - Title (card) 15–17 / 650 / -0.01em
  - Body 15 / 400–500 / — / 1.6
  - Body-sm 13.5 / 400 / 1.5
  - Caption (meta) 12.5 / 500
  - Micro (labels/badges) 11–12 / 600–700 / 0.06em, UPPERCASE
  - Mono 12.5–13 / 500

### Spacing — 4px base
`2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80`. Desktop gutter **28px**; mobile **16–18px**. Card padding 16–22. Section rhythm 40–64.

### Radius
sm 8 · md 10 · lg 14 · xl 18 · 2xl 24 · pill/avatars 999. Inputs 10–12, cards 14, modals 18.

### Elevation
- e1 (card): `1px solid var(--hairline)` + faint depth
- e2 (raised): `0 6px 20px -6px rgba(0,0,0,.5)`
- e3 (modal): `0 40px 100px -24px rgba(0,0,0,.8)`
- glow (primary CTA): `0 10px 26px -10px rgba(34,211,238,.6)`
- focus ring: `0 0 0 4px rgba(34,211,238,.1)` + cyan border
- gold highlight (deep-link): `0 0 0 2px rgba(233,184,114,.6)` pulsing

### Motion
- fast 120ms (hover/color) · base 180–200ms (route/reveal/toggle) · slow 320ms (modal/sheet)
- easing standard `cubic-bezier(.2,.7,.2,1)`; emphasized `cubic-bezier(.2,.9,.1,1)`
- loops: skeleton shimmer 1.4s linear · thinking dots 1.2s · spinner 0.8s · deep-link ring-pulse 1.6s ×2
- **Honor `prefers-reduced-motion`:** disable shimmer, pulse, thinking-dot bounce, and the deep-link auto-scroll animation (jump instead).

---

## Screens / views
Top nav (desktop, 60px sticky, blurred): logo (cyan ring mark + "iis | Forums") · tabs **Solutions · Discussions · Ask AI · Experts · Trends** · compact search · "Sentinel" ghost button · account avatar (SSO). Active tab: cyan text on `rgba(34,211,238,.1)` with inset cyan ring. On Solution/Thread sub-views, the parent tab (Solutions/Discussions) stays active.

### 1. Forums Home — max-width 1120
- Eyebrow pill: "ARIA-native · Free forever · No paywalls" (cyan, glowing dot).
- **Universal ask bar** (the star): large input, leading sparkle-search icon, camera button (→ Ask AI), cyan "Ask" button. **Focus** state = cyan border + glow + focus ring + a suggestions dropdown (typeahead rows badged KB/Discussion + a "Diagnose from a screenshot instead →" row). Example chips below. Reassurance line: "Local-first · Free to search · WCAG 2.1 AA".
- **3 hero variants** (design options — pick one for MVP): **A search-first** (centered), **B answer-preview** (split copy + a live ranked-answer card), **C screenshot-first** (drop-zone hero leading the Fable-5 vision moment).
- **Trust strip** — 3 honest value pillars (Local-first & private / Real answers honestly ranked / One-click Fix with ARIA). **No numbers.**
- **Recently solved** — 3 solution cards (category tag, source badge, title, snippet, confidence chip, "Open →"). **No vote/view counts.**
- **Trending** — honest **empty state** ("Trends are still warming up… we show real signals only").

### 2. Solutions — search results (Google-like) — max-width 940
- Inline ask bar + filter chips (category: All/Windows/Microsoft 365/Network/Devices) + sort (Relevance / Most helpful).
- **Loading:** "Searching the KB and accepted answers…" spinner + 4 shimmer skeleton rows (~1.1s).
- **Results:** context line ("Best matches for '<query>'" or "Top solutions right now" when browsing). **Ranked #1 hero card** — cyan-tinted, `RANKED #1` mono badge, source badge, title, snippet, a wide confidence meter + label, a "Why #1" rationale, and **[⚡ Fix with ARIA]** + **[Open solution →]**. Then standard rows (rank number, title, source badge, snippet, compact confidence, meta). Discussion-sourced rows badged **"from a discussion"** and deep-link to the exact thread post.
- **Empty / no-confident-match:** honest card ("We'd rather say 'not sure' than guess") with 3 actions: **Ask AI with a screenshot**, **Ask the community**, **Escalate to IIS** (gold). Triggered when confidence is below threshold.

### 3. Solution / article page — max-width 800
- Breadcrumb, source badge + confidence + OS/updated meta, H1.
- **Primary action card** (cyan/gold gradient): "Fix this automatically" → **[Open in ARIA]** (primary) · **[Download Sentinel]** · **[Escalate to IIS]** (gold). Copy: "ARIA runs the verified steps below on your machine, then confirms the fix. Local-first — nothing leaves your device, roll back anytime."
- Overview prose → **numbered Steps** (each with optional mono code block) → **green "Verify it worked" callout**.
- **Screenshot-diagnosis zone** ("Fable 5 vision" badge, "Not quite your situation? Show us."): dashed drop zone → **analyzing** state (mock BSOD thumbnail with a scanning line + "Fable 5 is reading your screenshot…" staged dots) → **done** state (diagnosis + Fix / Open a discussion / Try another). ~2.3s.
- Related solutions list · **"Was this helpful?"** (Yes/No, thumbs, thank-you confirmation).

### 4. Discussions — thread list — max-width 900
- Title + subtitle ("Accepted answers graduate into Solutions") + **[+ Start a discussion]** (cyan).
- Category filter chips. Thread rows: **status icon** (gold check = accepted; cyan chat = active; muted = neutral), title, **"Graduated to Solutions"** badge where applicable, one-line excerpt, tag chips, `author · time · category` meta, stacked participant avatars (initials, **no fake +N**). **No reply/view counts.**

### 5. Single thread — max-width 780
- Breadcrumb, title, tags, "Opened by <author> · <time>".
- **AI suggested answer card** at top (cyan): sparkle header, "88% match", **"Verify before applying"** chip, sourced-from row (KB link + "the accepted answer below"). Honest & sourced.
- Posts: OP (with "OP" chip), replies, **accepted answer** (gold border/tint, "✓ Accepted answer" + **"Graduated to Solutions →"** link), mono code blocks, **@mentions** (cyan). "Was this helpful?" on the accepted answer.
- Markdown reply composer (B / ‹› / @ affordances, "Post reply").

### 6. Cross-link / deep-link (signature)
A discussion-sourced Solutions result → click → route to its thread, **smooth-scroll to the exact post**, and land with a **gold ring-pulse** highlight that fades after ~3.2s. (Implementation note: set the scroll container's `scrollTop` directly / rAF-ease — `scrollTo({behavior:'smooth'})` was unreliable on the nested scroll container.)

### 7. Ask AI / concierge — max-width 760
- Empty state: ARIA orb + "How can I help you fix it?", a prominent **drop-zone** (screenshot/log/PDF, "Try a sample: BSOD screenshot →"), and suggested-issue rows.
- Conversation: right-aligned user bubbles (text or an attached-screenshot bubble with thumbnail) · **"ARIA is running a check"** staged trace (Reading input ✓ → Matching KB ✓ → Ranking fix ⟳, ~2.4s) · **diagnosis card** (lead label + confidence, title, body, numbered steps, **[⚡ Fix with ARIA]** · **[Open full solution →]** · **[Open a discussion]**).
- Sticky input bar (attach + text + send). Footer disclaimer: "ARIA can be wrong — it always shows sources and confidence. Verify before applying."

### 8. Experts & Trends (light / later-stage)
- **Experts:** "Coming soon · honest placeholder" — no fabricated profiles/ratings. Area cards (Identity & Entra, Endpoint & Intune, Network & VPN, Security & Defender) each with **[Request an expert]**.
- **Trends:** honest empty analytics panel — greyed placeholder bars behind an **"Awaiting real signal"** card, category legend with `—` placeholders.

### 9. Mobile (Home, Solutions, Solution, Thread, Ask AI)
392px device frame with a **status bar + compact app header** (logo, search, avatar) and a **bottom 5-tab nav** (icons + labels, active = cyan). All multi-column grids collapse to **1 column**; filter chips wrap; hit targets ≥44px. Toggle desktop/mobile via the on-screen "Preview" dock in the prototype.

### 10. Global states
Loading (skeletons + spinner) · AI-thinking (staged traces) · empty (honest copy + next action) · error (`--danger`, e.g. BSOD) · success **toast** (info/success/error, bottom-center, auto-dismiss 3.4s) · **SSO auth modal** ("Continue with IIS", single sign-on, "free — no account needed to search").

---

## Interactions & behavior
1. **Universal ask → ranked answer:** type → Enter/Ask → optimistic route to Solutions → skeleton (~1.1s) → ranked #1 + confidence. Low-confidence → honest no-match state.
2. **Screenshot → diagnosis (Fable 5):** drop/paste/sample → user bubble → staged thinking trace (~2.4s) → diagnosis card (root cause, error signature, steps, confidence, Fix + open-discussion fallback). On the Solution page and Ask AI.
3. **Fix with ARIA:** CTA → modal **choose** (steps preview + local-first note) → **running** (agentic checks + shimmer progress, ~2.4s) → **applied** (green "Fixed & verified", rollback note) + success toast. **Sentinel** download is the no-agent fallback.
4. **Discussion → Solution deep-link:** see screen 6.
- Modals: click-backdrop or ✕ to close, `Esc` to dismiss, trap focus, `position:fixed` overlay with blur.
- All interactive elements: hover, active, and a visible cyan **focus ring**.

## State management
Prototype state (recreate equivalently): `view` (route) · `viewport` (desktop/mobile) · `heroVariant` (A/B/C) · `query` + `askFocused` · `searchStage` (idle/loading/results/empty) · `filterCat` / `filterSort` · `activeSolutionId` · `activeThreadId` + `highlightPostId` (deep-link) · `discCat` · `aiMessages[]` + `aiThinking` + `aiInput` · `diagStage` (idle/analyzing/done) · `fixModal` (closed/choose/running/applied) · `ssoOpen` · `toast` · `helpfulVote`. Loading/thinking transitions are timer-driven in the prototype — replace with real async.

## Backend wiring (prototype simulation → real integration)
- **Ranked results** (canned + timer) → **RUN-A semantic retriever** over the KB + accepted answers; `confidence` = normalized retriever score; blend + badge by source.
- **"from a discussion" + deep-link** → store the source thread/post anchor on each promoted KB entry; route + scroll-to + highlight.
- **"Graduated to Solutions"** → auto-promote accepted answers into the KB with a two-way backlink; show badge on both.
- **Screenshot → diagnosis** → **Fable 5 vision**; stream the staged trace; return `{ signature, rootCause, steps[], confidence }`.
- **Fix with ARIA** → hand off to the **ARIA / Sentinel** agent; poll run states; return a verify result + rollback token.
- **SSO** → IIS account OIDC/SSO; forum stays fully readable without auth (free, no paywall).
- **Rule 14 (non-negotiable):** never render vote/view/member/online counts, ratings, or testimonials until backed by real data. Below threshold, render the honest empty state.

## Accessibility (WCAG 2.1 AA — build checklist)
- Contrast ≥ AA (primary text ~15:1 on void, secondary ~7:1; verify every badge/label pair; on-accent `#04262B` on cyan).
- Visible cyan focus ring on all interactive elements; never remove an outline without a replacement.
- Full keyboard: tab order, Enter submits ask bar, Esc closes modals, arrow keys through suggestions; modals trap focus.
- Screen-reader semantics: landmark `nav`/`main`, heading hierarchy, `aria-live` on AI-thinking + toasts, alt text on user screenshots, `aria-hidden` on decorative icons.
- `prefers-reduced-motion` respected. Hit targets ≥44px on mobile.

## Assets
- Fonts: **Hanken Grotesk** + **JetBrains Mono** (Google Fonts).
- All icons are inline stroke SVGs (Lucide-style, `stroke-width` ~1.8–2, `currentColor`) — swap for the codebase's icon set.
- The IIS logo mark is a simple CSS cyan ring + dot (no image asset). Replace with the real IIS brand mark from the codebase.
- No raster images are required; the "screenshot" previews are HTML mocks. Real uploads come from the user.

## Files
- `IIS Forums Prototype.dc.html` — the full clickable prototype (all screens, states, signature interactions, desktop + mobile).
- `IIS Forums — Handoff.dc.html` — the visual design-system spec (tokens with swatches, live type scale, component inventory + states, interaction specs, a11y, layout, sim→build map).
- `support.js` — the runtime both `.dc.html` files load (keep it beside them to open in a browser).
