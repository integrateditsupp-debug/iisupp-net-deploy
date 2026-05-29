---
id: l2-fileshare-001
title: "Shared / mapped network drive won't sync, keeps disconnecting, or shows stale files"
category: fileshare
support_level: L2
severity: medium
estimated_time_minutes: 30
audience: technician
os_scope: ["Windows 10", "Windows 11"]
prerequisites: ["User account has share/NTFS permissions", "Connectivity to the file server / DFS namespace"]
keywords:
  - mapped drive disconnected
  - network drive not syncing
  - shared drive missing
  - red x on mapped drive
  - offline files stuck
  - dfs not updating
  - drive letter gone
  - shared folder out of date
  - reconnect at logon
related_articles:
  - l1-onedrive-001
  - l2-permissions-001
  - l2-dns-001
escalation_trigger: "Many users lose the same share at once, DFS namespace/referral failures, or file-server SMB/replication (DFS-R) backlog — that is a server/infrastructure (L3) problem."
last_updated: 2026-05-26
version: 1.0
---

# Shared / mapped network drive not syncing or disconnecting

## 1. Symptoms
- A mapped drive (e.g., `S:`) shows a **red X** or "Disconnected Network Drive" and needs a click to reconnect.
- Files on the share look out of date; a colleague's changes don't appear until a refresh or reboot.
- "An error occurred while reconnecting… The local device name is already in use."
- Offline Files shows conflicts or sits "working offline" when actually online.
- The drive letter disappears after sleep, VPN reconnect, or logon.

## 2. Likely Causes
1. **The red X is cosmetic** — Windows shows drives as disconnected until first access; they reconnect on click. Often not a real fault.
2. **Credentials don't persist** — saved credential mismatch, or the share is on a different domain/realm.
3. **VPN/network not up at logon**, so "Reconnect at sign-in" fails before the tunnel is ready.
4. **SMB session drop** from idle timeout, flaky Wi-Fi, or power management on the NIC.
5. **Offline Files (CSC) cache** is stale or corrupt, showing old content / stuck conflicts.
6. **DFS namespace** pointing the client at a down or far replica; referral cache stale.
7. **Drive-letter collision** — the letter is already used by another mapping or a USB device.
8. **Name resolution** — DNS/NetBIOS can't resolve the server name (works by IP, not by name).

## 3. Questions To Ask User
1. Is it one share or all network drives?
2. Does it affect just you, or your whole team/floor?
3. Are you on VPN / remote, or in the office wired?
4. Does double-clicking the drive reconnect it (cosmetic red X), or does it error?
5. "Stale files" — do you see a colleague's edits after pressing F5 / reopening?
6. Did it start after a password change, new laptop, or moving offices?

## 4. Troubleshooting Steps
1. **Double-click the drive.** If it opens fine, the red X was cosmetic — explain and move on.
2. **Resolve the server by name:** `ping servername` and `nslookup servername`. If name fails but IP works, it's DNS (→ §5 / l2-dns-001).
3. **List current sessions:** `net use` shows mapped drives and their status; `klist` shows Kerberos tickets.
4. **Test the raw path:** open `\\server\share` in Explorer directly. If the UNC works but the mapped letter doesn't, it's the mapping/credentials.
5. **Check VPN timing** for remote users — does the drive work after a manual reconnect post-VPN?
6. **Check Offline Files** status: Control Panel → Sync Center → Manage offline files.

## 5. Resolution Steps
**Re-create the mapping cleanly:**
1. `net use S: /delete` (or remove the mapping in Explorer).
2. `net use S: \\server\share /persistent:yes` — supply correct credentials if prompted; tick "Remember my credentials".
3. If credentials are wrong/stale: Control Panel → **Credential Manager** → Windows Credentials → remove old entries for that server → re-map.

**Fix "local device name already in use":**
1. `net use S: /delete`, reboot, then re-map. If it persists, check for a GPO/login-script mapping the same letter, or a USB drive holding `S:`.

**Stop SMB sessions dropping (idle/power):**
1. Device Manager → NIC → Power Management → uncheck "Allow the computer to turn off this device to save power".
2. For chronic idle disconnects, raise the SMB client session timeout via policy (L2 change, document it).

**Repair stale / stuck Offline Files (CSC):**
1. Sync Center → resolve any listed conflicts (keep server or local version deliberately).
2. If corrupt, re-initialize the CSC cache: set `HKLM\SYSTEM\CurrentControlSet\Services\CSC\Parameters\FormatDatabase = 1` (DWORD) → reboot (rebuilds the offline cache; ensure pending changes are synced first).
3. Where OneDrive/SharePoint is the standard, consider migrating off Offline Files entirely.

**Refresh DFS referrals:**
1. `dfsutil /pktflush` (clears the client referral cache) so the client re-queries the namespace for a healthy target.
2. Verify the client is hitting the closest/online target; if a replica is down, escalate.

**Force a fresh view of "stale" files:**
1. Press **F5** in the folder; SMB caches directory listings briefly. If edits still don't appear and others see them, suspect DFS-R replication lag (→ escalate).

## 6. Verification Steps
- The mapped drive opens immediately on logon without a red-X click (or the red X is understood as cosmetic).
- `net use` shows the drive as **OK**, not Disconnected/Unavailable.
- A test file created by another user appears after F5 within the expected replication window.
- After sleep/VPN reconnect, the drive is reachable without manual remap.

## 7. Escalation Trigger
- An entire team/site loses the same share simultaneously.
- DFS namespace/referral errors, or DFS-R replication backlog causing stale files for everyone.
- SMB signing/encryption or authentication (Kerberos/NTLM) failures in the server logs.
- Suspected file-server storage, share permission, or capacity issue.
- → Escalate to **L3 / file-server admin** with `net use`, `klist`, and `dfsutil` output attached.

## 8. Prevention Tips
- Map drives via GPP/Intune (item-level targeting) rather than ad-hoc, so they're consistent and self-heal.
- For remote users, prefer Always-On VPN or move the data to SharePoint/OneDrive so logon-timing races disappear.
- Disable NIC power-management on docked machines.
- Keep DNS healthy; avoid mapping by IP (breaks Kerberos and DFS).

## 9. User-Friendly Explanation
"That red X usually just means Windows hasn't reopened the drive yet — clicking it reconnects. When it genuinely won't sync, it's normally a saved-password mismatch, the VPN not being ready when you log in, or an old offline-cache copy showing stale files. We'll clear the saved credentials, re-map the drive cleanly, and refresh the cache so you see everyone's latest changes. If your whole team lost it at once, that's the file server and we'll get the server team on it."

## 10. Internal Technician Notes
- Cosmetic red X is by-design (KB on auto-reconnect); don't chase it unless access actually fails.
- `net use` status `Unavailable` vs. `Disconnected` matters — Unavailable = genuine reachability problem.
- Logon-script vs. GPP vs. Intune mappings can collide on a drive letter; audit all three.
- Kerberos double-hop / SPN issues show as access-denied only by name (not IP) — check `setspn` and time skew (l1-clock-001).
- CSC database rebuild discards un-synced offline edits — sync first.
- DFS: `dfsutil /pktinfo` shows which target the client chose and its referral state.

## 11. Related KB Articles
- l1-onedrive-001 — OneDrive not syncing
- l2-permissions-001 — NTFS / file-share permissions
- l2-dns-001 — Internal name resolution

## 12. Keywords / Search Tags
mapped drive disconnected, network drive not syncing, shared drive missing, red x on mapped drive, offline files stuck, dfs not updating, drive letter gone, shared folder out of date, reconnect at logon, net use, credential manager, csc cache, dfsutil
