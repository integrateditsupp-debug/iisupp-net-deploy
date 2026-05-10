---
id: l1-windows-006
title: "An app won't open / closes immediately / shows error on launch"
category: windows
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: []
keywords:
  - app won't open
  - app crashes
  - exe won't run
  - application error
  - not opening
  - closes immediately
related_articles:
  - l1-windows-003
  - l2-windows-001
escalation_trigger: "Multiple apps fail to launch (system-wide), or specific app crashes after reinstall"
last_invalidated: 2026-05-07
version: 1.0
---

# An app won't open / closes immediately

## 1. Symptoms
- Double-click icon, nothing happens.
- App splash flashes then disappears.
- "This app can't run on your PC".
- "The application was unable to start correctly (0xc000007b)".
- Black window flashes and closes.

## 2. Likely Causes
1. Corrupted app install / update interrupted.
2. Missing dependency (Visual C++ Redistributable, .NET, DirectX).
3. Antivirus blocking the executable.
4. User permissions (running as wrong user).
5. Compatibility issue — app expects older Windows.
6. Conflicting background process.
7. Profile corruption (specific to one user account).

## 3. Questions To Ask User
1. When did it last open successfully?
2. Did you install / update the app or Windows recently?
3. Do you see any error message at all?
4. Does it work for another user logged in to the same PC?
5. Is the app installed for all users, or just you?

## 4. Troubleshooting Steps
1. Restart the PC. Solves a quarter of these.
2. Right-click app → Run as administrator (rules in or out a permissions issue).
3. Open Event Viewer → Windows Logs → Application → look for error matching app launch time.
4. Check if a different user on same PC can launch it.
5. Open Task Manager → confirm no zombie process from prior launch (kill if present).

## 5. Resolution Steps
**Repair the app:**
- Settings → Apps → Installed apps → app → ⋮ → Modify / Repair (where supported, e.g., M365, most enterprise apps).

**Reinstall:**
- Uninstall via Settings → Apps → Installed apps.
- Restart.
- Reinstall from official source.

**Missing runtime:**
- For "0xc000007b" or "MSVCP*.dll missing" → install latest Visual C++ Redistributables (x86 + x64) from Microsoft.
- For ".NET Framework x.x is required" → install via Settings → Optional features.

**Compatibility:**
- Right-click .exe → Properties → Compatibility tab → Run this program in compatibility mode for Windows 7/8 → try.

**Antivirus:**
- Check Windows Security → Virus & threat protection → Protection history. If app blocked, restore + add exclusion (only if from known-good vendor).

**User profile corrupt:**
- Test with a different user account. If app launches for them and not for current user → profile rebuild required (escalate to L2).

## 6. Verification Steps
- App launches and reaches its main window in <30 sec.
- App's primary function works (open file / save / log in).
- 3 consecutive launches succeed without issue.

## 7. Escalation Trigger
- Multiple apps won't launch — system-wide problem.
- Reinstall doesn't resolve and app is critical.
- Compatibility / DLL hell unresolvable at L1.
- User profile suspected corrupted.
- → Escalate to **L2** with: app name + version, error code, Event Viewer entry, attempted fixes.

## 8. Prevention Tips
- Don't kill an app installer mid-flight.
- Keep Visual C++ and .NET runtimes current.
- Don't allow random "uninstaller" apps to delete shared runtimes.
- Whitelist legitimate work apps in security software during install.
- Reboot weekly.

## 9. User-Friendly Explanation
"The app's having trouble starting. Often it's a missing piece it needs (a runtime), or its install got corrupted, or something is blocking it. We'll repair it first, then check Event Viewer for clues, and reinstall fresh if needed. Most apps come back with a 5-minute fix."

## 10. Internal Technician Notes
- Useful Event Viewer filter: Application log, Source = `Application Error` or `.NET Runtime`. Match by exe name + timestamp.
- 0xc000007b classic = mixing 32 vs 64-bit DLLs; ensure correct VC++ redist (both x86 and x64).
- For Store / MSIX apps that won't launch: `Get-AppxPackage` to check state; `Get-AppxLog` for install errors. Reset via Settings → Apps → app → Advanced → Reset.
- Profile corruption test: log on with admin/test account → run app. If works → use ProfWiz or rebuild user profile.
- For per-user installs in C:\Users\<u>\AppData\Local\Programs\, check that AV didn't quarantine pieces.

## 11. Related KB Articles
- l1-windows-003 — Slow PC / app launch slow
- l2-windows-001 — User profile rebuild

## 12. Keywords / Search Tags
app won't open, app crashes, exe won't run, application error, not opening, closes immediately, 0xc000007b
