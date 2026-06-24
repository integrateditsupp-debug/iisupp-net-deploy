# ARIA Sentinel 0.1.11 Release Notes

Date: 2026-06-23  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.11 is the **final completion-sweep** build: it closes the chat readability, license-flow,
and detector-coverage gaps from the 0.1.10 line and fixes two UI regressions surfaced by a full
surface-by-surface walkthrough. No-cost, unsigned Windows MVP. Every automated suite is green.

## What's new

- **Readable ARIA Chat answers.** Knowledge-base answers render as real formatting — headings, numbered fix
  steps, bullet lists, monospaced commands (e.g. `gpupdate /force`), links and quotes — instead of raw
  `##`/`-`/`1.` text, matching the iisupp.net/aria reading experience. Rendering is XSS-safe (model output is
  HTML-escaped before any formatting is applied). The article card + source/provenance badges are preserved.
- **One chat surface.** The redundant "Ask ARIA" box in Settings → Mode was removed; ARIA Chat lives only in
  the ARIA tab. The Personal-tier upsell nudge now posts into that live chat (it was silently dropped when the
  old Settings dock was removed).
- **License flow hardened — no more "Minting…" hang.** Every leg of the mint/verify path is now time-bounded:
  the admin console mint call (10s, with an actionable "check these Netlify env vars" error), the desktop
  license verify (10s, fail-closed to offline), and the server-side Resend email in both funnel functions (8s,
  best-effort). A slow or mis-deployed endpoint can no longer block a paying customer.
- **3-mode × 13-error proof matrix.** Automated coverage that all 13 common Windows error classes behave
  correctly through the real pipeline (recommendAction → supervisor → execution policy) at Manual / Confirmed /
  Autonomous — including high-risk (reboot) fixes that NEVER auto-execute even when proven, and non-executable
  findings that carry no live recipe in any mode.
- **20+ Windows-error detector sweep.** All seven live watchers (event log, performance, disk, WER, service,
  network, crash-control) are swept with PII-laced input; each emits the correct symbolic signal and leaks
  none of the injected machine name / username / file path / app title — the content-blind invariant, proven
  across every detector at once.
- **Two walkthrough fixes.** Restored the invisible Personal-tier upsell nudge; removed a dead "resume
  watching" control binding (resume is "Start ARIA", which clears any pause).
- **Feature walkthrough doc.** `docs/feature-walkthrough-0.1.11.md` — every tab and primary control verified
  (present · wired · reaches a real IPC method), plus a manual click-through checklist for the packaged build.

## Safety Defaults

- **The answer chain is locked and visible:** knowledge base first ($0), then Anthropic only for novel
  questions, then the bundled local KB offline. Anthropic is never removed.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat +
  session content are path-scrubbed.
- Manual mode previews fixes; real execution requires the supervisor + 10-second countdown + Ctrl+Alt+K
  kill-switch. High-risk fixes (BitLocker recovery, ransomware triage, AD/GPO) always require explicit
  confirmation and never auto-execute.

## Build / packaging note

The physical `npm run package:win` (Electron + electron-builder) and the OTA publish are run on Ahmad's
Windows machine — this build line was prepared and verified in a no-Electron CI environment. The customer
build allow-list still excludes admin-console, tests, fixtures, design-review, docs and `axis/`.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
