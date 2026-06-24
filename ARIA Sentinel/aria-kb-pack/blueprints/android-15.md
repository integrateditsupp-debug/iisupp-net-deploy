# Android 15

## Architecture
Android 15 (codename "Vanilla Ice Cream", API level 35) runs on the **Linux kernel** (vendor kernels are typically GKI — Generic Kernel Image — based) with the Android userspace on top. App runtimes execute on **ART (Android Runtime)** with ahead-of-time and just-in-time compilation. The default package format is the **APK** (and **App Bundles / .aab** for distribution); apps install through the Play Store, OEM stores, or sideloaded APKs (which require explicit per-source "Install unknown apps" permission). The default interactive shell reachable over **ADB** is `mksh` (the MirBSD Korn shell) with Toybox providing core utilities; there is no end-user terminal on stock devices.

Security model:
- **SELinux in enforcing mode** confines every process with mandatory access control (MAC) domains.
- **Application sandbox** — each app gets a unique Linux UID and isolated storage; **Scoped Storage** restricts file access to the app's own directories plus the media store.
- **Verified Boot (AVB)** with a hardware root of trust validates the boot chain and reports tamper state.
- **Runtime permissions** are user-granted per capability (Location, Camera, Microphone, Contacts, etc.) with one-time and "while using the app" options; Android 15 adds **partial photo/media access** and a **Privacy Dashboard**.
- **Hardware-backed Keystore / StrongBox** (Titan M / TEE) protects keys; **File-Based Encryption** encrypts user data at rest.
- Android 15 adds **Private Space** (a hidden, separately-locked app container) and **theft-detection** features.

## Settings access
Open the **Settings** app (gear icon in the app drawer or Quick Settings). Use the search bar at the top to jump anywhere. (Exact wording varies slightly by OEM — Pixel/AOSP, Samsung One UI, etc.)
- **Wi-Fi:** Settings > Network & internet > Internet (Samsung: Settings > Connections > Wi-Fi)
- **Bluetooth:** Settings > Connected devices > Connection preferences > Bluetooth (Samsung: Settings > Connections > Bluetooth)
- **Display:** Settings > Display
- **Sound:** Settings > Sound & vibration
- **Storage:** Settings > Storage
- **Accounts:** Settings > Passwords & accounts (Samsung: Settings > Accounts and backup > Manage accounts)
- **Updates:** Settings > System > Software update / System update (Samsung: Settings > Software update)
- **Privacy:** Settings > Security & privacy (Privacy dashboard, permission manager)

## Common pain points
1. **Wi-Fi connected, no internet** — Settings > Network & internet > Internet; tap the network, Forget, then reconnect; toggle Airplane Mode briefly.
2. **Storage full** — Settings > Storage; clear cache, use the "Free up space" tool, move photos to cloud.
3. **App keeps crashing** — Settings > Apps > [app] > Storage & cache > Clear cache (then Clear storage only if needed); update the app.
4. **Battery draining fast** — Settings > Battery > Battery usage; restrict background activity for the worst offenders; enable Adaptive Battery.
5. **Phone slow / laggy** — Restart the device; free storage; check Settings > Apps for a misbehaving app using high background data/CPU.
6. **Bluetooth won't connect** — Settings > Connected devices; Forget the device, re-pair with the accessory in pairing mode.
7. **Overheating while charging** — Remove the case, use the supplied charger, avoid heavy use while charging.
8. **Notifications not arriving** — Settings > Apps > [app] > Notifications, and turn off battery optimization for that app.
9. **Mobile data not working** — Settings > Network & internet > SIMs; confirm data is on and the APN is correct; toggle Airplane Mode.
10. **Won't update (OTA stuck)** — Ensure 50%+ battery and Wi-Fi; Settings > System > Software update > retry; clear Google Play services cache if the check fails.

## Voice-guidable steps
ARIA reads these aloud; the user taps. ARIA never controls the phone.

- **Connect to Wi-Fi:** "Open Settings, tap Network and internet, then tap Internet. Tap your network's name, type the password, and tap Connect."
- **Turn on Bluetooth:** "Swipe down from the top to open Quick Settings, then tap the Bluetooth icon so it turns on. To pair, open Settings, tap Connected devices, then Pair new device."
- **Update Android:** "Open Settings, scroll down and tap System, tap Software update, then tap Check for update. If one appears, tap Download and install."
- **Clear an app's cache:** "Open Settings, tap Apps, tap See all apps, choose the app, tap Storage and cache, then tap Clear cache."
- **Free up storage:** "Open Settings, tap Storage, then tap Free up space and follow the prompts to remove unused items."
- **Reset Wi-Fi/Bluetooth/mobile:** "Open Settings, tap System, tap Reset options, then tap Reset Wi-Fi, mobile and Bluetooth, and confirm."

## Hardware diagnostic commands
These run over **ADB** (Android Debug Bridge) from a computer with USB debugging enabled, or in a terminal on rooted/dev builds. All listed commands are **READ-ONLY** — they only report state and do not change the device.

- `adb shell getprop` — dump all system properties (model, build, ABI). READ-ONLY.
- `adb shell dumpsys battery` — battery level, health, temperature, charge state. READ-ONLY.
- `adb shell dumpsys cpuinfo` / `dumpsys meminfo` — CPU and memory usage. READ-ONLY.
- `adb shell df -h` — filesystem/storage usage. READ-ONLY.
- `adb shell top -n 1` — snapshot of running processes. READ-ONLY.
- `adb shell dmesg` (needs permission) / `adb logcat -d` — kernel ring buffer / system log dump. READ-ONLY.
- `adb shell cat /proc/cpuinfo` and `/proc/meminfo` — hardware details. READ-ONLY.
- `adb shell dumpsys wifi` / `dumpsys connectivity` — network state. READ-ONLY.
- On-device dialer code `*#*#4636#*#*` opens a hidden testing/info menu (phone, battery, Wi-Fi info — primarily read-only).

Note: enabling USB debugging is a developer action; these commands never remotely operate the device on a user's behalf.

## Network reset procedure
1. Toggle **Airplane Mode** on for ~15 seconds, then off (swipe down to Quick Settings).
2. **Settings > Network & internet > Internet** — tap the network, **Forget**, then reconnect.
3. Restart the device.
4. Full reset: **Settings > System > Reset options > Reset Wi-Fi, mobile & Bluetooth.** This clears all saved Wi-Fi networks, paired Bluetooth devices, and cellular/APN settings without deleting personal data. (Samsung path: Settings > General management > Reset > Reset network settings.) Confirm and let it complete.

## Safe-mode equivalent
- **Boot into Safe Mode (disables third-party apps to isolate problems):** Press and hold the power button until the power menu appears, then **press and hold "Power off"** until "Reboot to safe mode" appears and confirm. To exit, simply restart normally. (Samsung: power off, then on power-up hold Volume Down until it boots showing "Safe mode.")
- **Recovery Mode (system maintenance, cache wipe, factory reset):** Power off, then hold **Power + Volume Up** (exact combo varies by OEM) until the recovery menu appears; navigate with volume keys, select with power. "Wipe cache partition" is the safe, non-destructive option.
- **Force restart (frozen device):** Hold **Power + Volume Down** for ~10-20 seconds until it reboots.

## Backup/restore mechanism
- **Google One / Google backup (primary):** Settings > Google > Backup. Backs up apps & app data, call history, contacts, device settings, SMS, and photos/videos (via Google Photos). Storage counts against the Google Account / Google One quota.
- **Photos & media:** Google Photos backup, or Samsung devices can also use Samsung Cloud / Smart Switch.
- **Restore:** On a new or reset device, sign in to the same Google Account during setup and choose **Restore** to pull apps, settings, and data; cabled migration is offered via the setup wizard or OEM tools (e.g., Samsung Smart Switch).
- **Local copy:** Connect via USB in File Transfer (MTP) mode to copy photos/files to a computer manually.
