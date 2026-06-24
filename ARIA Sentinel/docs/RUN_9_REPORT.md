# RUN 9 Report — v1.0 polish + command palette + ROI + multi-tenant pane

**Date:** 2026-06-19 · **Suite:** 30/30 green · **`node --check`:** clean · **Deps added:** 0 · **Published:** nothing

## Built
- **Globe "done" flourish** — cyan check (existing `x-done`) + a gold ring sweep via pure CSS keyframe (`aria-done-ring`); no Lottie dependency.
- **Low-power mode** — `src/shared/power-mode.mjs` (pure: 60s polling · 15fps globe · animations off). Settings → About toggle → `set-low-power` IPC; overlay idle fps honors it; `lowPower` in state.
- **Command palette (Cmd/Ctrl+K)** — `src/shared/command-palette.mjs` (pure build + ranked filter over 75 recipes + nav/action commands). Renderer overlay with keybinding, live filter, Enter/click to run a recipe (dry-run), navigate a tab, or open admin/globe.
- **ROI calculator** — `src/shared/roi.mjs` (pure: fixes × minutes × rate). Settings → About shows "ARIA fixed N, saved ~M hrs @ $X/hr = $Y" from the **local audit log only**, with an editable hourly rate.
- **Multi-tenant fleet pane** — admin console Overview gains a per-customer health grid (handles only, per R11 privacy) + a live customer filter. (Row drill-in + responsive land in RUN 11.)
- **Multi-monitor** — overlay cursor-dodge already resolves the display nearest the cursor each tick (`getDisplayNearestPoint` + per-display `workArea`); verified in code.

## Tests (27 → 30 suites)
- `low-power.test.mjs` (new) — profile switches (60s / 15fps / animations off); source profiles frozen.
- `command-palette.test.mjs` (new) — 81 commands built; ranked filter (label-start > word > substring > keyword); recipe + nav search; limit + no-match.
- `roi-calc.test.mjs` (new) — math, custom rate, 0 fixes, very large, garbage-safe, singular grammar.

## Acceptance
- [x] `npm test` = 30/30 green
- [x] Cmd/Ctrl+K opens the palette + filters recipes
- [x] ROI shows a realistic $ figure from the audit log
- [ ] **Manual:** 4 DPI screenshots per scale (100/125/150/200%) — needs a Windows desktop session
- [ ] **Manual:** idle CPU < 1% / idle RAM < 50MB — measure on a real machine (low-power mode added to help hit it)

## Next-run prerequisites (RUN 10)
- License HMAC + API bearer auth both reuse `node:crypto`; API payloads consume `telemetry-event-v1`.
