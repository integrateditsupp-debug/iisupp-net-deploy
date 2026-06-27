# ARIA Sentinel 0.1.18 Release Notes

Date: 2026-06-26  
Audience: Internal pilot, founder-led enterprise demos, on-device client-scenario + live-integration testing

## Status

ARIA Sentinel 0.1.18 adds the **secure in-app credentials form** to the W5 Integrations surface, so live
Entra / Dynamics / ServiceNow testing no longer needs a hand-edited `.env.local`. Built on the 0.1.17
client-scenario line (Integrations tab + first-run profile + honest session-end emails). No-cost, unsigned
Windows MVP.

## What's new

- **Secure "Configure" credentials panels (Integrations tab).** The three connector cards that need secrets
  now have an in-app **Configure** panel:
  - **Azure AD / Entra:** Tenant ID · Client ID · Client secret.
  - **CRM (Dynamics / HubSpot):** Dynamics / Dataverse URL · HubSpot private-app token.
  - **ServiceNow:** Instance URL · integration user · password.
- **Encrypted at rest via Electron `safeStorage`** (OS-backed — DPAPI on Windows), stored in the app's
  userData, **never** in a plaintext `.env`. On launch the values are decrypted and fed into the **same env
  keys** the providers already read (`DIRECTORY_*`, `DYNAMICS_URL`, `CRM_TOKEN`, `SN_*`), so **Test
  connection** does its read-only check and flips the badge — **Connected only on a real 2xx, never faked.**
- **Privacy-hardened by construction (RULE 14 + R11):**
  - Secret fields are `type=password`, **never pre-filled**, **never returned** to the renderer (the
    get-config IPC sends a masked view that reports only *whether* a secret is set), and **never logged**.
  - A blank secret on save means "leave the stored secret unchanged" — saving one card never wipes another.
  - If the OS reports secure storage unavailable, the app **refuses to save** rather than writing plaintext,
    and the panel says so.
- **New suite:** `tests/integration-credentials.test.mjs` (10 cases) locks encrypted-at-rest, no-plaintext-on-disk,
  secrets-never-returned, refuse-without-encryption, env-feed, and merge-safety. Full suite **190/190 green**.

## Carry-forward (0.1.17 → 0.1.18)

- Integrations tab (8 cards, edition-gated, read-only status), first-run profile gate, honest session-end
  emails, "Resolve it for me", the KB → Anthropic → offline KB answer chain, and the control-plane kill switch
  are all carried forward and green.

## Not in this build (tracked follow-ups)

- **Code signing** is not applied — unsigned MVP (`-unsigned.exe`). Installed locally it's a normal grantable
  process; customer distribution still needs Authenticode / Azure Trusted Signing (config documented in
  `sales/setup-video-guides/04-code-signing-azure-trusted.md`).
- The **Dynamics/Dataverse read connector** itself is still a follow-up — the Configure panel stores
  `DYNAMICS_URL`, but the live CRM badge currently verifies via the HubSpot read path until the Dataverse
  reader lands.

## Safety Defaults

- Read-only first; no live directory/RSA/ServiceNow write without per-customer approval. Integrations status is
  read-only. Secrets encrypted local-only, masked, never logged, sent only to the provider's own endpoint.
- The answer chain is locked and visible: KB first ($0), then Anthropic for novel questions, then bundled local
  KB offline. Anthropic is never removed.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced.

## Build / deploy note

`npm run package:win` runs on Ahmad's Windows machine; customer build allow-list still excludes admin-console,
tests, fixtures, design-review, docs and `axis/`. Installed locally for on-device testing only — no OTA publish.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode / Azure Trusted Signing + SmartScreen reputation.
- Live ServiceNow / Entra / Dynamics OAuth apps + assignment mapping; the Dataverse read connector.
- MSI/SCCM/Intune packaging and silent install switches.
- Encrypted local KB store · full rollback test matrix · external pen test · legal DPA/EULA/SLA package.
