---
id: diagnostics/account-lockout-windows-ad-entra
intent: identity/unlock
vertical: generic
---

# Windows / Active Directory / Entra Account Locked Out — Too Many Failed Password Attempts

## Symptom: Windows or work account locked after too many failed sign-in attempts.
> User phrasings: "account locked out", "account locked after too many failed password attempts", "locked out of windows", "locked out of work account", "too many sign in attempts", "my account is locked", "active directory account locked", "entra account locked", "azure ad locked", "domain account locked", "how to unlock account windows", "account locked administrator", "account locked windows login", "unlock AD account"

> **VERTICAL GUARD — This article is for standard Windows domain (Active Directory) and Microsoft 365 / Entra ID work accounts.**
> It does NOT cover MyChart, Epic, patient portals, banking portals, or healthcare system logins.
> For patient-portal or MyChart lockouts, contact the healthcare provider's own support line directly.

### Cause: Too many wrong password attempts (lockout policy triggered)
**Probability:** 60%
**Detection:** Error message: "Your account has been locked. Please contact your administrator." or "Too many sign-in attempts." Check system-context.json `identity.lockoutState` flag.
**Safe diagnostic:** Confirm the lockout message and whether SSPR (Self-Service Password Reset) is available (read-only).
**Safe fix:** Two paths:
- **Self-service:** If SSPR is configured → go to https://aka.ms/sspr from another device → verify identity → reset password (account unlocks automatically).
- **Help Desk:** Call IT Help Desk → verify identity → IT unlocks the account via `Unlock-ADAccount` (PowerShell) or Azure AD portal → sign in with new/existing password.
**Escalation:** If the account re-locks within minutes after IT unlocks it, an old password is still saved on a device and sending bad credentials. Escalate to IT to find the source (DC Event ID 4740 — "Caller Computer Name").

### Cause: Old password saved on another device (repeat lockouts)
**Probability:** 25%
**Detection:** Account unlocks but re-locks quickly; user recently changed their password; IT confirms repeated bad-auth attempts from a specific device or service.
**Safe diagnostic:** Identify devices still logged in with the work account: phone, tablet, home laptop, VPN, mapped drives (read-only inventory).
**Safe fix:** With user confirmation, update the saved password on each device: phone/tablet (remove and re-add work email), Outlook mobile (update account), VPN client (reconnect with new password), Windows Credential Manager (remove old entries), mapped network drives (disconnect and re-map).
**Escalation:** If the source can't be found, IT must check Domain Controller Event ID 4740 to identify the "Caller Computer Name."

### Cause: Entra ID Smart Lockout (cloud-only accounts)
**Probability:** 10%
**Detection:** Cloud-only Microsoft 365 account; lockout is temporary (starts at 60 seconds, backs off); Azure AD sign-in logs show the failure reason.
**Safe diagnostic:** Check if SSPR is available at https://aka.ms/sspr (read-only attempt).
**Safe fix:** Wait out the Smart Lockout period, then sign in. If SSPR is available, use it. Otherwise, contact IT for an Entra ID admin to unblock the account.
**Escalation:** Escalate to IT/Entra admin if the lockout recurs or the user can't wait.

### Cause: Privileged / admin account locked (security escalation)
**Probability:** 5% — but HIGH priority
**Detection:** The locked account has admin or elevated permissions.
**Safe diagnostic:** Confirm whether this is a standard user account or an admin/privileged account (read-only check with the user).
**Safe fix:** Do NOT attempt self-service on privileged accounts. Escalate immediately to IT Security.
**Escalation:** Any lockout of a privileged account → escalate to IT Security immediately. Do not unlock without investigation.
