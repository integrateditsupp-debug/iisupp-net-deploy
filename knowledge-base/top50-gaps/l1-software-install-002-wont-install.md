---
id: l1-software-install-002
title: "Software won't install — admin rights, blocked installer, or app store error"
category: software
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You have the installer or app store access", "Admin rights or ability to request them"]
keywords:
  - cant install software
  - admin rights needed
  - this app cant run on your pc
  - smartscreen blocked
  - unidentified developer mac
  - app store error
  - winget install failed
  - cant install msi
  - this installation package cannot be opened
  - administrator privileges required
tags:
  - software
  - install
  - admin-rights
  - top-50
related: [l1-software-install-001-software-install-request, l1-windows-006-app-wont-open]
---

# Software won't install — diagnose and unblock

## Symptoms

- "This app can't run on your PC"
- "Windows protected your PC" (SmartScreen)
- "Administrator privileges required"
- macOS: "[App] can't be opened because Apple cannot check it for malicious software"
- "App can't be opened because the developer cannot be verified"
- App store error / never finishes downloading
- Installer launches then closes immediately
- "The installation package cannot be opened"

## Step 1 — Identify the block type

| Error | Type |
|---|---|
| "Administrator privileges required" | UAC / Admin rights |
| "Windows protected your PC" (blue banner) | SmartScreen / unsigned installer |
| "This app can't run on your PC" | Architecture mismatch (x86/x64/ARM) or compatibility |
| "Apple cannot check it" / "developer cannot be verified" | macOS Gatekeeper |
| App store shows install spinning forever | Account / connection / storage |
| Installer opens then closes | Corrupt download or missing prerequisite |

## Step 2 — Admin rights (most common)

### Windows
1. Right-click installer → **Run as administrator**.
2. UAC prompt → Yes.
3. If you don't have admin: the box was set up by IT and end users are blocked from installing. **Request from IT** via your standard process.

### macOS
1. Apps that need admin: enter your password when prompted.
2. If you're not an admin user on the Mac: ask your admin user to install, or get elevated.

### Corporate-managed devices
- Most managed PCs use Software Center, Company Portal, or Self Service.
- Don't try to install with regular installers — go through the IT-approved store.
- If the app you need isn't in the store: open a ticket asking for it to be added or for a one-time admin elevation.

## Step 3 — Windows SmartScreen (unsigned installer)

For legitimate apps that aren't signed (rare, but happens with smaller indie tools):

1. SmartScreen blue banner: "Windows protected your PC."
2. Click **More info**.
3. Click **Run anyway**.
4. Confirm UAC.
5. Done.

⚠️ **Only do this for apps you trust**. If you downloaded from a random link, don't.

### Persistent SmartScreen on every install
Settings → Privacy & security → Windows Security → App & browser control → Reputation-based protection settings → adjust "Check apps and files" to **Warn** instead of **Block**. (Don't disable entirely.)

## Step 4 — macOS Gatekeeper

For apps not signed with a recognized Apple Developer ID:

1. Try to open the app — you get the "cannot be verified" error.
2. Click **Cancel**.
3. **System Settings → Privacy & Security**.
4. Scroll down to the message at the bottom: "[App] was blocked..."
5. Click **Open Anyway**.
6. Re-launch the app → confirm.

⚠️ Same caution — only for apps you trust.

### Persistent issue
- If you frequently install from non-App-Store sources, the Gatekeeper setting can be relaxed. But Apple in recent macOS versions removed the "Anywhere" option for security.

## Step 5 — Architecture / compatibility

### "This app can't run on your PC"
- Likely 32-bit installer on 64-bit Windows (or vice versa), or x86 installer on ARM Windows.
- Check the app's download page — pick the version matching your PC architecture.
- See your system: Settings → System → About → "System type" (e.g., "64-bit operating system, x64-based processor").

### macOS Intel vs Apple Silicon
- Most apps work on both (Universal binary).
- Some older apps: Intel-only — they run via Rosetta. Mac will auto-install Rosetta on first request. If it doesn't:
  - Right-click app → Get Info → check "Open using Rosetta."

## Step 6 — App store install errors

### Microsoft Store stuck
- Settings → Apps → Apps & features → search Microsoft Store → Advanced options → **Reset** (or Repair first).
- Restart.
- Try install again.

### Mac App Store stuck
- Sign out of Apple ID in App Store → sign back in.
- Or restart the Mac.

### iOS / Android
- Cellular data limit blocks large apps. Try Wi-Fi.
- Storage full — see `l1-storage-001-disk-full`.
- App store account region mismatch — sign out, sign in correctly.

## Step 7 — Installer opens then closes / Corrupt download

1. Re-download from the original source (don't trust cached download).
2. Disable antivirus temporarily during install (re-enable after).
3. Check installer size — should match what the website lists.
4. Try a different download mirror if available.

## Step 8 — Missing prerequisite

Many apps need a runtime: .NET Framework, .NET Runtime, Visual C++ Redistributable, Java.

If installer fails with "missing X" error:
- Windows: install Visual C++ Redistributables (all versions, free from Microsoft).
- .NET: Windows Update usually installs the right version; or download from microsoft.com.
- Java: only install if explicitly required — many apps don't need it anymore.

## Step 9 — `winget` / `choco` / `brew` (CLI installers)

If you're a power user and Microsoft Store install fails:

**Windows:**
```
winget install <app-name>
```
or with Chocolatey: `choco install <app-name>`

**Mac:**
```
brew install <app-name>
```

These avoid Store and Gatekeeper friction entirely.

## When to escalate

| Situation | Path |
|---|---|
| Admin rights blocked, app is business-critical | L1 — IT grants elevation or pre-approves the app |
| Same app fails to install on multiple PCs | L2 — possibly conflict with endpoint security or AppLocker |
| Need software not in IT's approved list | L1 → procurement |
| Installer modifies system files and fails halfway | L2 — system file repair may be needed |
| Persistent SmartScreen block on legitimate vendor app | L2 — IT can whitelist the publisher |

## Prevention

- Keep a list of apps you legitimately need. Submit them once to IT in a batch.
- Always download installers from the official vendor site, not mirror/forum links.
- For ongoing software needs: ask IT to add to Software Center / Company Portal.
- Don't install from email attachments — even if from a coworker.

## What ARIA can help with

ARIA can identify which block type you're hitting from the error text, walk you through the bypass (when safe), and draft the IT ticket if the app needs admin approval. ARIA cannot grant admin rights or override SmartScreen / Gatekeeper.
