# 3-Mode Smoke Test — Results

**Outcome:** ✅ ALL MODES PASS  ·  recipe: `network-flush-dns` (safe Tier-0, never spawned)

| Case | Result | Decision |
|---|---|---|
| Manual — default (preview) | ✅ pass | `{"verdict":"approve","dryRun":true,"execute":false,"countdown":true,"autoFire":false}` |
| Manual — user confirms | ✅ pass | `{"verdict":"approve","dryRun":false,"execute":true,"countdown":true,"autoFire":false}` |
| Confirmed — countdown + exec | ✅ pass | `{"verdict":"approve","dryRun":false,"execute":true,"countdown":true,"autoFire":false}` |
| Autonomous — proven, fast-path | ✅ pass | `{"verdict":"approve-fast","dryRun":false,"execute":true,"countdown":false,"autoFire":true}` |
| Autonomous — unproven, keeps countdown | ✅ pass | `{"verdict":"approve","dryRun":false,"execute":true,"countdown":true,"autoFire":true}` |

_Decision pipeline only (supervisor → executionPolicy → countdown gate). No OS command is executed._
