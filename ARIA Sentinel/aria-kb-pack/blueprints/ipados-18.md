# iPadOS 18

## Architecture
iPadOS 18 runs on Apple silicon (A-series and M-series chips) and shares the Darwin/XNU hybrid kernel and core frameworks with iOS, layered with iPad-specific features (Stage Manager, external display support, multitasking). There is no user-facing package manager — all software is distributed as signed `.ipa` bundles through the App Store (in the EU, alternative marketplaces are permitted under DMA rules). There is no user-accessible shell on a non-jailbroken device.

Security model is a layered, hardware-rooted design:
- **Secure Enclave** holds keys and handles Face ID / Touch ID biometric matching; biometric templates never leave the chip.
- **Verified / Secure Boot chain** validates every stage from the Boot ROM upward; only Apple-signed firmware loads.
- **Code signing + mandatory app sandbox** — each app runs in its own container with a private data directory and no access to other apps' data except through declared entitlements and system APIs.
- **Data Protection** encrypts files with per-file keys tied to the passcode; data at rest is encrypted by default.
- **Permissions are per-capability and prompted at first use** (Camera, Microphone, Photos, Contacts, Location, Local Network, Bluetooth, Tracking).
- **Lockdown Mode** is available for high-risk users; **Stolen Device Protection** adds a biometric + time-delay barrier when away from familiar locations.

## Settings access
All system configuration lives in the **Settings** app (gray gear icon). Use the search bar at the top of Settings to jump to any pane.
- **Wi-Fi:** Settings > Wi-Fi
- **Bluetooth:** Settings > Bluetooth
- **Display:** Settings > Display & Brightness (and Settings > Accessibility > Display & Text Size for larger text / contrast)
- **Sound:** Settings > Sounds (volume, ringtone, headphone safety)
- **Storage:** Settings > General > iPad Storage
- **Accounts:** Settings > [your name] at the very top (Apple Account / iCloud), and Settings > Mail / Calendar / Contacts > Accounts for third-party mail accounts
- **Software updates:** Settings > General > Software Update
- **Privacy:** Settings > Privacy & Security (per-app permissions, Tracking, App Privacy Report, Safety Check)

## Common pain points
1. **Wi-Fi connected but no internet** — Toggle Wi-Fi off and back on in Settings > Wi-Fi; if it persists, tap the (i) next to the network and choose Forget, then rejoin.
2. **Storage full** — Settings > General > iPad Storage; offload large apps and clear the Photos "Recently Deleted" album.
3. **App won't update or download** — Sign out and back in to the Apple Account, or check Settings > General > Software Update for a pending OS update that blocks the App Store.
4. **iPad won't charge / charges slowly** — Use an Apple-certified cable and a higher-wattage USB-C adapter; clean lint from the USB-C port with a wooden toothpick.
5. **Bluetooth accessory won't pair** — Settings > Bluetooth, Forget the device, put the accessory back in pairing mode, retry.
6. **Battery draining fast** — Settings > Battery shows per-app usage; disable Background App Refresh for heavy apps in Settings > General > Background App Refresh.
7. **Stage Manager confusion / lost windows** — Swipe up to App Library or toggle Stage Manager off in Control Center to return to full-screen apps.
8. **Touchscreen unresponsive in spots** — Remove screen protector/case, clean the screen, and force-restart (see Safe-mode equivalent).
9. **Apple Account / iCloud password loop** — Settings > [your name] > Sign-In & Security to verify trusted devices and update the password.
10. **Screen Time / restrictions blocking content unexpectedly** — Settings > Screen Time > Content & Privacy Restrictions; verify the Screen Time passcode and toggles.

## Voice-guidable steps
ARIA speaks these step-by-step; the user performs each tap. ARIA never controls the device.

- **Connect to Wi-Fi:** "Open the Settings app, then tap Wi-Fi near the top. Make sure the switch at the top is green. Tap the name of your network, type the password, then tap Join."
- **Turn on Bluetooth:** "Open Settings, tap Bluetooth, and make sure the switch is green. Your device will appear under Other Devices when it's ready to pair."
- **Update iPadOS:** "Open Settings, tap General, then tap Software Update. If an update is listed, tap Download and Install and enter your passcode."
- **Free up storage:** "Open Settings, tap General, then tap iPad Storage. Wait for the bar to load, then tap any large app and choose Offload App to free space while keeping your documents."
- **Check battery health:** "Open Settings, tap Battery, then tap Battery Health & Charging to see your Maximum Capacity."
- **Reset network settings:** "Open Settings, tap General, scroll to Transfer or Reset iPad, tap Reset, then tap Reset Network Settings and enter your passcode."

## Hardware diagnostic commands
A standard, non-jailbroken iPadOS device has **no user shell**, so traditional commands are not available on-device. Diagnostics are READ-ONLY and surfaced through the UI or a tethered Mac.

- **On-device (READ-ONLY, no terminal):** Settings > General > About (model, serial, capacity, OS version); Settings > Battery > Battery Health; Settings > Privacy & Security > Analytics & Improvements > Analytics Data (raw log files you can read/share).
- **Tethered to a Mac (READ-ONLY):**
  - `xcrun simctl list` — lists simulators (developer context only).
  - In the macOS **Console** app, select the connected iPad to stream live device logs (read-only).
  - `idevicesyslog` / `ideviceinfo` (from the open-source libimobiledevice tools) — stream the syslog and print device properties. **READ-ONLY**, they only read information.
- **Apple Diagnostics:** Apple-run hardware checks via a Genius Bar / authorized service appointment.

All of the above only **read** state; none modify the device.

## Network reset procedure
1. Open **Settings > Wi-Fi** and toggle Wi-Fi off, wait 10 seconds, toggle it back on.
2. If still failing, tap the **(i)** next to your network and choose **Forget This Network**, then rejoin with the password.
3. Toggle **Airplane Mode** on for 15 seconds (Control Center), then off, to reset the radios.
4. Full reset: **Settings > General > Transfer or Reset iPad > Reset > Reset Network Settings.** This clears all saved Wi-Fi networks, passwords, cellular settings, and VPN/APN config (it does not delete personal data). Enter your passcode to confirm and let the iPad restart.

## Safe-mode equivalent
iPadOS has no traditional "safe mode," but these recovery paths apply:
- **Force restart (Face ID iPads, no Home button):** Press and quickly release Volume Up, press and quickly release Volume Down, then press and hold the Top button until the Apple logo appears.
- **Force restart (iPads with a Home button):** Hold the Top button and the Home button together until the Apple logo appears.
- **Recovery Mode (reinstall OS, keep trying to preserve data):** Connect to a Mac/PC with Finder or the Apple Devices app, then perform the force-restart sequence but keep holding until the recovery (cable-to-laptop) screen appears; choose **Update** to reinstall iPadOS without erasing data.
- **DFU Mode:** A deeper firmware-restore state for unresponsive devices; use only with on-screen guidance from Apple or a trusted technician.

## Backup/restore mechanism
- **iCloud Backup (recommended):** Settings > [your name] > iCloud > iCloud Backup; enable **Back Up This iPad** and tap **Back Up Now**. Backups run automatically when locked, charging, and on Wi-Fi. Storage uses the iCloud / iCloud+ plan.
- **Local/computer backup:** Connect to a Mac (Finder) or Windows PC (Apple Devices app); choose the device and **Back Up Now**. Enable **Encrypt local backup** to include Health, Wi-Fi passwords, and Keychain.
- **Restore:** During setup choose **Restore from iCloud Backup** or **Restore from Mac or PC**; or on an existing device, restore via Finder/Apple Devices.
- **Quick Start:** Hold a new iPad next to your current one to migrate settings, data, and apps directly over the air or via cable.
