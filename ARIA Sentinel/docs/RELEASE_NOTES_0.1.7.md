# ARIA Sentinel 0.1.7 Release Notes

Date: 2026-06-23  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.7 moves ARIA Chat into the app as a dedicated left-sidebar **ARIA** tab (replacing the separate window from 0.1.6), and lays in the ARIA brain surfaces (Chat · Learning · Health · Memory · Agents) as sub-sections of that one tab. It remains a no-cost, unsigned Windows MVP.

## What's new

- **ARIA is now a left-sidebar tab (not a separate window).** Per founder feedback ("put the chat as a tab on the left panel, not a separate window"), the detached ARIA Chat window was removed. ARIA is one parent tab with five sub-sections:
  - **Chat** (primary) — the same premium design as the web /aria: gold globe + **Integrated IT Support Inc.** centered, gold user bubbles vs neutral ARIA bubbles, KB article cards, source badges (KB $0 / via Anthropic / offline). Now fills the content area (centered, max 720px).
  - **Learning** — what ARIA is learning from the web knowledge base.
  - **Health** — the live answer-chain status, with the locked "Anthropic is your last-resort safety net" banner.
  - **Memory** — local-only conversation sessions (path-scrubbed).
  - **Agents** — read-only background-agent heartbeats.
- Ctrl+Alt+A, the tray, and the focus-chat shortcut now open the in-app ARIA tab. The detached window, its top-bar pill, and the Mode-tab launcher button were all removed.

## In progress (shipping across 0.1.7.x → 0.1.8)

- Live data wiring for the Learning / Health / Memory / Agents sub-sections (knowledge-base stats, system-status polling, local session reader, agent heartbeats) + the first-launch Setup wizard.

## Safety Defaults

- **The answer chain is locked and visible:** knowledge base first ($0), then Anthropic only for novel questions, then the bundled local KB offline. Anthropic is never removed.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat content and any session data are path-scrubbed.
- Manual mode keeps its dry-run preview; real execution requires the supervisor + 10-second countdown + Ctrl+Alt+K kill-switch.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
