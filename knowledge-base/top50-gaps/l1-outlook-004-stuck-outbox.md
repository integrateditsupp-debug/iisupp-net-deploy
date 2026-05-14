---
id: l1-outlook-004
title: "Outlook stuck in Outbox — email won't send"
category: outlook
support_level: L1
severity: high
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - outlook stuck outbox
  - email wont send
  - send and receive failed
  - attachment too large
  - outlook offline mode
  - 0x8004210b
  - cant send mail
  - outbox not clearing
  - retry send
tags:
  - outlook
  - email
  - top-50
related: [l1-outlook-001-not-receiving-emails, l1-outlook-002-cant-send-emails, l1-outlook-003-send-receive-errors]
---

# Outlook stuck in Outbox

### Email stuck because attachment is over 25 MB

M365 caps attachments at 25 MB. Open the email in the Outbox folder. Right-click attachment → see size. If over 25 MB, save the file to OneDrive, get the share link, replace the attachment with the link, hit Send. If you can't tell the size, that's still the most likely cause — try removing the attachment and retest. If under 25 MB but still stuck, that's the next bit.

### Send/Receive button does nothing, Outbox just sits there

Outlook is in offline mode silently. Send/Receive tab → Work Offline button → toggle on then off. This forces a reconnect. Watch the bottom-right status bar — should go from "Disconnected" to "Connected." Outbox flushes within 30 seconds if connection is healthy. If button stays grey or status stays disconnected, your account profile needs repair — File → Account Settings → Email → click your account → Repair.

### Outlook keeps prompting for password

You changed your password recently and Outlook still has the old cached one. File → Office Account → Sign out completely. Quit Outlook. Reopen → sign in with new password. If it prompts immediately again, the Windows credential cache is bad — Control Panel → Credential Manager → Windows Credentials → delete every entry starting with "Outlook" or "MicrosoftOffice" → restart Outlook fresh. If still prompting after that, your account is locked (5+ failed attempts) — wait 15 minutes or call IT.

### Stuck email won't even delete from Outbox

Outlook is mid-send-attempt and has the email locked. Force the lock release: File → Work Offline → ON. Now Outbox is editable. Right-click stuck email → move to Drafts OR delete. Toggle Work Offline OFF. Send the fixed version from Drafts.

### Error 0x8004210b — operation timed out

Network is slow or antivirus is scanning outbound mail. Test: open a browser, load any heavy site (youtube.com). Does it load fast? If no, fix your internet. If yes, temporarily disable antivirus and try send — if it works, antivirus's email scanner is the problem. Re-enable AV, add Outlook to exclusions in the AV settings.

### Whole team can't send today

Not a you-problem. Check status.office.com for an Exchange Online incident. If service health shows orange/red, wait. If service health is green and only you/your team is affected, that's L2 — your tenant's mail flow rule or recent migration is the cause.

### When to escalate to L2

You've tried Work Offline toggle, restart, password re-sign-in, and the email is under 25 MB → L2 takes it. Also: any error code starting with "550 5.7" (transport authorization failed), profile rebuild not solving it, or send works internally but external bounces with SPF/DKIM error.
