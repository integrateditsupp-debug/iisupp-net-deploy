---
id: l1-newdevice-001
title: "Set up a new work laptop — first boot and sign-in"
category: onboarding
support_level: L1
severity: low
estimated_time_minutes: 30
audience: end-user
os_scope: ["Windows 11","Windows 10","macOS"]
prerequisites: []
keywords: ["new laptop first boot","got a new laptop","new device setup","first boot setup","set up my new computer","new computer setup","autopilot enrollment","new pc setup","setting up new laptop","first time setup","oobe setup","enroll new device","new work computer","getting started new laptop"]
related_articles: ["l1-m365-001","l1-mfa-001","l1-onedrive-001"]
escalation_trigger: "Setup stalls during enrollment/provisioning, the device won't join the company account, or required apps never install after sign-in."
last_updated: 2026-06-24
version: 1.0
---

# Set up a new work laptop — first boot and sign-in

## 1. Symptoms
- You received a new work laptop and need to set it up for the first time.
- The screen shows the out-of-box setup (region, keyboard, network, sign-in).
- You're unsure whether to sign in with your work account or a personal one.
- The device is "getting ready" or installing things and you don't know how long to wait.
- Your apps and files aren't there yet on the brand-new machine.

## 2. Likely Causes
1. This is a normal first-boot (OOBE) — the device just needs to be configured and enrolled.
2. The device is provisioning through Windows Autopilot / company enrollment, which runs automatically after you connect to the internet and sign in.
3. Apps install automatically after enrollment and take time on first boot.
4. Your files live in OneDrive/SharePoint and sync down after you sign in, rather than being pre-loaded.

## 3. Questions To Ask User
1. Is it a Windows laptop or a Mac?
2. Is this your first time turning it on (fresh out-of-box screen)?
3. Do you have a working Wi-Fi or wired network nearby, and the password?
4. Do you know your full work email, password, and have your MFA method (Authenticator/phone) ready?
5. Were you told this device uses Autopilot / automatic company setup?

## 4. Troubleshooting Steps
1. **Plug in power** and keep it plugged in for the whole setup.
2. **Connect to a network early.** Choose your Wi-Fi (or plug in Ethernet) at the network step — enrollment needs internet.
3. **Have MFA ready.** Keep your phone with Microsoft Authenticator nearby; you'll approve a prompt during sign-in.
4. **Sign in with your WORK account**, not a personal Microsoft account, when asked for email — this is what triggers company enrollment.
5. **Be patient on "Setting up your device."** Autopilot can take 10-30+ minutes to apply policies and install apps; don't power off mid-way.

## 5. Resolution Steps
**Windows (OOBE / Autopilot):**
1. Power on; choose **region** and **keyboard**.
2. Connect to **Wi-Fi or Ethernet**.
3. At the sign-in screen, enter your **work email and password**, then **approve the MFA prompt**.
4. Let the device run **"Setting up your device / account"** (Autopilot Enrollment Status Page) — it applies security settings and installs core apps. Leave it plugged in and online.
5. When you reach the desktop, **open the Company Portal / Software Center** (if present) to install any optional apps you need.
6. **Sign in to OneDrive** so your files start syncing; sign in to Outlook and Teams.

**macOS (company-enrolled):**
1. Power on; choose region, keyboard, and **connect to a network**.
2. Sign in / complete **Remote Management / enrollment** when prompted (this registers the Mac with the company).
3. Create your local account, then **sign in to Microsoft 365 apps** (Outlook, Teams) with your work account and approve MFA.
4. Let managed apps install, then sign in to OneDrive to sync files.

## 6. Verification Steps
- You reach the desktop and can open Outlook with email flowing.
- Teams signs in and shows green presence.
- OneDrive shows it is syncing / "Up to date."
- Core company apps are installed (or installing) without errors.
- The device shows as enrolled/compliant in IT's console (IT can confirm).

## 7. Escalation Trigger
- Setup stalls or errors during the **Enrollment Status Page** / provisioning.
- The device won't accept the work account or says it can't join the organization.
- Required apps never install after you reach the desktop.
- OneDrive won't sign in or files don't sync after a reasonable wait.
- → Escalate to **L2** with: device make/model and serial, the exact step/error, network type, and your work email (UPN).

## 8. Prevention Tips
- Always do first-boot on a reliable network and on power.
- Use your work account (not personal) at sign-in so policies apply.
- Don't skip MFA setup — finishing it now avoids lockouts later.
- Keep files in OneDrive/SharePoint so a future new device just syncs them back.
- Don't power off during "Setting up your device"; interrupting enrollment can require a reset.

## 9. User-Friendly Explanation
"A new work laptop sets itself up mostly on its own once you connect to Wi-Fi and sign in with your work email. After you sign in, it spends 10-30 minutes quietly applying our security settings and installing your apps — that 'getting ready' screen is normal, so just leave it plugged in. Your files aren't missing; they live in OneDrive and download once you sign in. Within about half an hour you'll have email, Teams, and your apps ready to go."

## 10. Internal Technician Notes
- Windows Autopilot: device must reach Entra/Intune over the internet during OOBE; the Enrollment Status Page (ESP) blocks the desktop until required apps/policies land. ESP timeouts are the most common stall point.
- Confirm the device's hardware hash is registered (Autopilot deployment profile) before shipping, or it falls back to standard OOBE.
- macOS: relies on ABM/ASM + MDM (Intune/Jamf) Automated Device Enrollment; "Remote Management" screen = supervised enrollment.
- If user signed in with a personal MSA by mistake, the device won't enroll — may need to reset OOBE.
- OneDrive Known Folder Move (KFM) usually redirects Desktop/Documents/Pictures automatically; verify it engaged so the user's profile data is protected.
- Check enrollment/compliance state in Intune (Devices) and Entra (device join state, `dsregcmd /status` on Windows).

## 11. Related KB Articles
- l1-m365-001 — Can't sign in to Microsoft 365
- l1-mfa-001 — MFA setup, lost device, and recovery
- l1-onedrive-001 — OneDrive not syncing

## 12. Keywords / Search Tags
new laptop first boot, got a new laptop, new device setup, first boot setup, set up my new computer, new computer setup, autopilot enrollment, new pc setup, oobe setup, enroll new device, first time setup
