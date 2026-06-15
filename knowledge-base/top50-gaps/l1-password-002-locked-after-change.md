---
id: l1-password-002
title: "Account locked after password change — sync your new password to every device and app"
category: authentication
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You know your new password"]
keywords:
  - locked out after password change
  - just changed my password
  - keep getting locked out
  - account keeps locking
  - phone keeps asking for old password
  - outlook locked after password change
  - sync new password
  - password not accepted
  - aad_smartcard_credential_provider
tags:
  - authentication
  - password
  - lockout
  - top-50
related: [l1-password-001-reset-and-sspr, l1-mfa-002-lost-authenticator-phone, l2-active-directory-001-account-lockout]
---

# Locked out after password change — find the device that's still trying the old password

## When this applies

You changed your work password (forced rotation, you forgot the old one, IT reset it) and now:
- You get locked out every few minutes
- Outlook keeps asking for the password
- Your phone keeps showing "wrong password" for work email
- Teams or VPN keeps disconnecting

99% of the time, this is one device or app still trying your **old** password in the background. Each failed attempt counts against you. After 5-10 failures, AD/Entra locks the account.

## Step 1 — Identify which device is the culprit

Common offenders (in order of frequency):
1. **Phone — work email account.** Outlook mobile, Apple Mail, Gmail/Outlook on Android.
2. **Phone — Wi-Fi password** (if your corporate Wi-Fi uses your account creds).
3. **Other laptop / second device** you forgot you signed into.
4. **Saved password in browser** for SharePoint / Teams / your time-tracking app.
5. **Old VPN client** still running with cached creds.
6. **Outlook desktop on Windows** with cached Exchange profile.
7. **OneDrive / Google Drive sync client** on any device.
8. **Smartphone Authenticator app** isn't the issue (it doesn't use your password).

### Ask IT to send you a lockout source report
Active Directory and Entra ID can show **which device IP** generated the failed sign-in. Open a ticket: "I'm locked out repeatedly after password change. Please pull the lockout source for [your username] in the last 24 hours."

This narrows it to one device fast.

## Step 2 — Update password everywhere — checklist

Work through this list. Skip what doesn't apply.

### On your phone
- [ ] **Outlook mobile:** open Outlook → tap account icon → Settings → tap your account → **Reset Account** OR sign out and sign back in with new password.
- [ ] **Apple Mail (iOS):** Settings → Mail → Accounts → tap work account → Account → re-enter password.
- [ ] **Gmail app (Android, with Exchange account):** Settings → tap account → Account → re-enter password.
- [ ] **Corporate Wi-Fi:** Forget the Wi-Fi network → rejoin → enter new password.
- [ ] **VPN apps:** open Ivanti / GlobalProtect / Cisco AnyConnect / Pulse / SonicWall → disconnect → reconnect → enter new password.
- [ ] **Microsoft Authenticator:** doesn't store passwords directly, but if it shows a stale "approve sign-in" prompt for an old session, deny and re-enroll if needed.
- [ ] **MDM-enrolled phone:** Settings → may have a "Company portal" or "Intune" app that needs you to re-enter creds.

### On your laptop
- [ ] **Lock and unlock Windows** with new password (if you changed it on the web/portal but haven't typed it on the laptop yet). On AD-joined: Ctrl-Alt-Del → Change Password (if available) OR lock + unlock to refresh.
- [ ] **Outlook desktop:** restart Outlook. It'll prompt for new password. If it doesn't and keeps failing → File → Account Settings → repair.
- [ ] **OneDrive sync client:** right-click cloud icon → Settings → Account → "Unlink this PC" → set up again with new password (you won't lose files — they're still in the cloud).
- [ ] **Teams desktop:** sign out, sign back in.
- [ ] **Browsers:** Chrome / Edge / Safari — clear saved credentials for your work domains. Settings → Passwords → search for company email → delete entry → next time you log in, save the new one.
- [ ] **Credential Manager (Windows):** Control Panel → User Accounts → Credential Manager → Windows Credentials. Look for entries pointing to your work tenant. Remove any stale entries.

### On other devices
- [ ] **Old laptop, tablet, second computer** you forgot about
- [ ] **Home computer** with a saved work email account
- [ ] **Smart watch** linked to your phone (it inherits the phone's accounts)
- [ ] **Conference room PCs / shared workstations** where you signed in

## Step 3 — Unlock your account

If you're currently locked out:
- **Entra ID / Office 365:** wait 5-30 minutes (auto-unlock) OR go to `aka.ms/sspr` if SSPR is enabled.
- **AD on-prem:** call IT to unlock. Don't keep trying the new password — that resets the lockout timer.

While the unlock is in flight, **kill the device that was failing**. Otherwise it'll lock you out again within minutes.

## Step 4 — Verify by waiting

After updating everywhere:
1. Sign in normally on your laptop.
2. **Wait 15 minutes** without doing anything special.
3. Try to sign in again. Still works? Good — you found and fixed the source.
4. If you get locked out again → there's still a device using old creds. Get the lockout-source report from IT.

## Common edge cases

### "I keep getting locked out at 3 AM"
Likely a server, scheduled task, or service account using your creds. Common cause: a script you set up months ago, a printer scan-to-email, or a phone email check on auto-fetch overnight. Run through the checklist above; check any "scheduled task" or "service" that might use your account.

### "My phone wants my password but I just typed it"
Sometimes the OS keychain on iOS/Android keeps re-trying with a cached version even after you re-enter. Restart the phone. Then re-enter. If it still keeps prompting, delete the email account entirely and re-add it.

### "VPN works for 30 seconds then disconnects"
Your VPN client may have two saved credential sets. Settings → Saved connections → delete all, recreate with new password.

### "Outlook desktop won't accept the new password"
Sign out of Windows entirely (not just lock — full sign-out), sign back in. This refreshes the kerberos ticket / Entra token Outlook is using.

## When to escalate

| Situation | Path |
|---|---|
| You've updated everything, still locked every few minutes | L1 — needs lockout source report from AD/Entra |
| Phone won't sign in with new password no matter what | L2 — possible Intune compliance or conditional access block |
| Multiple team members locked after a tenant-wide rotation | L2 — likely a service account or policy script that needs updating |
| Account locked AND MFA is also failing | L1 + see l1-mfa-002 (recovery) |

## Prevention

- When you change your password, **immediately** sign out and back into Outlook + your phone email + Teams + any VPN.
- Use a password manager (1Password / Bitwarden / Dashlane). Update one entry, and your devices that use the manager pick up the new password.
- Don't share your password to "make IT easier." If a teammate or service needs access, IT can use delegated permissions or a service account.
- For PCs left on overnight: don't enable "save password" on third-party apps unless you know they'll handle rotation gracefully.

## What ARIA can help with

ARIA can walk you through the checklist live for your specific device mix, generate the lockout-source ticket text for IT, and identify which device class is most likely the offender based on your description. ARIA cannot reset the password itself — that's you or your admin.
