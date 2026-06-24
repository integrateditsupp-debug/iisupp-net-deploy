---
id: l1-security-001
title: "Lost or stolen work laptop or phone — report and secure it now"
category: security
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 11","Windows 10","macOS","iOS","Android"]
prerequisites: []
keywords: ["lost my work laptop","laptop stolen","my laptop might be stolen","lost laptop","stolen device","lost my phone","remote wipe","report lost device","missing work device","find my device","remote lock","misplaced laptop","work phone lost","stolen laptop report"]
related_articles: ["l1-mfa-001","l1-password-001","l1-m365-001"]
escalation_trigger: "Any confirmed or suspected loss/theft of a work device is reported to IT/security immediately so sessions can be revoked and the device locked or wiped."
last_updated: 2026-06-24
version: 1.0
---

# Lost or stolen work laptop or phone — report and secure it now

## 1. Symptoms
- You cannot find your work laptop, phone, or tablet and believe it is lost or stolen.
- A device was left in a taxi, hotel, airport, café, or vehicle and not recovered.
- A bag containing a work device was stolen.
- You suspect someone may have taken or accessed your device without permission.
- A device is missing and may still be powered on and signed in to email or apps.

## 2. Likely Causes
1. Device physically lost in transit or in a public place.
2. Device stolen (theft, break-in, pickpocket).
3. Device misplaced at home or office (may be recoverable).
4. Device handed to the wrong person or left unattended.

## 3. Questions To Ask User
1. Which device is it — laptop, phone, or tablet? Make/model if known?
2. When and where did you last have it? How long ago?
3. Was it powered on and signed in (email, Teams, VPN, password manager)?
4. Is it lost (possibly recoverable) or do you believe it was stolen?
5. Does it have a SIM/cellular, and is "Find My" / device tracking enabled?
6. Were any other items taken (badge, second device, paper notes)?

## 4. Troubleshooting Steps
1. **Report it immediately.** Time matters most — contact IT/security right away rather than searching for an hour first. Early reporting lets IT revoke access before data can be reached.
2. **Do not delay to "look around first."** You can keep looking after reporting; reporting is reversible if the device turns up.
3. **Change your password now** from another trusted device (phone or another computer) — this alone can cut off most access.
4. **Approve no unexpected MFA prompts.** If a sign-in approval request appears that you did not start, deny it and tell IT — it may be the thief trying to get in.
5. **Locate the device** if you safely can: use Find My (Apple), Find My Device (Android/Google), or Microsoft account "Find my device" for Windows. Note its last location for IT and, if stolen, for police — but never confront a thief in person.

## 5. Resolution Steps
**What you should do:**
1. Report the loss to IT/security through the normal channel as your first action.
2. From a trusted device, change your account password and sign out of all sessions where the option exists (for example, in your account security page).
3. If the device had cellular service and is a phone, consider asking your carrier to suspend the SIM (IT can advise).
4. If theft is involved, file a police report and keep the report number — IT and insurance may need it.

**What IT does (so you know what to expect):**
1. **Revoke active sessions and tokens** so existing sign-ins on the device stop working.
2. **Remote lock or remote wipe** the device through MDM (for example, Microsoft Intune) or Find My — this can lock the screen and erase company data remotely once the device is online.
3. **Reset or require re-registration of MFA** if the device was an authenticator.
4. **Disable or reset the account** temporarily if needed, then re-enable once you are secured.
5. **Confirm disk encryption** (BitLocker on Windows, FileVault on macOS) so that even if the disk is removed, the data stays unreadable.

## 6. Verification Steps
- IT confirms the device is reported and a lock/wipe command has been queued or completed.
- Your password is changed and old sessions are signed out.
- You can sign in normally on a replacement or trusted device with your new password and MFA.
- No unexpected MFA prompts continue to arrive.
- If wiped, the device shows as wiped/retired in the management console (IT confirms).

## 7. Escalation Trigger
- Any confirmed or suspected loss or theft — this is always reported to IT/security immediately.
- The device held highly sensitive data, was signed in to admin tools, or had a password manager open.
- Suspicious sign-in attempts or MFA prompts continue after the password change.
- → Escalate to **L2 / Security** with: device type and owner, last-known location and time, whether it was signed in, and any police report number.

## 8. Prevention Tips
- Keep disk encryption on (BitLocker / FileVault) — IT usually enforces this, but confirm it is enabled.
- Use a strong screen lock and short auto-lock timeout on every work device.
- Enable Find My / device location tracking before you ever need it.
- Don't leave devices visible in cars or unattended in public.
- Save your BitLocker/recovery key to your Microsoft or work account ahead of time.
- Keep work data in OneDrive/SharePoint, not only on the local disk, so a wipe doesn't lose your files.

## 9. User-Friendly Explanation
"The single most important thing is to tell us right away — even before you finish looking for it. The moment we know, we can lock the device, sign it out of everything, and erase the company data on it remotely. Your laptop and phone are also encrypted, which means that even if someone takes the drive out, they can't read your files. So a lost device is usually a lost piece of hardware, not a lost data event — as long as we hear about it quickly. After we secure your account, we'll get you back to work on another device."

## 10. Internal Technician Notes
- Speed is the control: revoke sessions/tokens first (Entra: Users → user → Revoke sessions), then queue MDM lock/wipe.
- Intune: Devices → select device → Lock / Wipe / Retire. Wipe = full reset; Retire = remove company data only (use for personal/BYOD).
- Find My (Apple Business Manager / iCloud) and Find My Device (Android Enterprise) can locate, lock, and erase managed mobiles.
- Reset MFA methods if the device was an authenticator (aka.ms/mfasetup / Entra → Authentication methods).
- Confirm encryption status before assuming data-at-rest is safe: BitLocker `manage-bde -status`; macOS `fdesetup status`.
- Log the incident per the security/incident process; capture last-known location, sign-in state, and any police report number for insurance.
- For BYOD, prefer selective/Retire wipe to avoid erasing personal data; document the choice.

## 11. Related KB Articles
- l1-mfa-001 — MFA setup, lost device, and recovery
- l1-password-001 — Password reset and self-service unlock
- l1-m365-001 — Can't sign in to Microsoft 365

## 12. Keywords / Search Tags
lost my work laptop, laptop stolen, my laptop might be stolen, lost laptop, stolen device, lost my phone, remote wipe, report lost device, missing work device, find my device, remote lock, work phone lost
