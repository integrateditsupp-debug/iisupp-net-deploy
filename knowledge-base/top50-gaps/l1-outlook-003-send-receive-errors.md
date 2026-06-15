---
id: l1-outlook-003
title: "Outlook send/receive errors — stuck Outbox, can't connect, sync paused"
category: outlook
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Outlook installed and signed in"]
keywords:
  - outlook stuck outbox
  - outlook cant connect
  - outlook offline
  - email wont send
  - 0x8004210b
  - 0x800ccc0e
  - cannot connect to server
  - send receive error
  - outlook disconnected
  - new outlook sync paused
tags:
  - outlook
  - email
  - sync
  - top-50
related: [l1-outlook-001-not-receiving-emails, l1-outlook-002-cant-send-emails, l1-m365-001-cant-sign-in, l1-password-002-locked-after-change]
---

# Outlook send/receive errors — get email flowing again

## Symptoms

- Email sitting in Outbox, never sends
- "Outlook is disconnected" at bottom-right of window
- "Cannot connect to server" error
- Send/Receive Status bar shows red X or "Failed"
- New Outlook shows "Sync paused" or never updates
- Specific error codes: 0x8004210b, 0x800ccc0e, 0x80040115, "needs password"

## Step 1 — Check the obvious

1. **Are you actually online?** Open a browser. Load any website. If browser also fails → Wi-Fi / Ethernet issue, fix that first.
2. **Is Outlook offline mode on accidentally?** Send/Receive tab → check **Work Offline** button. If highlighted, click to turn off.
3. **Restart Outlook.** Yes really. Resolves 30% of these.

## Step 2 — Check Microsoft 365 service health

If everything looks fine on your end, M365 might be having an outage.

- Visit https://portal.office.com/servicestatus (sign-in required) or https://status.office.com.
- Look for Exchange Online incidents.
- If there's a current incident: wait. Don't troubleshoot further. Microsoft fixes within hours typically.

## Step 3 — Stuck Outbox (most common)

The email is in your Outbox and won't go out.

### Why it gets stuck
- Attachment too large (most M365 tenants cap at 25 MB).
- Recipient address invalid.
- Outlook profile auth expired (silent — no obvious password prompt).

### Fix
1. Click the **Outbox** folder in Outlook's folder pane.
2. Open the stuck email.
3. Check:
   - Recipient address (typo? Spaces?)
   - Attachment size (right-click attachment → see size). If > 25 MB → use OneDrive link instead: drag the file to OneDrive, share, paste link.
4. Hit **Send** again.
5. Watch the Outbox — does the email show as italic-pending? If so, click **Send/Receive All Folders** to push.
6. If it stays stuck: delete (or save as draft), restart Outlook, retry.

### "It's stuck and won't even delete from Outbox"
- File → Work Offline → toggle offline mode.
- Now Outbox is editable. Right-click stuck email → Delete (or move to Drafts).
- Toggle Work Offline back off.
- Send/Receive.

## Step 4 — "Cannot connect to server" / disconnected

### Classic Outlook (Windows)
1. File → Account Settings → Account Settings.
2. Pick your account → **Repair**.
3. Follow prompts. Usually fixes 70% of connection issues.

### If repair fails
1. Same Account Settings → Pick account → **Change** → **More Settings**.
2. Advanced tab → confirm you're using Exchange (not POP/IMAP) for M365.
3. Security tab → "Logon network security" → **Anonymous Authentication** (for modern Exchange Online).
4. OK → Test Account Settings.

### New Outlook (Windows)
1. Settings (gear) → Accounts → click your account → Remove.
2. Add it back fresh.
3. Sign in with your work email.
4. Wait for initial sync (5-10 min for big mailboxes).

### macOS Outlook
- Outlook (top menu) → Preferences → Accounts → click account → **Advanced** → Server tab.
- Verify outlook.office365.com is the server (for M365 accounts).
- Save → restart Outlook.

## Step 5 — "Outlook needs your password" repeatedly

If Outlook keeps asking for password every few minutes:

### Most likely — you changed your password
See `l1-password-002-locked-after-change`. Outlook is using the old password. Sign out + sign back in via Account Settings.

### Or — MFA token expired
1. Open a browser → go to office.com → sign in fresh.
2. Complete MFA.
3. Return to Outlook → it should reconnect using the refreshed token.

### Or — corrupted Windows credential cache
1. Close Outlook.
2. Win+R → `control /name Microsoft.CredentialManager` → Enter.
3. Look for entries containing "MicrosoftOffice", "Outlook", or your email.
4. Delete each one.
5. Reopen Outlook. It'll prompt for fresh sign-in.

## Step 6 — Specific error codes

### 0x8004210b — Operation timed out
- Slow internet, server unreachable, or antivirus blocking.
- Temporarily disable antivirus → test send.
- Or restart router.

### 0x800ccc0e — Cannot connect to server (POP/IMAP)
- Server settings wrong. Check vendor's recommended settings.
- For M365 users: you should be on Exchange, not POP/IMAP. Migrate the account profile.

### 0x80040115 — Logon failure / mailbox unavailable
- Account is being moved on Exchange Online side.
- Wait 15-30 minutes, try again. Usually self-resolves.

### "We're not able to schedule the meeting" (calendar-specific)
- Calendar Connector issue with Teams. Restart Teams + Outlook.

## Step 7 — Profile rebuild (last resort)

If nothing above works, the Outlook profile may be corrupt.

### Classic Outlook (Windows)
1. Close Outlook.
2. Control Panel → Mail (32-bit) → Show Profiles.
3. Add → name it "New Profile" → set up your account.
4. Set "When starting Microsoft Outlook, use this profile" → "Prompt for a profile to be used."
5. Open Outlook → pick New Profile.
6. If it works smoothly, you can delete the old profile.

### macOS
- /Applications/Outlook → Right-click → Show Package Contents → not the answer here.
- Simpler: Library → Group Containers → UBF8T346G9.Office → Outlook → delete the profile data folder.
- Reopen Outlook → set up from scratch.

⚠️ Local-only data (drafts, custom views, signatures) is lost on profile rebuild. Server data is fine.

## Specific scenarios

### "Outlook stuck on splash screen, never opens"
See `l1-teams-002-wont-load-stuck-splash` for similar diagnostics. Try `outlook.exe /safe` to skip add-ins.

### "Big mailbox — never finishes initial sync"
- Settings → Account Settings → Email → click account → Change → use the slider to set "Mail to keep offline" to a shorter range (e.g., 3 months instead of 1 year).
- Online-only mode (Outlook = thin client) loads faster on big mailboxes.

### "Email sent but recipient says they never got it"
- Check Outlook → Sent Items. Is it actually there?
- If yes — possibly stuck in their spam / quarantine.
- If no — your send didn't complete; investigate Outbox.

### "Teams meeting invite from Outlook doesn't show as Teams meeting"
- Teams add-in for Outlook may be disabled. File → Options → Add-ins → COM Add-ins → enable Microsoft Teams Meeting Add-in.

## When to escalate

| Situation | Path |
|---|---|
| Account-level issue (mailbox unavailable, exchange error) | L2 — Exchange admin |
| Profile rebuild didn't help | L2 — possibly OST file corruption, may need full reset |
| Multiple users in your org report same issue today | L2 — service health, mail flow rules |
| Send works internally but external emails bounce | L2 — DKIM / SPF / DMARC configuration |
| Encrypted email won't decrypt | L2 — certificates / Outlook S/MIME |

## Prevention

- Use OneDrive links for attachments > 10 MB.
- Keep Outlook updated. Most send/receive bugs are fixed in next patch.
- Don't switch between online and cached mode often — pick one.
- After password changes, immediately repair the Outlook account profile.

## What ARIA can help with

ARIA can identify the specific error code from your screenshot, walk you through repair → reset → rebuild in order, and tell you when to give up and call IT vs keep trying. ARIA cannot rebuild your Outlook profile remotely.
