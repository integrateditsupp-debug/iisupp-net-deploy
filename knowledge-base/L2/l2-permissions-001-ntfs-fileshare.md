---
id: l2-permissions-001
title: "NTFS / file share permissions: access denied, broken inheritance, audit"
category: permissions
support_level: L2
severity: medium
estimated_time_minutes: 30
audience: admin
prerequisites: ["File server admin", "AD groups admin"]
os_scope: ["Windows Server", "Windows 10/11 file shares"]
keywords:
  - ntfs
  - permissions
  - access denied
  - share
  - inheritance
  - take ownership
  - icacls
  - effective access
related_articles:
  - l2-sharepoint-001
  - l2-active-directory-001
escalation_trigger: "Cross-forest, broken ACL on critical share, or active investigation/audit"
last_updated: 2026-05-07
version: 1.0
---

# NTFS / share permissions

## 1. Symptoms
- "Access denied" on file/folder despite group membership.
- Inheritance broken at unexpected level.
- New user added to group still cannot open.
- Cannot delete file (locked / orphan permissions).

## 2. Diagnosis
**Effective Access:**
- File Properties → Security → Advanced → Effective Access tab → pick user/group → View effective access.

**ACL inspection:**
- `icacls "C:\Path\To\Folder"` — current ACEs.
- `icacls "C:\Path\To\Folder" /verify` — list inconsistencies.

**Share permissions:**
- Most restrictive of share + NTFS applies.
- `Get-SmbShareAccess -Name <share>` shows share ACL.

**Token bloat:**
- User in 50+ groups can hit Kerberos token size cap; symptoms: random access denied, sign-in delays.

## 3. Resolution
**Add missing perm:**
- Add via Properties → Security or `icacls "C:\Path" /grant "DOMAIN\Group:(OI)(CI)M"`.

**Restore inheritance:**
- Properties → Security → Advanced → Enable Inheritance.

**Reset broken ACL:**
- `icacls "C:\Path" /reset /T /C` — resets to inherit. Use carefully.

**Take ownership (orphan):**
- `takeown /F "C:\Path" /R /D Y` then `icacls "C:\Path" /grant Administrators:F /T`.

**Token size:**
- Increase MaxTokenSize via GPO; or reduce group memberships.

## 4. Verification
- Affected user opens / saves / deletes target.
- Effective Access shows expected.
- Inheritance reflects intent.
- 3 sample paths random-tested.

## 5. Escalation
- Cross-forest trust ACL.
- Mass restoration (DR scenario).
- Forensic preservation in progress.
- → L3.

## 6. Prevention
- Use security groups, not direct user grants.
- Document ACL design at share root; let inheritance carry.
- Avoid Deny ACEs unless absolutely required.
- Quarterly access review.
- Monitor for changes via auditing (4670, 4663).

## 7. Notes
- AGDLP model: Account → Global → Domain Local → Permission.
- Don't use Everyone for production data.
- "Authenticated Users" includes computer accounts — careful on services.
- For ABE (Access-Based Enumeration), users see only what they can access — reduces support tickets.

## 8. Related
- l2-sharepoint-001 — Cloud equivalent
- l2-active-directory-001 — Group membership issues

## 9. Keywords
ntfs, permissions, access denied, share, inheritance, take ownership, icacls, effective access
