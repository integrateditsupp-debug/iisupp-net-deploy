# ARIA Sentinel 0.1.17 Release Notes

Date: 2026-06-26  
Audience: Internal pilot, founder-led enterprise demos, on-device client-scenario testing

## Status

ARIA Sentinel 0.1.17 is a **client-scenario-ready** line on top of 0.1.16. It folds the W5 Integrations
surface and the first-run profile + honest session-end reporting into a single installable build so on-device
client scenarios (Windows issues, profile/Resolve flow) can be run end-to-end. No-cost, unsigned Windows MVP.

## What's new

- **Integrations tab (W5) replaces the standalone ServiceNow nav slot.** Identity, service, and
  Microsoft 365 connectors live in one edition-gated surface (8 cards). Status is **read-only** and derived
  from the existing health checks — live writes to any directory, RSA, or ServiceNow stay gated behind
  per-customer approval. ServiceNow is now a card here rather than its own tab.
- **Mandatory first-run profile gate.** On first launch the user enters First / Last / Company / Email /
  Phone, saved **locally** to the ARIA Sentinel data folder and re-read each launch. Profile PII is local-only
  and is sent only to deliver the user's own session report.
- **Honest session-end emails.** At session end (user- or escalation-ended) the app POSTs a content-safe
  session payload (issue · backend steps · outcome · ARIA-tab transcript · **real** SLA metrics) to
  `netlify/functions/sentinel-session-report.js`, which emails the company the same data ARIA web shares and
  the user their issue + solution + SLA. **RULE 14:** real metrics only — escalations say "escalated", never
  "fixed". Email fires only at session end, never mid-session.

## Carry-forward (0.1.16 → 0.1.17)

- "Resolve it for me" (gated), ARIA Chat web parity, the one-brain KB → Anthropic → offline KB answer chain,
  the control-plane kill switch / supervisor critic / 10-second countdown / Ctrl+Alt+K, and the restored
  `aria-recipes` / `aria-stop-codes` endpoints are all carried forward and green.

## Not in this build (tracked follow-ups)

- **Secure in-app credentials form** (Integrations "Configure" panels — Entra Tenant/Client/Secret, Dynamics
  URL, ServiceNow URL/user/pass, encrypted via Electron `safeStorage`) is **not yet built**. Live
  Entra/Dynamics/ServiceNow integration testing that needs pasted creds is therefore still blocked; the
  Integrations tab shows status only. Windows-issue client scenarios and the profile/Resolve flow need no
  external creds and are fully exercisable in this build.
- **Code signing** is not applied — this is the unsigned MVP (`-unsigned.exe`). Installed locally it is a
  normal grantable process; customer distribution still needs the Authenticode / Azure Trusted Signing path.

## Safety Defaults

- The answer chain is locked and visible: knowledge base first ($0), then Anthropic only for novel questions,
  then the bundled local KB offline. Anthropic is never removed.
- High-risk fixes always require explicit confirmation and never auto-execute. Integrations status is
  read-only; no live directory/ServiceNow writes without per-customer approval.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat +
  session content are path-scrubbed.

## Build / deploy note

The physical `npm run package:win` (Electron + electron-builder) runs on Ahmad's Windows machine. The customer
build allow-list still excludes admin-console, tests, fixtures, design-review, docs and `axis/`. This build is
installed locally for on-device testing only — no OTA publish, no binary upload.

## Remaining Blocks Before Paid Enterprise Launch

- Secure in-app credentials form (above) + live ServiceNow/Entra/Dynamics OAuth apps and assignment mapping.
- Windows Authenticode certificate / Azure Trusted Signing and SmartScreen reputation path.
- MSI/SCCM/Intune packaging and silent install switches.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test / security assessment.
- Legal DPA/EULA/SLA package.
