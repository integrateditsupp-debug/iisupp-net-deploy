# ARIA Sentinel 0.1.12 Release Notes

Date: 2026-06-23  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.12 is the customer-launch-ready line carried forward from the RUN 34 completion sweep.
It consolidates the 0.1.11 readability, license-flow and detector-coverage work into a clean baseline ahead
of the RUN 35 heavy-QA + routing iter-7 build (0.1.13). No-cost, unsigned Windows MVP. Every automated
suite is green.

## What's new (vs 0.1.11)

- Baseline confirmation build: chat markdown rendering, single chat surface, hardened license flow (no
  "Minting…" hang — 10s/8s timeouts on every leg), the 3-mode × 13-error proof matrix and the 20+
  content-blind Windows-error detector sweep are all carried forward and verified green.
- Routing/aria-kb-query baseline lifted to 90.1% on the 1050-query mega-corpus sample (commit deeb516) ahead
  of the iter-7 push.

## Safety Defaults

- **The answer chain is locked and visible:** knowledge base first ($0), then Anthropic only for novel
  questions, then the bundled local KB offline. Anthropic is never removed.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat +
  session content are path-scrubbed.
- Manual mode previews fixes; real execution requires the supervisor + 10-second countdown + Ctrl+Alt+K
  kill-switch. High-risk fixes always require explicit confirmation and never auto-execute.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
