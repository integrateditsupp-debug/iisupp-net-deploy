---
id: l1-calendar-003
title: "Meeting invites missing, duplicating, or showing on wrong calendar"
category: calendar
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android", "Web"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Outlook / Calendar app installed and signed in"]
keywords:
  - meeting invite missing
  - cant find calendar event
  - duplicate meeting
  - event shows twice
  - meeting on wrong calendar
  - shared calendar issue
  - declined invite still appears
  - outlook calendar not syncing
  - teams meeting in outlook calendar
  - recurring meeting wrong
tags:
  - calendar
  - outlook
  - meetings
  - top-50
related: [l1-calendar-001-outlook-calendar-issues, l1-calendar-002-out-of-office-setup, l1-outlook-001-not-receiving-emails]
---

# Meeting invites missing, duplicating, or on wrong calendar — fix

## Symptoms

- Colleague says "I sent the invite" — you never see it
- Same meeting appears twice in your calendar
- Recurring meeting shows on some days but not others
- Meeting on your personal calendar instead of work
- Declined a meeting but it still appears on your calendar
- Outlook on phone shows event, desktop doesn't (or vice versa)
- Shared/team calendar event missing for one person, visible for others

Most calendar issues fall into 4 root causes. Identify which → fix.

## Root cause 1 — Invite went to a different folder

### "I never got the invite"
Check (in this order):
1. **Junk / Spam folder.** Many corporate filters mis-classify meeting invites, especially from external senders.
2. **Other inbox folder.** Rules may have moved it. Outlook → search the sender's name.
3. **Conference room calendar** (if the meeting room is the organizer). Sometimes Teams meetings invite the room, not you.
4. **Wrong email address.** Did the sender use your old address? Check "To:" line if you find the invite.

**Fix:** ask the sender to re-send. Or check the org's distribution list — you may have been removed.

### "Outlook doesn't show it, but I see the invite in email"
The invite landed but wasn't processed. Could be:
- You're on Outlook mobile that's out of sync — pull to refresh.
- Outlook desktop is offline — File → Account Info → check connection status.
- The .ics attachment is corrupt — ask sender to re-send.

## Root cause 2 — Duplicate events

### Common reasons
1. **Imported a calendar twice.** Common when migrating between systems.
2. **Multiple email clients syncing the same calendar.** iCloud + Outlook + Google all subscribed to the same work calendar.
3. **iCloud showing your work calendar via subscription.**
4. **Teams meeting + Outlook meeting + Calendar app all displaying the same event.**

### Fix — find the duplicate source

**On iPhone:**
1. Settings → Calendar → Accounts.
2. Look at each account — is your work calendar showing up under both iCloud AND your Exchange account?
3. Turn off "Calendars" sync on one of them.
4. Restart Calendar app — duplicates should clear.

**On Outlook desktop:**
1. View → Folder Pane → Folder List.
2. Look at the calendar folders — duplicates often hide under multiple account groups.
3. Right-click the duplicate → "Remove from view" (doesn't delete, just hides).

**On macOS Calendar:**
1. Calendar → Settings → Accounts.
2. Each account has calendar checkboxes. Uncheck the duplicate source.

### "Same meeting shows at different times"
Time zone issue. Check:
- Outlook → File → Options → Calendar → Time zones — confirm your zone is correct.
- iPhone: Settings → General → Date & Time → "Set Automatically" ON.

## Root cause 3 — Shared calendar / delegate issue

### "Boss's calendar isn't showing"
1. Outlook → File → Open & Export → Other User's Folder → type their email → Calendar.
2. Or right-click "My Calendars" → Add Calendar → From Address Book.
3. Permissions: they need to share with you. Ask them: "Right-click your calendar → Sharing Permissions → add me with Reviewer or Editor access."

### "I'm a delegate but can't accept invites for them"
Delegate permissions need to be set up on the BOSS's account, not yours:
- Boss's Outlook → File → Account Settings → Delegate Access → Add → you → Set permissions.
- Then in your Outlook: invite arrives → accept → boss's calendar updates.

## Root cause 4 — Recurring meeting weirdness

### "Recurring meeting shows on most days but not all"
Likely: organizer modified a single instance and the modification deleted that occurrence.
- Look in email for "Updated meeting" or "Canceled meeting" from organizer.
- Or recurring meeting hit its end date.

### "I declined one instance, but the whole series disappeared"
This used to happen — declining a single instance sometimes deleted the series. Modern Outlook handles it correctly. If your Outlook is old, update.

### "Recurring meeting moved by 1 hour after DST"
Time zone of organizer ≠ time zone of meeting. Fix: organizer needs to recreate the series with explicit time zone. Annoying but standard issue.

## Specific scenarios

### "Calendar invite shows in Teams but not Outlook"
Teams calendar IS the Outlook calendar — they should always match. If they don't:
- Outlook is offline — File → Send/Receive → All Folders.
- Or your Outlook profile is out of sync. Restart Outlook. If still off, repair the profile (Control Panel → Mail → Profiles → Repair).

### "I declined but it still appears in my calendar"
You declined but didn't actually remove. By default, declined meetings stay on calendar for visibility.
- Outlook → File → Options → Calendar → "When I respond to a meeting request, delete the original message from my Inbox" — toggle.
- Or right-click the declined event → Delete.

### "Phone shows invite, laptop doesn't"
Almost always a sync lag. Force sync:
- Outlook: File → Send/Receive → All Folders.
- iPhone: pull-down refresh in Calendar app.
- Wait 60 seconds.

### "Meeting on personal Outlook calendar instead of work"
You accepted from your personal email. Sender sent to both. Accept from work email instead. Delete the personal-calendar event.

## When to escalate

| Situation | Path |
|---|---|
| Calendar entirely out of sync, not just one event | L1 — restart + force sync, then L2 if persists |
| Delegate permissions don't appear after setup | L2 — Exchange / Entra calendar permissions issue |
| Calendar disappears after Outlook update | L2 — profile repair |
| Recurring meetings constantly recreating themselves | L2 — possibly a corrupt event needs admin Powershell |
| Multiple users in same org report missing invites | L2 — Exchange transport rule or service issue |

## Prevention

- Use **one** calendar client per device — don't sync Outlook + iCloud + Google all to the same screen.
- Set your default account in Outlook to your work email.
- Don't accept invites from email previews — open the actual invite to make sure it adds to the right calendar.
- Keep your Outlook updated (especially mobile — old versions have known sync bugs).

## What ARIA can help with

ARIA can walk you through identifying which of the 4 root causes applies, navigating each fix step-by-step, and clarify whether the issue is sender-side or receiver-side. ARIA cannot accept invites on your behalf (that's an explicit user action).
