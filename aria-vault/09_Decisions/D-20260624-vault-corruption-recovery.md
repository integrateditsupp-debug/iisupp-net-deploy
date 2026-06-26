---
brain_region: frontal-decisions
type: decision
date: 2026-06-24
status: locked
---

# D-20260624 · Vault corruption → recovery (postmortem)

## Context
- During a Claude-Code run, **multiple processes wrote the same `.git` concurrently** (CC + cron jobs + Cowork's own git ops). Git's `HEAD`, `packed-refs`, and index were truncated; a stale `index.lock` remained.
- A repair attempt by Cowork **raced the still-running CC** and worsened the state → reverted. The broken checkout left `aria-vault/` directories present but empty; the live working tree was lost, including ~50 **uncommitted** auto-memory mirror notes.
- Obsidian wouldn't open the vault; mount writes were intermittently failing under a file-watcher's contention.

## What was lost vs recovered
- **Recovered (145 notes):** 98 core brain notes (from `origin/main`), all 75 strategic/prospect files (from `USA Outreach/` = the `iisupp-strategic` source), R15–17 rules, and Ahmad's `.obsidian` settings — restored **in place** in the original `iisupp-net-deploy/aria-vault` so existing links hold.
- **Not recoverable (~50 notes):** auto-generated memory mirrors (`feedback_*`, `project_*`) that only ever existed in the live working tree — never committed, never archived, not in git objects (fsck = 0 dangling), not on disk anywhere (whole-PC search confirmed). The substantive ones were **regenerated** from session memory ([[2026-06-23]], [[2026-06-24]], [[D-20260623-director-safe-autonomy-mandate]], this note).

## Decision / lessons locked
- **[[RULES]] R16 — one writer per `.git`.** Only one agent touches a given `.git` at a time; others use their own clone/worktree. No Cowork git ops during a live CC run.
- **[[RULES]] R17 — backup discipline.** ≥2 backup copies outside the working tree; daily snapshot + **instant snapshot after any large block of work**; back up the backup.
- **[[RULES]] R15 — push ownership.** CC commits + pushes every run; Cowork merges; Ahmad never pushes by hand (reduces concurrent-writer pressure).
- Recovery work happens in **clean sandbox space first**, then restores in place once the working tree is quiet (verified by a write test).

## Why it matters
- The damage came entirely from concurrency + no instant backup of uncommitted work. R16 removes the cause; R17 removes the blast radius.

## Revisit when
- A safer multi-agent git workflow (e.g. per-agent worktrees by default, or a commit queue) is adopted.

## Related

<!-- LINK-WEB:auto -->
- [[_Decisions]]
- [[D-20260619-bake-stripe-price-ids-in-code]]
- [[D-20260623-director-safe-autonomy-mandate]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[2026-06-23]]
- [[2026-06-24]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[D-20260624-aria-web-sentinel-one-product]]
- [[D-20260625-pricing-editions-ad-integration]]
- [[D-20260625-privacy-hosts-entra]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[Live-Operations-Log]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
