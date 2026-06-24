# RUN 6 Report — Autonomous opt-in + Slack/Teams notify + weekly digest

**Date:** 2026-06-19 · **Suite:** 26/26 green · **`node --check`:** clean · **Deps added:** 0 · **Published:** nothing · **Windows + macOS guards:** intact

## Built
- **Autonomous opt-in flow** — Settings → Mode → Autonomous opens a modal (explainer + recipe list + "I understand" checkbox); **Enable stays disabled until checked**. `set-mode("autonomous")` is refused by main unless `{understood:true}` — cannot be enabled silently (`canEnableAutonomous`).
- **Safety guards** (`src/shared/autonomous.mjs`, pure): per-recipe cap **3×/24h/endpoint** (4th → fall back to Confirmed), **30-min cooldown** between any two auto-fires, **fleet rate-limit** (>5% of fleet in 60 min disables the recipe). Only green recipes auto-fire; yellow always confirms.
- **Auto-fire path** — `addDetection` calls `autoFireIfEligible` (mode=autonomous + green + guards pass → `runRecipe` auto, records history, notifies). Idempotency-backed so a flapping detection can't double-apply.
- **Pause Autonomous** — `pause-autonomous` IPC ([1h / 24h / until re-enable]); `autonomousPausedUntil` in state.
- **Restore-point UI polish** (design §17) — 360px card, circular-arrow icon, mono name, ghost "ROLL BACK THIS FIX".
- **Slack/Teams notify** (`src/shared/notify.mjs`) — Settings → ServiceNow/Integrations panel: webhook URL + channel. Sends only a sanitized `telemetry-event-v1` (recipe · outcome · endpoint handle · duration); **host-allowlisted to Slack/Teams, https-only**; webhook URL **redacted in logs**, never stored in the audit.
- **Weekly digest** (`src/shared/weekly-digest.mjs` + project-local `netlify/functions/aria-weekly-digest.mjs`) — per-customer aggregate (fixes · hours saved · top-3 · escalations), ISO timestamps, content-blind; scheduled via `export const config={schedule}`; Resend send is a dry-run stub until the live key is wired.

## Tests (22 → 26 suites)
- `autonomous-guards.test.mjs` (new) — opt-in gate, cap, cooldown, fleet rate-limit, pause choices.
- `autonomous-refire.test.mjs` (new) — same execution_id applies once; new ids bounded by the 3/24h cap (no runaway loop).
- `slack-notify.test.mjs` (new) — host allowlist (https Slack/Teams only), symbolic-only payload, 0 user content, webhook redacted in logs.
- `weekly-digest.test.mjs` (new) — aggregation math, HTML render, content-blind, empty-safe.

## Acceptance
- [x] `npm test` = 26/26 green
- [x] Autonomous requires explicit opt-in modal (gate-enforced in main + UI)
- [x] 4th auto-fire within 24h falls back to Confirmed (per-recipe cap test)
- [x] Slack/Teams test ping path works (mock — sends nothing without a configured allowed webhook)
- [x] Weekly digest produces valid HTML in dry-run

## Notes / locked rules
- Notify is opt-in and sends ONLY content-blind telemetry to a user-pasted Slack/Teams webhook; nothing fires without explicit config, and no hardcoded external URL was added to `src/` (privacy audit still clean).
- Off-by-one note: the packet's "26" assumed the idempotency suite was new; it's existing. The autonomous re-fire scenario got its own new suite instead, landing the count at a true 26.

## Next-run prerequisites (RUN 7)
- Recipe expansion uses the existing recipe shape + recipe-runner green allowlist; content-leak corpus grows to 1500.
