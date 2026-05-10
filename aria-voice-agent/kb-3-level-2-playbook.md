# KB-3 — Level-2 Playbook (try once, escalate if no fix in ~5 min)

ARIA tries the first fix. If that doesn't work in one round, she stops and offers the warm transfer. Never fight an L2 issue for more than five minutes — Ahmad's time is more valuable to the customer than ARIA's persistence.

---

## L2-01 · Wi-Fi keeps dropping intermittently
**Triage:** "Does it drop on a schedule, or random? And does anything else trigger it — printer, microwave, time of day?"
**First try:** Forget the network and rejoin. Update wifi driver via Device Manager. Switch to 5 GHz band if dual-band. Move closer to the router as a test.
**Escalate if:** Pattern persists after driver update. Possible router firmware, channel interference, or ISP issue.
**Sample line:** "Let me try one driver update — if that doesn't hold for the next ten minutes, this is Ahmad territory."

## L2-02 · VPN won't connect or drops
**First try:** Restart the VPN client. Try a different VPN server location. Check that the device clock is correct (VPNs hate clock skew). Disable IPv6 temporarily (some corporate VPNs block it).
**Escalate if:** Corporate VPN with custom config, or specific apps failing through the tunnel.
**Sample line:** "Two minutes on this — if it doesn't grab, we hand it to Ahmad to look at the corporate config."

## L2-03 · OneDrive sync stuck / "still loading"
**First try:** Right-click OneDrive tray icon → Pause syncing → 2 hours, then Resume. If still stuck, sign out (right-click → Settings → Account → Unlink) and re-sign in. Check disk space.
**Escalate if:** Specific folders refuse to sync, or sync conflicts pile up.
**Sample line:** "OneDrive's pause-and-resume usually unjams it. If not, this is a deeper conflict — Ahmad's call."

## L2-04 · Slow internet on one device only
**First try:** Speed test on the slow device, then on a known-good device. Check for background updates (Windows Update, Steam, OneDrive). Restart the device.
**Escalate if:** Speed test shows 10x slower than other devices on same network — likely network adapter or driver issue.
**Sample line:** "Let me see if the device is fine but a background download is hogging it."

## L2-05 · Computer extremely slow (after L1 first-pass already tried)
**First try:** Check Task Manager → CPU/Memory/Disk tabs for a runaway process. Disable Superfetch service if disk is at 100%. Check disk health: `wmic diskdrive get status`.
**Escalate if:** Disk shows "Pred Fail" or runaway process is a system service.
**Sample line:** "Let's see what's eating the CPU. If it's a system process going wild, we'll loop in Ahmad."

## L2-06 · App crashes repeatedly on launch
**First try:** Reinstall the app fresh from the official source. Run as Administrator. Check Windows Event Viewer (eventvwr.msc) for the exact crash module.
**Escalate if:** Crash references a system DLL or stays after reinstall.
**Sample line:** "Clean reinstall first — if it still crashes, the Event Log will tell us why and that's Ahmad's read."

## L2-07 · Windows Update stuck / failed
**First try:** Settings → Windows Update → Pause + Resume. Run Windows Update Troubleshooter. Restart Windows Update service via Services.msc.
**Escalate if:** Update has been stuck for 24+ hours, or rollback loop, or BSOD on update.
**Sample line:** "Troubleshooter first. If it's been stuck for a day, this needs Ahmad's hands on it."

## L2-08 · BSOD (first-pass triage)
**First try:** Note the stop code (write it down — e.g., MEMORY_MANAGEMENT, IRQL_NOT_LESS_OR_EQUAL). Boot into Safe Mode. Check for recent Windows updates or driver installs.
**Escalate immediately if:** BSOD is recurring (more than once today) or stop code is hardware-related (WHEA_UNCORRECTABLE_ERROR, MACHINE_CHECK_EXCEPTION).
**Sample line:** "Read me the stop code — that tells us if this is a software fix or a hardware call."

## L2-09 · Mac kernel panic (first-pass triage)
**First try:** Boot into Safe Mode (hold Shift on startup for Intel Macs; for Apple Silicon, hold power → Options → Shift-click boot disk). Disconnect all peripherals.
**Escalate if:** Panic recurs in Safe Mode → likely hardware.
**Sample line:** "Let's boot into Safe Mode. If it still panics there, that's Ahmad — likely hardware."

## L2-10 · Email rules misfiring / mail going to wrong folder
**First try:** Outlook: File → Rules → review and disable rules one by one. Check Junk email settings.
**Escalate if:** Rules look correct but behavior is wrong, or shared mailbox involved.
**Sample line:** "Let's turn off rules one by one and find the culprit."

## L2-11 · Cannot access shared drive / SharePoint folder
**First try:** Sign out of Office and back in. Browser: clear cookies for sharepoint.com. Try the file in incognito.
**Escalate if:** Permissions error referencing AD/Entra group → Ahmad needs to fix at the tenant level.
**Sample line:** "Let me try the basic re-auth. If it's a permission denied, Ahmad needs to grant access."

## L2-12 · Permission denied accessing a file
**First try:** Right-click → Properties → Security tab → check current user has Read/Modify. Take ownership if owner is unknown (but warn — this is destructive on shared files).
**Escalate if:** It's on a corporate file server or NAS — don't touch ownership without Ahmad.
**Sample line:** "If this is on a shared drive, I'm not going to touch ownership — Ahmad takes that one."

## L2-13 · Outlook calendar not syncing
**First try:** Send/Receive → Send/Receive All Folders. Toggle calendar sharing off + on. Check delegate access settings.
**Escalate if:** Shared/delegated calendar with multiple users affected.
**Sample line:** "Let me force a sync. If it's a shared calendar, that gets escalated."

## L2-14 · Printer prints garbled or wrong colors
**First try:** Replace cartridge / toner. Print a self-test page from the printer's own menu (not from Windows). Update printer driver.
**Escalate if:** Self-test page also looks wrong → hardware issue.
**Sample line:** "Print a test page from the printer's own menu — if that's also garbled, the printer is the problem."

## L2-15 · Mac slow after macOS update
**First try:** Restart twice (first restart triggers re-indexing, second one settles). Check Activity Monitor for runaway process. Free up disk to >15%.
**Escalate if:** Spotlight reindexing has been running for 24+ hours or kernel_task pinned at 200%+ CPU.
**Sample line:** "Restart twice — first one rebuilds indexes, second one is the real performance read."

## L2-16 · iPhone or iCloud backup stuck
**First try:** Force quit Settings app. Toggle iCloud Drive off + on. Confirm enough iCloud storage. Try over wifi (cellular backups fail more often).
**Escalate if:** Repeated failures with paid iCloud storage available.
**Sample line:** "Most stuck backups are storage-full or wifi-flaky. Let's check both."

## L2-17 · Domain-joined PC won't authenticate
**First try:** Try logging in while connected to corporate VPN (sometimes needed to refresh AD ticket).
**Escalate immediately:** This is Ahmad's domain — pun intended. Don't try to rejoin domain without him.
**Sample line:** "Domain auth is firmly Ahmad's call — let me transfer you."

## L2-18 · App uninstall fails
**First try:** Run the app's official uninstaller from its install folder. Use Settings → Apps → Advanced uninstall. As last resort, Microsoft's official uninstaller troubleshooter.
**Escalate if:** Registry damage suspected — leave it for Ahmad.
**Sample line:** "Let me try the official uninstaller first. If registry's corrupted, Ahmad cleans that."

## L2-19 · SSD/HDD running out of space
**First try:** Disk Cleanup → System files → check Windows.old, Temp, Downloads. Storage Sense (Settings → System → Storage). Move large files to OneDrive or external drive.
**Escalate if:** Disk is full and won't free up despite cleanup → could be shadow copies or system reserved space hogging.
**Sample line:** "Disk Cleanup first. If it's still tight, we look at shadow copies — that's Ahmad."

## L2-20 · Webcam works in some apps but not others (privacy permissions)
**First try:** Mac: System Settings → Privacy & Security → Camera → enable for the specific app. Windows: Settings → Privacy → Camera → "Allow apps to access" + per-app toggles. Restart the app.
**Escalate if:** Permission is enabled but app still fails — likely driver or app-specific bug.
**Sample line:** "Almost always a privacy toggle. Let me walk you to the right setting."
