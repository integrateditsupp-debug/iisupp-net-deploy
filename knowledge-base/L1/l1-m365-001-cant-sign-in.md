---
id: l1-m365-001
title: "Can't sign in to Microsoft 365 / repeated password prompts"
category: m365
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
prerequisites: []
keywords:
  - microsoft 365
  - m365
  - office 365
  - can't sign in
  - password prompt
  - login loop
  - aadsts
  - account locked
  - we couldn't connect
related_articles:
  - l1-mfa-001
  - l1-password-001
  - l2-azure-ad-001
escalation_trigger: "AADSTS50053 (account locked), AADSTS50126, or pattern across multiple users on same tenant"
last_updated: 2026-05-07
version: 1.0
---

# Can't sign in to Microsoft 365 / repeated password prompts

## 1. Symptoms
- Office apps prompt for password repeatedly even after entering correct credentials.
- "We couldn't connect, please check your network" with green check on network.
- "Need password" badge on Outlook.
- AADSTSxxxxx error code on the sign-in screen.
- Sign-in loops back to start after typing password.

## 2. Likely Causes
1. Cached stale credentials.
2. MFA challenge missed or denied.
3. Password recently changed elsewhere; not yet propagated locally.
4. Conditional Access policy blocking device or location.
5. Account locked from too many failed attempts.
6. Time/clock skew on device (>5 min off).
7. Tenant-wide identity outage (rare).

## 3. Questions To Ask User
1. What error code or message appears (full text)?
2. Have you used MFA today — accepted the prompt on phone or text?
3. Did you change your password recently (today, this week)?
4. Are you on a corporate network, home, or public Wi-Fi / hotel?
5. Is your phone clock and PC clock both correct?
6. Can you sign in to https://office.com from a private/incognito browser window?

## 4. Troubleshooting Steps
1. Clear cached credentials:
   - Control Panel → User Accounts → Credential Manager → Windows Credentials.
   - Remove every entry beginning with `MicrosoftOffice16_Data:`, `MicrosoftAccount:`, `OneDrive Cached Credential`.
2. Restart all Office apps (close, verify in Task Manager, reopen).
3. Verify time: Settings → Time & language → Date & time → Sync now.
4. Test sign-in via incognito browser → office.com.
5. Confirm MFA: open Authenticator app, accept any pending request.

## 5. Resolution Steps
**If password recently changed:**
- Sign in fresh on each Office app; for Outlook, also: File → Account Settings → Email → Change → re-enter.

**If MFA prompt is missed:**
- Open Microsoft Authenticator app on phone — manually scroll for any pending request, approve.
- Or use https://aka.ms/mfasetup to verify methods are current.

**If account locked (AADSTS50053):**
- Wait 30 minutes for soft unlock OR request L2 to unlock via Azure AD admin.

**If Conditional Access block (AADSTS53003):**
- Compliant device required — verify Intune / Endpoint enrollment status.
- Or switch to a compliant network if location-based.

**If clock skew:**
- Reset time via Settings; also check BIOS clock if persistent (laptop battery often dead).

## 6. Verification Steps
- Sign-in completes without prompts after 1 attempt.
- Office.com loads tenant home page within 5 seconds.
- Outlook status bar reads "Connected".
- Teams shows green presence.
- 24h with no recurring prompt.

## 7. Escalation Trigger
- AADSTS error codes: 50053, 50126, 53003, 65001, 700016, 90072.
- Multiple users in same tenant cannot sign in.
- After credential clear + retry, prompts persist.
- Conditional Access blocking and user device should be compliant.
- → Escalate to **L2** with: error code, sign-in log timestamp, UPN, device name, network type.

## 8. Prevention Tips
- Don't share Microsoft accounts across users.
- Keep one MFA method primary + one backup (text/phone call/app).
- Don't ignore password expiry warnings — change at scheduled time, not at last minute.
- Keep PC clock auto-synced.
- Save the BitLocker / recovery key to your Microsoft account preemptively.

## 9. User-Friendly Explanation
"Your computer has saved an old version of your password and is fighting with the new one. We'll clear the saved one, restart Office, and sign you in fresh. If your phone hasn't approved the security prompt yet, that'll be the next thing we check. Should take just a few minutes."

## 10. Internal Technician Notes
- Sign-in logs (admin): Entra portal → Users → user → Sign-in logs. Filter to last 1h, examine Status, Conditional Access result, MFA result.
- Common AADSTS:
  - 50053 = locked from too many failures (≥10 typically) — auto-unlock at 30 min, or admin reset via Entra.
  - 50126 = invalid credentials.
  - 53003 = Conditional Access blocked.
  - 700016 = wrong app/tenant.
  - 65001 = consent required (admin grant).
- Credential Manager nuke (PowerShell): `cmdkey /list` then `cmdkey /delete:<TargetName>`.
- For Office, also check `dsregcmd /status` — confirms Azure AD join state and SSO state.
- For Mac users, clear keychain entries: Keychain Access → search "office" / "microsoft" → delete.

## 11. Related KB Articles
- l1-mfa-001 — MFA setup, lost device, and recovery
- l1-password-001 — Password reset and self-service unlock
- l2-azure-ad-001 — Conditional Access policy diagnosis

## 12. Keywords / Search Tags
microsoft 365, m365, office 365, can't sign in, password prompt, login loop, aadsts, account locked, mfa loop
