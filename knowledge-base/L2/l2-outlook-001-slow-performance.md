---
id: l2-outlook-001
title: "Outlook is slow, freezes, or hangs on 'Processing' / 'Not Responding'"
category: outlook
support_level: L2
severity: medium
estimated_time_minutes: 30
audience: technician
os_scope: ["Windows 10", "Windows 11"]
prerequisites: ["User can sign in to Outlook", "Local admin or remote-management access for profile/OST work"]
keywords:
  - outlook slow
  - outlook freezing
  - outlook not responding
  - outlook hangs
  - outlook processing
  - large ost
  - outlook performance
  - outlook lag
  - cached exchange mode
related_articles:
  - l1-outlook-001
  - l1-outlook-003
  - l2-exchange-001
escalation_trigger: "Slowness affects many users on the same mailbox database or Exchange server, or mailbox/OST corruption persists after profile rebuild — that is an Exchange/server-side (L3) problem."
last_updated: 2026-05-26
version: 1.0
---

# Outlook slow / freezing / "Not Responding"

## 1. Symptoms
- Outlook takes a long time to launch or shows "Processing…" on startup.
- UI freezes ("Not Responding") when switching folders, searching, or opening large mailboxes.
- Search is slow or returns incomplete results.
- Sending/receiving lags; the status bar sits on "Updating this folder" for a long time.

## 2. Likely Causes
1. **Oversized OST/PST** — a cached mailbox or large local PST (multi-GB) makes Outlook crawl, especially on a spinning disk.
2. **Too much cached** — Cached Exchange Mode set to "All" on a 50 GB+ mailbox.
3. **Misbehaving add-in** (especially CRM, archiving, AV, or PDF toolbars).
4. **Corrupt OST or search index.**
5. **Corrupt Outlook profile.**
6. **Hardware/disk contention** — low free disk, OneDrive/AV scanning the OST, low RAM.
7. **Network latency to Exchange Online** (poor Wi-Fi, VPN, or proxy intercepting MAPI/HTTP).

## 3. Questions To Ask User
1. Slow always, or only on launch / search / a specific large folder?
2. Roughly how big is the mailbox (File → Account Settings shows the data file)?
3. Did it start after an update, a new add-in, or migrating to a new PC?
4. Slow only on VPN / Wi-Fi, or also on a wired/office connection?
5. Any PST files attached (archives, old .pst on a network share)?

## 4. Troubleshooting Steps
1. **Start in Safe Mode:** hold **Ctrl** while launching Outlook (or `outlook.exe /safe`). If it's fast in Safe Mode, an add-in is the culprit.
2. **Check the data-file size:** File → Account Settings → Account Settings → Data Files. Note OST/PST size and location.
3. **Check free disk space and where the OST lives** (`%LOCALAPPDATA%\Microsoft\Outlook`). Confirm AV/OneDrive isn't scanning/syncing the OST folder.
4. **Test search:** File → Options → Search → "Indexing Options" → confirm Outlook is indexed and indexing is complete.
5. **Test on the web:** open Outlook on the web (OWA). If OWA is fast, the problem is the local client, not the mailbox/server.

## 5. Resolution Steps
**Disable problem add-ins:**
1. File → Options → Add-ins → Manage: **COM Add-ins** → Go.
2. Uncheck all non-essential add-ins → OK → restart Outlook. Re-enable one at a time to find the offender.

**Right-size Cached Exchange Mode (big win on large mailboxes):**
1. File → Account Settings → Account Settings → double-click the Exchange account → set **"Mail to keep offline"** to **3 or 6 months** instead of "All".
2. Restart Outlook; it rebuilds a smaller OST. Confirm OST shrinks under `%LOCALAPPDATA%\Microsoft\Outlook`.

**Rebuild the OST (clears local corruption):**
1. Close Outlook. Rename the `.ost` (e.g., `outlook.ost` → `outlook.ost.old`) in `%LOCALAPPDATA%\Microsoft\Outlook`.
2. Reopen Outlook — it rebuilds the OST from Exchange Online (no data loss; the mailbox is the source of truth). Allow time to re-sync.

**Rebuild the search index (if search is the slow part):**
1. File → Options → Search → Indexing Options → Advanced → **Rebuild**. Let it complete (can take an hour on large mailboxes).

**Create a fresh Outlook profile (if still slow / profile corruption):**
1. Control Panel → Mail (Microsoft Outlook) → Show Profiles → **Add** a new profile → configure the account.
2. Set Outlook to "Prompt for a profile" or set the new one as default → launch with the new profile.

**Reduce/relocate PSTs:**
1. Move large archive `.pst` files off network shares to local disk, or migrate them into Online Archive. PSTs on network shares are unsupported and slow.

## 6. Verification Steps
- Outlook launches and reaches the inbox in a reasonable time (target < 15s on SSD).
- Folder switching and search return quickly with no "Not Responding".
- OST size is sane for the offline window chosen.
- A 10-minute working session shows no freezes; send/receive completes promptly.

## 7. Escalation Trigger
- Many users on the same mailbox DB / Exchange Online region are slow at the same time.
- OST corruption recurs immediately after a clean rebuild (possible mailbox-side corruption → run server-side repair).
- MAPI-over-HTTP / Autodiscover errors point to a proxy or network-path issue.
- → Escalate to **L3 / Exchange admin** for mailbox repair, throttling-policy review, or proxy/Autodiscover fixes.

## 8. Prevention Tips
- Keep Cached Exchange Mode at 3–6 months for large mailboxes, not "All".
- Exclude the Outlook OST folder from real-time AV scanning and from OneDrive Known Folder sync.
- Encourage Online Archive instead of local PSTs; never store PSTs on network shares.
- Audit add-ins fleet-wide; remove abandoned/duplicate toolbars via policy.

## 9. User-Friendly Explanation
"Outlook gets sluggish when it's trying to keep too much mail on your laptop, when an add-in is misbehaving, or when its local cache file gets corrupted. We'll start it in a clean mode to spot a bad add-in, trim how much mail it stores locally, and rebuild its cache from the server — none of your email is lost because the real copy lives in the cloud. It should feel snappy again after that."

## 10. Internal Technician Notes
- `outlook.exe /safe` isolates add-ins; `outlook.exe /rpcdiag` and the connection status (Ctrl+right-click the tray icon → Connection Status) reveal latency/RTT to Exchange.
- OST > ~25–50 GB is a known performance cliff on HDDs; SSDs tolerate more but still benefit from a shorter offline window.
- ScanPST repairs PST only, not OST — for OST you rename/rebuild.
- Check `HKCU\Software\Microsoft\Office\16.0\Outlook` for stuck/forced add-in keys; managed AV add-ins sometimes reload after being disabled.
- Confirm the OST isn't living on a redirected/roamed/OneDrive-synced path — that is a frequent silent cause.

## 11. Related KB Articles
- l1-outlook-001 — Not receiving emails
- l1-outlook-003 — Send/receive errors
- l2-exchange-001 — Mail flow troubleshooting

## 12. Keywords / Search Tags
outlook slow, outlook freezing, outlook not responding, outlook hangs, outlook processing, large ost, outlook performance, outlook lag, cached exchange mode, rebuild ost, com add-ins, search index rebuild, online archive
