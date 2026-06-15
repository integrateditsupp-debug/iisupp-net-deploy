---
id: l1-outlook-002
title: "Outlook can't send emails / messages stuck in Outbox"
category: outlook
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - outlook
  - can't send
  - stuck in outbox
  - email not sending
  - unable to send
  - smtp error
  - outbox
related_articles:
  - l1-outlook-001
  - l2-exchange-001
escalation_trigger: "Multiple users on same tenant cannot send, or NDR shows 5.7.x policy violation, or DKIM/SPF/DMARC failure"
last_updated: 2026-05-07
version: 1.0
---

# Outlook can't send emails / messages stuck in Outbox

## 1. Symptoms
- Composed message sits in **Outbox** indefinitely.
- "Outlook is trying to send your message" dialog hangs.
- NDR (non-delivery report) bounces back from Postmaster with a code like `5.7.1`, `5.7.135`, `5.4.6`, `5.2.2`.
- Send button appears to do nothing.
- "Cannot send this item" error pops up.

## 2. Likely Causes
1. Large attachment exceeding 25 MB / 35 MB tenant limit.
2. Recipient address typo or external block.
3. Outlook in offline mode.
4. Stuck Outbox item from a prior failed send.
5. Authentication / token expired (especially after password change).
6. Tenant policy blocking external recipients.
7. Mailbox quota exceeded (cannot send when over).

## 3. Questions To Ask User
1. Is it one specific email, or all of them?
2. Is there an attachment? How big?
3. What does the NDR (bounce) message say, if any?
4. Did you change your password recently?
5. Are you online? (try a website)
6. Is the recipient internal (same company) or external?

## 4. Troubleshooting Steps
1. Open Outbox folder. If a single email is stuck, double-click → close. Outlook needs the message unlocked to delete or retry.
2. Move the stuck message to Drafts (drag).
3. Check internet: open https://office.com — should load.
4. Check Outlook status bar — must say "Connected".
5. Send/Receive → click **Work Offline** off if engaged.
6. Try sending a small test message (no attachment) to yourself.

## 5. Resolution Steps
**If a stuck message blocks Outbox:**
1. Outlook → Send/Receive → Work Offline (toggle ON to halt sending).
2. Drag the stuck message from Outbox to Drafts.
3. Toggle Work Offline OFF.
4. Open the Drafts copy — re-attach files if needed — Send.

**If attachment too large:**
- For corporate users: upload to OneDrive → share link → paste link in email instead.
- M365 default 25 MB per send (some tenants 35 MB or 150 MB). External providers vary.

**If NDR cites 5.7.x (security/policy):**
- 5.7.1 → recipient or domain blocked your tenant. Contact recipient via phone.
- 5.7.135 → SPF/DKIM authentication block. Escalate to L2.
- 5.7.708 → access denied; user may be on M365 sender block list. Escalate.

**If authentication issue (recent password change):**
1. File → Account Settings → Account Settings → highlight account → Change → re-enter password.
2. If MFA recently enabled, complete the modern auth prompt.
3. If repeated auth pop-ups: File → Account Settings → Account Settings → Email → Repair.

**If quota:**
- Cannot send while over quota. Archive or delete old items first (see l1-outlook-001 §5).

## 6. Verification Steps
- Stuck message no longer in Outbox.
- Test message to self arrives within 60 seconds.
- External test (to personal email or coworker) arrives without NDR.
- Status bar shows "Connected to: Microsoft Exchange".

## 7. Escalation Trigger
- NDR codes: `5.7.135`, `5.7.708`, `5.7.520`, `5.7.230` — tenant policy.
- Multiple users in same tenant cannot send.
- External-domain bounces with DMARC/DKIM failures.
- Password change does not resolve repeated auth prompts.
- → Escalate to **L2** with: NDR header (full), recipient domain, sender UPN, last successful send timestamp.

## 8. Prevention Tips
- Use OneDrive links for files >10 MB by default.
- Keep mailbox under quota — over-quota mailboxes can receive but not send.
- Update Outlook to current channel; old builds have known auth bugs.
- Train users on what NDRs mean — "5.x.x means hard fail; copy-paste it to IT."
- Don't bulk-send via Outlook from a regular mailbox — flagged as spam.

## 9. User-Friendly Explanation
"Your email isn't leaving your computer. It's usually one of three things: a too-big attachment, the message got stuck so nothing else can leave, or your password changed and Outlook hasn't caught up. We'll move the stuck one out of the way, retry with a smaller file via OneDrive if needed, and re-sign you in if that's the issue. Should be back to sending in a couple of minutes."

## 10. Internal Technician Notes
- Outbox lock: items in Outbox in "in-progress" state can't be deleted. Forcing offline first releases the lock.
- For shared/delegated mailboxes, "Send As" requires `SendAs` permission on the source mailbox; "Send on Behalf" requires `GrantSendOnBehalfTo`. Confirm in Exchange Admin.
- Modern auth issues: clear cached creds via `Control Panel → User Accounts → Credential Manager` — remove all `MicrosoftOffice16_Data:*` entries, then close + reopen Outlook.
- For NDR `5.7.135` "this message can't be delivered due to authentication", check Exchange Admin Center → Mail Flow → spoof intelligence; the sender may be flagged.
- Outlook for Mac uses different sync — issues may need profile rebuild via `Outlook Profile Manager`.

## 11. Related KB Articles
- l1-outlook-001 — Outlook not receiving new emails
- l2-exchange-001 — Exchange Online mail flow troubleshooting

## 12. Keywords / Search Tags
outlook, can't send, stuck in outbox, email not sending, smtp error, attachment too large, ndr, bounce, postmaster
