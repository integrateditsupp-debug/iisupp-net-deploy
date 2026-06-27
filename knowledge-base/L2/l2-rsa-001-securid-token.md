---
id: l2-rsa-001
title: "RSA SecurID token — setup, app registration & resync"
category: rsa
support_level: L2
severity: medium
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "iOS", "Android"]
prerequisites: ["IT has issued you a token or an import URL/QR code"]
keywords:
  - rsa
  - securid
  - token
  - soft token
  - fob
  - otp
  - resync
  - out of sync
  - next tokencode
  - pin
---

# RSA SecurID token

## 1. What it is
A one-time-code (OTP) hardware fob or the RSA Authenticator app that protects VPN / remote access. The 6-digit code rotates ~every 60 seconds.

## 2. First-time setup (software token / app)
1. Install **RSA Authenticator** (App Store / Google Play).
2. IT emails a **CT-KIP URL** or QR code — open it in the app to import the token.
3. Set your **PIN** when prompted (this is yours — not the 6-digit code).
4. Sign in = **PIN + the current 6-digit code**.

## 3. Hardware fob
- Read the 6 digits; enter PIN + code when prompted.
- Battery lasts ~3–5 years → request a replacement from IT before it expires.

## 4. "Out of sync" / "next tokencode" / access denied
1. Wait for a NEW code — never reuse one.
2. If prompted for the **next tokencode**, enter the next code that appears — this resyncs the token.
3. Still failing → IT resyncs it in RSA Authentication Manager (token → **Resynchronize**).

## 5. New / replacement token
Request via IT; the old token is disabled and a new fob or app-import URL is issued.

## 6. Safety
Never share your PIN or codes. IT will never ask for them.
