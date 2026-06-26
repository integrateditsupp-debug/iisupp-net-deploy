# Microsoft 365 Help Desk KB Pack — DRAFT CONTENT
**AXIS 24/7 Dispatcher — 2026-06-25**  
Status: DRAFT — not published, not sent. For Ahmad review before any external use.

---

## Product Overview

**Title:** Microsoft 365 Help Desk KB Pack  
**Buyer:** Help desks, SMB IT admins, internal IT coordinators  
**Core promise:** A ready-to-use reference set of answers, workflows, and checklists for the 25 most common M365 support tickets — so junior staff can close Level 1 tickets faster without escalating.  
**Price range:** $29–$149  
**Delivery format:** PDF (human use) + structured Markdown/JSON (AI/ARIA-ingestible)

---

## Chapter 1: Identity & Access

### 1.1 User Cannot Sign In to Microsoft 365

**Symptoms:** "Access Denied", spinning login screen, MFA loop, wrong tenant error.

**Step-by-step resolution:**
1. Confirm correct UPN/email format (firstname@domain.com, not alias).
2. Check if the account is disabled in Entra ID (Azure AD) → Active Users → filter by sign-in status.
3. Check license assignment — unlicensed accounts cannot sign in to apps.
4. Test with Incognito / private browser to rule out cached credential conflict.
5. If MFA loop: reset MFA methods in Entra → Authentication Methods. Offer temp access pass if emergency.
6. If wrong tenant error: clear browser storage, confirm user is signing into correct org URL.
7. Escalate if: SSO/SAML federation errors, Conditional Access policy blocks (check sign-in logs for CA policy name).

**Escalation trigger:** CA policy block + no override path → contact M365 admin with license and sign-in log screenshot.

**CASL/privacy note:** Never share another user's sign-in logs without manager authorization.

---

### 1.2 Multi-Factor Authentication (MFA) Issues

**Symptoms:** "Approve sign-in request" never arrives, authenticator app says code is invalid, user changed phones.

**Step-by-step resolution:**
1. Verify Authenticator app is installed and notifications are enabled on the mobile device.
2. Check time sync on the device — TOTP codes fail if device clock is off >30 seconds.
3. If new phone: old app uninstalled or not transferred. → Reset authentication methods in Entra ID → user re-registers.
4. If SMS fallback fails: check phone number in profile; send test SMS from Entra.
5. Issue Temporary Access Pass (TAP) for immediate unblock while user re-registers (Entra ID → user → Authentication Methods → Add TAP).

**Escalation trigger:** Conditional Access policy requires compliant device + user device is wiped or lost.

---

## Chapter 2: Email (Exchange Online / Outlook)

### 2.1 Outlook Not Syncing / Not Receiving Emails

**Symptoms:** Emails visible in OWA but not in Outlook desktop; "Send/Receive errors"; inbox freezes.

**Step-by-step resolution:**
1. Test in OWA (outlook.office.com) first — if working, issue is Outlook client, not Exchange.
2. Outlook desktop: File → Account Settings → Repair account. Restart after.
3. Check Offline mode: Send/Receive tab → uncheck Work Offline if enabled.
4. OST file corruption: close Outlook → rename or delete OST file at `%LOCALAPPDATA%\Microsoft\Outlook\` → reopen (rebuilds from server).
5. Check mailbox quota: Admin center → Users → mailbox storage. At-quota mailboxes reject incoming mail silently.
6. Run Microsoft Support and Recovery Assistant (SaRA) for automated diagnosis.

**Escalation trigger:** Exchange transport rules blocking mail; mailbox over quota with archived data; hybrid on-prem sync issue.

---

### 2.2 Email Sent to Spam / Not Delivered to External Recipients

**Symptoms:** External contacts don't receive emails; "undeliverable" NDR; lands in recipient spam.

**Step-by-step resolution:**
1. Check NDR error code in the bounce email — 5.x.x = permanent delivery failure; 4.x.x = temporary.
2. Common NDR 550 5.7.1: check if domain is on a blocklist at MXToolbox (mxtoolbox.com/blacklists).
3. Verify SPF, DKIM, DMARC DNS records: Admin Center → Settings → Domains → check propagation.
4. Check Exchange Anti-Spam Outbound Policy — if IP reputation flagged, Microsoft submission portal: https://sender.office.com
5. For "lands in spam": recipient adds sender to safe senders, or sender requests header analysis.

**Escalation trigger:** Domain on major blocklist (Spamhaus SBL); DKIM/DMARC misconfiguration requiring DNS change.

---

### 2.3 Outlook Crashes or Freezes on Launch

**Step-by-step resolution:**
1. Launch in Safe Mode: `outlook.exe /safe` via Run dialog. If it opens → add-in conflict.
2. Disable add-ins: File → Options → Add-ins → Go → uncheck third-party add-ins one at a time.
3. Repair Office: Control Panel → Apps → Microsoft 365 → Modify → Quick Repair (online if needed).
4. Check Windows Updates and Office channel updates (File → Office Account → Update Options).
5. Recreate Outlook profile: Control Panel → Mail → Show Profiles → Add (new profile).

---

## Chapter 3: Teams & Collaboration

### 3.1 Teams Audio / Video Not Working in Meetings

**Symptoms:** "No microphone detected", camera shows black, echo, or other participants cannot hear/see.

**Step-by-step resolution:**
1. Windows Settings → Privacy → Microphone/Camera → ensure Microsoft Teams has permission.
2. In Teams: Settings (gear icon) → Devices — select correct microphone and camera; test both.
3. Check device default in Windows Sound settings — wrong default output/input is the #1 cause.
4. For echo: one party is using laptop speakers while another is on call — use headset or mute when not speaking.
5. For video black screen: update camera driver via Device Manager; try "Background effects: None".
6. Run Teams network test: https://www.microsoft365.com/networkconnectivity

**Escalation trigger:** Meeting policy restricting camera/mic use (Teams admin center); enterprise network blocking UDP ports 3478-3481.

---

### 3.2 Teams Channels / Files Not Loading

**Step-by-step resolution:**
1. Clear Teams cache: quit Teams → `%AppData%\Microsoft\Teams\` → delete `Cache`, `blob_storage`, `databases`, `GPUCache`, `IndexedDB`, `Local Storage`, `tmp`. Relaunch.
2. Check SharePoint site permissions if files tab shows "You don't have access."
3. Confirm user is a member of the Team, not a guest (guests have restricted file access by default).
4. For channels not visible: check if channel is hidden — three-dot menu → Manage channels → unhide.

---

## Chapter 4: SharePoint & OneDrive

### 4.1 OneDrive Sync Issues

**Symptoms:** Files not syncing, blue cloud icon stuck, "You need to sign in again" loop, selective sync missing folders.

**Step-by-step resolution:**
1. Click OneDrive tray icon → Settings → Account → Unlink this PC → re-sign in (safe, no file loss).
2. Known Folder Move issues: Settings → Backup → check Desktop/Documents/Pictures sync status.
3. Selective sync: Settings → Account → Choose folders — re-check missing folders.
4. OneDrive log at: `%LocalAppData%\Microsoft\OneDrive\logs\` — review SyncDiagnostics.log for specific errors.
5. File name/path issues: paths >260 characters, special characters (`# % & * : < > ? /`), or locked files cause silent skip.

---

## Chapter 5: Licensing & Admin

### 5.1 User Needs a License Assigned or Changed

**Step-by-step resolution:**
1. M365 Admin Center → Users → Active Users → select user → Licenses and apps tab.
2. Assign appropriate license (Business Basic, Business Standard, Business Premium).
3. After assignment: 15-30 minutes for services to activate. Apps appear in portal.office.com.
4. Changing license (e.g., Basic → Standard): uncheck old, check new in same screen. Service continuity maintained.

**Admin note:** License count must be available. If at seat limit → Admin Center → Billing → purchase additional seats.

---

### 5.2 Shared Mailbox Setup

**Step-by-step resolution:**
1. Admin Center → Teams & Groups → Shared Mailboxes → Add.
2. Set display name and email address. Takes ~5 minutes to provision.
3. Assign members (grant Full Access + Send As permissions).
4. Members access via Outlook → File → Open & Export → Other User's Folder → type shared mailbox name.
5. For auto-mapping: Full Access permission auto-maps in 20-30 min without user action.

---

## Chapter 6: Security Basics

### 6.1 User Received Suspicious Email — Is It Phishing?

**Triage checklist (run in order):**
- [ ] Check sender domain — does it match the real org? (hover over From name)
- [ ] Look for urgency language: "Act now", "Your account will be suspended"
- [ ] Check link destination: hover before clicking; should match sender's legitimate domain
- [ ] Look for mismatched branding, bad grammar, generic greetings ("Dear User")
- [ ] Check email headers for SPF/DKIM fail (Outlook: File → Properties → Internet headers)

**If confirmed phish:**
1. Do not click any links or download attachments.
2. Report via Outlook: Report Message add-in → Phishing.
3. If user already clicked: immediately change password, revoke sessions (Entra → user → Revoke sessions), notify IT.
4. Block sender domain in M365 Defender if pattern is confirmed.

---

### 6.2 Compromised Account Response Checklist

**Immediate steps (first 15 minutes):**
- [ ] Reset password immediately (Admin Center or Entra ID → Reset Password)
- [ ] Revoke all active sessions: Entra ID → user → Revoke sessions
- [ ] Review sign-in logs: Entra ID → Sign-in logs → filter by user → look for unfamiliar IPs/locations
- [ ] Check for inbox rules: Outlook → Rules → look for any auto-forward rules created by attacker
- [ ] Check Sent Items and Deleted Items for outbound phishing or data exfil
- [ ] Notify user to re-register MFA from a trusted device
- [ ] Escalate to IT lead: document incident timestamp, IP of suspicious login, any sent items

---

## Chapter 7: Quick-Reference Checklists

### New Employee M365 Onboarding Checklist
- [ ] Account created with correct UPN
- [ ] License assigned (correct tier)
- [ ] MFA enforced — user prompted on first login
- [ ] OneDrive storage initialized (sign into office.com once)
- [ ] Teams added to relevant channels/groups
- [ ] Shared mailboxes added if applicable
- [ ] Email signature set
- [ ] Manager informed of ready status

### Offboarding Checklist (Leavers)
- [ ] Reset password + revoke sessions immediately on last day
- [ ] Block sign-in (Entra ID → Disable account — do NOT delete yet)
- [ ] Export mailbox if legally required (eDiscovery or PST)
- [ ] Reassign mailbox as shared mailbox or auto-forward for transition period (max 30 days)
- [ ] Remove from all Teams, Groups, SharePoint
- [ ] Remove license after mailbox handling complete (saves cost)
- [ ] Confirm exit date in HR system for license audit

---

## AI-Readable Version (ARIA-Ingestible)

```json
{
  "product": "M365 Help Desk KB Pack",
  "version": "draft-2026-06-25",
  "intents": [
    "user cannot sign in",
    "MFA not working",
    "outlook not syncing",
    "email going to spam",
    "teams audio not working",
    "teams video not working",
    "onedrive not syncing",
    "assign license",
    "shared mailbox setup",
    "phishing email triage",
    "compromised account response"
  ],
  "escalation_signals": [
    "conditional access policy block",
    "domain on spam blocklist",
    "hybrid on-prem exchange sync",
    "lost/wiped MFA device",
    "confirmed account compromise"
  ]
}
```

---

## Production Notes

- Remaining chapters to add: Power Automate basics, Power BI sharing issues, mobile MDM enrollment.
- Graphics to add: onboarding flowchart, compromised account triage diagram.
- Ahmad approval needed before publishing or selling.
- Upsell CTA for each chapter: "Need this set up for your team? IIS offers M365 admin and support retainers → iisupp.net"
