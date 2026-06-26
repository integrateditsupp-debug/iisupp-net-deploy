# Growth Library Product #4 — Windows 11 Troubleshooting KB
**Status:** DRAFT — awaiting Ahmad review before publishing
**Date:** 2026-06-26
**Price point:** $19–$79 (standalone) | bundle with M365 KB Pack at $99–$149
**Target buyer:** IT support technicians, IT teams, power users, MSPs
**Problem solved:** Common Windows 11 issues burn support time and frustrate end users
**Upsell:** IIS Managed IT / ARIA Sentinel ($70/mo Web tier or Sentinel tiers)

---

## AI-Readable Metadata Block

```json
{
  "product": "Windows 11 Troubleshooting KB",
  "version": "1.0",
  "author": "Integrated IT Support Inc.",
  "audience": ["IT support technicians", "MSP L1 agents", "power users", "SMB IT teams"],
  "topics": ["Windows 11", "desktop support", "L1 troubleshooting", "help desk"],
  "price_range": "$19–$79",
  "bundle": "M365 Help Desk KB Pack",
  "upsell_service": "IIS Managed IT / ARIA Sentinel",
  "intents": [
    "fix Windows 11 not starting",
    "resolve blue screen / BSOD",
    "fix Windows Update stuck",
    "resolve Wi-Fi not connecting",
    "fix printer not detected",
    "resolve slow performance",
    "fix Microsoft Store not working",
    "resolve Start menu broken",
    "fix audio not working",
    "resolve display driver crash",
    "fix OneDrive sync issues",
    "resolve Windows Hello not working",
    "fix BitLocker recovery key prompt",
    "resolve account sign-in loop",
    "fix app crashes / not launching"
  ]
}
```

---

## Chapter 1 — Who This Is For and How to Use It

This guide is for IT support technicians, MSP L1 agents, and technically capable power users who need fast, reliable answers to the most common Windows 11 issues. Each entry follows a consistent structure: symptom → quick confirm → root cause options → fix steps → escalation trigger.

**How to use:** Search by keyword (Ctrl+F on PDF, or use the JSON index for AI-assisted lookup). Each entry is self-contained — you do not need to read end to end.

**Scope:** Windows 11 Home and Pro, version 22H2 and 23H2. Enterprise-only features (e.g., AppLocker, WDAG) are flagged separately.

---

## Chapter 2 — Boot and Startup Issues

### 2.1 PC Won't Start / Black Screen After Power On

**Symptom:** Power light on, but screen stays black or shows a cursor only.

**Quick confirm:** Does any Windows logo appear? If no → hardware/BIOS level. If yes but loops → OS level.

**Root causes:**
- Display output going to wrong port (HDMI vs DisplayPort)
- Corrupted boot loader
- Failed Windows Update leaving bad driver
- RAM or GPU seating issue (after physical move)

**Fix steps:**
1. Force-shutdown (hold power 10 sec). Power on. Does Windows Recovery Environment (WinRE) appear?
2. If yes → Startup Repair → Automatic Repair.
3. If WinRE does not appear: boot from USB (Windows 11 ISO) → Repair your computer → Startup Repair.
4. If still fails: `bootrec /fixmbr` + `bootrec /fixboot` + `bootrec /rebuildbcd` from USB CMD.
5. Hardware angle: reseat RAM stick, try different display cable/port.

**Escalate when:** bootrec commands fail, drive not detected in BIOS, or POST beep codes present.

---

### 2.2 Windows Stuck in Restart Loop

**Symptom:** PC restarts repeatedly, never finishes booting.

**Root causes:**
- Bad Windows Update (KB patch)
- Corrupted system file
- Driver conflict (GPU, chipset, USB)

**Fix steps:**
1. Boot to WinRE (hold Shift + Restart, or F8/F11 at boot on some OEMs).
2. Troubleshoot → Advanced Options → Uninstall Updates → Uninstall latest quality update.
3. If that fails: System Restore to pre-update point.
4. Safe Mode boot: WinRE → Startup Settings → Enable Safe Mode with Networking. In safe mode run `sfc /scannow` then `DISM /Online /Cleanup-Image /RestoreHealth`.
5. Check Event Viewer (in Safe Mode) → Windows Logs → System → filter Critical errors for driver names.

**Escalate when:** all restore points gone, drive health failing (CrystalDiskInfo shows caution/bad), or BitLocker locks the drive in WinRE.

---

## Chapter 3 — Blue Screen (BSOD) Reference

### 3.1 Reading a BSOD

Windows 11 BSODs show a stop code and optionally a failing module. Always capture the stop code before rebooting.

**Common stop codes:**

| Code | Common Cause | First Fix |
|---|---|---|
| IRQL_NOT_LESS_OR_EQUAL | Driver accessing wrong memory | Update/roll back recent driver |
| MEMORY_MANAGEMENT | RAM issue or bad driver | Run Windows Memory Diagnostic |
| SYSTEM_SERVICE_EXCEPTION | Antivirus or system driver conflict | Boot safe mode, disable AV |
| CRITICAL_PROCESS_DIED | Core Windows process crashed | SFC + DISM |
| KERNEL_SECURITY_CHECK_FAILURE | Corrupted system file or RAM | SFC + DISM + MemTest86 |
| PAGE_FAULT_IN_NONPAGED_AREA | Faulty driver or failing RAM | Roll back driver + MemTest86 |
| DPC_WATCHDOG_VIOLATION | SSD firmware or driver issue | Update SSD firmware + chipset driver |
| WHEA_UNCORRECTABLE_ERROR | Hardware fault (CPU/GPU/RAM) | Check temps, reseat hardware |

### 3.2 Standard BSOD Fix Workflow

1. Note the stop code and any module name (e.g., `ntfs.sys`, `nvlddmkm.sys`).
2. Search the module name — it almost always points to the vendor (nvlddmkm = NVIDIA, ataport = storage, etc.).
3. Update or roll back that specific driver first.
4. Run `sfc /scannow` (elevated CMD).
5. Run `DISM /Online /Cleanup-Image /RestoreHealth`.
6. Run Windows Memory Diagnostic (mdsched.exe) — schedule overnight.
7. If recurring: download WhoCrashed or WinDbg to analyze the .dmp file in `C:\Windows\Minidump`.

**Escalate when:** MemTest86 shows errors (RAM replacement needed), WHEA errors point to CPU/motherboard, or BSODs continue after clean driver install.

---

## Chapter 4 — Windows Update Issues

### 4.1 Update Stuck at X% or Failing with Error Code

**Common error codes:**

| Code | Meaning | Fix |
|---|---|---|
| 0x80070005 | Access denied | Run Windows Update Troubleshooter; check permissions on SoftwareDistribution folder |
| 0x80070422 | Windows Update service disabled | Enable WUAUSERV in services.msc |
| 0x800705b4 | Timeout | Pause/resume update; check disk space |
| 0x8007000d | Corrupted update file | DISM RestoreHealth then retry |
| 0x80240034 | Update not applicable | Check Windows version compatibility |

**Universal fix sequence:**
1. Settings → Windows Update → Troubleshooter → Run.
2. If no fix: Stop WUAUSERV and BITS services → delete `C:\Windows\SoftwareDistribution\Download` contents → restart services → retry.
3. Run `DISM /Online /Cleanup-Image /RestoreHealth` then `sfc /scannow`.
4. Retry update. If a specific KB fails, download it manually from Microsoft Update Catalog (catalog.update.microsoft.com).

### 4.2 Update Causing New Problem (Roll Back)

1. Settings → Windows Update → Update History → Uninstall Updates.
2. Find the KB that matches the install date of the problem.
3. Uninstall. Restart.
4. To pause future delivery: Settings → Windows Update → Pause updates (up to 5 weeks).

---

## Chapter 5 — Network and Connectivity

### 5.1 Wi-Fi Not Connecting / No Internet

**Triage tree:**
- Is Wi-Fi adapter visible in Device Manager? No → driver missing or hardware disabled (Function key).
- Does the network appear in the list but won't connect? → WPA mismatch, wrong password, or DHCP failure.
- Connects but no internet? → DNS or gateway issue.

**Fix steps:**
1. `netsh winsock reset` + `netsh int ip reset` (elevated CMD). Restart.
2. `ipconfig /flushdns` + `ipconfig /release` + `ipconfig /renew`.
3. Forget the network and reconnect.
4. Try alternate DNS: set to 8.8.8.8 / 8.8.4.4 in adapter settings.
5. Update Wi-Fi driver from OEM site (not Windows Update — OEM drivers are more current).
6. Disable IPv6 on the adapter if router is older.

**Escalate when:** adapter not seen in Device Manager and hardware Wi-Fi toggle hasn't helped, or issue is company-managed network (need network admin).

### 5.2 Ethernet Connected But No Internet

1. Test with `ping 8.8.8.8` — if it works, DNS is the issue; set manual DNS.
2. If ping fails: test cable with another device. Check switch/router status.
3. `netsh winsock reset` + restart.
4. Check for proxy settings: Settings → Network → Proxy → ensure "Use a proxy server" is off (if not intentional).

---

## Chapter 6 — Peripheral and Hardware Issues

### 6.1 Printer Not Detected

1. Check Devices → Printers. If listed but offline: right-click → See what's printing → Use Printer Online.
2. Remove printer → Add printer (let Windows search).
3. Download driver directly from printer OEM (HP, Canon, Brother, Epson) — do not rely on Windows generic drivers for network printers.
4. For shared printers: verify the hosting PC is on and the share path is correct: `\\<hostname>\<printername>`.
5. Clear print spooler: Stop Spooler service → delete `C:\Windows\System32\spool\PRINTERS\*` → Start Spooler → retry.

### 6.2 Audio Not Working

1. Right-click speaker icon → Open Sound settings → check Output device is correct.
2. Update audio driver (Realtek / IDT / Conexant) from OEM site.
3. Run Audio Troubleshooter: Settings → System → Troubleshoot → Other troubleshooters → Playing Audio.
4. If HDMI audio: set HDMI audio device as default in Sound control panel → Playback tab.
5. Check Windows Audio service is running: services.msc → Windows Audio → Start.

### 6.3 Display / Monitor Issues

- Single monitor blank: check cable, try different port/cable, verify GPU driver is current.
- Second monitor not detected: Settings → System → Display → Detect. Update GPU driver.
- Resolution wrong after update: roll back display driver. Set resolution manually in Display settings.
- Flickering: update GPU driver; if Intel integrated, check Intel Arc Control.

---

## Chapter 7 — Common App and OS Issues

### 7.1 Start Menu or Taskbar Frozen / Unresponsive

1. Restart Windows Explorer: Ctrl+Shift+Esc → Details tab → right-click explorer.exe → End Task → File → Run new task → explorer.exe.
2. If recurring: `sfc /scannow` → `DISM /Online /Cleanup-Image /RestoreHealth`.
3. Create a new user profile and test — if new profile works, the issue is profile corruption. Migrate data.

### 7.2 Microsoft Store Not Working / Apps Won't Update

1. Settings → Apps → Installed Apps → find Microsoft Store → Advanced options → Reset.
2. Run: `wsreset.exe` (clears Store cache).
3. If apps still won't install: check date/time is correct (cert validation fails on wrong time).
4. Try Sign out and back in to Microsoft Store.

### 7.3 Windows Hello Not Working (PIN / Fingerprint / Face)

1. Settings → Accounts → Sign-in options → PIN → I forgot my PIN → reset.
2. For fingerprint/face: remove and re-enroll.
3. If TPM issue: check TPM status in tpm.msc. If TPM not ready, clear and reinitialize (data loss warning if BitLocker active — ensure recovery key saved first).

### 7.4 BitLocker Asking for Recovery Key at Boot

**Do NOT skip or bypass without the key.**
1. Check if key is saved to the Microsoft account: account.microsoft.com/devices → Recovery keys.
2. Check if key was saved to Active Directory (corporate device: ask IT admin).
3. If found: enter key, boot, then check why BitLocker triggered (hardware change, BIOS update, TPM issue).
4. After boot: manage-bde -status to confirm encryption state.

**Escalate when:** recovery key not found — data recovery is not possible without it.

### 7.5 App Crashes / Won't Launch

1. Check Event Viewer → Application log → Error at crash time for the process name.
2. Run as administrator — sometimes permissions are the issue.
3. Clear app cache (for UWP apps: Settings → Apps → Advanced → Reset).
4. Reinstall via winget: `winget uninstall <app>` then `winget install <app>`.
5. Check for missing Visual C++ Redistributable or .NET runtime (common for older Win32 apps).

---

## Chapter 8 — Performance Issues

### 8.1 PC Running Slow

**Quick triage:**
1. Task Manager (Ctrl+Shift+Esc) → CPU / Memory / Disk columns. Which is maxed?
2. Disk at 100%: check for Windows Search indexing (disable for large drives), antivirus scan running, or StorPort issues with older HDD. Check disk health with CrystalDiskInfo.
3. Memory at 100%: identify process eating RAM. Check for memory leak. Add RAM if consistently at capacity.
4. CPU at 100%: check for runaway process, Windows Update running in background, or malware.

**General fixes:**
- Disable startup apps: Task Manager → Startup tab.
- Run Disk Cleanup + optimize drives.
- Check for malware: Windows Defender full scan.
- Adjust Visual Effects: sysdm.cpl → Advanced → Performance → Adjust for best performance.

### 8.2 OneDrive Sync Issues

1. Check sync status in system tray. Pause and resume sync.
2. Check available cloud storage (OneDrive quota).
3. Reset OneDrive: `%localappdata%\Microsoft\OneDrive\onedrive.exe /reset` (CMD).
4. Check file path length — Windows has a 260-char limit (can be extended in Group Policy).
5. Check for locked files (open in another app).

---

## Chapter 9 — Escalation Triggers and Checklists

### When to escalate to L2/L3 or vendor:
- BSOD persists after driver update + SFC + DISM → hardware diagnosis needed
- MemTest86 shows errors → RAM replacement
- SMART errors or CrystalDiskInfo showing bad sectors → disk replacement
- BitLocker recovery key not found → data may not be recoverable
- Domain-joined PC issues → Active Directory/GPO admin needed
- BIOS/firmware update needed → OEM vendor or senior tech only

### Pre-escalation checklist (complete before handoff):
- [ ] Error code / BSOD stop code documented
- [ ] Steps already tried documented
- [ ] Event Viewer log exported (if applicable)
- [ ] Last known good state (before problem started) noted
- [ ] Screenshot or photo of error attached
- [ ] PC model, Windows version, and last update date noted

---

## Implementation Notes (IIS-specific)

- Bundle this with the M365 Help Desk KB Pack for a complete desktop support reference at $99–$149.
- ARIA Sentinel (future integration): this KB feeds directly into ARIA's local matcher. Structured symptom/fix pairs can be imported as ARIA KB articles for automated deflection.
- Pricing recommendation: $29 standalone → include a "free for 30 days with any IIS Managed IT plan" CTA as conversion driver.
- Upsell path: buyer downloads this → IIS email drip (3 emails, 7 days) → offer ARIA Sentinel trial or IIS support plan.

---

*Draft complete. Ahmad review required before publishing to Growth Library or Shop.*
