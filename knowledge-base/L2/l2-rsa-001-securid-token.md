---
id: l2-rsa-001
title: "RSA SecurID token — setup, app registration & resync"
category: rsa
support_level: L2
severity: medium
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
keywords:
  - rsa
  - securid
  - rsa token
  - soft token
  - fob
  - resync
  - out of sync
  - passcode
  - pin
  - authenticator
related_articles: []
escalation_trigger: "See the Escalate section in the body."
last_updated: 2026-06-27
version: 1.0
status: active
---
# RSA SecurID token — setup & resync

## New soft token (app)
- Install the RSA Authenticator / SecurID app. Request the import URL or QR (CTKIP/CT-KIP) from IT — never share the token file by email.
- Import the token, set the PIN when prompted, then test a sign-in to confirm the passcode is accepted.

## Token out of sync
- A SecurID code is time-based: check the device clock is correct (auto time zone on).
- If sign-in still fails, IT can run a next-tokencode resync (enter two consecutive codes) from the RSA console.

## New hardware fob
- IT assigns the fob's serial to your account in the RSA console, sets the initial PIN policy, and confirms the first passcode.

## Common failures
- Wrong PIN order (PIN + tokencode), expired/replaced fob, or account not yet bound to the token → IT re-binds in the RSA console.

## Escalate
- Repeated "access denied" after a verified PIN + fresh code, or the token won't import → identity/security admin.

## Keywords
rsa, securid, rsa token, soft token, fob, resync, out of sync, passcode, pin, authenticator
