---
id: l2-intune-001
title: "Intune device compliance: device shows non-compliant or fails to enroll"
category: intune
support_level: L2
severity: high
estimated_time_minutes: 30
audience: admin
os_scope: ["Windows 10", "Windows 11", "iOS", "Android", "macOS"]
prerequisites: ["Intune Administrator", "Endpoint Manager portal access"]
keywords:
  - intune
  - device compliance
  - not compliant
  - autopilot
  - enrollment failed
  - hybrid join
  - company portal
  - device not registered
related_articles:
  - l2-azure-ad-001
  - l2-bitlocker-001
  - l3-endpoint-001
escalation_trigger: "Mass enrollment failure, or compliance regression after policy change, or Autopilot ESP timeout"
last_updated: 2026-05-07
version: 1.0
---

# Intune device compliance / enrollment

## 1. Symptoms
- Intune portal shows device "Not compliant" with reason.
- "Your device does not meet your organization's requirements."
- Autopilot ESP (Enrollment Status Page) hangs or times out.
- "Hybrid Azure AD join" failing.
- Company Portal app shows "Couldn't add device".
- New device not appearing in Intune at all.

## 2. Likely Causes
1. BitLocker not enabled where required.
2. Encryption method mismatch (TPM only vs PIN).
3. AV signatures out of date.
4. Compliance policy targets wrong OS edition.
5. Autopilot profile not assigned, or hardware hash not registered.
6. Hybrid join: no line-of-sight to AD during enrollment.
7. User-driven Autopilot but user not in target group.

## 3. Questions To Ask / Verify
- Device serial / Azure AD device ID?
- Compliance policy assigned (ID + name)?
- Is the device in the right Azure AD group for Autopilot profile?
- What Autopilot stage failed (Device prep, Device setup, Account setup)?
- Hardware hash present in `Get-AutopilotDevice`?

## 4. Troubleshooting Steps
1. Endpoint Manager → Devices → all devices → find device → Compliance.
2. Note exactly which compliance setting is failing.
3. Devices → Enrollment status → if Autopilot, view per-device deployment status.
4. On device: Settings → Accounts → Access work or school → click connection → Info → Sync.
5. Pull `MDM Diagnostics report` from device: Settings → Accounts → Access work or school → Export your management log files.

## 5. Resolution Steps
**Compliance reason: BitLocker:**
- Verify on device: `manage-bde -status C:` shows "Protection On".
- If missing, push BitLocker policy via Intune; ensure TPM present (`tpm.msc`).

**Compliance reason: AV signatures:**
- Update Defender: Win+R → `cmd` → `"C:\Program Files\Windows Defender\MpCmdRun.exe" -SignatureUpdate`.

**Autopilot device not registered:**
1. Run on the device (admin PowerShell): `Install-Script Get-WindowsAutopilotInfo -Force; Get-WindowsAutopilotInfo.ps1 -Online`.
2. Provide creds with Intune permission. This uploads hardware hash to Autopilot service.
3. Wait 5–10 min, then run user OOBE.

**Autopilot profile assignment:**
- Endpoint Manager → Devices → Enroll → Deployment Profiles → assigned to group containing this device.
- Confirm group includes by device ID, not just user.

**Hybrid AAD join (more complex):**
- Confirm on-prem AD Connect SCP set: `Get-ADObject -Identity "CN=62a0ff2e-97b9-4513-bf6b-4a0aabe4ba9c,CN=Device Registration Configuration,CN=Services,CN=Configuration,$(Get-ADRootDSE).configurationNamingContext)" -Properties keywords`.
- Confirm device successfully creates `dsregcmd /status` shows AzureAdJoined: YES, DomainJoined: YES.

**Wipe and reset:**
- Endpoint Manager → device → Wipe (Autopilot reset) — re-runs OOBE clean.

## 6. Verification Steps
- Device shows "Compliant" in Intune.
- `dsregcmd /status` shows AzureAdJoined: YES, EnterpriseJoined / DomainJoined: YES (if hybrid).
- Conditional Access sign-in shows "Compliant: Yes".
- User can access targeted resources.

## 7. Escalation Trigger
- Mass enrollment failure (>5 devices same week).
- Compliance regression after policy edit affects >10 devices.
- Autopilot ESP timeout (>1h) on standard profile.
- AAD Connect or hybrid join service issue.
- → Escalate to **L3** with: device count, policy IDs, MDM diag bundles, AAD Connect logs.

## 8. Prevention Tips
- Always pilot policy changes against a small test group before tenant-wide.
- Pre-register Autopilot hashes at hardware vendor (Dell / HP / Lenovo can do this for procurement).
- Maintain a dedicated test device for compliance validation.
- Monitor Endpoint Manager → Reports → Compliance daily.
- Document policy intent + target.

## 10. Internal Technician Notes
- MDM diag log path: `%programdata%\Microsoft\IntuneManagementExtension\Logs\` — `IntuneManagementExtension.log`, `AgentExecutor.log`.
- Autopilot enrollment phases: device prep, device setup, account setup. Each has timeouts (default ~60 min total).
- For hybrid: domain controller line-of-sight at OOBE = Always-On VPN before login OR direct LAN.
- BitLocker compliance race: device may report compliant before encryption finishes; allow 4h grace.
- `Get-AutopilotDevice` (graph) requires `WindowsAutoPilot.ReadWrite` scope.
- For ESP "Account Setup" hang, often Win32 app with bad detection rule — review `IntuneManagementExtension.log` for app deploy errors.

## 11. Related KB Articles
- l2-azure-ad-001 — Conditional Access
- l2-bitlocker-001 — BitLocker recovery and policy
- l3-endpoint-001 — Endpoint architecture and incident response

## 12. Keywords / Search Tags
intune, device compliance, not compliant, autopilot, enrollment failed, hybrid join, company portal, device not registered
