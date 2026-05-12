---
id: l1-calendar-002
title: "Out-of-Office (Automatic Replies) — set up correctly for time away"
category: outlook
support_level: L1
severity: low
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - out of office
  - ooo
  - automatic replies
  - auto reply
  - away from desk
  - vacation
  - autoresponder
  - vacation responder
  - delegate
  - inbox rules
related_articles:
  - l1-calendar-001-outlook-calendar-issues
  - l1-outlook-001-not-receiving-emails
escalation_trigger: "User can't set OOO because the option is greyed out in all interfaces — likely admin policy blocking. Escalate to L2 for tenant config check."
last_updated: 2026-05-12
version: 1.0
---

# Out-of-Office (Automatic Replies) — set up correctly for time away

## 1. Symptoms
User going on vacation / leave / travel. Wants Outlook to auto-reply to incoming emails with an away message + redirect urgent contacts.

## 2. Step-by-Step Setup — Microsoft 365 / Exchange Online

### Best path: Outlook on the Web (works everywhere, syncs to all devices)

**Step 1 — Open Outlook on the Web.**
- Browser → `https://outlook.office.com` → sign in.

**Step 2 — Open Settings.**
- Click the **gear icon** (top right) → click **View all Outlook settings** at the bottom of the side panel.
- *(What you should see: A settings panel slides in. If it shows just a few options, click "View all" at the bottom.)*

**Step 3 — Navigate to Automatic Replies.**
- Left pane: **Mail** → **Automatic replies**.

**Step 4 — Toggle ON.**
- Click **Turn on automatic replies**.

**Step 5 — Set time range (optional but recommended).**
- Check **Send replies only during a time period**.
- Pick start date and end date.
- *(Why: ensures OOO turns OFF automatically when you return. People hate "OOO until further notice" replies coming back in March.)*

**Step 6 — Compose the internal reply (people in your org).**
- Write a clear message. Example:
  - *Hello, I'm out of the office from [start] to [end]. For urgent matters please contact [colleague name] at [email]. Otherwise I'll respond when I'm back.*
- Keep it short — most people just need to know you're away and when you're back.

**Step 7 — Compose the external reply (optional).**
- Toggle **Send replies outside your organization**.
- Decide: All external senders or only contacts.
- Write a slightly shorter external version (less personal info, no internal phone numbers).

**Step 8 — Save.**
- Click **Save**.
- *(What you should see: A confirmation toast "Automatic replies are turned on" and the toggle stays green.)*

### Outlook Desktop (Win/Mac) — alternative path

**Win:**
1. File → Automatic Replies.
2. Select "Send automatic replies."
3. Set date range, internal message, external message.
4. OK.

**Mac:**
1. Tools menu → Automatic Replies.
2. Same fields.

### Mobile Outlook (iOS / Android)

1. Profile (top-left) → **Settings** (gear).
2. Tap your account → **Automatic Replies**.
3. Toggle on → set dates + message.
4. Save.

## 3. Common OOO Mistakes

- **No end date.** Set one. Avoid "OOO until further notice" sticking forever.
- **No urgent contact.** Always give an alternate human or team.
- **Too much detail externally.** Don't tell strangers exactly when your house will be empty.
- **Internal jargon in external version.** Write external version in plain language.
- **Auto-forwarding to personal email.** Common bad pattern — defeats company security. Use a colleague instead.

## 4. Verification Steps
- Send yourself a test email from a personal Gmail / iCloud account.
- You should receive the external auto-reply within 1-2 minutes.
- Send from another work email (a coworker can help) — you should receive the internal version.
- Bonus: open Outlook → confirm the orange OOO banner appears at the top of your mailbox.

## 5. Additional Coverage (for longer absences)

For longer than ~5 days, set up these in addition to OOO:

1. **Calendar block.** Block your calendar from start to end as "Out of Office" (not "Busy") so meetings auto-decline / route to delegates.
2. **Delegate.** Outlook Web → Settings → General → Delegation → add a delegate. Choose: Send on my behalf only OR Send as me.
3. **Slack / Teams status.** Set the matching away status with same dates in Slack and Teams.
4. **Phone voicemail.** Update voicemail greeting.
5. **Calendar handoff.** Send a heads-up to your top 5-10 frequent collaborators.

## 6. When to Call IT
- The OOO option is greyed out / not available → admin policy blocking. IT must enable in tenant config.
- Auto-reply not actually sending to external senders → check tenant's anti-spam outbound rules (admin level).
- OOO sending duplicate replies to the same person — rare bug, IT to repair mailbox.

## 7. Prevention Tips
- **Set OOO BEFORE you leave**, not from the airport.
- **Test it before leaving.** Send yourself a test from a personal account.
- **Use the time range feature** so it auto-disables.

## 8. User-Friendly Explanation
Go to outlook.office.com → click the gear icon → search for "Automatic replies" → toggle it on → set start and end dates → write your message → save. Test it by sending yourself an email from your personal account. The internal version is for coworkers, the external version is for everyone outside the company. Always include an end date and a backup contact.

## 9. Internal Technician Notes
- OOO state stored in mailbox as `OOFConfig` MAPI property + retrieved via EWS / Graph.
- Admin tenant policy: Exchange Admin Center → Mail flow → Remote domains → can disable external OOO globally.
- For shared mailbox OOO: only the primary delegate with Full Access + Send As can set OOO from web; alternate path is PowerShell `Set-MailboxAutoReplyConfiguration` (Exchange Online Management module).
- Group / distribution list mailboxes have no OOO (they're not mailboxes).
- OOO de-duplication: Exchange Online suppresses sending the same OOO message to the same sender within a 24-hour window per default.
- Mobile Outlook OOO writes through Graph API → identical to web behavior.

## 10. Related KB Articles
- `l1-calendar-001` — Outlook calendar issues
- `l1-outlook-001` — Outlook not receiving emails

## 11. Keywords / Search Tags
out of office, ooo, automatic replies, auto reply, away message, vacation responder, autoresponder, delegate, time off, leave, vacation, holiday
