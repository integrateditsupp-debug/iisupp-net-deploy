---
id: l2-bitlocker-001
title: "BitLocker: recovery key retrieval and re-protection"
category: bitlocker
support_level: L2
severity: high
estimated_time_minutes: 20
audience: admin
os_scope: ["Windows 10", "Windows 11"]
prerequisites: ["Entra Cloud Device Administrator", "AD BitLocker recovery info read"]
keywords:
  - bitlocker
  - recovery key
  - recovery prompt
  - tpm reset
  - hardware change
  - manage-bde
  - protector
related_articles:
  - l1-windows-002
  - l2-intune-001
escalation_trigger: "No recovery key in any directory; data may be unrecoverable. Or hardware platform regression after BIOS update."
last_updated: 2026-05-07
version: 1.0
---

# BitLocker recovery key retrieval and re-protection

## 1. Symptoms
- "Enter the recovery key for this drive" prompt at boot.
- After BIOS / firmware update, BitLocker triggered protection.
- Disk swapped, board replaced, TPM cleared.
- `manage-bde -status` shows protection ON but TPM protector missing.

## 2. Likely Causes
1. Hardware change broke TPM seal.
2. Firmware / UEFI updated outside Microsoft-blessed path.
3. Boot configuration changed (Secure Boot toggled).
4. PCR values changed.
5. Disk moved to another machine.
6. Genuine encryption integrity event.

## 3. Retrieving the recovery key
**Cloud-joined (Azure AD / Entra) device:**
- Entra portal → Devices → Devices → find device → Recovery keys (left blade).
- User self-service: https://account.microsoft.com/devices/recoverykey (personal MS) or https://myaccount.microsoft.com/device-list (work).

**Hybrid / AD-joined:**
- ADUC (or RSAT) → Computer object → BitLocker Recovery tab → list of stored keys.
- Or PowerShell: `Get-ADObject -Filter {ObjectClass -eq "msFVE-RecoveryInformation"} -SearchBase "CN=<computer>,..." -Properties msFVE-RecoveryPassword`.

**Intune (cloud-managed):**
- Endpoint Manager → Devices → device → Recovery keys.

**Local backup:**
- USB / printed copy created at encryption time (user kept it).

## 4. Resolution / Re-Protection
1. Boot using recovery key.
2. After login, open admin Command Prompt:
   ```
   manage-bde -status C:
   manage-bde -protectors -get C:
   ```
3. If TPM protector missing:
   ```
   manage-bde -protectors -delete C: -type RecoveryPassword
   manage-bde -protectors -add C: -tpm
   manage-bde -protectors -add C: -RecoveryPassword
   manage-bde -protectors -get C:    # confirm new password
   ```
4. Force backup of new key to AAD/AD/Intune:
   - For Intune-managed: `BitLocker.exe -BackupToAAD -Password <numeric ID>` (or the BackupToAD cmdlet); next sync uploads.

## 5. Verification
- `manage-bde -status` → TPM, Numerical Password, External Key (if used) listed.
- New recovery key visible in directory of record.
- Reboot completes without recovery prompt.

## 6. Escalation Trigger
- No recovery key anywhere — data unrecoverable; treat as a data-loss event.
- Hardware regression after BIOS update repeats across fleet.
- → Escalate to **L3** for fleet-wide remediation.

## 7. Prevention
- Always escrow keys to AAD/AD/Intune at encryption time. Verify by spot check.
- Use Microsoft-blessed firmware update method (Dell Command Update, HP Manager, Lenovo Vantage) — many BIOS updates suspend BitLocker automatically.
- Suspend BitLocker manually before risky firmware changes:
  ```
  manage-bde -protectors -disable C: -RebootCount 1
  ```
- Avoid Secure Boot toggling on encrypted disks.

## 8. Internal Technician Notes
- TPM PCRs that BitLocker measures (default): 0, 2, 4, 7, 11. PCR 7 (Secure Boot) is the usual culprit on firmware change.
- For platforms that don't survive firmware updates clean, customize PCR profile via GPO/Intune (avoid PCR 7) — security trade-off.
- For machine name change / hardware ID change, AAD device record may go stale; ensure single device record per physical machine.
- For recovery key BackupToAAD failure, check `Microsoft-Windows-BitLocker-API/Management` event log.
- Intune Encryption report + Endpoint security blade is the single pane of glass for fleet status.

## 9. User-Friendly Explanation
"Your laptop's encryption was triggered to ask for the recovery key — usually because something at the firmware or hardware layer changed. We have your key on file, we'll unlock the drive, and then re-secure it so it doesn't ask again."

## 11. Related KB Articles
- l1-windows-002 — Won't boot / BitLocker prompt
- l2-intune-001 — Intune compliance and encryption settings

## 12. Keywords / Search Tags
bitlocker, recovery key, recovery prompt, tpm reset, hardware change, manage-bde, protector
