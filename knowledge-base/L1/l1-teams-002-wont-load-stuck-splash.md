---
id: l1-teams-002
title: "Microsoft Teams won't load / stuck on splash screen"
category: teams
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - teams won't load
  - teams stuck
  - white screen
  - splash screen
  - teams crashes
  - teams won't sign in
  - new teams not opening
related_articles:
  - l1-teams-001
  - l1-m365-001
escalation_trigger: "Reinstall fails, Teams admin center reports incident, or all users on tenant unable to load"
last_updated: 2026-05-07
version: 1.0
---

# Teams won't load / stuck on splash screen

## 1. Symptoms
- Teams shows logo/splash and never progresses to inbox.
- White screen on launch.
- "We're sorry — we've run into an issue" with retry button looping.
- Teams immediately closes after launch.
- Sign-in succeeds in browser but desktop app fails.

## 2. Likely Causes
1. Corrupted Teams cache.
2. Stale credential from previous session.
3. Windows network stack glitch (DNS, proxy).
4. Conflicting Teams installations (Classic + New).
5. Outdated Teams build with known crash bug.
6. Antivirus / endpoint agent blocking Teams.
7. Service-side outage (status.office.com).

## 3. Questions To Ask User
1. Does it stop on the very first splash, or after the loading bar?
2. Can you sign in to teams.microsoft.com in a browser?
3. Did this start today suddenly, or has it been worsening?
4. Is this New Teams (purple icon, "Microsoft Teams") or Classic (blue with white people icon)?
5. Have you installed antivirus or VPN software recently?

## 4. Troubleshooting Steps
1. Quit Teams fully — right-click tray icon → Quit. Then verify Task Manager shows no `Teams.exe` / `ms-teams.exe`.
2. Restart PC.
3. Check service health: https://portal.office.com/servicestatus (or admin posts on social).
4. Try teams.microsoft.com in a private browser window — confirms server-side OK.

## 5. Resolution Steps
**Cache clear (most common fix):**
- New Teams: close → File Explorer → `%localappdata%\Packages\MSTeams_8wekyb3d8bbwe\LocalCache` → delete contents → relaunch.
- Classic Teams: close → `%appdata%\Microsoft\Teams\` → delete contents (or just `Cache`, `Code Cache`, `Local Storage`, `IndexedDB`).

**Credential clear:**
- Control Panel → Credential Manager → Windows Credentials → remove `msteams_*` and `MicrosoftAccount:user=*` (related entries) → relaunch Teams.

**Reinstall:**
- Settings → Apps → Installed apps → uninstall both "Microsoft Teams" and "Microsoft Teams (work or school)" if both present.
- Also remove `%localappdata%\Microsoft\Teams\` folder.
- Reinstall: New Teams via Microsoft Store, or via M365 admin pushed app, or https://teams.microsoft.com/downloads.

**Antivirus check:**
- Temporarily allow Teams in security software (whitelisting `Teams.exe` and the Microsoft Store ms-teams package).
- Re-enable AV after testing.

## 6. Verification Steps
- Teams loads to chats list within 30 seconds.
- Presence shows correct status (green/Available).
- Test call works (Settings → Devices → Make a test call).
- Send test message in a chat and receive.

## 7. Escalation Trigger
- Cache clear + reinstall fails to resolve.
- Office service status page shows Teams incident.
- Pattern across multiple users in same office/tenant.
- Endpoint protection blocking Teams cannot be bypassed without admin override.
- → Escalate to **L2** with: Teams version, OS build, screenshot of failure point, log file from `%appdata%\Microsoft\Teams\logs.txt` (Classic) or get-logs export (New).

## 8. Prevention Tips
- Don't run Classic + New Teams concurrently on same login during a transition — uninstall the one you don't need.
- Restart Teams weekly to clear memory leaks.
- Allow Teams updates to install automatically.
- Don't store Teams cache on a synced location (OneDrive home folder); causes corruption.
- For locked-down environments, ensure firewall allows `*.teams.microsoft.com`, `*.microsoft.com`, and Microsoft 365 endpoints.

## 9. User-Friendly Explanation
"Teams gets confused if its memory of past sessions gets corrupted. We'll wipe that little stash, sign you in fresh, and it almost always opens straight up. If a bigger fix is needed we'll reinstall the app. Should be done in a few minutes."

## 10. Internal Technician Notes
- New Teams = MSIX from Store; Classic = Squirrel-based. Different uninstall paths matter.
- Classic crash logs: `%appdata%\Microsoft\Teams\logs.txt` (rolling).
- New Teams logs: Settings → About → Get logs (or `Ctrl+Alt+Shift+1` keyboard shortcut to upload).
- For Citrix/VDI environments, Teams optimization pack must match (Classic VDI optimizer ≠ New Teams VDI). Confirm with Citrix HDX policy.
- DNS issue diagnostic: `nslookup teams.microsoft.com` and `Resolve-DnsName *.teams.microsoft.com`.
- For corporate proxy with TLS inspection, often the cert chain breaks Teams; whitelist the Microsoft cert pin.

## 11. Related KB Articles
- l1-teams-001 — Teams audio not working
- l1-m365-001 — Can't sign in to M365

## 12. Keywords / Search Tags
teams won't load, teams stuck, white screen, splash screen, teams crashes, teams won't sign in, new teams not opening
