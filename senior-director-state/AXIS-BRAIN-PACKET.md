# AXIS — RUN A: Brain verification + Phase 1 voice-in scaffolding

> Voice-first AI companion. Name: **AXIS** (Augmented eXecution Intelligence System). The pivot around which Ahmad's operation rotates. Same brain as Cowork. Male voice. Wake-word "AXIS".

## Context

Cowork (director, Claude Desktop) has reshaped the vault into brain anatomy and named the companion **AXIS** per Ahmad's directive. Vault is at `aria-vault/` inside the iisupp-net-deploy repo on Ahmad's Windows machine. Read these FIRST:

1. `aria-vault/00_Index/Brain-Map.md` — anatomical layout
2. `aria-vault/07_Cortex/AXIS.md` — full vision + phasing + architecture
3. `aria-vault/07_Cortex/Ahmad.md` — founder profile (4-layer vision now includes AXIS)
4. `aria-vault/02_Hippocampus/RULES.md` — hard rules
5. `aria-vault/02_Hippocampus/DIRECTOR_AUTONOMY.md` — Standing Rule 12

## Objective

**Verify the brain-shaped vault is internally consistent + scaffold Phase 1 (voice-in) for AXIS.**

## Part A — Verify vault (1 hour)

Run these checks. Fix in place if broken; report if findings.

1. Every `.md` in `aria-vault/` has a `brain_region:` frontmatter field. Add the correct region to any missing it (use folder → region mapping below).
2. All wikilinks resolve (no broken `[[name]]` references). Use `node scripts/link-web.mjs` to detect orphans.
3. The folder rename did not strand any external references. Grep the repo (outside `aria-vault/`) for any `aria-vault/01_Business`, `02_Memory`, etc. — these are stale paths. Either update OR document them in a stale-paths report (do NOT silently change critical files like CLAUDE.md, packets, deploy configs — flag those).
4. `Brain-Map.md` ASCII diagram renders cleanly when opened in Obsidian markdown preview.
5. `link-web.mjs` syntax-checks (`node --check`) and runs clean (`stubs: 0`).

Folder → region mapping (for missing-frontmatter fixes):
- `01_Frontal/` → `frontal` (subregion if discoverable: `frontal-iis`, `frontal-aria`, `frontal-sentinel`)
- `02_Hippocampus/` → `hippocampus`
- `03_BasalGanglia/` → `basal-ganglia`
- `04_ShortTerm/` → `short-term`
- `05_Thalamus/` → `thalamus`
- `06_Cerebellum/` → `cerebellum`
- `07_Cortex/` → `cortex` (or `cortex-frontal` for agents that plan)
- `08_Amygdala/` → `amygdala`
- `09_Decisions/` → `frontal-decisions`
- `10_Brainstem/` → `brainstem`
- `11_CorpusCallosum/` → `corpus-callosum`
- `12_Glia/` → `glia`
- `00_Index/` → `cortex-association`

## Part B — Region-aware graph weighting (1 hour)

Patch `aria-vault/scripts/link-web.mjs` so notes in the same brain region get prioritized in each other's Related blocks (currently the only weighting is by folder + master hub + reverse links). Add:

```js
// inside the per-file loop, before assembling candidates
const myRegion = readRegion(text); // parse from frontmatter
for (const other of allFiles2) {
  if (other === f) continue;
  if (readRegion(await readFile(other, "utf8").catch(()=>"")) === myRegion) {
    candidates.add(noteKey(other));
  }
}
```

Implement `readRegion(text)` as a frontmatter parser (regex `^brain_region:\s*([\w-]+)`). Cache region reads to avoid quadratic IO blowup — read all regions once into a Map at start.

Expected result: graph clustering in Obsidian visibly tightens by region — nodes group into anatomical lobes.

## Part C — Scaffold AXIS Phase 1 (2 hours, no shipping yet)

Create the directory skeleton + stubs for the voice-in phase. NO runtime code yet — just structure CC can flesh out in next run.

```
ARIA Sentinel/axis/
├── README.md                  — AXIS overview, links to vault notes
├── voice-in/
│   ├── hotkey-listener.mjs    — STUB: registers global hotkey (Win+Space default)
│   ├── whisper-wrapper.mjs    — STUB: spawns local Whisper binary, returns transcript
│   ├── transcript-router.mjs  — STUB: classifies transcript → routes to brain region read → dispatch
│   └── tests/
│       └── hotkey.test.mjs    — STUB: unit test for hotkey registration
├── voice-out/
│   └── (Phase 2 — empty for now)
├── brain-bridge/
│   ├── vault-reader.mjs       — STUB: reads aria-vault/<region>/<note>.md by region+query
│   └── memory-reader.mjs      — STUB: reads Cowork's persistent memory/MEMORY.md
└── docs/
    └── ARCHITECTURE.md         — full architecture (lift content from aria-vault/07_Cortex/AXIS.md)
```

Each stub file should have:
- Top comment explaining its purpose
- Empty exported functions with TODO comments
- No external dependencies installed yet (zero new spend — respect cap)

## Part D — Update Sentinel CLAUDE.md (15 min)

Add to `ARIA Sentinel/CLAUDE.md` (top of file):
> AXIS is the voice layer that will eventually wrap the Sentinel shell. Read `aria-vault/07_Cortex/AXIS.md` before any voice-related work. AXIS uses SENTINEL_ADMIN_TOKEN for any admin endpoints (same as Sentinel — single source of admin truth).

## Acceptance criteria

- All vault `.md` files have `brain_region:` frontmatter ✓
- `node scripts/link-web.mjs` reports `stubs: 0` ✓
- Region-aware clustering visibly tightens the Obsidian graph (screenshot before/after)
- `ARIA Sentinel/axis/` skeleton exists with all stub files ✓
- `ARIA Sentinel/CLAUDE.md` updated ✓
- No regressions: `node tests/admin-publish.test.mjs` still passes (77/77 or current count)
- Local commit only — do NOT push (Cowork handles git from sandbox)

## Hard rules (inherited from Ahmad's standing feedback)

- No Raymond James anywhere
- Spend cap $20-70 CAD/mo — do NOT install Whisper or ElevenLabs yet (stubs only this run)
- No money-back guarantee language
- Caveman comms in reports — bullets, no paragraphs
- Don't ask, just do — make the calls; flag in report not chat
- Never break ARIA / Aperture / Sentinel runtime
- Audit-integrity banner from RUN 17 must keep working (test it)

## Report format

When done, output:
1. Files touched (list)
2. Vault verification findings (what was missing, what was fixed)
3. Region clustering before/after stats (master hub count, average backlinks per region)
4. Phase 1 stub tree (find output)
5. Test results
6. Anything that needs Ahmad approval before next RUN

Local commit message: `[axis] RUN A: brain verification + Phase 1 scaffolding`

---

## RUN B (added 2026-06-20 by Ahmad): AXIS Command Center (live brain HUD)

> "/btw ult9athink add all that is inside obsidian and what claude cowork planned above … into one command center or dashboard. Use https://iisupp.net/aperture-learning.html since its already a command center and just call it AXIS and make it look like a human brain … brain will be large and in centre of the page. Surrounding by data info, status info, performance etc. and from the brain vein type lights go down to a live agent office where agent in real time show they are working … HD animated office space with all the AI agents. … similar anime [as TikTok reference] but I want it better."

### Reference
TikTok creator: **AXIAL Studios** — "the sims for managing AI agents" — isometric office where each agent has a desk and you watch them work in real time. Frames extracted at `/tmp/axis-video-frames/`. Key elements:
- isometric Sims-style office with per-agent workstations
- kanban view with agent-tagged tasks
- knowledge graph view (Obsidian-style)

### What Ahmad wants (better than the reference)
1. **Large anatomical brain in center** with 12 clickable regions (Frontal · Hippocampus · BasalGanglia · ShortTerm · Thalamus · Cerebellum · Cortex · Amygdala · Decisions · Brainstem · CorpusCallosum · Glia)
2. Each brain region's glow + activity = vault folder activity (from `aria-vault/<region>/`)
3. **Vein-style animated lights** flowing from brain → agent office below
4. **Live agent office** at bottom: isometric workstations for Cowork, Claude-Code, AXIS, OPS, Leads, KB, Cleaning, Backup — pulse when active
5. Surround with **status panels**: Brainstem vitals (Netlify · Stripe · DO · crons), Frontal revenue (products · tiers · gov bids · partners), Amygdala alerts (audit · security · build · payments)
6. Live agent roster on left (8 agents, status dot, current task)
7. Live marquee at bottom (commit feed)
8. **Cyber-noir HD theme**: deep midnight blue + gold accents (matches IIS brand)

### Preview shipped by Cowork
**`outputs/axis-command-center-preview.html`** (385 lines, 25KB, self-contained, no external deps). Working static prototype with:
- SVG anatomical brain (12 regions, clickable, glow on hover)
- 8 isometric workstations with avatars + monitors + active screen flicker
- 5 animated SVG veins from brainstem → office floor
- Live UTC clock, scan line, grid overlay, marquee ticker
- All 3 right-rail status panels populated with real data
- Cyber-noir + gold cinematic palette

### Your job (RUN B — after Part A-D from above complete)
1. **Inspect** `outputs/axis-command-center-preview.html` (Cowork built it as the design lock)
2. **Take a screenshot** + visually compare to TikTok reference frames at `/tmp/axis-video-frames/frame_*.jpg`. Confirm parity or flag deltas.
3. **Replace** `public/aperture-learning.html` with the live version of the preview:
   - Keep the existing owner-only gate (read `public/aperture-learning.html` first to identify the auth wrapper)
   - Wire the static data to the live Netlify functions: vault stats from `/.netlify/functions/aria-axis-vault-stats` (you'll create this), agent state from `/.netlify/functions/aperture-state`, alerts from `/.netlify/functions/aperture-alerts`
   - Poll every 5s (use fetch + AbortController; never block UI)
   - Auto-reconnect on failure with exponential backoff
4. **Create** `netlify/functions/aria-axis-vault-stats.js` — returns `{ regions: { frontal: { notes: N, lastUpdate: ISO }, hippocampus: {…}, … }, masterHubs: N, totalNotes: N, stubs: N }` by reading from a JSON snapshot Cowork's link-web.mjs writes at `aria-vault/.axis-state.json` (you'll add that write step to the linker)
5. **Update** `aria-vault/scripts/link-web.mjs` to emit `.axis-state.json` at the end of every run — Cowork uses this so the HUD has live data without re-walking the vault on every request
6. **Wire agent office activity** to real signals:
   - Cowork active = last message in `aria-vault/04_ShortTerm/$(date +%Y-%m-%d).md` within 5 min
   - Claude-Code active = last commit in any `[sentinel]` / `[axis]` branch within 5 min
   - Leads-agent active = last entry in Gmail drafts pipeline (poll the leads heartbeat function)
   - Others: simple file-mtime checks on their respective regions
7. **Vein animation** = pulse intensity based on which region had activity in last 60s (currently CSS-static; make it dynamic via inline `style` injected by the poll loop)
8. **Tests** (`tests/axis-hud.test.mjs`):
   - vault-stats endpoint returns valid JSON
   - HUD HTML parses cleanly (no broken tags)
   - All 8 workstations render
   - All 12 brain regions present in SVG with `data-region` attribute
9. **Push** via Cowork (don't push from your side — let Cowork drive the /tmp clone after you commit locally)

### Acceptance for RUN B
- `public/aperture-learning.html` matches `outputs/axis-command-center-preview.html` visually + has live data wiring
- New Netlify function `aria-axis-vault-stats` deployed + returns 200
- `aria-vault/.axis-state.json` regenerated on every `link-web.mjs` run
- Agent dots flip green ↔ idle based on real signals
- No regression on existing `aperture-learning.html` owner-only gate
- All tests green
- Local commit message: `[axis] RUN B: command center live — brain HUD + agent office + vault stats wiring`

### Hard rules (re-stated)
- No new spend (cap $20-70/mo)
- No external CDN deps (preview is fully self-contained — keep it that way)
- Preserve existing owner-only auth
- Mobile-responsive fallback acceptable (degrade gracefully below 1280px)
- Don't break the live homepage gate / ARIA / Sentinel
