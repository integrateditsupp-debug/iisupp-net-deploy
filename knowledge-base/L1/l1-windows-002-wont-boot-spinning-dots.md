---
id: l1-windows-002
title: "Windows won't boot — stuck on spinning dots or black screen"
category: windows
support_level: L1
severity: high
estimated_time_minutes: 25
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: []
keywords:
  - won't boot
  - stuck on logo
  - spinning dots
  - black screen
  - boot loop
  - automatic repair loop
  - windows not loading
related_articles:
  - l1-windows-001
  - l2-bitlocker-001
  - l3-disaster-recovery-002
escalation_trigger: "BitLocker recovery key prompt appears, or boot fails after 2 startup-repair cycles, or storage SMART warnings present"
last_updated: 2026-05-07
version: 1.0
---

# Windows won't boot — stuck on spinning dots or black screen

## 1. Symptoms
- Manufacturer logo + spinning dots loop indefinitely.
- "Preparing Automatic Repair" appears repeatedly — never resolves.
- Black screen after POST with only a cursor.
- BitLocker recovery key prompt appears unexpectedly.
- "Boot device not found" or "No bootable medium" message.

## 2. Likely Causes
1. Failed Windows update or interrupted shutdown corrupted boot files.
2. Bad sectors on the system drive or failing SSD/HDD.
3. BCD (Boot Configuration Data) corruption.
4. New hardware (especially RAM, storage, or external boot device) changed boot order.
5. BitLocker triggered protection mode after firmware/hardware change.
6. Disk fully encrypted and TPM cleared.

## 3. Questions To Ask User
1. What exactly do you see on screen (read it word-for-word, or photo)?
2. Did the PC shut down normally last time, or was there a power loss / forced shutdown?
3. Has any hardware changed — new RAM, SSD, dock, USB drive plugged in?
4. Is BitLocker enabled? (Corporate-managed devices typically yes.)
5. Do you have your BitLocker recovery key (Microsoft account or organization portal)?
6. Did Windows Update install anything in the last 24 hours before the issue?

## 4. Troubleshooting Steps
1. Disconnect ALL external USB devices except keyboard and mouse, then reboot.
2. Force three failed boots: power on → as soon as Windows logo appears, hold power button until off → repeat. After the third attempt Windows enters Recovery Environment (WinRE).
3. From WinRE: Troubleshoot → Advanced options → Startup Repair. Let it run.
4. If Startup Repair fails, return to Advanced options → Command Prompt and run:
   - `bootrec /fixmbr`
   - `bootrec /fixboot` (if "Access denied", run `bootsect /nt60 sys` first)
   - `bootrec /scanos`
   - `bootrec /rebuildbcd`
5. Run `chkdsk C: /f /r` from the same CMD.

## 5. Resolution Steps
**If above completes successfully:**
1. Exit and reboot. Most boot-config issues resolve here.

**If BitLocker prompt appears:**
1. Retrieve the recovery key from one of:
   - User's Microsoft account → https://account.microsoft.com/devices/recoverykey
   - Azure AD / Entra ID portal (admin) → Devices → Device → BitLocker keys
   - Active Directory (admin) → Computer object → BitLocker tab
2. Enter the 48-digit key.
3. Once booted, run `manage-bde -protectors -get C:` to confirm protector state, and re-enable TPM protector if needed.

**If still stuck:**
1. Boot from a Windows 10/11 USB installer.
2. Choose "Repair your computer" → Troubleshoot → System Restore. Pick a restore point from before the failure.
3. Or: Reset this PC → Keep my files (last resort before reimaging).

## 6. Verification Steps
- Windows boots to the lock screen and accepts credentials.
- Event Viewer (after login) shows no `bugcheck` or `disk` errors in the last hour.
- All apps the user relies on launch successfully.
- BitLocker reports "Protection On" via `manage-bde -status`.

## 7. Escalation Trigger
- After two cycles of Startup Repair + bootrec, system still won't boot.
- BitLocker recovery key cannot be located in any directory.
- SMART data shows warning/critical attributes on the system drive.
- Repeat boot failures after a successful repair within 7 days.
- → Escalate to **L2** for image-based recovery, or **L3** if hardware replacement is suspected.

## 8. Prevention Tips
- Always allow Windows updates to complete fully before shutting down.
- Use UPS power on critical desktops.
- Confirm BitLocker keys are escrowed to Azure AD / on-prem AD before encryption.
- Keep a known-good recovery USB on hand for critical user laptops.
- Watch SMART data quarterly with CrystalDiskInfo or vendor tooling.

## 9. User-Friendly Explanation
"Your computer is having trouble starting up. Often it's a small file Windows uses to know where to load itself from — we can usually rebuild that in a few minutes. If your work device is encrypted, we may need a recovery key from your IT records to unlock it. We'll get you running and figure out what triggered it so it doesn't happen again."

## 10. Internal Technician Notes
- WinRE auto-trigger: 3 consecutive failed boots. If WinRE doesn't appear, the recovery partition may be deleted or the BCD entry for it is missing.
- Useful command from WinRE CMD: `bcdedit /enum all` — surfaces any orphaned or wrong-disk OS entries.
- For UEFI systems with EFI partition issues: `mountvol Z: /S` then rebuild EFI: `bcdboot C:\Windows /s Z: /f UEFI`.
- BitLocker: if TPM is reset, recovery key required ONCE to re-establish trust. Document the firmware/UEFI change cause.
- If `bootrec /fixboot` returns Access Denied on UEFI, that's expected — the EFI partition needs `bcdboot`.
- Image deployment fallback: PXE / Intune Autopilot reset → user productivity in <90 min on managed hardware.

## 11. Related KB Articles
- l1-windows-001 — Blue screen of death (BSOD)
- l2-bitlocker-001 — BitLocker recovery key retrieval and re-protection
- l3-disaster-recovery-002 — User device reimage workflow

## 12. Keywords / Search Tags
won't boot, stuck on logo, spinning dots, black screen, boot loop, automatic repair loop, windows not loading, bcd, bootrec, bitlocker recovery, computer dead
