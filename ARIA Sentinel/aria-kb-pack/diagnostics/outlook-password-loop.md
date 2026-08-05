---
id: diagnostics/outlook-password-loop
intent: break-fix
vertical: generic
safe_recipe: clear-office-credentials
---

# Outlook Keeps Asking for Password — Password Prompt Loop / Credential Loop

## Symptom: Outlook repeatedly shows a password or sign-in dialog that comes back even after entering correct credentials.
> User phrasings: "outlook keeps asking for password", "outlook password prompt over and over", "outlook asking for password again and again", "outlook password loop", "password dialog keeps coming back", "outlook credential prompt", "outlook won't stop asking for password", "clear outlook credentials", "outlook credential manager", "outlook sign in loop", "cached credential outlook", "modern auth outlook loop", "outlook password every time"

### Cause: Stale cached credential in Windows Credential Manager (most common)
**Probability:** 50%
**Detection:** Outlook prompts repeatedly despite correct password; other M365 apps (Teams, OneDrive) work fine; check system-context.json `identity.credManagerStale` flag.
**Safe diagnostic:** Open Windows Credential Manager (Control Panel → Credential Manager → Windows Credentials tab) and look for entries named `MicrosoftOffice*`, `Office 365*`, `Outlook*`, or `msal.cache` (read-only inspection).
**Safe fix:** With user confirmation:
1. Close Outlook completely (check Task Manager).
2. In Credential Manager → Windows Credentials → remove ALL entries containing `MicrosoftOffice`, `Office 365`, `Outlook`, or `msal`.
3. Reopen Outlook and sign in fresh when prompted.
**Escalation:** If the credential prompt returns within minutes after clearing, escalate — a Conditional Access policy or MFA change likely requires admin attention.

### Cause: Expired Modern Auth token (OAuth / MSAL cache stale)
**Probability:** 25%
**Detection:** Prompt appears after a recent password change, MFA re-enrollment, or Conditional Access policy update. The sign-in window shows a Microsoft web page rather than a simple username/password box.
**Safe diagnostic:** Confirm whether the sign-in dialog is a web-browser-style popup (Modern Auth) or a classic username/password dialog (read-only check).
**Safe fix:** With user confirmation, in Outlook: File → Office Account → Sign Out → close Outlook → reopen → sign in fresh with the new credential.
**Escalation:** If sign-in fails with an AADSTS error code (e.g. AADSTS50076, AADSTS53003), this is a Conditional Access block — escalate to IT admin.

### Cause: Multiple Outlook profiles fighting over one credential
**Probability:** 15%
**Detection:** More than one Outlook profile exists; credential prompts appear at unexpected intervals.
**Safe diagnostic:** Check Control Panel → Mail (Microsoft Outlook) → Show Profiles to count profiles (read-only).
**Safe fix:** With user confirmation, remove unused/old profiles and ensure only the active profile is set as default.
**Escalation:** If removing old profiles causes data-loss concern (old archived mail), escalate to L2 to safely migrate mail before removal.

### Cause: Basic Auth disabled, Outlook version too old
**Probability:** 10%
**Detection:** Repeated prompts on Outlook 2013/2016 after a tenant Modern Auth migration; newer Outlook versions work fine.
**Safe diagnostic:** Check Outlook version under File → Office Account → About Outlook (read-only).
**Safe fix:** Upgrade Outlook to a version that supports Modern Auth (Outlook 2019 / 2021 / 365). Escalate to IT if the user is on a managed device.
**Escalation:** Version upgrade requires admin/license; escalate to IT.
