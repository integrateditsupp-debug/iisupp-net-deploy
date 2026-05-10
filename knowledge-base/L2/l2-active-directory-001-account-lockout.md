---
id: l2-active-directory-001
title: "Active Directory: account lockout / repeating lockouts after password change"
category: active-directory
support_level: L2
severity: high
estimated_time_minutes: 30
audience: admin
os_scope: ["Windows Server 2016+"]
prerequisites: ["AD Account Operators or higher", "Event Log access on DCs"]
keywords:
  - account lockout
  - locked out
  - bad password attempts
  - repeating lockout
  - cached credential
  - service account locked
  - 4740 event
related_articles:
  - l1-password-001
  - l2-azure-ad-001
escalation_trigger: "Lockout source unidentifiable, or service account, or pattern across many accounts (possible attack)"
last_updated: 2026-05-07
version: 1.0
---

# AD account lockout — finding the source

## 1. Symptoms
- User reports being locked out repeatedly even after admin unlock.
- Account locks within minutes of unlock.
- Service account locks daily.
- Multiple users locking simultaneously (broadcast credential issue).

## 2. Likely Causes
1. Cached old password on a phone (Outlook ActiveSync), tablet, or laptop after password change.
2. Mapped network drive using saved old credential.
3. Saved Wi-Fi profile with domain creds.
4. Scheduled task running as user with old password.
5. Service account with hardcoded password in script/server.
6. Brute-force attack against the account.

## 3. Questions To Ask
- Recent password change — yes/no, when?
- All devices the user signs in on (laptop, phone, tablet, desktop, kiosk)?
- Mapped drives, scheduled tasks, ActiveSync devices?
- Frequency of lockout?

## 4. Troubleshooting Steps
1. On PDC emulator (holds master lockout state) → Event Viewer → Security → filter for Event ID 4740 ("A user account was locked out").
2. Note "Caller Computer Name" — that's the source machine sending bad creds.
3. Microsoft Account Lockout & Management Tools (LockoutStatus.exe) gives a UI for this.
4. On caller machine, open Event Viewer → Security → 4625 events for that user — narrows process / source workstation.
5. Check Credential Manager (`cmdkey /list`) on caller for stale entries.

## 5. Resolution Steps
**Cached creds on phone (Outlook / ActiveSync):**
- Have user remove + re-add the work profile / mail account on phone with new password.
- For Intune-enrolled phones, force update profile.

**Mapped drive with saved cred:**
- On caller machine: `cmdkey /delete:server.domain.local`.
- Reconnect drive with current creds (or via GPO).

**Scheduled task with old password:**
- Task Scheduler → identify tasks running as user → Actions → update creds.

**Wi-Fi enterprise SSID:**
- Forget + reconnect with current creds.

**Service account:**
- Find every place the password is used (DSC, SCCM, scripts, services).
- Change all in coordination, then reset AD password.
- Best practice: convert to Group Managed Service Account (gMSA) — auto-rotated.

**Brute force:**
- Check 4625 source IPs and counts. If external, escalate to L3/Security.
- Consider implementing Smart Lockout in Azure AD / Microsoft Defender for Identity.

## 6. Verification Steps
- 24 hours with no Event 4740 for the user.
- LockoutStatus.exe shows account "Not Locked Out" across all DCs.
- User signs in normally everywhere.

## 7. Escalation Trigger
- Source machine cannot be identified after 4740 review.
- Service account that's hardcoded in many places.
- Pattern of lockouts across many accounts (attack).
- → Escalate to **L3 / Security**.

## 8. Prevention Tips
- Use gMSA for all service accounts.
- Don't reuse passwords across accounts.
- Set sane lockout policy (5–10 attempts, 15 min reset is common).
- Monitor for 4740 spikes — alert if >5/hour.
- Implement password rotation hygiene with documented update procedures.

## 9. User-Friendly Explanation
"Some device of yours is still trying to log in with your old password. We need to find which one — usually a phone, mapped drive, or saved Wi-Fi — and update it. Once we do, the lockouts stop."

## 10. Internal Technician Notes
- Lockout policy is set in default domain policy GPO (`Computer Config → Policies → Windows Settings → Security Settings → Account Policies → Account Lockout Policy`).
- PDC role: `netdom query fsmo`.
- LockoutStatus.exe (free Microsoft tool) — checks all DCs at once.
- ALTools / `Get-LockoutEvents` PowerShell — pulls 4740 across DCs.
- For RODC-served sites, lockouts replicate from RODC to writable DC; source field still populated.
- Microsoft Defender for Identity flags lockout patterns and suspicious lateral attempts.

## 11. Related KB Articles
- l1-password-001 — User password reset
- l2-azure-ad-001 — Cloud sign-in lockouts

## 12. Keywords / Search Tags
account lockout, locked out, bad password attempts, repeating lockout, cached credential, service account, 4740 event
