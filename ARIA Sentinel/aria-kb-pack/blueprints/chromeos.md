# ChromeOS

## Architecture
ChromeOS is Google's Linux-based operating system for Chromebooks, built on a hardened **Linux kernel** with a **Gentoo Portage-derived** build system used by developers (end users never compile packages). The user experience centers on the **Chrome browser**, **Progressive Web Apps (PWAs)**, **Android apps** via the **ARC++ / ARCVM** container (Google Play), and an optional **Linux development environment** called **Crostini** that runs Debian inside a secured VM (Termina/`crosvm`). There is no traditional end-user package manager for the host OS — the host image is immutable and updated as a whole. A limited shell, **crosh**, is reachable in the browser (Ctrl+Alt+T) for diagnostics.

Security model:
- **Verified Boot** — a hardware root of trust checks each boot stage; the OS detects and self-heals tampering, falling back to a known-good copy.
- **Read-only, immutable root filesystem** — the system partition cannot be modified at runtime; updates are applied to an alternate partition (A/B) and swapped on reboot.
- **Sandboxing everywhere** — each browser tab/process, Android apps (in ARCVM), and Linux apps (in the Crostini VM) are isolated.
- **Automatic background updates** with rollback safety; **per-user data encryption** (eCryptfs/ext4 encryption) tied to the Google Account.
- **Developer Mode** can relax some protections (used to access a root shell) but explicitly powerwashes the device and shows a warning at boot.

## Settings access
Open **Settings** from the launcher (circle icon, bottom-left), the Quick Settings panel (click the clock, bottom-right), or `chrome://settings`. Use the Settings search bar to jump anywhere.
- **Wi-Fi:** Settings > Network > Wi-Fi (or the network icon in Quick Settings)
- **Bluetooth:** Settings > Bluetooth (or the Bluetooth toggle in Quick Settings)
- **Display:** Settings > Device > Displays
- **Sound:** Quick Settings volume slider, or Settings > Device > Audio
- **Storage:** Settings > Device > Storage management
- **Accounts:** Settings > Accounts (add/remove Google Accounts, sync)
- **Updates:** Settings > About ChromeOS > Check for updates
- **Privacy:** Settings > Security and Privacy (Guest browsing, lock screen, verified access)

## Common pain points
1. **Wi-Fi connected, no internet** — Click the network in Quick Settings, Forget, then reconnect; toggle Wi-Fi off/on.
2. **Storage full** — Settings > Device > Storage management; clear browsing data and Downloads, and uninstall unused Android/Linux apps.
3. **ChromeOS won't update** — Settings > About ChromeOS > Check for updates; if it errors, restart and ensure 50%+ battery and a stable network.
4. **Android (Play) app crashing or missing** — Settings > Apps > Google Play Store; clear the app's cache, or toggle Play Store off/on; ensure the device is in the supported Play list.
5. **Linux (Crostini) container won't start** — Restart the device; Settings > Advanced > Developers > Linux; if needed, remove and reinstall the Linux environment (this deletes Linux files — back up first).
6. **Printer not found** — Settings > Printing & scanning > Printers > Add printer; confirm same network and IPP/driverless support.
7. **External monitor not detected** — Settings > Device > Displays; reseat the cable/dongle; some USB-C ports are data-only.
8. **Touchpad/keyboard glitches** — Try the keyboard/touchpad self-test in `chrome://diagnostics`; perform a hardware reset (see Safe-mode).
9. **Account sync not working** — Settings > Accounts > Sync; sign out and back in to the Google Account.
10. **Slow performance / too many tabs** — Open the ChromeOS Task Manager (Search + Esc) and end heavy tasks; restart.

## Voice-guidable steps
ARIA dictates; the user taps/clicks. ARIA never controls the Chromebook.

- **Connect to Wi-Fi:** "Click the clock in the bottom-right to open Quick Settings, click the arrow next to Wi-Fi, choose your network, type the password, and click Connect."
- **Turn on Bluetooth:** "Click the clock in the bottom-right, then click the Bluetooth icon so it turns on. Click the arrow next to it to pair a new device."
- **Update ChromeOS:** "Open Settings, click About ChromeOS at the bottom-left, then click Check for updates. When it finishes, click Restart."
- **Free up storage:** "Open Settings, click Device, then Storage management. Review each category and remove what you don't need."
- **Open diagnostics:** "Open the launcher, type Diagnostics, and open the Diagnostics app to run battery, CPU, memory, and network tests."
- **Power-wash (factory reset, last resort):** "Open Settings, search for Reset, click Reset settings, then click Powerwash and Restart. This erases everything on the device, so back up first."

## Hardware diagnostic commands
ChromeOS provides a built-in **Diagnostics** app and the **crosh** shell (open the browser, press **Ctrl+Alt+T**). The crosh commands below are **READ-ONLY** information/test commands — they report status and do not alter the system.

- **Diagnostics app** (launcher > "Diagnostics"): battery health, CPU, memory, and network connectivity tests. READ-ONLY.
- In **crosh** (Ctrl+Alt+T):
  - `battery_test 1` — quick battery status/discharge readout. READ-ONLY.
  - `memory_test` — RAM check. READ-ONLY.
  - `storage_status` — storage device health (where supported). READ-ONLY.
  - `network_diag` — run network diagnostics. READ-ONLY.
  - `top` — live process/CPU view (type `q` to quit). READ-ONLY.
  - `ping <host>` — connectivity test. READ-ONLY.
- Inside the **Crostini Linux** terminal (a Debian VM, if enabled), the standard READ-ONLY Linux tools apply: `df -h`, `free -h`, `lsblk`, `dmesg`, `journalctl` — these report on the Linux container, not the locked host.
- Page `chrome://system` shows a full read-only system information dump.

## Network reset procedure
1. Toggle **Wi-Fi off and on** from Quick Settings (click the clock, then the Wi-Fi toggle).
2. Forget and rejoin: Quick Settings > Wi-Fi arrow > click the network > **Forget**, then reconnect with the password.
3. Restart the Chromebook (sign out, then Shut down and power on).
4. In **crosh** (Ctrl+Alt+T), run `network_diag` to identify the failing layer.
5. Deeper reset: Settings > **Reset settings** lets you restore network behavior; the ultimate reset is **Powerwash** (factory reset) — only after backing up, since it erases local data. ChromeOS keeps most settings synced to the Google Account, so they restore on sign-in.

## Safe-mode equivalent
ChromeOS has no classic "safe mode" because the OS is immutable and self-healing, but these recovery paths apply:
- **Hard reset (refresh device hardware/firmware state):** Hold **Refresh + Power** (on most Chromebooks) to restart; this does not erase files.
- **Guest mode (isolate account/extension issues):** From the sign-in screen choose **Browse as Guest** to test without your profile, extensions, or apps.
- **Recovery Mode (reinstall ChromeOS if it won't boot):** Hold **Esc + Refresh**, then press **Power**; release on the recovery screen. Recover using a **ChromeOS recovery USB** made with the Chromebook Recovery Utility on another computer. This reinstalls the OS and erases local data.
- **Developer Mode:** Exists for advanced/root access but **powerwashes** the device on entry and weakens verified boot — not a routine troubleshooting step.

## Backup/restore mechanism
- **Account sync (primary):** ChromeOS continuously syncs to the **Google Account** — bookmarks, extensions, settings, Wi-Fi networks, passwords, and app list. Signing in on any Chromebook restores this profile automatically. Manage at Settings > Accounts > Sync.
- **Google Drive / Google One:** Files in the **Files app > Google Drive** are stored in the cloud; Google One backs up associated mobile/photo data. Local files in **My files / Downloads** are NOT automatically backed up — move important files to Drive or external media.
- **Google Photos:** Backs up images/videos to the cloud.
- **Restore:** On a new or recovered/powerwashed Chromebook, sign in with the same Google Account during setup; synced settings, extensions, and Drive files return automatically. Re-download Android apps from Play and re-add the Linux container if used (Linux files must have been backed up separately, e.g., exported via Settings > Developers > Linux > Backup).
