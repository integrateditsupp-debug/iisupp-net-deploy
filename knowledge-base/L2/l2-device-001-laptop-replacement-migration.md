---
id: l2-device-001
title: "Laptop replacement / refresh: migrate a user to a new device with no data loss"
category: device-lifecycle
support_level: L2
severity: medium
estimated_time_minutes: 90
audience: technician
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: ["Replacement device available", "User's data is in OneDrive/known-folder-redirected or backed up", "Intune/Autopilot for corporate devices"]
keywords:
  - laptop replacement
  - device refresh
  - new laptop migration
  - move to new computer
  - data migration
  - hardware swap
  - device refresh runbook
  - transfer files new pc
  - decommission old laptop
related_articles:
  - l1-newdevice-001
  - l2-intune-002
  - l2-offboarding-001
escalation_trigger: "Bulk fleet refresh / imaging program design, or recovery of data that exists only on a failed local disk — data-recovery vendor / L3 program work."
last_updated: 2026-05-26
version: 1.0
---

# Laptop replacement / refresh — migrate with no data loss

## 1. Symptoms / Requests
- "My laptop is being replaced — move everything over."
- Scheduled hardware refresh (lease end / 3–5 year lifecycle).
- Device failing (battery, performance, damage) and needs swapping.
- New hire was issued the wrong/temporary device and needs the standard build.

## 2. Goal / Definition of Done
1. User signed in on the new device with all apps, mail, and files.
2. **Zero data loss** — everything previously on the old device is accessible on the new one (ideally because it was in OneDrive/SharePoint all along).
3. Old device wiped, unenrolled, and returned/decommissioned.
4. Asset records updated.

## 3. Pre-Migration Questions / Checklist
1. What's on the old device that is **only local** (Desktop/Documents not redirected, local PSTs, app data, certificates, browser profiles, line-of-business app local databases)?
2. Is **OneDrive Known Folder Move** active (Desktop/Documents/Pictures already in the cloud)?
3. Any **encryption** (BitLocker/FileVault) — do we have the recovery key before touching the disk?
4. Specialized software / licenses / hardware dongles to re-activate?
5. Local admin or saved credentials the user will need re-established?
6. Is the new device corporate (Autopilot) or a manual build?

## 4. Migration Steps
**A) Capture what's only local (before anything):**
1. Confirm/turn on **OneDrive Known Folder Move** on the old device and let Desktop/Documents/Pictures finish syncing (status = green check).
2. Identify and back up genuinely local items: local **PSTs**, browser bookmarks/profiles (or rely on Edge/Chrome profile sync), app config, signed **certificates** (export if needed), local LOB app data.
3. Verify the **BitLocker/FileVault recovery key** is escrowed in Entra ID/Intune (do not wipe until confirmed).

**B) Prepare the new device:**
1. Corporate Windows: run **Autopilot** OOBE → user signs in → device enrolls and applies policy/apps (see l2-intune-002).
2. Manual build: enroll into Intune, sign in with the work account so Entra join + MDM apply.
3. Let **assigned apps** install; install any specialized software not delivered by Intune.

**C) Restore the user's data & settings:**
1. Sign the user into **OneDrive** on the new device — Desktop/Documents/Pictures rehydrate automatically (the big win of KFM).
2. Outlook: add the work account; it rebuilds the OST from Exchange Online. Re-import any local **PST** archives, or move them to Online Archive.
3. Re-map network drives (l2-fileshare-001), reconnect printers, restore browser profile (sign in to sync).
4. Re-activate licensed apps / re-pair hardware dongles.

**D) Validate with the user:**
1. Have the **user** confirm they can open their key files, send/receive mail, reach their apps and shares, and print — before the old device leaves their hands.

**E) Decommission the old device:**
1. In Intune: confirm the new device is healthy, then **Retire/Wipe** the old device and delete its Entra/Intune records.
2. Wipe local disk per policy (BitLocker already protects data; a remote **Wipe** or reset clears it). For disposal, follow the data-sanitization standard.
3. Collect the device; update the **asset management** record (l2-asset-management is the lifecycle reference).

## 5. Resolution Notes by Scenario
- **Old device still works:** ideal — sync everything first, validate on new, then wipe. This is the no-loss path.
- **Old device dead/won't boot but disk OK:** pull data via a USB enclosure or boot media before wipe; if encrypted, you need the recovery key.
- **Disk failed / no backup and not in OneDrive:** data may be unrecoverable without a data-recovery vendor — set expectations honestly and escalate.

## 6. Verification Steps
- User opens a sample of their **own** Desktop/Documents files on the new device.
- Outlook shows full mail; calendar and contacts present.
- Network drives, printers, and required apps all work for the user.
- Old device shows **Retired/Wiped** in Intune and is removed from Entra ID.
- Asset record reflects the new serial assigned to the user and the old one as returned/disposed.

## 7. Escalation Trigger
- Data exists **only** on a failed local disk → data-recovery vendor.
- Large/bulk refresh needing an imaging/Autopilot program design → L3 deployment.
- Specialized LOB app migration that vendor support must perform.

## 8. Prevention Tips
- Enforce **OneDrive Known Folder Move** fleet-wide so a laptop swap is near-instant and lossless by default.
- Discourage local PSTs and local-only data; standardize on SharePoint/OneDrive + Online Archive.
- Ensure **BitLocker/FileVault keys escrow** automatically to Entra ID/Intune at enrollment.
- Use **Autopilot** so replacement builds are hands-off and consistent.
- Keep asset records current so refresh cycles are planned, not reactive.

## 9. User-Friendly Explanation
"Because your files live in OneDrive and your email lives in the cloud, moving to a new laptop is mostly a sign-in: we set up the new machine, you log in, and your Desktop, Documents, and email come right back. We'll check together that everything you need is there before we take the old laptop — and only then do we securely wipe it. The main things we hand-carry are anything saved only on the old machine, so tell us about any files you keep locally."

## 10. Internal Technician Notes
- KFM (Known Folder Move) is the single highest-leverage control for painless refreshes — verify it's actually on, not just assigned.
- Don't trust "it's all in OneDrive" — check for local PSTs (`%LOCALAPPDATA%\Microsoft\Outlook`), `C:\` working folders, and app-local data (e.g., AppData) that KFM doesn't cover.
- Confirm BitLocker key escrow in Entra ID before any wipe; a wipe without the key = unrecoverable.
- Edge/Chrome profile sign-in restores bookmarks/passwords/extensions — faster than manual export.
- For Autopilot, pre-stage the new device's hardware hash + profile so OOBE is hands-off; otherwise it falls back to manual enroll.
- Retire vs. Wipe in Intune: Retire removes company data/management (BYOD-friendly); Wipe factory-resets (corporate disposal). Choose per ownership.

## 11. Related KB Articles
- l1-newdevice-001 — New laptop first boot
- l2-intune-002 — Device enrollment
- l2-offboarding-001 — Exit / device return process

## 12. Keywords / Search Tags
laptop replacement, device refresh, new laptop migration, move to new computer, data migration, hardware swap, device refresh runbook, transfer files new pc, decommission old laptop, known folder move, autopilot, bitlocker key escrow, retire vs wipe
