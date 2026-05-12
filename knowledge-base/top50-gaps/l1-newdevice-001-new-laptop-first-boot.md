---
id: l1-newdevice-001
title: "New work laptop — first-boot setup checklist"
category: onboarding
support_level: L1
severity: medium
estimated_time_minutes: 60
audience: end-user
os_scope: ["Windows 11", "macOS 15+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: ["Laptop unboxed, plugged in, network available", "Sign-in credentials from IT", "MFA already set up on phone"]
keywords:
  - new laptop
  - new computer
  - first boot
  - oobe
  - out of box experience
  - windows 11 setup
  - macos setup
  - autopilot
  - intune enrollment
  - jamf enrollment
  - device onboarding
  - migration
  - new user setup
related_articles:
  - l1-mfa-001-setup-recovery
  - l2-onboarding-001-new-user
  - l1-mobile-email-001-set-up-work-email-on-phone
escalation_trigger: "Autopilot / Jamf enrollment fails to apply policies after 2 attempts → IT to manually re-enroll device."
last_updated: 2026-05-12
version: 1.0
---

# New work laptop — first-boot setup checklist

## 1. Symptoms
User received a new work laptop. Needs to set it up so it's ready for daily work, with all company apps and policies applied.

## 2. The Smooth Path (Autopilot / DEP — most common)

If IT pre-staged the device (Windows Autopilot or Apple Automated Device Enrollment), unboxing + signing in does most of the work:

### Windows 11 — Autopilot

**Step 1 — Power on.**
- Press power button. Windows starts the Out-of-Box Experience (OOBE).

**Step 2 — Country + keyboard.**
- Select your country (Canada / United States / etc.).
- Keyboard layout: English (US) or English (Canada) typically.
- Skip second keyboard layout.

**Step 3 — Network.**
- Connect to Wi-Fi. Use a network that's NOT the corporate 802.1X network — that requires policies that aren't applied yet. Personal hotspot or office guest Wi-Fi works.
- *(What you should see: After connecting, Windows downloads updates briefly.)*

**Step 4 — License agreement → Accept.**

**Step 5 — Sign in with WORK email.**
- "Enter your email" → enter your work address (e.g., `jane.smith@yourcompany.com`).
- Microsoft sign-in flow → enter your work password → MFA prompt.
- *(What you should see: A "Setting up your device" loading screen for 5-15 minutes. Autopilot is applying policies, installing required apps, configuring Defender, BitLocker, etc.)*

**Step 6 — Initial Windows desktop appears.**
- BitLocker may finish encrypting in the background (don't power off for 1-2 hours).
- Required apps installed automatically: Outlook, Teams, OneDrive, Microsoft 365 apps, antivirus.
- Optional apps available via **Company Portal** → install on demand.

**Step 7 — Open Outlook.**
- First launch may take 5 minutes to sync — let it.
- Outlook → File → Office Account → confirm Activated (no nag).

**Step 8 — Sign in OneDrive.**
- Start menu → OneDrive → sign in with work email.
- Choose folders to sync: Documents + Desktop + Pictures recommended.
- Files migrate over 10-60 minutes depending on volume.

**Step 9 — Set up Teams.**
- Open Teams → sign in (auto-detects work email).
- Test camera + mic in Settings.

### macOS — Apple Automated Device Enrollment (DEP)

**Step 1 — Power on.**
- Pick language + region.

**Step 2 — Wi-Fi.**

**Step 3 — Apple ID** — leave blank initially, OR sign in with a PERSONAL Apple ID. Don't use a work Apple ID unless your company specifically provides one (rare).

**Step 4 — Activation Lock check** — should bypass automatically (DEP).

**Step 5 — Remote Management** — screen appears asking to enroll. Click **Enroll**.

**Step 6 — Sign in.**
- "Enter your work email" → your work address.
- MFA → approve.
- Jamf / Kandji / Intune for macOS pushes policies + apps. Takes 5-15 minutes.

**Step 7 — Set up Touch ID / Face ID + password.**

**Step 8 — FileVault encryption.**
- Will be enabled automatically by policy. Save your recovery key to iCloud if prompted.

**Step 9 — Open Self Service** — install your specific apps.

**Step 10 — Open Outlook / Teams / OneDrive** — same as Windows.

## 3. The Manual Path (no pre-staging)

If IT didn't pre-stage:

1. Set up Windows / macOS with a LOCAL account first.
2. Add your work account: Settings → Accounts → Access work or school → Connect.
3. Microsoft sign-in + MFA.
4. IT-pushed policies apply within 30 minutes.
5. Install apps manually via Company Portal / Self Service.

## 4. Essential Day-1 Configuration (do these even if Autopilot worked)

### Windows 11
- **BitLocker:** Settings → Privacy & security → Device encryption → ON (should already be).
- **Hello (face/fingerprint):** Settings → Accounts → Sign-in options → Set up Windows Hello.
- **Screen lock timeout:** Settings → Accounts → Sign-in options → "When PC has been inactive" → 5 minutes.
- **OneDrive backup:** OneDrive icon → Settings → Backup → Manage backup → enable Documents + Desktop + Pictures.
- **Sleep / power:** Settings → System → Power → Sleep at 30 min when plugged in.
- **Updates:** Settings → Windows Update → Check now.
- **Antivirus:** Defender / CrowdStrike / SentinelOne / etc. should be running (icon in tray).

### macOS
- **FileVault:** System Settings → Privacy & Security → FileVault → confirm ON.
- **Touch ID:** Settings → Touch ID & Password → Add a fingerprint.
- **Screen lock timeout:** Settings → Lock Screen → 5 minutes idle.
- **iCloud Drive:** sign in with personal Apple ID OK; do NOT sync work folders to personal iCloud.
- **Software Update:** System Settings → General → Software Update → check.
- **Privacy → Full Disk Access:** confirm IT's MDM agent + endpoint security have it.

## 5. Migrate from Old Laptop

If migrating, copy these BEFORE the old laptop is wiped:

- Bookmarks: export from browser → import on new.
- Files outside OneDrive / cloud sync.
- Email PST archives (if old setup used local PST).
- Saved Wi-Fi passwords (export from old: `netsh wlan export profile` Windows; Keychain Access macOS).
- App preferences (most apps re-prompt; some have export/import).
- License keys for non-M365 apps (BUY only if you can't find the key).

## 6. The 24-Hour Checklist

By end of Day 1:
- ✅ Outlook receives + sends mail.
- ✅ Teams + OneDrive working.
- ✅ Can access intranet via VPN (if required).
- ✅ Printer driver installed (test print).
- ✅ Browser extensions: 1Password / Bitwarden, ad blocker if policy allows.
- ✅ MFA token bound to this device (sign in to a M365 app fresh → confirm MFA on phone).
- ✅ Calendar populated from server.
- ✅ Slack / Discord / industry-specific tools installed.
- ✅ Backup verification: edit a file in OneDrive Documents → wait 60s → confirm green check (synced).

## 7. When to Call IT
- Autopilot/DEP fails to apply policies (Settings shows you as "personal device" not "work").
- Required corporate app missing from Company Portal / Self Service.
- BitLocker / FileVault recovery key prompts unexpectedly (something went sideways during setup).
- Can't sign into specific corporate app (might need pre-registration on that app's back-end).
- Older laptop replacement: data migration help.

## 8. Prevention Tips
- **Don't sign in with your personal Apple ID** as the primary on a work Mac.
- **Keep OneDrive sync clean** — don't pile up 100 GB of personal photos.
- **Set up your password manager browser extension Day 1** — saves headaches later.

## 9. User-Friendly Explanation
Plug in, power on, connect to Wi-Fi, sign in with your work email — Windows/macOS does the rest automatically if IT pre-staged the device. Within 30 minutes you'll have Outlook, Teams, and OneDrive ready. Take a quick walk through Settings to confirm BitLocker/FileVault is on, screen lock at 5 minutes, and Hello/Touch ID set up. If anything doesn't work after an hour, ping IT.

## 10. Internal Technician Notes
- Autopilot profile assignment via Entra ID Group → Intune Autopilot deployment profile → mapped on device serial number import.
- ESP (Enrollment Status Page) controls user experience during apply. Configure: track app install progress, block until critical apps deploy.
- For Macs: DEP enrolled via Apple Business Manager → MDM server URL → Jamf Pro / Kandji / Intune.
- LAPS (Local Administrator Password Solution) for Win — randomized local admin per device, rotated on use.
- For migration: User State Migration Tool (USMT) for Win OOBE-to-OOBE; Migration Assistant for Mac (slow, often skipped — files via OneDrive instead).
- Required apps to push via Intune: Microsoft 365, Outlook, Teams, OneDrive, Edge Stable, Defender, Company Portal, Authenticator, BitLocker policy, antivirus.
- Optional apps: VS Code, Slack, Zoom, 1Password, Adobe Reader, AnyDesk — Self Service catalog.

## 11. Related KB Articles
- `l1-mfa-001` — MFA setup
- `l2-onboarding-001` — New user (full onboarding from IT side)
- `l1-mobile-email-001` — Email on phone

## 12. Keywords / Search Tags
new laptop, new computer, first boot, oobe, out of box experience, windows 11 setup, macos setup, autopilot, intune enrollment, jamf enrollment, dep, apple business manager, device onboarding, migration, new user setup, day one
