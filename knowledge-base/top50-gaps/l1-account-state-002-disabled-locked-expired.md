---
id: l1-account-state-002
title: "Can't log in — disabled vs locked vs expired password"
category: authentication
support_level: L1
severity: high
estimated_time_minutes: 6
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "Web"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - account locked
  - account disabled
  - password expired
  - your account has been disabled
  - too many sign-in attempts
  - cant log in error
  - aad_unauthorized
  - sign-in blocked
  - account is disabled cannot sign in
tags:
  - authentication
  - account
  - lockout
  - top-50
related: [l1-password-001-reset-and-sspr, l1-password-002-locked-after-change, l1-mfa-002-lost-authenticator-phone]
---

# Account state — what error means what

### "Your account is disabled"

Your account was actively disabled by an admin. This is different from a lockout. Reasons: you're an ex-employee, role changed, security review in progress. Self-recovery NOT possible — call IT immediately at (647) 581-3182. They confirm the reason and either re-enable or escalate to HR/security. Don't keep trying — disabled accounts won't unlock with time.

### "Account is locked due to too many sign-in attempts"

You (or someone trying your password) hit the lockout threshold (typically 5 failures in 10 minutes). Auto-unlock in 15-30 minutes for most M365 tenants. If you need access now, call IT to manually unlock. Important: don't keep trying the password during lockout — it resets the timer. While waiting, check other devices (phone, second laptop) for an old password cached somewhere, since that's the most likely cause.

### "Your password has expired"

Password rotation policy hit. M365 default is 90 days. Browser sign-in prompts you to set a new one inline — do it. If you signed in on a thick client (Outlook desktop, Teams app), close them all, sign in via browser at office.com first to set the new password, then thick clients pick up the new credential. New password requirements vary by tenant: common is 12+ chars, mix of upper/lower/number/symbol, no reuse of last 24.

### "AAD_Unauthorized" or "AADSTS50057" — sign-in blocked

Entra ID Conditional Access blocked the sign-in attempt. Common triggers: signing in from an unusual country, an unmanaged device, an outdated OS version, missing MFA, or risky-sign-in detection. Try again from your usual office or home network. If still blocked, that's L2 — admin checks the Sign-in Logs in Entra to see which Conditional Access rule fired.

### Sign-in works, then immediately signs me back out

Token issuance failure. Clear browser cookies for `login.microsoftonline.com` and `login.live.com`. Use a fresh InPrivate / Incognito window. If still failing, possibly stale Windows credential cache — Control Panel → Credential Manager → delete entries containing "MicrosoftAccount" or your email.

### How to tell which state you're in — read the error verbatim

The exact wording matters. "Disabled" = admin action (call IT). "Locked" or "too many attempts" = wait + retry. "Expired" = self-service via browser. "Blocked" / unauthorized / AADSTS50xxx error code = Conditional Access (L2). Don't paraphrase the error when you call IT — read the message word-for-word, including any error code in parentheses.

### When to escalate to L2

Disabled account (immediate L2/HR). AADSTS error codes (L2 reads sign-in logs). Lockout that won't clear after 60 minutes. Password expired but reset flow won't accept any new password (likely policy mismatch). Repeated lockouts within 24 hours despite password change — see KB l1-password-002 first, then L2 if not resolved.
