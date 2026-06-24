# macOS 15 Sequoia

> KNOWLEDGE ONLY. ARIA guides users by voice/chat. ARIA never remote-controls a device. All commands below are READ-ONLY diagnostics; ARIA only describes steps, the user performs them.

## Architecture
- **Kernel:** XNU (hybrid Mach + BSD). Runs on Apple silicon (M-series) and supported recent Intel Macs.
- **Package manager:** No bundled CLI package manager; the App Store handles apps. Third-party **Homebrew** (`brew`) is common among power users. `.dmg`/`.pkg` installers and the `installer` tool also exist.
- **Default shell:** `zsh` (since macOS Catalina); `bash` (3.2) still ships. Terminal.app is the default terminal.
- **Security model:** System Integrity Protection (SIP) protects system files; **signed system volume (SSV)** is read-only/cryptographically sealed; Gatekeeper + notarization verify apps; per-app TCC privacy permissions (camera, mic, location, Files & Folders, Screen Recording); App Sandbox; Secure Enclave; FileVault full-disk encryption; **Lockdown Mode** for high-risk targets; admin vs. standard users; Touch ID / Apple Account sign-in.

## Settings access
Open **System Settings** (Apple menu  > System Settings).
- **Wi-Fi:** Wi-Fi (or the Control Center / menu-bar Wi-Fi icon).
- **Bluetooth:** Bluetooth.
- **Display:** Displays.
- **Sound:** Sound.
- **Storage:** General > Storage.
- **Accounts:** Users & Groups (and Apple Account at the top of System Settings).
- **Updates:** General > Software Update.
- **Privacy:** Privacy & Security.

## Common pain points
1. **Software Update stuck/failing** — General > Software Update; ensure storage/space and a stable network, then retry; reboot.
2. **Wi-Fi dropping** — Click the Wi-Fi menu, turn off and back on; under Wi-Fi settings remove the network ("Forget") and rejoin.
3. **Bluetooth device won't connect** — Bluetooth settings, remove the device, put it in pairing mode, reconnect.
4. **No sound / wrong output** — Sound settings > Output, select the correct device; check the volume in Control Center.
5. **Startup disk almost full** — General > Storage; use "Optimize Storage" and review large files/recommendations.
6. **App "can't be opened" (Gatekeeper)** — System Settings > Privacy & Security; scroll down and click "Open Anyway" for the blocked app you trust.
7. **App permission missing (camera/mic/screen)** — Privacy & Security; enable the app under the relevant category.
8. **Beachball / app frozen** — Force Quit (Option+Command+Esc), select the app, Force Quit.
9. **External display not detected** — Displays settings > Detect Displays; reseat the cable/adapter.
10. **Slow Mac / battery drain** — Open Activity Monitor to find high CPU/energy processes.

## Voice-guidable steps
- *Connect to Wi-Fi:* "Click the Control Center icon in the top-right menu bar, click Wi-Fi, then choose your network and type the password."
- *Check for updates:* "Click the Apple menu in the top-left, choose System Settings, click General, then click Software Update."
- *Check storage:* "Open System Settings, click General, then click Storage to see what's using space."
- *Find your macOS version:* "Click the Apple menu, then click About This Mac to see your macOS version and chip."
- *Force quit a frozen app:* "Hold Option and Command and press Escape. Pick the app, then click Force Quit."

## Hardware diagnostic commands
All READ-ONLY. Run in Terminal. None of these change settings.
- `system_profiler SPHardwareDataType` — model, chip, memory, serial.
- `sysctl -a | grep machdep.cpu` — CPU details (read-only).
- `df -h` — disk space by volume.
- `top -l 1` — current CPU/memory snapshot (or use Activity Monitor).
- `pmset -g batt` — battery charge and condition.
- `ioreg -l` — I/O registry / hardware tree (verbose, read-only).
- `log show --last 1h` — recent unified-log entries.
- `sysdiagnose` — gathers a full diagnostic bundle (Apple-supported; read-only collection, can be large).
- **Apple Diagnostics:** power on and hold **D** (Intel) or hold the power button to Startup Options then Command+D (Apple silicon).

## Network reset procedure
1. Quick: Wi-Fi menu off/on, then Wi-Fi settings > Details for your network > "Forget This Network", and rejoin.
2. Renew lease: Wi-Fi settings > Details > TCP/IP > "Renew DHCP Lease".
3. Deeper reset: in Network settings, remove the Wi-Fi service with the minus button, then re-add it with the plus button. Optionally remove network config files in `/Library/Preferences/SystemConfiguration/` only via a knowledgeable user (advanced; requires admin and a reboot).
4. Flush DNS cache: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` (admin password required).

## Safe-mode equivalent
- **Apple silicon:** Shut down, hold the power button until "Loading startup options," select the startup disk, then hold **Shift** and click "Continue in Safe Mode."
- **Intel:** Restart and immediately hold **Shift** until the login window; "Safe Boot" appears in the menu bar.
- **Recovery (macOS Recovery):** Apple silicon — hold power until Startup Options > Options > Continue. Intel — hold Command+R at boot.
- **DFU/Revive (Apple silicon):** done from a second Mac using Apple Configurator / Finder; used to revive or restore firmware.

## Backup/restore mechanism
- **Time Machine** — automatic local backups to an external/network drive (System Settings > General > Time Machine). Restore via Migration Assistant or in macOS Recovery > "Restore from Time Machine."
- **iCloud** — syncs Desktop, Documents, Photos, and app data (System Settings > Apple Account > iCloud).
- **Migration Assistant** — transfers data from another Mac, a Time Machine backup, or a Windows PC.
- Manual `rsync`/`cp` copies to external media are possible for advanced users.
