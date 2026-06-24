# ARIA Sentinel 0.1.8 Release Notes

Date: 2026-06-23  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.8 completes the in-app ARIA experience: the ARIA sidebar tab now routes correctly and its five sub-sections (Chat · Learning · Health · Memory · Agents) are wired to live data, the dry-run UI clutter is removed, and a first-launch Setup wizard is added. No-cost, unsigned Windows MVP.

## What's new

- **ARIA tab routing fixed.** Clicking ARIA (or any of its sub-section links) now switches the right pane to the ARIA tab — previously it highlighted the sidebar but fell back to the Dashboard pane.
- **ARIA sub-sections wired to live data:**
  - **Chat** — the premium in-tab assistant (knowledge base first, Anthropic only for novel questions, local KB offline).
  - **Learning** — recent learnings, coverage-by-tier, and top categories from the knowledge-base stats.
  - **Health** — the live answer-chain status with the locked "Anthropic is your last-resort safety net" banner and the three-tier fall-through chain.
  - **Memory** — local-only conversation sessions (path-scrubbed; never leaves the device).
  - **Agents** — read-only background-agent heartbeats.
- **Dry-run UI removed.** The "Dry-run safe" top-bar pill and the "Keep system fixes in dry-run mode" checkbox are gone — execution safety is now governed entirely by the Mode you choose (Manual previews; Confirmed/Autonomous execute after the supervisor + countdown + kill-switch).
- **Setup wizard.** A first-launch (and re-runnable) wizard for license/trial, mode, ARIA Chat and notification preferences.

## Safety Defaults

- **The answer chain is locked and visible:** knowledge base first ($0), then Anthropic only for novel questions, then the bundled local KB offline. Anthropic is never removed.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat content and any session data are path-scrubbed.
- Manual mode still previews fixes before applying them; real execution requires the supervisor + 10-second countdown + Ctrl+Alt+K kill-switch.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
