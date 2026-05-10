---
id: l1-password-001
title: "Password reset / forgotten password (self-service)"
category: passwords
support_level: L1
severity: high
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
prerequisites: []
keywords:
  - password reset
  - forgot password
  - sspr
  - self service password reset
  - locked out
  - account locked
  - reset link
related_articles:
  - l1-mfa-001
  - l1-m365-001
  - l2-active-directory-001
escalation_trigger: "User cannot complete SSPR (no verification methods or expired), or admin reset required, or local-account-only PC with lost password"
last_updated: 2026-05-07
version: 1.0
---

# Password reset / forgotten password (self-service)

## 1. Symptoms
- "I forgot my password."
- "Sign-in says my password is wrong."
- "My account is locked out."
- "Password expired and I can't change it from sign-in screen."
- "Caps Lock was on and I'm now locked."

## 2. Likely Causes
1. Forgotten password.
2. Multiple wrong attempts triggered lockout.
3. Password expired and grace period passed.
4. Caps Lock / wrong keyboard language.
5. Account disabled administratively (offboarding, security).

## 3. Questions To Ask User
1. Have you tried with Caps Lock OFF and your keyboard set to your usual language?
2. Are you trying to sign in to your work account (M365 / company login)?
3. Have you registered for self-service password reset (SSPR) — added phone or app to your account?
4. Do you still have access to your phone / authenticator?
5. Are you remote, or in the office on a corporate network?

## 4. Troubleshooting Steps
1. Try sign-in once more with Caps Lock confirmed OFF.
2. Wait 30 minutes if lockout suspected (auto-unlock often).
3. Verify SSPR enrollment: visit https://aka.ms/ssprsetup.
4. Confirm a phone or Authenticator is registered before attempting reset.

## 5. Resolution Steps
**Self-service reset (SSPR):**
1. From sign-in page, click "Can't access your account?" / "Forgot password?".
2. Enter UPN (email) and the captcha.
3. Pick a verification method (phone text, phone call, Authenticator code, or email).
4. Receive code → enter.
5. Set new password (must satisfy: min length 8, mix of upper/lower/number/symbol, not reused).
6. Wait 30 seconds for sync.
7. Sign in.

**For a Windows-joined device, when a remote user resets cloud password but local cache is stale:**
- Connect to corporate VPN, then lock + unlock with new password to refresh local cached credentials.
- Or: use "Reset password" link on Windows lock screen if SSPR-from-Windows is enabled.

**For password expired:**
- Sign-in normally prompts "Your password has expired" — change in-flow.
- If sign-in screen doesn't show option: log in via web (office.com), it'll prompt there.

## 6. Verification Steps
- Sign-in succeeds with new password on web.
- Outlook, Teams, Office apps sign back in successfully.
- Lock + unlock Windows session works with new password.
- 24h with no further "wrong password" issues.

## 7. Escalation Trigger
- User not enrolled in SSPR (no methods registered).
- Reset goes through but Windows local cache rejects new password despite VPN refresh.
- Account marked disabled in Azure AD / AD.
- Local-account-only PC (workgroup) with lost password — different recovery path.
- → Escalate to **L2** for admin reset; **L3** if local Windows account requires offline tooling.

## 8. Prevention Tips
- Register at least 2 verification methods at https://aka.ms/ssprsetup.
- Use a password manager (corporate-approved) to avoid forgetting.
- Don't share passwords across personal and work accounts.
- Don't use a date-of-birth / pet name / sequential pattern.
- For shared workstations, never let the OS save the password for someone else's account.

## 9. User-Friendly Explanation
"You can reset your own password without needing to call IT, as long as you've registered a phone or the Authenticator app. We'll go to the reset page, prove it's you with a code on your phone, and pick a new password. If your laptop still wants the old one after, we'll connect to the company network for a moment so it catches up."

## 10. Internal Technician Notes
- SSPR portal: https://passwordreset.microsoftonline.com or via the sign-in page link.
- Admin reset (cloud-only): Entra → Users → user → Reset password.
- Hybrid AD: ensure Azure AD Connect Password Writeback is enabled, or reset will only update cloud → user can sign into M365 but not into AD-joined PC.
- Cached credentials on Windows: stored in registry / `lsass`. VPN + lock/unlock refreshes; otherwise, only old password works at console until a domain-connected session.
- Lockout policy default in Entra: 10 failed attempts → 1-min lockout, doubling for repeats. Tune via Authentication methods policy.
- Password protection bans common passwords; enforce custom banned list for company-specific weak passwords.

## 11. Related KB Articles
- l1-mfa-001 — MFA setup and recovery
- l1-m365-001 — Can't sign in to M365
- l2-active-directory-001 — AD account unlock / admin reset

## 12. Keywords / Search Tags
password reset, forgot password, sspr, self service, locked out, account locked, reset link, password expired
