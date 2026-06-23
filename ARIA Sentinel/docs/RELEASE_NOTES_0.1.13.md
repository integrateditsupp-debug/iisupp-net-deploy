# ARIA Sentinel 0.1.13 Release Notes

Date: 2026-06-23  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.13 is the **heavy-QA + routing-iter-7** build: a chat scroll-containment fix, a routing
overhaul for the three weak KB categories, a found-and-fixed website 404, and two full QA audits plus a
dual-surface scenario sweep. No-cost, unsigned Windows MVP. Every automated suite is green (186 suites).

## What's new

- **ARIA Chat scroll containment.** A long conversation no longer grows the whole ARIA tab. The message log
  (`#ariaChatLog`) now scrolls **inside** a fixed viewport envelope — the gold-globe header stays pinned at the
  top and the input + Send button stay pinned at the bottom. Auto-scroll follows new messages but **pauses when
  you scroll up** to read history (and resumes when you return to the bottom); your own sent message always
  jumps to the latest.
- **Routing iter-7 (live aria-kb-query).** Lifted the three weak categories with new hard-routing rules:
  - **Security** — ransomware families (LockBit/WannaCry/Conti/Ryuk/…), malware-popup phrasings and
    phishing-clicked → malware triage; account-takeover signals (compromised/hacked, impossible travel,
    MFA bombing, foreign sign-in, account takeover) → security incident.
  - **Wi-Fi** — connectivity phrasings that never say "wifi" (no internet access, connected but no internet,
    network timing out, 2.4 GHz, can't see 5 G, adapter not found, …) → the Wi-Fi article.
  - **Printer** — tightened so a vertical-app "WONT PRINT" (no "printer", no print-symptom) correctly falls
    through to chat instead of being captured, while real printer issues still route.
  - **MFA** — bare "authenticator" + phone-loss phrasings now route to the MFA article (surfaced in the live
    sample, where they previously fell below the confidence threshold).
  All routing changes are unit-test-proven; they take effect on the live endpoint at the next deploy.
- **Website fix — order confirmation page.** Created the previously-missing `checkout-success.html`: every
  one-time purchase (and every cancel) now lands on a branded confirmation page with the order reference,
  instead of a 404.
- **Two full QA audits.** `docs/iisupp-net-qa-audit.md` (every page, every Stripe button → live checkout, every
  form → live backend, proper 404s) and `docs/sentinel-qa-audit.md` (10 tabs, 5 ARIA sub-sections, every button
  wired, IPC integrity, Anthropic banner locked, Memory R11 scrub) — both 100% pass on every verifiable row.
- **Dual-surface scenario sweep.** Web /aria classifier: **98.64%** over 332,163 scenarios. Live aria-kb-query:
  a clean rate-limit-respecting sample with 0 network errors; 7 of 11 intents at 82–100%; the remaining gaps are
  closed by the iter-7 commits (pending deploy). See `docs/aria-web-159k-results.md` +
  `docs/aria-sentinel-159k-sample-results.md`.

## Safety Defaults

- **The answer chain is locked and visible:** knowledge base first ($0), then Anthropic only for novel
  questions, then the bundled local KB offline. Anthropic is never removed.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat +
  session content are path-scrubbed.
- Manual mode previews fixes; real execution requires the supervisor + 10-second countdown + Ctrl+Alt+K
  kill-switch. High-risk fixes always require explicit confirmation and never auto-execute.

## Build / deploy note

The physical `npm run package:win` (Electron + electron-builder) and the OTA publish run on Ahmad's Windows
machine — this build line was prepared and verified in a no-Electron CI environment. The customer build
allow-list still excludes admin-console, tests, fixtures, design-review, docs and `axis/`. The routing iter-7 +
checkout-success.html changes also require a website deploy (Cowork/Ahmad) to reach the live endpoint/site.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
