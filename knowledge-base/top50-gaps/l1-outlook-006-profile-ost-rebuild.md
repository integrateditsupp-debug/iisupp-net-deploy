---
id: l1-outlook-006
title: "Outlook won't start — rebuild a corrupt profile or OST file"
category: outlook
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You know your Microsoft 365 / email sign-in", "Your mail lives on Exchange Online or Exchange (so the OST can be safely rebuilt from the server)"]
keywords:
  - cannot start microsoft outlook
  - cannot open the outlook window
  - the set of folders cannot be opened
  - outlook wont open
  - outlook keeps crashing on startup
  - rebuild outlook profile
  - recreate outlook profile
  - corrupt ost file
  - rebuild ost
  - new outlook profile
  - outlook safe mode
  - outlook needs repair
tags:
  - outlook
  - email
  - profile
  - top-50
related: [l1-outlook-001-not-receiving-emails, l1-outlook-005-password-prompt-loop, l1-office-001-repair-reinstall]
---

# Outlook won't start — rebuild a corrupt profile or OST file

## Symptoms
- "Cannot start Microsoft Outlook. Cannot open the Outlook window."
- "The set of folders cannot be opened."
- Outlook hangs on the "Loading Profile" / "Processing" splash and never opens.
- Outlook crashes within a few seconds of launch, every time.
- Search, folders, or the reading pane are blank or throw errors.

## Likely causes
- A corrupt local cache file (the OST) for a mailbox that syncs from the server.
- A damaged Outlook profile (the settings bundle, not the mailbox itself).
- A bad add-in loading at startup.
- A navigation-pane settings file that got corrupted.

## Safe steps (try in order — stop when Outlook opens)
- **Start in Safe Mode to rule out an add-in:**
  - Hold **Ctrl** and click the Outlook icon; keep holding until it asks "open in Safe Mode?" → **Yes**.
  - If it opens in Safe Mode, an add-in is the cause → File → Options → Add-ins → Manage: COM Add-ins → **Go** → untick recently added add-ins → reopen normally. (See the "re-enable / disable a disabled add-in" runbook.)
- **Reset the navigation pane (fixes "cannot open the Outlook window"):**
  - Fully quit Outlook (confirm no `outlook.exe` in Task Manager).
  - Press **Win + R**, type `outlook.exe /resetnavpane`, press Enter.
- **Repair the account profile:**
  - File → Account Settings → Account Settings → Email tab → select your account → **Repair** → follow the wizard → restart Outlook.
- **Rebuild the OST (safe because the mailbox stays on the server):**
  - This affects only the *local cache*. Nothing is deleted from the server — Outlook re-downloads a fresh copy.
  - Quit Outlook fully.
  - Press **Win + R**, paste `%localappdata%\Microsoft\Outlook`, press Enter.
  - Rename the `.ost` file (e.g., add `.old` to the end) rather than deleting it, so there's a fallback.
  - Reopen Outlook — it builds a new OST and re-syncs from the server (large mailboxes can take a while).
- **Create a fresh Outlook profile (if repair didn't help):**
  - Close Outlook.
  - Control Panel → **Mail (Microsoft Outlook)** → Show Profiles → **Add** → name it (e.g., `New`) → add your email account → set the new profile as default → reopen Outlook.

## Verify
- Outlook opens straight to the inbox without the splash hanging.
- Folders, search, and the reading pane all load.
- New mail arrives and sends normally.

## When to escalate (to L2 / IT)
- Repair, `/resetnavpane`, a rebuilt OST, and a new profile all fail.
- The mailbox is on-premises Exchange or POP/IMAP where the local data file (PST) is the *only* copy — do **not** rename/delete a PST without a backup; hand this to IT.
- Multiple people in the office hit the same startup failure at once (possible server/tenant issue).

## Safety notes
- OST files are a local cache and are safe to rebuild for Exchange/M365 mailboxes. **PST files can be primary storage** — never delete one; escalate instead.
- These are guided, reversible steps (rename, don't delete; add, don't remove accounts). No system-level changes are required.

## What ARIA can help with
- ARIA can read the exact error text back to you and pick the right branch (add-in vs profile vs OST), and — with your confirmation — run the vetted, reversible OST-rebuild helper (`outlook-ost-repair-v1`, which closes Outlook, renames the OST, and relaunches). ARIA never touches a PST and never deletes mail from the server.
