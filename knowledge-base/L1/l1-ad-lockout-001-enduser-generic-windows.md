---
id: l1-ad-lockout-001
title: "Account locked after too many failed password attempts — Windows / Active Directory / Entra"
category: identity
support_level: L1
severity: high
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: current
year_range: "Current"
eol_status: "Current. Applies to domain-joined Windows PCs and Microsoft 365 / Entra ID accounts."
prerequisites: []
intent: identity/unlock
vertical: generic
keywords:
  - account locked
  - account locked out
  - locked out of windows
  - locked out of computer
  - too many failed password attempts
  - account locked after password attempts
  - account lockout
  - my account is locked
  - unlock my account
  - active directory locked
  - entra locked
  - azure ad locked
  - windows account locked
  - domain account locked
  - your account has been locked
  - account temporarily locked
  - too many sign in attempts
  - failed login attempts
  - locked out of work account
  - it locked my account
  - locked windows account unlock
  - user account locked out
  - AD lockout
  - account lock windows
  - how to unlock account windows
  - account locked due to incorrect password
  - account locked too many attempts
related_articles:
  - l1-password-001
  - l1-m365-001
  - l2-active-directory-001
escalation_trigger: "Account re-locks within minutes after IT unlocks it (old password saved on a device — needs source tracking by admin), or this is a privileged / admin account, or multiple accounts locking at once (possible attack)."
last_updated: 2026-06-28
version: 1.0
---

# Account locked after too many failed password attempts — Windows / AD / Entra

> **This is a GENERIC Windows / IT account lockout article.**
> It covers standard Windows domain (Active Directory) and Microsoft 365 / Entra ID accounts — NOT patient portals, health apps (MyChart, Epic), or banking portals.
> For MyChart / patient-portal lockouts, those are handled by the healthcare provider's own IT or support line, not this team.

## 1. Symptoms
- You try to sign in to your Windows computer or work account and see:
  - *"Your account has been locked. Please contact your administrator."*
  - *"The referenced account is currently locked out."*
  - *"Your account has been locked due to too many failed sign-in attempts."*
  - *"Too many sign-in attempts. Try again later."*
- You can't log in to your work PC, Microsoft 365, Outlook, Teams, or the VPN.
- The lockout happened after several wrong password tries (by you or a device that had the old password saved).

## 2. Why Accounts Lock
Your organisation's IT policy locks an account after a set number of wrong password attempts (typically 5–10 in a row). This protects against guessing/brute-force attacks.

Common triggers:
1. **You forgot your new password** — typed the old one several times.
2. **A device still has your old password saved** — phone, tablet, or a mapped drive kept trying to connect with the outdated password after you changed it.
3. **Old Outlook profile on another PC** — still trying to authenticate with the old credential.
4. **Typed password into wrong field** — e.g. username field instead of password, causing repeated bad auth.
5. **Autocomplete saved the old password** — browser or Windows Credential Manager auto-submitting wrong credentials.

## 3. What End-Users Can Try First

### Option A — Self-Service Password Reset (if your organisation has SSPR)
1. On your locked device, look for a **"Reset password"** or **"I forgot my PIN"** link on the Windows sign-in screen.
2. Or from another device: go to **https://aka.ms/sspr** (Microsoft 365 SSPR portal).
3. Enter your work email, verify identity via phone/email/authenticator → reset your password → your account unlocks automatically.

### Option B — Contact IT Help Desk
If SSPR is not available, or you can't get to the portal:
1. Call or email the IT Help Desk.
2. You'll need to **verify your identity** (employee ID, manager's name, a pre-registered security question, or a callback to your work phone).
3. IT unlocks the account and (optionally) forces a password reset.
4. You sign in with the new password.

## 4. After Your Account Is Unlocked — Update Every Device

**If your account keeps re-locking within minutes**, an old/wrong password is still being sent somewhere automatically. Work through this checklist with IT:

- **Phone/tablet** — remove and re-add your work email account (Outlook mobile, Exchange ActiveSync) with the new password.
- **Other Windows PCs / laptops** — sign in and let Windows update the cached credential, OR clear Windows Credential Manager entries for your account.
- **VPN client** — disconnect and reconnect; update saved credentials.
- **Mapped network drives** — disconnect and re-map with new credentials.
- **Saved passwords in browser** — update or delete the old entry for your work sign-in page.
- **Scheduled tasks** (if you have any running as your account) — update the password there too.

## 5. Verification Steps
- Sign in to Windows or your work PC successfully.
- Outlook/Teams/OneDrive connects without a credential prompt.
- Sign in to the Microsoft 365 web portal at https://office.com to confirm account is active.
- No new lockout occurs within 30 minutes.

## 6. When to Escalate (hand to IT/L2)
- **Account re-locks within minutes** — IT needs to find which device/service is sending bad credentials (this requires checking Domain Controller Event ID 4740 logs — end-users can't do this).
- **You can't access SSPR** and have no way to reach IT (emergency: ask a colleague to raise a ticket on your behalf).
- **Privileged or admin account** — any lockout of an account with elevated rights must go to IT immediately; do not attempt self-service on admin accounts.
- **Multiple accounts locking at once** — possible security incident; escalate urgently to IT Security.
- **You never mistyped your password** and the lockout is unexpected — possible unauthorized access attempt; report to IT Security.

## 7. Prevention Tips
- After every password change, immediately update it on ALL devices: phone, tablets, home laptop, VPN, mapped drives.
- Don't click "Remember password" on public or shared computers for work accounts.
- Enable **Self-Service Password Reset** (SSPR) before you need it — ask IT to activate it for you.
- If your password expired and you changed it on one device, do a quick round of all your other devices the same day.

## 8. User-Friendly Explanation
"Your account is like a door with a lock. After enough wrong keys in a row, it stays shut to protect against someone guessing the combination. IT can re-open it — they just need to verify it's really you before they do. Once it's open, make sure every device that uses your work account (phone, tablet, home laptop) has the right password so it doesn't accidentally lock you out again."

## 9. Internal Technician Notes
- To unlock a domain account: `Unlock-ADAccount -Identity <username>` (PowerShell) or ADUC → right-click account → Unlock Account. For Entra ID: Azure AD portal → Users → find user → Authentication methods → Revoke sessions, then ensure account is not Blocked sign-in.
- To find the lockout source: on the PDC Emulator, filter Security Event Log for Event ID 4740 — "Caller Computer Name" is the source sending bad credentials.
- L2 article with full admin lockout-source hunt: `l2-active-directory-001`.
- For Entra ID-only (cloud-only accounts), Smart Lockout applies — threshold is 10 by default, lockout duration starts at 60 seconds and backs off. Azure AD sign-in logs show the failure reason.
- If SSPR is configured, end-users can unblock themselves at https://aka.ms/sspr — no IT involvement needed. Worth enabling for all org users.

## 10. Related KB Articles
- `l1-password-001` — Password reset / forgotten password (self-service reset)
- `l1-m365-001` — Can't sign in to Microsoft 365 (broader M365 sign-in issues)
- `l2-active-directory-001` — AD account lockout — finding the source (admin/L2 article)

## 11. Keywords / Search Tags
account locked out, windows account locked, domain account locked, entra account locked, active directory locked, too many failed password attempts, locked out after too many attempts, unlock windows account, IT account lockout, account locked your administrator, account locked too many sign in, locked work account windows
