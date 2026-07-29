# Codex Playbook — scan 2026-07-28T21:10Z (window 2d)

**Verdict: this is no longer a Codex observer.** Codex proper: 0 commits, 26 days dormant (last 2026-07-02). The stream this loop watches is Ahmad + CC/Cowork agents.

## Window at a glance
- HEAD `73a6f0e4` on `axis-command-center-v2` (prior scan HEAD `ceed5ae5`)
- 14 commits in window, 9 new since prior scan — all on 2026-07-28
- Authors: Ahmad Wasee 7, CC Stage2 5, Cowork (Claude) 1, AXIS Worker 1

## What changed vs prior scan
1. **Human takes the lead.** First window where Ahmad out-commits the agents (7 of 14). Prior windows were agent-only (CC Stage2 / AXIS Worker).
2. **Conventional commits appear.** `feat(...)` / `fix(...)` / `chore(...)` prefixes are new — earlier windows used bare prose subjects. Signals a deliberate discipline shift.
3. **New domain: outreach + deliverability.** Send driver, token-based snapshot pusher, Deliverability Guardian (hard pre-send gate + daily 5pm SPF/DKIM/DMARC sweep), and the `"Hello ,"` merge-bug kill (renderer hard-fails, lint catches empty merges). This directly addresses the OPEN 2026-07-24 unattributed-mass-send incident.
4. **Test churn is the highest on record** — `tests/` is the #1 touched dir (15 files), consistent with the new lint/hard-fail guards.
5. **Repo hygiene fixed.** Dirty working-tree paths collapsed 516 → 127 via `bb98ebf1` (.gitignore hardened against a 440MB `outputs/`).
6. **Security posture.** `b9358fe9` force-404s `/CC-BRIEF.md` — publish dir is `.`, so root `.md` files were serving publicly.
7. **No new top-level directories.**

## Behavioral pattern (carry forward)
- Work lands in bursts on a single day after multi-day freezes (07-21: 15, 07-22: 2, 07-23..27: 0, 07-28: 14).
- Freeze windows correlate with a lingering `.git/index.lock`.
- Feature work lands on `axis-command-center-v2`, not `main`.
- Agent identities keep multiplying: CC Stage2, AXIS Worker, Cowork (Claude), Forge (dormant), ARIA loops. No single canonical committer.

## Flags for Ahmad
1. **`main` is still 14 ahead of `origin/main`, unchanged for 8 days.** RUN-F..RUN-K (first paid customer, first dollar, renewal truth, durable revenue) remain unpushed. Highest-value blocker, unmoved across three scans.
2. **`.git/index.lock` present again** (0-byte, ~89 min old, mtime NOT advancing this scan → reads stale, unlike prior scan where it was live-contended). Sandbox cannot unlink. Delete locally before the next write burst.
3. **Review the token-authed endpoints** — `/api/axis/snapshot-push` plus the new token-based snapshot pusher in `73a6f0e4`. Confirm tokens are server-side only and not committed.
4. **Incident closure candidate:** the deliverability + merge-bug work looks like the fix for the 07-24 mass-send. Worth formally closing that incident or documenting what remains.
5. **Retire the Codex framing.** 26 days dormant. Rename this loop `repo-observer` or point it at the Cowork/CC stream explicitly.
6. **`observe-codex.mjs` still missing.** Every scan since 07-21 is a manual git-log reconstruction. Either reconstruct the script into the repo or drop the step from the loop spec.
