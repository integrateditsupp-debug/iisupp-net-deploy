# iOS 18

> KNOWLEDGE ONLY. ARIA guides users by voice/chat. ARIA never remote-controls a device. ARIA cannot run commands on an iPhone; it only describes the on-device steps the user performs. The "diagnostic commands" below are tools the *user* runs from a Mac, not actions ARIA takes.

## Architecture
- **Kernel:** XNU (hybrid Mach + BSD), shared lineage with macOS. Runs on Apple A-series chips (iPhone Xs / iPhone SE 2 and newer support iOS 18).
- **Package manager:** No user-facing package manager; all apps install through the **App Store** (and, in the EU, notarized alternative marketplaces under DMA rules). No general-purpose CLI/shell for end users.
- **Default shell:** None exposed to users — iOS has no end-user terminal. Automation is done with the **Shortcuts** app.
- **Security model:** Tightly sandboxed apps; mandatory code signing; Secure Enclave; hardware-backed Data Protection encryption (always on with a passcode); per-app TCC permissions (camera, mic, location, photos, contacts, local network, Bluetooth, Tracking); App Tracking Transparency; **Lockdown Mode** for high-risk users; Face ID / Touch ID; Stolen Device Protection; Activation Lock tied to Apple Account.

## Settings access
Open the **Settings** app (gray gear icon).
- **Wi-Fi:** Settings > Wi-Fi (or Control Center).
- **Bluetooth:** Settings > Bluetooth (or Control Center).
- **Display:** Settings > Display & Brightness.
- **Sound:** Settings > Sounds & Haptics.
- **Storage:** Settings > General > iPhone Storage.
- **Accounts:** Settings > [your name] at the top (Apple Account), and Settings > Mail/Contacts for app accounts.
- **Updates:** Settings > General > Software Update.
- **Privacy:** Settings > Privacy & Security.

## Common pain points
1. **Won't update** — Settings > General > Software Update; ensure Wi-Fi, charge, and free space; if needed, delete the partial update under iPhone Storage and retry.
2. **Wi-Fi won't connect / drops** — Settings > Wi-Fi, tap the network's info (i), "Forget This Network," then rejoin.
3. **Bluetooth won't pair** — Settings > Bluetooth, tap the device info (i) > Forget This Device, set accessory to pairing mode, reconnect.
4. **Storage full** — Settings > General > iPhone Storage; offload unused apps and clear large attachments/videos.
5. **Battery draining fast** — Settings > Battery; review high-usage apps and enable Low Power Mode.
6. **No sound / muted** — Check the Ring/Silent switch and Focus modes; Settings > Sounds & Haptics for volume.
7. **App frozen** — Swipe up from the bottom (or double-press Home) to the App Switcher and swipe the app away to close it.
8. **Cellular data not working** — Settings > Cellular; toggle Cellular Data, or toggle Airplane Mode on/off.
9. **Forgotten passcode** — Requires Erase iPhone via Recovery/Find My; data is lost without a backup (security by design).
10. **iPhone won't charge / unresponsive** — Try a different cable/adapter; force restart (see Safe-mode section).

## Voice-guidable steps
- *Connect to Wi-Fi:* "Open Settings, tap Wi-Fi, wait for networks to appear, tap your network name, type the password, then tap Join."
- *Check for updates:* "Open Settings, tap General, then tap Software Update. If an update is shown, tap Download and Install."
- *Check storage:* "Open Settings, tap General, then tap iPhone Storage to see what's using space."
- *Find your iOS version:* "Open Settings, tap General, then tap About. The Software Version is listed there."
- *Turn on Low Power Mode:* "Open Settings, tap Battery, then turn on the Low Power Mode switch."
- *Reset network settings:* "Open Settings, tap General, scroll down and tap Transfer or Reset iPhone, tap Reset, then tap Reset Network Settings."

## Hardware diagnostic commands
iOS exposes **no end-user terminal**, so there are no on-device commands. READ-ONLY options the *user* can use:
- **On-device:** Settings > Battery > Battery Health & Charging (shows Maximum Capacity, read-only); Settings > Privacy & Security > Analytics & Improvements > Analytics Data (read-only logs); Settings > General > About (model, capacity, IMEI).
- **From a Mac (user-driven, read-only collection):** Apple's `sysdiagnose` can be triggered on the iPhone (button chord) and pulled via a Mac; developers can view device logs in **Console.app** or Xcode's Devices window. These observe, they do not change the device.
- Apple Support's diagnostics and the carrier field-test screen (`*3001#12345#*` then dial) display radio info read-only on some carriers.

## Network reset procedure
1. Quick: Settings > Wi-Fi, tap the (i) next to the network, "Forget This Network," then rejoin.
2. Toggle: turn Airplane Mode on for ~10 seconds, then off, to re-establish radios.
3. Full reset: Settings > General > **Transfer or Reset iPhone** > Reset > **Reset Network Settings**. This clears saved Wi-Fi passwords, cellular settings, and VPN/APN configs (it does **not** erase your data). Have your Wi-Fi passwords ready before doing this.

## Safe-mode equivalent
iOS has no traditional "safe mode." Equivalent recovery actions:
- **Force restart:** Press and release Volume Up, press and release Volume Down, then press and hold the Side button until the Apple logo appears (Face ID iPhones).
- **Recovery Mode:** Connect to a computer (Finder/Apple Devices app), then do the Volume Up, Volume Down, hold Side button chord until the recovery (cable-to-laptop) screen appears; choose Update or Restore.
- **DFU Mode:** A deeper restore state for firmware re-flash, entered via a precise button sequence while connected to a computer; used for stuck updates or unresponsive devices.

## Backup/restore mechanism
- **iCloud Backup** — automatic encrypted backups over Wi-Fi (Settings > [your name] > iCloud > iCloud Backup). Restore during device setup via "Restore from iCloud Backup." Storage tiers are **iCloud / iCloud+** (often called Apple's "Google One" equivalent).
- **Finder / Apple Devices app backup** — local (optionally encrypted) backup to a Mac or PC; restore from the same machine.
- **Quick Start** — transfers data directly from an old iPhone to a new one wirelessly or via cable during setup.
- **Advanced Data Protection** can extend end-to-end encryption to most iCloud categories, including backups.
