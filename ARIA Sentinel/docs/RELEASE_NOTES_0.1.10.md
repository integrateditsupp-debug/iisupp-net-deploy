# ARIA Sentinel 0.1.10 Release Notes

Date: 2026-06-23  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.10 is the final-polish line ahead of the 0.1.11 production-ready build: readable chat answers, a deduplicated chat surface, a hardened license flow, and a full 3-mode × Windows-error proof matrix. No-cost, unsigned Windows MVP.

## What's new

- **Readable ARIA Chat answers.** Knowledge-base answers now render as real formatting — headings, numbered fix steps, bullet lists, monospaced commands (e.g. `gpupdate /force`), links and quotes — instead of raw `##`/`-`/`1.` text. Matches the iisupp.net/aria reading experience, with the article card + source badges preserved. (Rendering is XSS-safe: model output is HTML-escaped before any formatting is applied.)
- **One chat surface.** The redundant "Ask ARIA" box in Settings → Mode was removed — ARIA Chat lives only in the ARIA tab now.
- **License flow hardened.** The admin "Mint + email" and the desktop license-verify calls now time out in 10 seconds with an actionable error instead of hanging on "Minting…", and the most common root causes (missing Netlify env vars) are surfaced to the operator.
- **3-mode × Windows-error proof matrix.** Automated coverage that every execution mode (Manual previews · Confirmed countdown · Autonomous supervisor) behaves correctly across the common Windows fix categories, including high-risk fixes that NEVER auto-execute and the Ctrl+Alt+K kill-switch.

## Safety Defaults

- **The answer chain is locked and visible:** knowledge base first ($0), then Anthropic only for novel questions, then the bundled local KB offline. Anthropic is never removed.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat + session content are path-scrubbed.
- Manual mode previews fixes; real execution requires the supervisor + 10-second countdown + Ctrl+Alt+K kill-switch. High-risk fixes (BitLocker recovery, ransomware triage, AD/GPO) always require explicit confirmation and never auto-execute.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
