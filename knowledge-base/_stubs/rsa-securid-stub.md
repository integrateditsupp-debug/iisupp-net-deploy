---
id: stub-rsa-securid
title: "RSA SecurID token (stub)"
category: rsa
support_level: L2
status: stub
keywords: [rsa, securid, token, resync, otp]
---

## What it is
RSA SecurID is a multi-factor authentication method that generates a time-based
one-time passcode (OTP). The code comes from a hardware fob or the RSA
Authenticator app and rotates every 60 seconds. At sign-in the user enters their
PIN plus the current token code (this combined value is the "passcode").

## First-time setup
- Confirm the user is enrolled in RSA Authentication Manager and assigned a token.
- For app (software) tokens, import the issued CTF/QR file or activation link into
  the RSA Authenticator app and verify the device clock is set to automatic time.
- On first use the user may be prompted to set a new PIN; have them choose one and
  confirm it meets the policy length.

## Out of sync / resync
- Token codes can drift if the device clock is wrong or several wrong codes were
  entered. Have the user wait for a fresh code before retrying.
- In Authentication Manager, locate the user's token and run "Resynchronize Token,"
  then enter two consecutive codes when prompted. Hardware fobs cannot be
  manually time-set; resync corrects the offset.
- If resync fails, the token may be disabled after too many failures — clear the
  lockout or issue a new token.

## Safety
- Never ask for or record a user's full passcode or PIN. Verify identity through
  standard checks before any token action. Escalate suspected token theft or
  account compromise to security immediately.
