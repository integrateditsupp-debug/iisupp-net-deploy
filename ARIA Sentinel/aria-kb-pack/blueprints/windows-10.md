# Windows 10

> KNOWLEDGE ONLY. ARIA guides users by voice/chat. ARIA never remote-controls a device. All commands below are READ-ONLY diagnostics; ARIA only describes steps, the user performs them.

## Architecture
- **Kernel:** Windows NT kernel (hybrid). Runs on 32-bit and 64-bit hardware; UEFI or legacy BIOS; TPM optional. Note: Windows 10 reaches end of mainstream security support on **October 14, 2025** (Extended Security Updates available); recommend planning an upgrade where eligible.
- **Package manager:** `winget` (available on updated builds), Microsoft Store for UWP/MSIX, plus traditional MSI/EXE installers.
- **Default shell:** PowerShell 5.1 and `cmd.exe`; Windows Terminal optional (install from Store). WSL/WSL2 provides a Linux subsystem.
- **Security model:** User Account Control (UAC) for elevation; Mandatory Integrity Control; per-app privacy permissions (camera/mic/location); Windows Defender + SmartScreen; BitLocker / Device Encryption; standard vs. administrator accounts; Windows Hello (PIN/face/fingerprint).

## Settings access
Open **Settings** (Start > gear icon, or `Win + I`).
- **Wi-Fi:** Network & Internet > Wi-Fi (or the network icon in the taskbar tray).
- **Bluetooth:** Devices > Bluetooth & other devices.
- **Display:** System > Display.
- **Sound:** System > Sound.
- **Storage:** System > Storage.
- **Accounts:** Accounts (sign-in options, family, work/school).
- **Updates:** Update & Security > Windows Update.
- **Privacy:** Privacy (app permissions, diagnostics & feedback).

## Common pain points
1. **Won't update / stuck update** — Settings > Update & Security > Troubleshoot > Windows Update troubleshooter; reboot.
2. **No internet / Wi-Fi dropping** — Toggle Wi-Fi from the taskbar tray, then "Forget" and rejoin the network.
3. **Bluetooth won't pair** — Devices > Bluetooth & other devices, remove the device, set it to pairing mode, re-add.
4. **Audio not working** — Right-click the speaker icon > Open Sound settings, choose the correct output device.
5. **Disk full (C: drive)** — Settings > System > Storage > Storage Sense, or run Disk Cleanup (`cleanmgr`).
6. **Slow boot / startup bloat** — Task Manager (`Ctrl+Shift+Esc`) > Startup tab, disable high-impact entries.
7. **Printer offline** — Settings > Devices > Printers & scanners, remove and re-add the printer.
8. **App frozen** — Task Manager, select the app, End task.
9. **Forgotten sign-in PIN** — Use "I forgot my PIN" on the lock screen to reset.
10. **Start menu / taskbar unresponsive** — Restart "Windows Explorer" from Task Manager.

## Voice-guidable steps
- *Connect to Wi-Fi:* "Click the network icon at the bottom-right of the taskbar, click your network name, click Connect, type the password, then click Next."
- *Check for updates:* "Press Windows key plus I, click Update and Security, then click Check for updates."
- *Free up disk space:* "Open Settings, click System, click Storage, then click Temporary files and choose what to remove."
- *Find your Windows version:* "Press Windows key plus R, type winver, and press Enter to see your exact build."
- *Restart safely:* "Click Start, click the power icon, then choose Restart."

## Hardware diagnostic commands
All READ-ONLY. Run in PowerShell or Command Prompt. None of these change settings.
- `systeminfo` — OS, BIOS, RAM, uptime summary.
- `Get-ComputerInfo` — detailed system/hardware inventory (PowerShell).
- `wmic diskdrive get model,status` — drive status.
- `powercfg /batteryreport` — generates a read-only battery health report (HTML).
- `dxdiag` — graphics/sound diagnostic report viewer.
- `ipconfig /all` and `Get-NetAdapter` — network adapter and IP details.
- `wevtutil qe System /c:20 /rd:true /f:text` — recent System event-log entries.
- `sfc /verifyonly` — scan system files without modifying.

## Network reset procedure
1. Quick fix: Settings > Network & Internet > Wi-Fi > Manage known networks > select the network > Forget, then rejoin.
2. Renew IP: open Command Prompt and run `ipconfig /release`, then `ipconfig /renew`, then `ipconfig /flushdns`.
3. Full reset: Settings > Network & Internet > Status > **Network reset** > Reset now. This reinstalls all network adapters and resets components to defaults; the PC restarts and saved Wi-Fi passwords are cleared, so have them ready.

## Safe-mode equivalent
- **Safe Mode:** Settings > Update & Security > Recovery > Advanced startup > Restart now, then Troubleshoot > Advanced options > Startup Settings > Restart, then press 4 (Safe Mode) or 5 (Safe Mode with Networking).
- **Quick trigger:** Hold Shift while clicking Restart from the Start power menu.
- **Forced recovery (WinRE):** Three failed boots automatically launch the Windows Recovery Environment.

## Backup/restore mechanism
- **File History** backs up libraries/folders to an external or network drive (Settings > Update & Security > Backup, or Control Panel > File History).
- **System Restore** creates restore points for system files/settings (search "Create a restore point").
- **System Image / Backup and Restore (Windows 7)** in Control Panel makes a full drive image.
- **OneDrive** provides cloud sync and version history for Desktop/Documents/Pictures.
