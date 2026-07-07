---
id: l1-outlook-005
title: "Outlook keeps asking for my Windows password — clear stale credentials"
category: outlook
support_level: L1
severity: high
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: current
year_range: "Current"
eol_status: "Current. Applies to Microsoft 365 / Outlook 2019/2021/365 on Windows."
prerequisites: []
intent: break-fix
vertical: generic
safe_recipe: "clear-office-credentials"
keywords:
  - outlook keeps asking for password
  - outlook password prompt
  - outlook asking for password over and over
  - outlook password loop
  - password prompt keeps coming back
  - outlook won't stop asking for password
  - outlook credentials expired
  - outlook sign in loop
  - outlook credential manager
  - clear outlook credentials
  - windows credential manager outlook
  - MicrosoftOffice16
  - cached credentials outlook
  - modern auth outlook
  - outlook token expired
  - outlook repeated password
  - outlook password dialog won't go away
  - keeps asking for my password
  - password prompt every time i open outlook
  - office 365 password prompt loop
related_articles:
  - l1-m365-001
  - l1-password-001
  - l1-outlook-001
escalation_trigger: "Credentials re-prompting within minutes after clearing, or user sees AADSTS error codes (Conditional Access block — needs admin), or admin MFA policy changed and user cannot authenticate at all."
last_updated: 2026-06-28
version: 1.0
---

# Outlook keeps asking for my Windows password — clear stale credentials

> **This article is for:** Outlook on Windows repeatedly showing a password dialog — even after you type the correct password, it comes back again.
> 
> If you're getting an AADSTS error code or seeing a web browser sign-in loop, see `l1-m365-001` instead.

## 1. Symptoms
- A dialog box saying "Enter your credentials" or "Microsoft Outlook — Sign in" keeps re-appearing.
- You type your password, click OK, and the box comes back immediately or within minutes.
- Outlook shows a yellow "Need Password" or "Disconnected" bar at the bottom.
- Outlook was working fine, then stopped after a password change, MFA re-enrollment, or a Windows update.
- Other Microsoft apps (Teams, OneDrive) work fine — the problem is Outlook-specific.

## 2. Why This Happens (Most Common)
1. **Stale saved credential in Windows Credential Manager** — Windows remembered your old password. After a password change or MFA re-enrollment, the saved token no longer works, but Outlook keeps trying it silently, fails, then prompts you again.
2. **Modern auth token expired** — your Microsoft 365 authentication token expired and Outlook can't silently renew it (often after a long idle period or a network change). Clearing the stale token forces a clean re-auth.
3. **Outlook profile partially corrupted** — rare, but sometimes the profile itself holds a bad cached credential.
4. **Password was changed elsewhere** (another device, the web portal, or IT forced a reset) and Windows on this machine still has the old one saved.

## 3. Questions to Ask the User
1. Did you recently change your password, or did IT force a reset?
2. Did MFA (authenticator app / text code) recently change or get re-enrolled?
3. Has anything changed — new laptop, back from a long leave, recent Windows update?
4. Does the prompt appear when you first open Outlook, or after it's been open a while?
5. Are other Office apps (Teams, OneDrive) also prompting, or just Outlook?

## 4. Fix — Step by Step

### Step 1 — Close Outlook completely
1. Close Outlook.
2. Open **Task Manager** (Ctrl+Shift+Esc) → check Processes tab → if **OUTLOOK.EXE** still appears, right-click → End Task.
   Outlook must be fully closed before you can clear its saved credentials.

### Step 2 — Clear stale saved credentials from Windows Credential Manager (SAFE — this is fully reversible; Outlook will ask you to sign in fresh)
1. Open **Control Panel** (search for it in the Start menu) → **User Accounts** → **Credential Manager**.
2. Click **Windows Credentials**.
3. Look for entries that start with any of these (you may see several):
   - `MicrosoftOffice16_Data:...`
   - `MicrosoftOffice15_Data:...`
   - `MicrosoftOffice17_Data:...`
   - `Office 365...`
   - `Microsoft_OC_...`
   - `MsRtcSip-...` (Skype for Business / Teams legacy)
4. Click each matching entry → **Remove**.
   > You won't lose any email or files. You're only removing the saved sign-in token. Outlook will ask for credentials once, then remember the new token going forward.
5. Also look for any entry with your email address or your organisation's domain and remove it.

### Step 3 — Clear Office identity tokens (optional but recommended)
1. Open **File Explorer** and navigate to: `%localappdata%\Microsoft\Office\16.0\`
2. Look for a folder called **IdentityCache** and/or **TokenCache** — if present, delete the contents (not the folder itself).
   This clears OAuth tokens Office holds independently of Credential Manager.

### Step 4 — Reopen Outlook and sign in fresh
1. Open Outlook.
2. A sign-in dialog will appear — type your current password and complete the MFA prompt on your phone.
3. Tick **"Stay signed in"** / **"Keep me signed in"** if offered.
4. Outlook should connect and the yellow bar should disappear.

### Step 5 — If the prompt comes back immediately after Step 4
This means Outlook's profile itself holds a stale account reference. Reset the profile:
1. Go to **Control Panel → Mail (Microsoft Outlook)** → **Show Profiles** → **Add** (create a new profile with a new name, e.g. "Outlook New").
2. Add your email account to the new profile.
3. Set it as the default → restart Outlook.
   This is still non-destructive — your email lives on the server (Exchange/Microsoft 365), not in the profile.

## 5. Verification Steps
- Outlook opens without any password dialog.
- Status bar at the bottom says **"Connected to: Microsoft Exchange"** or **"Connected"** with a green dot.
- Send yourself a test email — it arrives in Sent Items and in Inbox within ~60 seconds.
- After closing and reopening Outlook, no prompt reappears.

## 6. When to Escalate (Self-fix limit)
- Prompt keeps returning within minutes even after clearing credentials and recreating the profile → likely a **Conditional Access policy** or **MFA registration issue** — needs admin/L2.
- User sees **AADSTS50053** (account locked), **AADSTS50076** (MFA required — device can't complete it), or **AADSTS50158** (external security challenge) → admin action required.
- **Multiple users on the same tenant** suddenly started prompting → tenant-wide identity outage or policy change — check Microsoft 365 Service Health and escalate to L2/L3.
- User **cannot access the MFA prompt** (lost phone, new phone without authenticator) → IT must re-enroll MFA before the credential clear will work.
- → Escalate to **L2** with: the exact dialog text or AADSTS code, whether it affects one user or many, and the date it started.

## 7. Prevention Tips
- After any password change, close Outlook and reopen it immediately — let it re-auth before the old cached token expires.
- Keep the Microsoft Authenticator app installed and notifications on. A denied or missed MFA push can trigger the prompt loop.
- If you're going on a long leave (>1 month), sign out of Office apps before you go so tokens don't go stale.

## 8. User-Friendly Explanation
"Outlook remembers your password so you don't have to type it every time. But if your password changed — or the saved copy got old — Outlook gets stuck asking for something it can't get. The fix is to go into Credential Manager (a Windows tool that stores saved passwords), find the old Outlook entries, and delete them. Don't worry — it won't delete your emails. It just makes Outlook ask for your password once to get a fresh copy, and then it won't bother you again."

## 9. Internal Technician Notes
- The Credential Manager path is: `Control Panel → User Accounts → Credential Manager → Windows Credentials`. Entries relevant to Office start with `MicrosoftOffice16_Data:`, `MicrosoftOffice15_Data:`, `Microsoft_OC_`, or the tenant name.
- Office also caches tokens at `%localappdata%\Microsoft\Office\16.0\IdentityCache\` and `%localappdata%\Microsoft\OneAuth\`. Clearing these covers MSAL-based modern auth tokens.
- If `net accounts` shows the account hasn't expired and the user can sign in via browser, this is 100% a cached credential / stale token issue on the PC.
- `outlook.exe /resetnavpane` forces Outlook to close + clear some cached state on next open — sometimes this alone resolves the loop after an MFA change.
- On hybrid-joined machines, Conditional Access "Require compliant device" blocking Office apps looks identical to a password loop from the user's perspective — check Azure AD sign-in logs for the actual error code.
- If the issue is modern auth token expiry on an always-on machine (server or kiosk): check Azure AD → refresh token lifetime policy; the default is 90 days inactive.

## 10. Related KB Articles
- `l1-m365-001` — Can't sign in to Microsoft 365 (AADSTS errors, broader M365 sign-in issues)
- `l1-password-001` — Password reset / forgotten password
- `l1-outlook-001` — Outlook not receiving new emails
- `l2-azure-ad-001` — Conditional Access blocking sign-in

## 11. Keywords / Search Tags
outlook keeps asking for password, outlook password prompt loop, outlook credential manager, clear MicrosoftOffice16 credentials, outlook sign in loop, password prompt keeps coming back, outlook disconnected need password, cached credentials outlook, modern auth token expired outlook, outlook password dialog won't go away
