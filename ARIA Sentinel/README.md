# ARIA Sentinel — Design Handoff Bundle

**For Ahmad — paste-ready package for Claude Design.**

## What's in here

| File | Purpose |
|---|---|
| `00_PROMPT-FOR-CLAUDE-DESIGN.md` | The prompt. Paste this entire file into your Claude Design session. |
| `01_master-brief-for-claude-design.md` | Source-of-truth brief (16 sections, ~440 lines). Attach as context. |
| `02_globe-states.svg` | 5 states of the floating globe |
| `03_fix-card.svg` | Fix card variants (detected / fixing / done / escalation) |
| `04_bsod-takeover.svg` | BSOD recovery screen with "ARIA — Solve it for me" option |
| `05_architecture-diagram.svg` | 4-layer architecture (brand / backend / extensions / desktop) |
| `06_sprint-stages.svg` | 7-sprint build timeline with AI-hour estimates |
| `07_user-flow.svg` | Linear user journey + BSOD edge lane |

## How to use this

### Option A — Hand off to your Claude Design session (recommended)

1. Open a new Claude conversation, set system context to "senior product designer"
2. Paste the contents of `00_PROMPT-FOR-CLAUDE-DESIGN.md`
3. Attach all 6 SVG files + the master brief
4. Claude Design will produce: Figma file, 20 mockups, 12+16 slide decks, Lottie animation, one-pager
5. Review the gated preview before approving production export
6. Approved design files → Cowork × Codex begin Sprint 0/1 immediately

### Option B — Cowork executes solo

1. Tell me "Cowork, execute Sprint 0 + scaffold Sprint 1"
2. I ship backend endpoints + Electron scaffold + globe UI directly
3. Designer reviews live build, refines via Figma after MVP demo
4. Approve gated previews as I ship each iteration

### Option C — Codex handoff

1. Codex picks up Sprint 1 (Electron desktop app) using the master brief as packet
2. Cowork takes Sprint 0 (backend) + Sprint 6 (polish)
3. KB-agent handles Sprint 5 (recipe expansion) on continuous loop

## Critical features locked

- **Manual mode default at install.** Confirmed + Autonomous are paid features.
- **Strict privacy.** Nothing uploads. KB pulls down from `iisupp.net/aria-recipes`. Privacy verifier UI included.
- **BSOD takeover** via Tier A (BCD boot menu entry) + Tier C (crash-on-resume detection) on Windows.
- **Standalone pricing** separate from existing ARIA Personal/Pro/SMB/Mid/Enterprise tiers.
- **B2B-first.** Mobile deferred.
- **Code signing AFTER MVP** — Ahmad buys certs only once internal test passes.
- **Direct download first**, store listings after.

## What Ahmad must do (only)

1. **Now**: paste the prompt into Claude Design. Or tell me to start Cowork-solo path.
2. **After MVP test**: buy code signing certs ($300/yr Microsoft EV + $99/yr Apple Developer ID).
3. **After v1 polish**: approve Chrome Web Store + MS Partner Store listing submits.
4. Everything else is automated.

— Cowork, 2026-06-19
