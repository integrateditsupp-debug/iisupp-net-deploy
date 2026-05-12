---
id: l1-security-001
title: "Lost or stolen company device — immediate response protocol"
category: security
support_level: L1
severity: critical
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - lost laptop
  - stolen laptop
  - lost phone
  - stolen phone
  - find my device
  - remote wipe
  - kill switch
  - mobile device management
  - mdm
  - intune wipe
  - jamf wipe
  - report theft
  - police report
related_articles:
  - l1-email-001-suspicious-phishing
  - l1-password-001-reset-and-sspr
  - l3-security-001
escalation_trigger: "ANY lost or stolen device handling work data is automatically a security incident. Notify IT/Security IMMEDIATELY. Do not wait."
last_updated: 2026-05-12
version: 1.0
---

# Lost or stolen company device — immediate response protocol

## 1. This is an emergency
Treat every lost/stolen device as potentially compromised data. Speed matters. Hours, not days. **Call IT immediately at (647) 581-3182 — do not wait until tomorrow.**

## 2. The 10-Minute Protocol (Do These Right Now)

### Step 1 — Report it to IT (FIRST — even before retracing your steps)
- Call IT: **(647) 581-3182**.
- If after hours: text the after-hours emergency line OR email `security@iisupp.net` with subject **URGENT LOST DEVICE**.
- Tell them:
  - Your full name + email.
  - What device (laptop model / phone model).
  - When and where last seen.
  - Was it powered ON when lost? (Matters for encryption status.)
  - Was it locked when lost?
  - Do you remember if you were signed into email / Slack / Teams / VPN at the time?

### Step 2 — Remote lock / wipe (IT does this — but you can start)

**For your phone (you can self-trigger):**

**iPhone / iPad:**
1. From any device → `https://icloud.com/find` → sign in with your Apple ID.
2. Click your phone → click **Mark As Lost**.
3. Set a passcode + custom message ("Reward if returned, call XYZ").
4. If recovery seems unlikely: click **Erase iPhone**.

**Android (Google account):**
1. From any device → `https://android.com/find` → sign in.
2. Click your phone → **Secure device** (locks remotely) OR **Erase device**.

**Samsung Find My Mobile** (extra option if you have a Samsung):
- `https://findmymobile.samsung.com` → sign in → similar options.

**For your laptop (IT does this):**
- IT will trigger an Intune / Jamf / MDM wipe.
- Disable account: IT disables your account in Entra ID / Active Directory — instantly blocks email / VPN / Microsoft 365 access regardless of laptop state.
- Revoke active sessions: IT runs a "Revoke all sessions" command — kills any open Outlook / Teams / Slack on the lost device.

### Step 3 — Change critical passwords from a DIFFERENT trusted device

From a friend's phone, a coworker's computer, your home computer — NOT the lost device — change:
1. **Your primary work email password** (Microsoft 365 / Google Workspace).
2. **Your password manager master password** (1Password / Bitwarden / LastPass).
3. **VPN credentials** if separate.
4. **Any banking / payment passwords** if you signed in on the lost device.
5. **Personal email** (often a recovery path to corporate).

### Step 4 — Revoke MFA tokens / device trust
1. Go to your account portal (Microsoft: `https://aka.ms/mysecurityinfo` / Google: `https://myaccount.google.com/security`).
2. Look for **Devices** or **Where you're signed in**.
3. Sign out / revoke trust for the missing device.
4. Remove MFA methods that were on the missing device (set up new ones first).

### Step 5 — File the appropriate report
- **Stolen:** police report. Get a case / report number. Insurance + corporate require it.
- **Lost in transit:** file with the venue (hotel, airline, ride-share, restaurant).
- **Document the loss** internally: write a short timeline (when, where, who you told).

## 3. What IT will do on their end (you don't have to do this)
- Disable your Entra ID / AD account → blocks all logins.
- Initiate Intune / Jamf wipe on the device.
- Revoke OAuth tokens (Microsoft, Google, Slack, Teams).
- Check audit logs for any post-loss activity from the device or your account.
- Decide whether incident escalates to Security team + management.
- File insurance / asset-loss paperwork.

## 4. While waiting for IT to finish
- Don't keep trying to find the device by signing into apps to look at its location — that creates more audit entries.
- Don't post about it on social media (signals to thieves to wipe / extract faster).
- Don't tell vendors / customers the device is lost via the lost device's email — use another channel.
- Note any suspicious activity in your accounts (login alerts, password reset emails, MFA prompts you didn't initiate) — share with IT.

## 5. If you find the device later
- DO NOT plug it into your work network until IT inspects it.
- DO NOT log in to anything from it.
- Bring it to IT. They will:
  - Check for tampering signs.
  - Confirm wipe state.
  - Re-image and re-enroll OR retire the device.

## 6. Verification (after IT response)
- Try to sign into your work account from the missing device's expected sign-in URL (using a different device) → you get prompted for full re-authentication (account disable then re-enable confirms IT's action).
- All previously-signed-in sessions are gone.
- Lost device shows as "Wiped" or "Compromised" in IT's MDM console (IT confirms).

## 7. Prevention (so this hurts less next time)
- **Disk encryption (BitLocker / FileVault)** enabled on every device. Without encryption, a thief can pull the drive and read everything regardless of password.
- **Auto-lock screen** at 5-10 minutes idle.
- **Strong device PIN/password.** Not 1234. Not the year. Six characters minimum, longer for laptops.
- **Find My iPhone / Find My Android** always on. Don't disable for "battery savings."
- **Don't store payment cards in browser** on portable devices unless absolutely needed.
- **Password manager with MFA** so no plaintext passwords live on any device.
- **Insurance:** corporate cyber insurance + asset insurance. Personal AppleCare+ / Samsung Care+ for phones.

## 8. User-Friendly Explanation
Call IT immediately, even if it's after hours — they need to disable your account and wipe the device before someone else can use it. While you wait, go to icloud.com/find (iPhone) or android.com/find (Android) and mark the device as lost or erase it. Then from a different computer or phone, change your work email password, your password manager password, and any banking passwords you used on the lost device. File a police report if stolen. Don't try to find the device yourself by logging in — let IT handle the audit log review.

## 9. Internal Technician Notes
- Intune wipe command: `Invoke-MgGraphRequest -Method POST -Uri "/v1.0/deviceManagement/managedDevices/{id}/wipe"` OR Intune portal → Devices → Wipe.
- Jamf wipe: Jamf Pro console → Computers → action → Erase.
- Entra ID account disable: `Update-MgUser -UserId user@company.com -AccountEnabled:$false`. (Note: this kills email immediately. Confirm before pulling trigger if disputes possible.)
- Revoke sessions: Microsoft Graph `revokeSignInSessions` on user object → kills all tokens.
- Conditional access risk score: Entra ID will mark the user as "Risk: high" automatically after sign-in from unfamiliar device — confirms our suspicion.
- Logs to check: Entra ID Sign-in logs (last 30 days), Intune device check-in time, Microsoft Defender for Cloud Apps alerts, Exchange Online unified audit log.
- If device may be at risk of exfiltration: Entra ID → Conditional access → block sign-in from outside specific IPs immediately while investigation runs.
- Consider: was disk encrypted? BitLocker recovery key in tenant? FileVault recovery key escrowed?
- If suspected nation-state / targeted theft: escalate to Anthropic / CISA / law enforcement per playbook.

## 10. Related KB Articles
- `l1-email-001` — Suspicious / phishing email
- `l1-password-001` — Password reset
- `l3-security-001` — Security incident response

## 11. Keywords / Search Tags
lost laptop, stolen laptop, lost phone, stolen phone, find my device, remote wipe, kill switch, mobile device management, mdm, intune wipe, jamf wipe, report theft, police report, icloud find, find my iphone, find my android, samsung find my mobile, security incident
