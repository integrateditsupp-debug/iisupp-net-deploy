# ARIA Sentinel 0.1.15 Release Notes

Date: 2026-06-24  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.15 is the **web↔Sentinel parity** line: the desktop ARIA Chat now matches the
iisupp.net/aria experience, and the on-device **"Resolve it for me"** action is enabled — gated by the
existing RUN 29 safety pipeline. No-cost, unsigned Windows MVP. Full automated suite green.

## What's new

- **"Resolve it for me" — enabled, safety-gated.** The previously-grayed on-device fix action now runs the
  matched detection→fix recipe **locally**, through the RUN 29 control plane: supervisor critic → execution
  policy → 10-second countdown → Ctrl+Alt+K kill-switch → allowed-tier check. **Default mode is Confirmed**
  (the user approves every fix); it never defaults to Autonomous, per-mode dry-run defaults are preserved
  (Manual ON), and the kill-switch aborts a fix mid-countdown. Nothing executes without an explicit confirm.
- **ARIA Chat = web parity.** The Sentinel chat surface now matches `iisupp.net/aria`: company header + gold
  globe, message bubbles, KB article cards, source/provenance badges (KB $0 · via Anthropic · offline local
  KB), fonts and spacing. The only intentional difference is the local "Resolve it for me" action (web shows
  a download/walkthrough gate instead).
- **One product, one brain.** Web and Sentinel share the same knowledge base, recipes, stop-codes and the
  locked fall-through chain (KB $0 → Anthropic → offline local KB). Documented in the vault and
  `docs/STRUCTURE.md`.

## Carry-forward (0.1.13 → 0.1.15)

- 0.1.14 / 0.1.15 were maintenance version bumps; this release consolidates them with the parity + resolve work.
- Chat scroll containment, routing iter-7 (security/wifi/printer/mfa), 3-mode × error matrix, and the
  content-blind detector sweep from the 0.1.11–0.1.13 line are all carried forward and green.

## Safety Defaults

- **The answer chain is locked and visible:** knowledge base first ($0), then Anthropic only for novel
  questions, then the bundled local KB offline. Anthropic is never removed.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat +
  session content are path-scrubbed.
- Manual mode previews fixes; real execution requires the supervisor + 10-second countdown + Ctrl+Alt+K
  kill-switch. High-risk fixes always require explicit confirmation and never auto-execute.

## Build / deploy note

The physical `npm run package:win` (Electron + electron-builder) and the OTA publish run on Ahmad's Windows
machine. The customer build allow-list still excludes admin-console, tests, fixtures, design-review, docs and
`axis/`.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
