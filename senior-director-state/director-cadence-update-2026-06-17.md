# Director Cadence Update — 2026-06-17

**Per Ahmad LOCKED 2026-06-17 — `feedback_loop_frequency_high`:**

| Component | Old cadence | New target |
|---|---|---|
| Senior Director worker tick | ~5 min | **1-2 min** |
| Cowork deliverables per response | 3-5 | **5-10 parallel tracks** |
| Idle-improvement fire interval | every 15 min | **every 5 min** |
| KB build loop | daily | **hourly** |
| Lead-radar scan | as set | **hourly** during business hours |
| Outreach prep scheduled task | as set | **hourly draft cycle** |
| Critique re-tick | weekly | **every 48 h or on drift** |
| Approval batch refresh | daily | **2× per day** |
| Cross-agent handoff re-pointer | on demand | **every worker tick** (auto-include) |

**Why:** "Last night we got from baseline to 90%+ in one push. Months of work in hours. Keep that pace."

**How:**
- Director worker `setInterval(..., 60_000)` instead of `300_000`.
- Cowork per-turn target raised — 5-10 parallel deliverables (was 3-5).
- Scheduled-task cron tightened on every recurring agent loop.
- Idle-improvement quota raised — each idle agent ships at least 2 micro-improvements per 30 min.

**Quality bar unchanged:** speed without verification is reckless. Frequent loops mean frequent **also** verification + frequent **also** dedupe.

**Stop rules unchanged:** no sends, no submits, no publishes without Ahmad gate. Idle-improvement still $0 cost + zero-risk.

Filed in: `senior-director-state/director-cadence-update-2026-06-17.md`. Director worker reads on next boot.
