# Codex Playbook — Delta (scan 2026-07-07 vs 2026-07-03)

**Window:** all-refs, 2d (net-new since prior scan 07-03T21:08). Read-only, $0.

## Top-line
| Metric | Prior (07-03) | Now (07-07) | Move |
|---|---|---|---|
| Net-new commits | 58 (all-refs/2d) | 6 net-new | quieted |
| Author mix | integrateditsupp-debug 47/58 + ~9 flywheel | integrateditsupp-debug 6/6 | fully consolidated |
| origin/main HEAD | 0fde03ca (advanced that window) | 0fde03ca | **FROZEN ~3.8d** |
| Top dir | aria-vault/iisupp-strategic | ARIA Sentinel/tests | web->desktop pivot |
| .git/index.lock | stale ~16h (flagged) | **cleared** | resolved |

## What's new
- **Theme pivot web -> desktop.** Prior window was the /plans interactive staffing-cost pricing-calculator (v2->v12) — web conversion lane. This window is 100% **ARIA Sentinel** (the desktop product): a demo/proof push.
- **6 Sentinel commits (07-04 -> 07-05), all on `cc/security-lockdown-2026-07-01`, pushed to origin, NOT merged:**
  - af5e03ab Harden ARIA Sentinel production proof (big; +KB pack, admin console, report-gen, compliance/perf/reports tabs)
  - cd518cea Add 100-call demo lab
  - 9f2b9bd7 Add live capture demo
  - 69058206 Add visible autonomy demo
  - ddfcac5b Add file association guard (main.mjs + preload + shared guard + test)
  - c0a0f6b4 Add Resolution tab (renderer + test)
- **Churn +7765 / -651**, concentrated ARIA Sentinel/tests (62 files) + src (57). Test-first discipline holding.

## Flags for Ahmad
1. **origin/main frozen ~3.8 days (~90h) at 0fde03ca** — nothing merged since PR #5. Two full revenue lanes now sit unmerged off main.
2. **Two parked revenue lanes:** (a) /plans pricing calculator (prior-window branch) and (b) Sentinel demo/proof suite (this-window branch, origin/cc/security-lockdown-2026-07-01). Both are conversion assets that only convert once merged + published.
3. **index.lock cleared** — the recurring 7+ consecutive stale-lock flag is gone; scans no longer blocked.
4. Codex/* namesake dormant ~17d; lane is 100% CC-flywheel under integrateditsupp-debug.
