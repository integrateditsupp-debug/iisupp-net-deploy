# Setup-guide screenshots + run evidence

Captured build-side by Forge from the running **ARIA Sentinel 0.1.19** install (real app window via
`PrintWindow`, so the captures are the app's own content, not a screen grab of the desktop).

## Captured
- **`00-app-dashboard.png`** — the running 0.1.19 desktop app (Dashboard).
- **`10-integrations-tab.png`** — the **Integrations tab**: 8 connector cards, honest **"Not configured"**
  badges, **Test connection** + **Configure** buttons (the W5 surface).
- **`11-integrations-configure.png`** — the **Azure AD / Entra Configure panel** expanded (the secure
  creds form): Tenant ID / Client ID / Client secret fields, **SAVE CREDENTIALS**, and the safeStorage
  notice ("Stored encrypted on this device only … Secrets are masked, never logged, and sent only to the
  provider's own read-only check"). **The real tenant/client IDs are `[REDACTED]`** — they were entered
  live on Ahmad's machine and must not land in git; the client secret is already masked by the app.
- **`flagship-case-e2e-run.log`** — a real headless end-to-end run of the **case orchestrator** against
  the actual modules:
  - RUN 1 (no creds) → outcome **escalated**, incident number **null** (no fake), both steps flagged
    **not-configured** (honest, not faked).
  - RUN 2 (configured via injected transport) → Interaction `IMS000101` → Incident `INC000201` →
    **revoke sign-in sessions** (verified, honestly labeled) → **resolve** incident → **close**
    interaction → email case summary `{resolved:true, ticket:{...}}`. Numbers came from read-back GETs.
  This is the exact code path Cowork runs with live ServiceNow/Entra creds.

## Still Cowork's live-capture (needs the driven UI + live creds, mid-scenario)
The remaining `[SCREENSHOT]` placeholders in guides 01–05 are the **live-flow** shots: a real Test-connection
flip to Connected, the actual ServiceNow Interaction/Incident records + emails, and the proactive summary
email. As of this capture, **live provisioning is already underway** — the Entra Configure panel showed real
credentials present ("Credentials present — run Test connection to verify"). Cowork completes the live run +
those shots with computer-use.
