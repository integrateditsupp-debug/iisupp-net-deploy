# Windows 11

> KNOWLEDGE ONLY. ARIA guides users by voice/chat. ARIA never remote-controls a device. All commands below are READ-ONLY diagnostics; ARIA only describes steps, the user performs them.

## Architecture
- **Kernel:** Windows NT kernel (hybrid). Windows 11 requires 64-bit CPU, UEFI with Secure Boot, and TPM 2.0.
- **Package manager:** `winget` (Windows Package Manager) is built in; the Microsoft Store handles UWP/MSIX apps. PowerShell `Add-AppxPackage` and legacy MSI/EXE installers also exist.
- **Default shell:** Windows Terminal hosting PowerShell (PowerShell 5.1 in-box; PowerShell 7 optional) and `cmd.exe` for legacy. `wsl` provides a Linux subsystem.
- **Security model:** User Account Control (UAC) prompts for elevation; Mandatory Integrity Control levels; per-app capability permissions (camera, mic, location) under Privacy & security; Microsoft Defender + SmartScreen; BitLocker / Device Encryption; Virtualization-Based Security (VBS), HVCI memory integrity, and Smart App Control on supported hardware. Standard vs. Administrator accounts; Windows Hello (PIN/face/fingerprint).

## Settings access
Open **Settings** (Start menu gear, or `Win + I`).
- **Wi-Fi:** Network & internet > Wi-Fi (or the quick-settings flyout via `Win + A`).
- **Bluetooth:** Bluetooth & devices > Bluetooth.
- **Display:** System > Display.
- **Sound:** System > Sound.
- **Storage:** System > Storage.
- **Accounts:** Accounts (sign-in options, family, work/school).
- **Updates:** Windows Update.
- **Privacy:** Privacy & security (app permissions, diagnostics).

## Common pain points
1. **Won't update / stuck update** — Run Settings > Windows Update > advanced > Windows Update Troubleshooter; reboot.
2. **No internet / Wi-Fi dropping** — Toggle Wi-Fi off/on in quick settings, then "Forget" and rejoin the network.
3. **Bluetooth won't pair** — Remove the device under Bluetooth & devices, set it to pairing mode, re-add.
4. **Audio not working** — Right-click the speaker icon > Sound settings, pick the correct output device.
5. **Disk full (C: drive)** — Settings > System > Storage > Storage Sense, or run Disk Cleanup (`cleanmgr`).
6. **Slow boot / high startup load** — Task Manager (`Ctrl+Shift+Esc`) > Startup apps, disable unneeded entries.
7. **Printer offline** — Settings > Bluetooth & devices > Printers & scanners > select printer > remove and re-add.
8. **App crashing/frozen** — Open Task Manager, select the app, End task.
9. **Forgotten Wi-Fi/sign-in PIN** — Use "I forgot my PIN" on the lock screen to reset via account.
10. **Search/Start menu not responding** — Restart Windows Explorer from Task Manager (find "Windows Explorer", Restart).

## Voice-guidable steps
- *Connect to Wi-Fi:* "Press the Windows key plus A to open quick settings. Click the arrow next to Wi-Fi, choose your network name, type the password, then click Connect."
- *Check for updates:* "Press Windows key plus I to open Settings. In the left list click Windows Update, then click Check for updates."
- *Free up disk space:* "Open Settings, click System, then click Storage. Click Temporary files, review the boxes, then click Remove files."
- *Find your PC name and Windows version:* "Open Settings, click System, scroll to the bottom and click About. Your device name and Windows edition are listed there."
- *Restart safely:* "Click the Start button, click the power icon, then choose Restart."

## Hardware diagnostic commands
All READ-ONLY. Run in PowerShell or Command Prompt. None of these change settings.
- `systeminfo` — OS, BIOS, RAM, uptime summary.
- `Get-ComputerInfo` — detailed system/hardware inventory (PowerShell).
- `wmic diskdrive get model,status` / `Get-PhysicalDisk` — drive health.
- `Get-WmiObject Win32_Battery` / `powercfg /batteryreport` — battery info/report.
- `dxdiag` — DirectX/graphics/sound diagnostic report (read-only viewer).
- `Get-NetAdapter` and `ipconfig /all` — network adapter and IP details.
- `wevtutil qe System /c:20 /rd:true /f:text` — last 20 System event-log entries.
- `sfc /verifyonly` — scan system files without modifying.

## Network reset procedure
1. Quick fix: Settings > Network & internet > Wi-Fi > "Forget" the network, then rejoin.
2. Renew IP (read-light): open Command Prompt and run `ipconfig /release` then `ipconfig /renew`, and `ipconfig /flushdns`.
3. Full reset: Settings > Network & internet > Advanced network settings > **Network reset** > Reset now. This removes and reinstalls all network adapters and resets components to defaults; the PC restarts and saved Wi-Fi passwords are cleared, so have them ready.

## Safe-mode equivalent
- **Safe Mode:** Settings > System > Recovery > Advanced startup > Restart now, then Troubleshoot > Advanced options > Startup Settings > Restart, then press 4 (Safe Mode) or 5 (Safe Mode with Networking).
- **Quick trigger:** Hold Shift while clicking Restart from the Start power menu to reach Advanced startup.
- **Forced recovery (WinRE):** If Windows fails to boot three times, it automatically enters the Windows Recovery Environment.

## Backup/restore mechanism
- **Windows Backup app** syncs folders, settings, and credentials to **OneDrive** (Settings > Accounts > Windows backup).
- **File History** backs up libraries to an external/network drive (Control Panel > File History).
- **System Restore** creates restore points for system files/settings (search "Create a restore point").
- **System Image / full backup** via Control Panel > Backup and Restore (Windows 7) for a complete drive image.
- **OneDrive** provides cloud sync and version history for Desktop/Documents/Pictures.
