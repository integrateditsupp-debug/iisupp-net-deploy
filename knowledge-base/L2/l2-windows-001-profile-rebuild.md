---
id: l2-windows-001
title: "Windows user profile corrupted / temp profile / rebuild"
category: windows
support_level: L2
severity: high
estimated_time_minutes: 45
audience: admin
prerequisites: ["Local admin on user device", "Domain admin if AD/AAD-joined"]
os_scope: ["Windows 10", "Windows 11"]
keywords:
  - profile corrupted
  - temp profile
  - profile rebuild
  - we can't sign in to your account
  - user shell folders
  - regedit profilelist
related_articles:
  - l1-windows-006
  - l2-active-directory-001
escalation_trigger: "Roaming profile / FSLogix corruption affecting multiple users"
last_updated: 2026-05-07
version: 1.0
---

# Windows user profile rebuild

## 1. Symptoms
- "We can't sign in to your account" → temporary profile loaded.
- Desktop empty after sign-in.
- Apps don't see user data.
- Profile folder bloated / locked.
- Specific user has issues; another user on same PC fine.

## 2. Diagnostic
- Event Viewer → Application → Source = User Profile Service.
- ProfileList registry: `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\<SID>`.
- `.bak` suffix on user's SID key = corrupted load.

## 3. Resolution
**Standard rebuild (single user):**
1. Sign out user; sign in as local admin.
2. Back up user's data: `C:\Users\<user>\` → external location (Documents, Desktop, AppData if needed).
3. Open System Properties → Advanced → User Profiles → Settings → select profile → Delete.
4. Or via registry: delete `ProfileList\<SID>` and `ProfileList\<SID>.bak` (if present).
5. Reboot.
6. User signs in fresh — new profile created.
7. Restore data from backup into new profile.
8. Reconfigure Office accounts, OneDrive, etc.

**For OneDrive users (cleaner):**
- Their OneDrive Known Folders (Desktop, Docs, Pictures) restore automatically once they sign back in.
- Outlook OST rebuilds from server.
- Browser data may need fresh sign-in / sync.

**FSLogix profile issues (RDS / AVD):**
- Take container offline (admin action).
- Mount VHD(X) on tech workstation, validate or extract.
- Replace with fresh container if corrupt.

## 4. Verification
- User signs in to permanent profile (not temp).
- Documents, settings, and apps work.
- ProfileList no `.bak` keys for this user.
- Event log clean.

## 5. Escalation
- Multiple users hitting same issue → roaming/FSLogix infra.
- Domain controller side ACL/group issue.
- → L3.

## 6. Prevention
- For shared PCs, use proper OneDrive Known Folder Move.
- Don't store work-critical data in C:\Users\<u>\.
- Patch UPHCLEAN-related issues (legacy, but still occasional).
- For RDS, monitor container performance + size.

## 7. Notes
- Profile size cap: nothing inherent, but oversized profiles slow logon dramatically. Trim AppData regularly.
- Temp profile warning: `notify` event 1530 in Application log when profile not unloading cleanly.
- ProfileList .bak: indicator profile load failed; rename procedure: rename SID to SID.old, rename SID.bak to SID, sign in.
- OneDrive Known Folder Move + Office apps tied to MSA make profile rebuild far less destructive.

## 8. Related
- l1-windows-006 — App won't open (sometimes profile-symptom)
- l2-active-directory-001 — Identity foundational

## 9. Keywords
profile corrupted, temp profile, profile rebuild, we can't sign in to your account, user shell folders, regedit profilelist
