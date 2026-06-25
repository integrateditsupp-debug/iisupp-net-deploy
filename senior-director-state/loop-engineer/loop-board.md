# Loop Board — live /loops view
Updated: 2026-06-25T02:16Z (Cowork). Sources: docs/LOOP-ENGINEER.md, docs/COLLAB_BRIEF.md, codex-claude-queue.md.

## /goal
Ship ARIA (web) + ARIA Sentinel (desktop) as ONE production-ready, sellable product (DoD-complete, no dry-run) and convert iisupp.net traffic into paying IIS clients. North star: scale Integrated IT Support Inc. to multi-million via recurring managed-services revenue.

## State snapshot
- ARIA Sentinel: NEW build (cc/coverage-sentinel-2026-06-24) built + installed per-user (2026-06-25). Left-panel ARIA chat tab RESTORED + verified live (KB-first $0, source cards, gated "Resolve it for me"). App registers aria-sentinel:// on startup (deep-link handler L190-208).
- ARIA web: live on iisupp.net/aria; answer chain KB-first($0) -> Anthropic -> offline KB. Web "Open with ARIA Sentinel" deep-link is ON main/live.
- CC: running queue Q0 / Q0b / Q1 / Q2 / Q3 (Ahmad-driven session).

## Active loops
| # | Loop | Owner | Status | Next safe move | Gate |
|---|------|-------|--------|----------------|------|
| 1 | product-ship (DoD) | CC | Q0 settings-box remove; Q0b deep-link merge; Q1 routing; Q2 recipes; Q3 regression | CC commits per task -> Cowork merges/verifies | Ahmad: 4.x key, Win VM |
| 2 | aria-behavior | CC/Cowork | web LLM free-form still mis-routes (only aria-event fires) | Q1 fix + live network proof of /aria-chat 200 | - |
| 3 | website-conversion | Ahmad | 12 staged conversion slices built, held local | approve-publish (one batch) or hold | publish |
| 4 | revenue-opportunity | Ahmad | SMB 7-day + Hines follow-ups drafted | send or hold | send |
| 5 | qa-safety | Cowork | R8 gates intact; caught deep-link backlog (handler stranded on branch) -> Q0b | verify deep-link e2e post-merge | - |
| 6 | trend->product-pack | Cowork | 230-call catalog + Future-of-Computing feed KB/recipes | convert top coverage gaps -> Tier-0 recipes (feeds Q2) | - |
| 7 | claude-strategy | Cowork | this board live + offer/positioning | keep board current; draft Sentinel sell offer/tiers | - |
| 8 | codex-build | Codex | per codex-claude-queue | as queued | - |

## Waiting on Ahmad (decide to unblock)
- PUBLISH (revenue): 12 staged conversion slices held local -> one batch approve or hold. (Start Here, overflow, ARIA deploy-path, ARIA KB route, Help Desk Blueprint, Overflow Pilot, M365 tune-up, M365 KB, Website Checklist, ...)
- SEND (pipeline): SMB 7-day follow-ups (WD Numeric, Tangs, Global Health Physio) + Jason Brown / Hines LinkedIn.
- KEY (DoD#2): Anthropic key with Claude 4.x access -> unblocks live LLM reply.
- VM (DoD#1): Windows VM -> >=10-recipe destructive sweep.

## Next prompt -> senior-director-state/loop-engineer/claude-next-prompt.md
