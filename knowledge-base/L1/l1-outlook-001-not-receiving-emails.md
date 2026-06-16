---
id: l1-outlook-001
title: "Outlook not receiving new emails"
category: outlook
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - outlook
  - not receiving emails
  - email stuck
  - inbox not updating
  - missing emails
  - send/receive
related_articles:
  - l1-outlook-002
  - l1-m365-002
  - l2-exchange-001
escalation_trigger: "Send/Receive returns 0x8004... errors, or issue affects multiple users in same tenant"
last_updated: 2026-05-07
version: 1.0
---

# Outlook not receiving new emails

## 1. Symptoms
- New messages don't appear, but they show in Outlook on the web.
- "Working offline" badge in status bar.
- Send/Receive button does nothing visible.
- Specific senders' emails don't arrive (rest do).
- Inbox shows up to a date and stops.

## 2. Likely Causes
1. Outlook is in Offline mode.
2. Send/Receive group disabled or interval too long.
3. OST file corrupted (cached mode).
4. Mailbox over quota — incoming queued at server.
5. Junk Email or rules redirecting messages.
6. Specific sender blocked or in junk filter.
7. Network connectivity loss.
8. Tenant-wide mail flow issue (Exchange Online).

## 3. Questions To Ask User
1. Are you missing all emails, or only from specific people?
2. Do the missing emails appear in Outlook Web (outlook.office.com)?
3. Does the bottom status bar say "Connected", "Offline", or "Disconnected"?
4. When did you last receive any email at all?
5. Have you set up any new rules or moved any items recently?
6. Are you the only one affected, or are coworkers seeing the same?

## 4. Troubleshooting Steps
1. Check Outlook status bar — if "Working Offline", click **Send/Receive** tab → toggle off **Work Offline**.
2. Open https://outlook.office.com — verify mail is arriving server-side.
3. Send/Receive tab → **Send/Receive All Folders** (F9). Watch progress dialog for errors.
4. Check **Junk Email** folder for missing messages.
5. File → Manage Rules & Alerts — review for redirect/forward/delete rules user didn't expect.
6. Verify mailbox usage: Outlook Web → Settings → General → Storage. If over quota, archive or delete old items.

## 5. Resolution Steps
**If Outlook is offline:**
- Send/Receive → uncheck Work Offline.

**If specific senders only:**
- Home → Junk → Junk E-mail Options → check Blocked Senders, Safe Senders, and Filters.
- Ask sender to resend; check delivery in Outlook Web first.

**If OST file corrupted:**
1. Close Outlook completely (verify no `OUTLOOK.EXE` in Task Manager).
2. File → Account Settings → Account Settings → Data Files tab.
3. Note the OST file location.
4. Open File Explorer to that folder, rename `*.ost` to `*.ost.old`.
5. Reopen Outlook — it will rebuild the OST from server (15–60 min for typical mailbox).

**If quota:**
- Archive items: File → Cleanup Tools → Archive (or Online Archive if licensed).
- Empty Deleted Items.
- Empty Junk.
- For corporate: request quota increase from L2.

## 6. Verification Steps
- Sender to user test: have someone send a test message; user receives within 60 seconds.
- Outlook status bar shows "Connected to: Microsoft Exchange".
- Send/Receive completes with no error in the progress dialog.
- Inbox count matches Outlook Web inbox count.

## 7. Escalation Trigger
- Send/Receive shows error codes `0x8004010F`, `0x800CCC0F`, `0x80042108`, or any HTTP 5xx in the progress dialog.
- Multiple users on the same tenant report the same issue → tenant-wide mail flow.
- Mail is missing on Outlook Web too → Exchange Online side, escalate immediately.
- OST rebuild fails or hangs >2 hours.
- → Escalate to **L2** with: error code, screenshots, account UPN, OST size, and whether issue spans multiple users.

## 8. Prevention Tips
- Don't disable Send/Receive groups.
- Archive monthly to keep mailbox under 80% of quota.
- Use Focused Inbox sparingly — it can hide messages users don't realize exist.
- Train users to check Junk weekly.
- For laptops with intermittent network, keep Cached Exchange Mode ON.

## 9. User-Friendly Explanation
"Outlook isn't pulling new mail from the server. Often it's stuck in Offline mode, or it's filtered something into Junk. We'll get it talking to the server again, peek in Junk, and double-check no rule is moving things. If we still can't see your latest emails, we'll log into the web version to confirm where they actually are, then fix the right piece."

## 10. Internal Technician Notes
- OST default location: `%localappdata%\Microsoft\Outlook\` — back it up before deletion if user has local-only items (PST attachments etc.).
- Mailbox quota check (admin): `Get-MailboxStatistics user@domain | ft DisplayName,TotalItemSize,ItemCount`.
- Mail flow trace: Exchange Admin Center → Mail flow → Message trace → search by recipient + date range.
- For shared mailboxes accessed in cached mode, OST can balloon — consider Online mode for small-mailbox shared.
- 0x8004010F often = corrupted profile, not OST. Fix with `Mail (Microsoft Outlook)` Control Panel applet → New Profile.
- If MFA was enforced recently and user hadn't reauth'd, modern auth prompts get suppressed in some Outlook builds — `outlook.exe /resetnavpane` then close + reopen forces auth.

## 11. Related KB Articles
- l1-outlook-002 — Outlook crashes / won't open
- l1-m365-002 — Microsoft 365 license / activation issues
- l2-exchange-001 — Exchange Online mail flow troubleshooting

## 12. Keywords / Search Tags
outlook, not receiving, email stuck, inbox not updating, missing emails, send receive, offline mode, ost, junk filter
