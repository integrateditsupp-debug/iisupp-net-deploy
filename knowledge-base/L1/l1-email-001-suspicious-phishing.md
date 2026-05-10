---
id: l1-email-001
title: "Suspicious email / suspected phishing — what to do"
category: email
support_level: L1
severity: high
estimated_time_minutes: 5
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
prerequisites: []
keywords:
  - phishing
  - suspicious email
  - scam email
  - spam
  - report phishing
  - email scam
  - business email compromise
  - bec
related_articles:
  - l1-password-001
  - l3-security-001
  - ga-scam-001
escalation_trigger: "User clicked link or entered credentials, or executive impersonation, or active BEC suspected"
last_updated: 2026-05-07
version: 1.0
---

# Suspicious email / suspected phishing

## 1. Symptoms
- Email from familiar name but address looks off.
- "Action required", "Verify your account", "Your password expires today".
- Unexpected attachment (.zip, .iso, .htm, .docm).
- Sense of urgency / threats / requests to bypass normal procedure.
- Wire-transfer or gift-card requests via email.
- Reply-to address differs from From address.
- Mismatched display name vs sender domain.

## 2. Likely Causes
1. Phishing — generic credential theft.
2. Spear-phishing — targeted at user's role.
3. Business Email Compromise (BEC) — impersonating CEO/CFO/vendor.
4. Malware delivery — attachment contains payload.
5. Spam (annoying but not malicious).
6. Legitimate but poorly-formatted email (rare).

## 3. Questions To Ask User
1. Did you click any link in this email?
2. Did you open any attachment?
3. Did you enter your password on any page after clicking?
4. Did you reply with information?
5. When did the email arrive — and was it expected?

## 4. Troubleshooting Steps — STOP FIRST
- Do **not** click any links.
- Do **not** open attachments.
- Do **not** reply.
- Do **not** call any phone number in the email.
- Hover (don't click) over links to see the real URL — phishing usually points to a different domain than it claims.
- Note display vs. address: "John Smith <jsmith@gmail.com>" when John normally emails from "@company.com" is a red flag.

## 5. Resolution Steps
**If you have NOT interacted with it:**
1. In Outlook → select message → Home tab → **Report** dropdown → "Report Phishing".
2. Or: forward email as attachment to your IT phishing inbox (e.g., `phishing@iisupport.net`) — drag-drop into a new message to preserve headers.
3. After reporting, delete from Inbox AND Deleted Items.
4. Block the sender if pattern continues (Junk → Block Sender).

**If you HAVE clicked a link:**
1. Don't enter anything; close the tab/window.
2. Run a full antivirus scan: Windows Security → Virus & threat protection → Scan options → Full scan.
3. Report the email to IT — escalate.

**If you HAVE entered credentials:**
1. Immediately change your password from a known-good device.
2. Sign out of all sessions: https://mysignins.microsoft.com → Sign out everywhere.
3. Notify IT immediately — escalate to L2/L3.
4. Watch your inbox for unexpected sent items, mailbox rules, MFA-prompts.

**If you HAVE replied with information (BEC):**
1. Do NOT engage further.
2. Notify IT and finance leadership — wires can sometimes be reversed within 24h.
3. File an IC3 report (US) or local equivalent if money was sent.

## 6. Verification Steps
- Email reported and removed from inbox.
- If credential exposure, password change confirmed, sessions revoked.
- Antivirus scan clean.
- No unfamiliar Outlook rules under File → Manage Rules & Alerts.
- No unfamiliar device under https://mysignins.microsoft.com.

## 7. Escalation Trigger
- User clicked link AND entered credentials.
- Executive (CEO/CFO/VP) impersonation in any form.
- Wire transfer requested or sent.
- Mass-distribution to multiple users in same tenant.
- Attachment was opened and ran.
- → Escalate to **L3 / Security Team** immediately.

## 8. Prevention Tips
- Verify any urgent money / credential request via a second channel (call the person on a known number).
- Hover before you click — every time.
- Use the Report button — it trains the org's filter.
- Keep MFA enabled on every account that supports it.
- Don't reuse passwords across sites; use a password manager.
- If something feels off, it probably is — slow down.

## 9. User-Friendly Explanation
"That email looks like a scam. Don't click anything in it. The safest move is to report it using Outlook's Report button — that tells our security system to clean it from everyone's inbox. If you already clicked or typed your password, tell us right now: every minute matters when an attacker has your credentials. We'll change your password, kick them out of your account, and make sure nothing was stolen. There's no shame in clicking — phishers are good at this. Just tell us fast."

## 10. Internal Technician Notes
- Microsoft Defender for Office 365 → Threat Explorer → search by sender domain or subject for tenant impact.
- Check for inbox rules created in last 7d — top BEC indicator: rules forwarding to RSS folder, deleting from sender, marking-as-read.
- Sign-in logs: Entra → Sign-in logs → filter by user → look for foreign IP, non-compliant device, "interrupted" status.
- Revoke sessions: `Revoke-AzureADUserAllRefreshToken -ObjectId <user>` (legacy) / `Revoke-MgUserSignInSession -UserId <id>`.
- Search-and-destroy: Defender → Threats → Submissions → bulk remove similar emails tenant-wide.
- For BEC: look at mailbox audit logs for `New-InboxRule`, `Set-InboxRule`, `MailboxLogin` from new IPs.
- Engage cyber-insurance carrier if money moved.

## 11. Related KB Articles
- l1-password-001 — Password reset (after suspected compromise)
- l3-security-001 — Security incident response runbook
- ga-scam-001 — Detect scam websites (general assistant)

## 12. Keywords / Search Tags
phishing, suspicious email, scam email, spam, report phishing, business email compromise, bec, impersonation, credential theft
