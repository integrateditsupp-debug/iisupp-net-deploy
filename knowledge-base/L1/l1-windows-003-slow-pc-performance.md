---
id: l1-windows-003
title: "Computer running slow / performance lag"
category: performance
support_level: L1
severity: medium
estimated_time_minutes: 20
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: []
keywords:
  - slow computer
  - laggy
  - performance
  - high cpu
  - high memory
  - high disk usage
  - 100% disk
  - slow startup
  - takes forever to load
related_articles:
  - l2-performance-005
  - l2-malware-001
  - l1-windows-004
escalation_trigger: "Performance issue persists after L1 cleanup, or task manager shows 100% disk usage with no identifiable process"
last_updated: 2026-05-07
version: 1.0
---

# Computer running slow / performance lag

## 1. Symptoms
- Apps take 30+ seconds to open.
- Mouse and typing feel laggy.
- File Explorer takes a long time to populate folders.
- Boot to login takes >2 minutes.
- Fans spin up loudly even when idle.
- Task Manager shows CPU, memory, or disk at 90–100%.

## 2. Likely Causes
1. Too many startup apps consuming RAM and CPU.
2. Low free disk space (<10% on C:).
3. Background indexing (Windows Search, OneDrive sync, antivirus scan).
4. Outdated/conflicting drivers (especially storage and Wi-Fi).
5. Malware or PUP (potentially unwanted programs).
6. Failing storage drive.
7. Insufficient RAM for current workload.

## 3. Questions To Ask User
1. When did you first notice this — sudden, or gradual over weeks?
2. Is it slow always, or only with specific apps?
3. How much free space on the C: drive? (This PC → C: drive properties.)
4. How many browser tabs and apps do you typically have open?
5. When did you last restart your PC (not just close the lid)?
6. Have you installed anything new recently?

## 4. Troubleshooting Steps
1. **Reboot.** Not "close lid and re-open" — full Restart from Start menu. ~40% of cases resolve here.
2. Open Task Manager (Ctrl+Shift+Esc) → Processes tab → sort by CPU, then by Memory, then by Disk. Note top 3 in each.
3. Task Manager → Startup tab → disable any non-essential apps with "High" impact rating.
4. Settings → System → Storage → Cleanup recommendations → run.
5. Check C: drive free space — needs ≥15% free to perform normally.
6. Settings → Apps → Installed apps — look for unfamiliar entries, recent installs, or "search bar" / "browser helper" type apps.

## 5. Resolution Steps
**If startup is the issue:**
1. Disable: OneDrive (if not work-required at startup), Spotify, Teams (if not corporate-required), any chat clients, Adobe updaters.
2. Keep: Antivirus, security agents, OEM device manager, Microsoft 365 apps.

**If disk space is the issue:**
1. Storage Sense → On.
2. Empty Recycle Bin and Downloads folder.
3. Move large files (Videos, ISOs) to OneDrive / external.
4. Run Disk Cleanup as administrator → "Clean up system files" → Windows Update Cleanup, Previous Windows installations, Delivery Optimization Files.

**If a process is pegging CPU/disk:**
1. In Task Manager, right-click the process → Properties → check Publisher.
2. If unknown publisher and high resource use → suspect malware. Run Windows Defender full scan (Virus & threat protection → Scan options → Full scan).
3. If "Antimalware Service Executable" / `MsMpEng.exe` — wait, it's an active scan; will subside.
4. If "System" or `Ntoskrnl.exe` is high — likely driver issue, escalate.

## 6. Verification Steps
- After full restart, idle CPU <10%, idle memory <60% used.
- Boot to login screen <60 seconds.
- Office apps launch in <10 seconds.
- File Explorer opens folders instantly.
- 24 hours of use without slowdown report.

## 7. Escalation Trigger
- Task Manager shows 100% disk for >10 minutes with no identifiable process.
- Slowdown returns within hours of cleanup.
- "System Interrupts" process consuming >5% CPU consistently — driver issue.
- Defender scan finds threats it cannot quarantine.
- → Escalate to **L2** with: top processes, free disk space, output of `winsat formal -restart`, and any threat names found.

## 8. Prevention Tips
- Restart at least weekly — pending updates and memory leaks compound.
- Don't run more than ~15 browser tabs concurrently on 8GB RAM.
- Avoid "PC cleaner / optimizer" utilities — they cause more problems than they solve.
- Keep at least 20% of C: free.
- Uninstall apps you don't use; bloat is real.

## 9. User-Friendly Explanation
"Your PC is doing too many things at once, or it's running low on space. We'll clean up the apps that start automatically, free up some disk room, and check that nothing unwanted is using your CPU. After a quick restart you should feel a real difference. If it stays slow, that's a sign of something deeper and we'll get a tech to look."

## 10. Internal Technician Notes
- Resource Monitor (`resmon`) gives a finer picture than Task Manager — Disk tab shows per-file activity.
- High disk on Win10 was historically Superfetch / SysMain — usually fine to disable on SSD systems: `sc config sysmain start=disabled`.
- Windows Search indexing on rebuild can hammer disk for hours — let it finish overnight before judging.
- For laptops, also check Power Plan: Settings → System → Power → Best performance during diagnosis.
- For OEM laptops, vendor "support assistant" apps often install bloat — uninstall after asset capture.
- `winsat formal` regenerates the WEI — useful to compare against baseline after fix.

## 11. Related KB Articles
- l1-windows-004 — Disk cleanup and storage management
- l2-performance-005 — Diagnosing intermittent system instability
- l2-malware-001 — Malware triage and quarantine

## 12. Keywords / Search Tags
slow computer, laggy, performance, high cpu, high memory, 100% disk, slow startup, takes forever, sluggish, freezing, hangs
