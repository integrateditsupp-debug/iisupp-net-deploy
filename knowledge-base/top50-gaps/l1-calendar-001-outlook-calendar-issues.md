---
id: l1-calendar-001
title: "Outlook calendar problems — meetings missing, double-booked, won't sync"
category: outlook
support_level: L1
severity: medium
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - outlook calendar
  - calendar
  - meeting missing
  - meeting disappeared
  - double booked
  - calendar sync
  - shared calendar
  - calendar permissions
  - delegate
  - free busy
  - free/busy
  - room calendar
  - resource calendar
  - calendar invite
  - .ics
related_articles:
  - l1-outlook-001-not-receiving-emails
  - l1-outlook-002-cant-send-emails
  - l1-calendar-002-out-of-office-setup
escalation_trigger: "Calendar shows different events on different devices for the same account AND clearing cache + rebuild profile doesn't fix → Exchange Online sync issue, L2 to check mailbox database / repair calendar."
last_updated: 2026-05-12
version: 1.0
---

# Outlook calendar problems — meetings missing, double-booked, won't sync

## 1. Symptoms
- Meeting that was on calendar yesterday is gone today.
- Meeting shows on phone but not laptop (or vice versa).
- You accepted a meeting but the organizer says you didn't.
- Free/busy shows you as busy when you're not (or free when you're busy).
- Shared calendar doesn't update.
- Room or resource calendar shows wrong info.

## 2. Step-by-Step Triage

### Step 1 — Check the calendar on Outlook on the Web
- Open a browser → `https://outlook.office.com` → sign in → click Calendar icon.
- This is the source of truth. If meeting EXISTS in web but NOT on your phone / desktop → device sync issue. If meeting DOESN'T EXIST in web either → it was deleted (by you or someone with permission, or rule auto-processed it).

### Step 2 — Devices not syncing fix

**Outlook Desktop (Win/Mac):**
1. File → Account Settings → Account Settings → click your account → Repair.
2. Wait for repair to complete.
3. Restart Outlook.
4. If still missing: File → Account Settings → Account Settings → Data Files → check your `.ost` or `.olm` file location → close Outlook → rename the .ost (Win) or move .olm (Mac) → reopen Outlook → it rebuilds the cache from server.

**iPhone Outlook app:**
1. Settings (gear icon) → tap your account → Reset Account.
2. Confirm reset. Outlook downloads everything fresh.

**Android Outlook app:**
1. Tap your profile → Settings → tap your account → Reset Account.

### Step 3 — Missing or moved meeting?
- Check Outlook **Deleted Items** folder — calendar items can land there if a rule moves invitation emails.
- Outlook on the Web → Calendar → click the small icon at top of date → **All my calendars** → toggle each calendar on/off to see if it's just hidden.
- Look at meeting in question's Tracking tab: if you Declined accidentally, you can re-accept from the invite email (search Sent / Deleted).

### Step 4 — Double-booked? Check delegates
- File → Account Settings → Delegate Access (Win) or Tools → Accounts → Delegation (Mac).
- See if anyone has delegated access to your calendar — they may be accepting meetings on your behalf.
- Remove or restrict delegates as appropriate.

### Step 5 — Shared calendar not updating
- Right-click the shared calendar → Open in New Window → File → Account Settings → Account Settings → Data Files → ensure the shared calendar is set to download full details, not just headers.
- For Outlook Desktop: File → Options → Advanced → "Send / Receive" → Send/Receive Groups → check that shared mailboxes update on the same schedule.
- If still stale: remove the shared calendar (right-click → Delete Calendar → Don't delete underlying data) → re-add via "Open Shared Calendar."

### Step 6 — Free / Busy wrong
- Microsoft 365 calendar visibility is set per-user. If others see you as always "Free" or "No Information": Outlook on the Web → Settings → Calendar → Shared calendars → "Publish a calendar" → set visibility level.
- For "Busy" when you're free: check for stuck/recurring meetings far in the future.

### Step 7 — Room / resource calendar wrong
- Resource calendars are owned by IT. If a room is showing wrong availability, it's a back-end issue.
- Self-serve check: book a test meeting in the room from your own calendar → wait 1 min → look at the room's calendar → should appear. If not, IT needs to investigate.

## 3. Verification Steps
- Calendar shows same events on web, desktop, and mobile.
- Free / busy displays correctly to coworkers (test by creating a draft meeting and looking at the Scheduling Assistant).
- Shared calendar reflects recent changes within 5 minutes.

## 4. When to Call IT
- Calendar repairs / rebuilds don't restore missing meetings.
- Mailbox is showing different event sets on different devices that won't reconcile.
- Resource (room / equipment) calendars show wrong availability.
- "Items cannot be displayed" errors with all repair attempts exhausted.

## 5. Prevention Tips
- **Accept all meetings from the invite email.** Don't drag-drop meetings from email to calendar — creates duplicates.
- **Use Outlook on the Web** as the source of truth if devices disagree.
- **Check delegate access quarterly** — old delegates should be removed.
- **Don't share your calendar with "All Details"** to large distribution lists. "Limited Details" or "Availability Only" for most people.

## 6. User-Friendly Explanation
First, check Outlook on the web at outlook.office.com — that's the source of truth. If it shows what you expect, your phone or desktop isn't syncing — reset the account on that device. If it doesn't show what you expect either, the meeting was deleted or moved. We can usually recover it from Deleted Items. If multiple devices show different things and won't agree, we may need IT to repair the back-end calendar.

## 7. Internal Technician Notes
- Outlook Desktop / .ost cache rebuild: Outlook → Cancel sync → close → rename .ost in `%LocalAppData%\Microsoft\Outlook\` → reopen Outlook → resync.
- Outlook for Mac / .olm: Outlook → Preferences → Accounts → click account → "Allow this account to deliver mail and reminders" toggle (off, then back on).
- Calendar repair via cmdlet (PowerShell + Exchange Online Management module): `New-MailboxRepairRequest -Identity user@company.com -CorruptionType ProvisionedFolder,SearchFolder,AggregateCounts,FolderView`
- Stuck meeting cleanup: Folder pane → right-click → Properties → Repair (deprecated in newer Outlook). Newer: server-side via mailbox repair.
- Free/Busy info served by Outlook Address Book + Exchange Web Services (EWS) calls. EWS calls cached for 15 minutes per default.
- iOS Outlook reset wipes local cache. Account creds remain.

## 8. Related KB Articles
- `l1-outlook-001` — Outlook not receiving emails
- `l1-outlook-002` — Outlook can't send emails
- `l1-calendar-002` — Out-of-Office setup

## 9. Keywords / Search Tags
outlook calendar, calendar, meeting missing, meeting disappeared, double booked, calendar sync, shared calendar, calendar permissions, delegate, free busy, free/busy, room calendar, resource calendar, calendar invite, .ics, .ost rebuild, .olm
