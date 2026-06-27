# Setup-guide screenshots

## Captured (build-side, by Forge on the real machine)
- **`00-app-dashboard.png`** — the running **ARIA Sentinel 0.1.19** desktop app (Dashboard view), captured
  live from the installed build window. Real evidence the flagship build launches and renders.

## Still to capture (Cowork's live-capture step — needs the driven UI + Ahmad's live creds/scopes)
The remaining `[SCREENSHOT]` placeholders in guides 01–05 are **live-flow** shots that require the case
driven through the UI against **real ServiceNow + Entra** (write role + admin consent + a test user that
Ahmad provisions — see `05-flagship-write-role-and-notifications.md`). Capture these while running the
scenario:
- Integrations tab (8 cards, honest "Not configured" badges) + a **Configure** panel (secure fields).
- Resolve-for-me → Interaction + Incident (real numbers) → Entra remediation (read-back verified) →
  resolve/close → the session-end + ServiceNow-notification emails.
- The proactive background pass + the user "what I handled" summary email.

> Why Forge didn't capture the rest: driving the Electron UI by mouse/foreground automation on Ahmad's
> **actively-used** machine (a browser was open mid-session) interferes with the live work and produces
> unreliable, sometimes screen-leaking captures — so build-side automation was stopped after the one clean
> dashboard shot. The live flow + its screenshots are Cowork's role with computer-use, per the original packet.
