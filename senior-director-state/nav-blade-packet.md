# Claude Code — MASTER RUN PACKET (consolidated 2026-06-23)

ONE run, ONE branch, ONE push. Recover unpushed work + rebuild homepage nav + reorganize structure for small-business readiness + fix the "falling behind" root cause.

Authority: Ahmad. Director: Cowork. **Focus = everything documented in `aria-vault/` — DO NOT restate it; READ it** (RULES R1–R14, `07_Cortex/Ahmad.md` mission: scale IIS into a multi-million IT-services co; revenue-first, systems, speed; products IIS · ARIA · Sentinel · AXIS).

## GROUND RULES (read `aria-vault/02_Hippocampus/RULES.md` first)
- Work on a FRESH branch off CURRENT `origin/main`. NEVER build on the stale local `main` / `sprint-0-backend` (172 behind = how we fell behind).
- R14 expense: ONE batched commit+push at the end. R6: visual changes preview before going live. R8: ARIA + Aperture must still load. R13: trace results to `aria-vault/11_CorpusCallosum/Live-Operations-Log.md`. No secrets in commits. Do NOT deploy (Ahmad triggers the deploy after preview).

## STEP 0 — branch off current production
`git fetch origin main && git switch -c cc/master-run-2026-06-23 origin/main`

## STEP 1 — recover UNPUSHED local-only work (verify each vs origin/main; recover only genuinely-missing, additive content)
### kb-bulk-push (2 commits not on origin/main)
- `3ce808c4` — 27 KBs + manifest v1.5 + Tier-2 bundle. ⚠ branch uses OLD `knowledge-base/L1/` layout; main reorganized. Diff per-file; map genuinely-new articles into main's CURRENT KB structure + manifest. Do NOT restore the old layout.
- `8dbb3ad9` — AEGIS compliance policies (`compliance/policies/*`: acceptable-use, access-control, encryption, business-continuity, change-management, data-classification, +). Diff vs main's `compliance/`; add any genuinely-missing policy pages.
### sprint-0-backend (98 commits not on origin/main)
- `ada5e4f` nav → STEP 2 (rebuild, do NOT cherry-pick).
- Sentinel `0.1.12–0.1.15` + RUN 34/35 (`ARIA Sentinel/`): diff vs main; recover ONLY newer-than-main source/docs/tests.
- `8b1a0f4` model fix → SKIP (superseded by `82ebcad` already on main).

## STEP 2 — rebuild homepage nav "AI Command Blade" on CURRENT main (`index.html` only)
One machined black+gold "blade" object replacing the plain top bar: brushed body w/ faint masked PCB circuit-trace texture, inset bevel, rounded ends. Left end-cap = brand "I" chip; right = gold connector "plug" on wide screens. Per-facet thin-line glyph + animated gold underline on hover/active (ARIA lit by default):
- CPU chip → Pricing/Services/Plans · storefront → Methodology/Shop/Marketplace · AI sparkle → AI Edge/ARIA · book+play → Growth Library/ARIA Demo · gem → Portfolio/About Us.
Keep ALL 12 desktop links + Request Consultation + Install App. Mobile (≤1024): blade hidden; logo+hamburger+full overlay (15 links) UNCHANGED. (`ada5e4f` on sprint-0-backend = design reference only — it was built on stale index.html.)

## STEP 3 — structure reorganization (conservative; small-business operational readiness)
Cleaner, maintainable, revenue-focused per the vault mission. SAFE moves only — never break deploy paths, links, or `netlify.toml` redirects:
- Archive the 17 root one-off `*.cmd`/`*.bat` helper scripts → `scripts/archive/` AFTER grepping they're unreferenced by `netlify.toml`/`package.json`.
- Document (don't blindly merge) overlapping dirs: `governance/` vs `compliance/` vs `Project AEGIS - Governance/`; `aria_memory/` vs `aria_brain_pack/` vs `aria-vault/`. Where unsafe to move, record in a new `docs/STRUCTURE.md`.
- Create `docs/STRUCTURE.md` — operational map of every top-level dir by business line (IIS/ARIA/Sentinel/AXIS). This is the small-business structure map.
- Do NOT move: `index.html`, root HTML pages, `netlify/`, `assets/`, `knowledge-base/`, `aria-vault/`, or anything referenced in `netlify.toml`.

## STEP 4 — verify before commit
- Nav: headless-Chrome screenshots at ≥1500 / 1280–1440 / ≤1024 (no overlap with the two action buttons; mobile untouched).
- `node tools/iis-tester-agent.mjs --online` → still 4 PASS (HALL-1 fix lands separately).
- Grep `netlify.toml` + `index.html` for any path you moved → zero broken refs.
- ARIA + Aperture pages load; markup balanced.

## STEP 5 — ONE commit + push to a REVIEW branch
- Stage all; one commit: `[cc] master run: recover unpushed KBs/policies/Sentinel + AI-command-blade nav + structure cleanup + STRUCTURE.md`.
- `git push -u origin cc/master-run-2026-06-23` → gives Ahmad a Netlify branch-deploy PREVIEW. He reviews → merges to main → triggers ONE deploy.
- Append one line to `aria-vault/11_CorpusCallosum/Live-Operations-Log.md` + add a short lesson note `aria-vault/07_Cortex/lesson-stay-synced-to-origin-main.md` (root cause: local drifted 172 behind, work stranded on side branches → always branch off current origin/main, push review branches, merge promptly).

## Root cause this fixes
"Falling behind / missing commits" = local clone drifted 172 behind origin/main; work was committed to side branches and never reconciled. Going forward: branch off CURRENT origin/main, push review branches, merge promptly.
