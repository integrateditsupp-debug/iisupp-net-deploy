---
id: l1-outlook-002
title: "Outlook keeps asking for my password over and over (credential prompt loop)"
category: email
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: current
year_range: "Current"
eol_status: "Current. Applies to Outlook for Microsoft 365 / Outlook 2016+ with Exchange Online."
prerequisites: []
keywords:
  - outlook keeps asking for password
  - outlook password prompt
  - outlook asking password again and again
  - outlook wont accept password
  - outlook keeps asking to sign in
  - password prompt loop
  - outlook credential loop
  - need password outlook
  - outlook keeps disconnecting asking password
  - outlook stuck on sign in
  - modern authentication
  - cached credentials outlook
  - credential manager outlook
  - outlook 365 password keeps popping
related_articles:
  - l1-outlook-001-not-receiving-emails
escalation_trigger: "After clearing cached credentials and a clean re-sign-in it still loops, AND Outlook Web (OWA) signs in fine in a browser → likely MFA/Conditional Access or a broken Office identity that IT/admin must reset. Escalate with the exact error text."
intent: identity
vertical: generic
safe_recipe: "clear-cached-credentials"
last_updated: 2026-06-28
version: 1.0
---

# Outlook keeps asking for my password (credential prompt loop)

> This is an **authentication** problem (Outlook won't stay signed in), different from "mail won't send/receive" (`l1-outlook-001`). The usual cause is a **stale/cached credential**, not a wrong password.

## 1. Symptoms
- A "Need Password" / "Sign in" box appears repeatedly, even right after you type the correct password.
- The status bar cycles "Need Password" → "Connected" → "Need Password".
- Typing the password seems to do nothing; the prompt returns in seconds.

## 2. Likely Causes (most common first)
1. **Stale cached credential** in Windows Credential Manager — the #1 cause. Fix: remove the saved Office/Outlook credentials, then sign in fresh.
2. **Outlook signed in with the wrong / old account identity.** Fix: sign out of Office, sign back in with the correct work account.
3. **MFA / Conditional Access re-auth needed** (e.g. after a password change or new device). Fix: complete the modern sign-in (browser-style) prompt; may need the authenticator app.
4. **Cached Exchange / profile corruption.** Fix: rebuild the Outlook profile.
5. **Recent password change** that Outlook still has the old one cached.

## 3. Quick Checks First
- Confirm the password works in a browser at **outlook.office.com** (OWA). If OWA works but the app loops → it's the app's cached credential, do Step 1.
- If OWA also rejects the password → the password itself is wrong/expired → reset it first (self-service password reset or IT).

## 4. Step-by-Step Self-Fix

### Step 1 — Clear cached Office credentials (SAFE, reversible — fixes most loops)
1. Close Outlook.
2. Open **Control Panel → User Accounts → Credential Manager → Windows Credentials**.
3. Under **Generic Credentials**, find every entry starting with **MicrosoftOffice16_Data:**, **MS.Outlook**, or **msteams** / **OneDrive** for the same account.
4. Expand each → **Remove**. (This only deletes the *saved* password; nothing is lost — you'll just sign in again.)
5. Reopen Outlook → when prompted, sign in with the correct work email + password (and approve MFA if asked).

### Step 2 — Sign Office in with the right identity
- In Outlook: **File → Office Account** → check the signed-in account. If it's wrong/old → **Sign out**, then sign back in with the correct work account.
- Also check **File → Account Settings → Account Settings** that the email account listed is the right one.

### Step 3 — Complete modern authentication / MFA
- If a browser-style Microsoft sign-in window appears, use it (don't dismiss it). Approve the **Authenticator** prompt or enter the code. Tick "stay signed in" if offered on a trusted PC.

### Step 4 — Rebuild the Outlook profile (if still looping)
1. Close Outlook.
2. **Control Panel → Mail (Microsoft Outlook) → Show Profiles → Add** → create a new profile → add the account → set it as default.
3. Open Outlook on the new profile and sign in fresh. (Cached mail re-downloads; nothing is deleted from the server.)

## 5. Verification Steps
- Outlook status bar reads **Connected** / **Connected to: Microsoft Exchange** and stays there.
- Send/receive completes with no re-prompt.
- Restart Outlook once — it opens without asking for a password.

## 6. When to Escalate
- Loop persists after Step 1–4 AND OWA works in a browser → IT/admin should check Conditional Access, MFA registration, or reset the Office identity.
- "Your organization's data cannot be pasted/accessed" or account-blocked messages → policy issue for IT.

## 7. Prevention Tips
- After any password change, expect one fresh sign-in on each device — that's normal.
- Keep the Microsoft Authenticator app set up so re-auth is a tap, not a lockout.

## 8. User-Friendly Explanation
When Outlook keeps asking for your password even though you typed it right, it's almost always a stale saved password confusing it — not a wrong password. The fix is to remove the saved Office entries in Windows Credential Manager, then open Outlook and sign in once more. If a Microsoft sign-in window pops up, use it and approve your authenticator. If it still loops but the same password works on outlook.office.com in a browser, IT needs to reset your sign-in.

## 9. Internal Technician Notes
- Credential Manager generic creds to clear: `MicrosoftOffice16_Data:*`, `MS.Outlook:*`, sometimes ADAL/WAM tokens.
- Modern Auth (OAuth/ADAL→WAM) loops often trace to broken WAM token cache: clearing `%LocalAppData%\Packages\Microsoft.AAD.BrokerPlugin_*` (or signing out in Settings → Accounts → Access work or school) can resolve stubborn cases.
- Registry flags from old tenants (e.g. `EnableADAL`, `AlwaysUseMSOAuthForAutoDiscover`) can force broken auth paths — generally leave at modern defaults.
- Check Conditional Access / sign-in logs in Entra (admin) for the exact failure reason if it's tenant-wide.

## 10. Related KB Articles
- `l1-outlook-001` — Outlook not sending/receiving (connectivity, not auth)

## 11. Keywords / Search Tags
outlook keeps asking for password, password prompt loop, credential manager, MicrosoftOffice16_Data, modern authentication, MFA re-auth, cached credentials, rebuild outlook profile, need password outlook
