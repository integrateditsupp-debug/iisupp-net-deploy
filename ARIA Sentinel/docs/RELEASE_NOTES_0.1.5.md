# ARIA Sentinel 0.1.5 Release Notes

Date: 2026-06-23  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.5 is the usability + proof-of-life release. It makes the three execution Modes provably correct with an automated harness, and (in progress) moves ARIA Chat into its own labeled window and simplifies the portal. It remains a no-cost, unsigned Windows MVP — ready for local internal testing and demos.

## What's new

- **3-Mode proof-of-life harness (RUN 32-B).** Automated integration tests now exercise the real execution pipeline (supervisor critic → execution policy → 10-second countdown → execute) end-to-end for each Mode against a safe Tier-0 recipe:
  - **Manual** — previews the fix (dry-run) and executes only after the user explicitly confirms.
  - **Confirmed** — executes live after supervisor approval + the 10-second countdown.
  - **Autonomous** — a *proven* recipe (5+ consecutive clean runs) fast-paths with no countdown; an *unproven* one still shows the countdown until it earns trust.
  - **Every mode** — a supervisor veto blocks execution, and the Ctrl+Alt+K kill-switch aborts an in-flight action.
  - A one-command on-device runner (`scripts/test-3-modes.mjs`) writes a pass/fail matrix to `docs/3-mode-smoke-results.md`.
- **KB-first answering carries forward (RUN 31).** Ask ARIA answers from the knowledge base first ($0) and only calls the reasoning model for novel questions.

## In progress (shipping across 0.1.5.x)

- **ARIA Chat in its own window** (RUN 32-A) — a dedicated "ARIA Chat" window launchable from the tray and Ctrl+Alt+A, so you can ask questions while watching the portal.
- **Portal simplification** (RUN 32-C) — an always-visible status bar (status dot + mode pill + Open ARIA Chat), verb-leaning tab labels, and a first-launch tour.

## Safety Defaults

- Manual mode keeps its dry-run preview safety; real execution (Confirmed/Autonomous) always requires the supervisor + 10-second countdown + Ctrl+Alt+K kill-switch.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; KB replies are path-scrubbed.
- The desktop never holds `SENTINEL_LICENSE_SECRET` (verifies via `sentinel-resolve`); telemetry stays content-blind on the 6-host allowlist.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
