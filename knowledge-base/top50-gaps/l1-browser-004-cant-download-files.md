---
id: l1-browser-004
title: "Browser won't download files / downloads are blocked"
category: browser
support_level: L1
severity: medium
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You can browse the web; the problem is saving files"]
keywords:
  - cant download files
  - chrome wont download
  - edge blocking downloads
  - download failed network error
  - insecure download blocked
  - download blocked by browser
  - downloads not showing
  - browser download stuck
  - failed to download file
  - couldnt download virus scan failed
tags:
  - browser
  - downloads
  - top-50
related: [l1-browser-001-pages-not-loading, l1-windows-004-disk-cleanup, l1-files-001-office-file-wont-open]
---

# Browser won't download files / downloads are blocked

## Symptoms
- Clicking a download link does nothing, or the download shows "Failed."
- "This file was blocked because it could harm your device."
- "Insecure download blocked" on an http (non-https) file.
- "Failed – Network error" or "Couldn't download – virus scan failed."
- Downloads finish but you can't find the file.

## Likely causes
- The browser (or your security software) is blocking a risky/insecure download.
- The download folder is missing, full, or lacks write permission.
- A browser extension or corrupt cache is interfering.
- The disk is out of space.

## Safe steps
- **Check where downloads go and whether the folder is valid:**
  - Chrome/Edge: **Settings → Downloads** → confirm the **Location** exists (reset it to the Downloads folder) → optionally turn on **"Ask where to save each file"** so you can see the save happen.
- **Handle a "blocked" or "insecure" download you trust:**
  - Open the browser's **Downloads** list (Ctrl/Cmd + J) → find the blocked item → **Keep** / **Download anyway** (only for files from a source you trust).
  - For "insecure download blocked," the file is on an old http site — get it over https, or ask the site owner; don't override for unknown sources.
- **Rule out an extension or cache:**
  - Try an **InPrivate / Incognito** window (Ctrl/Cmd + Shift + N) and download again — this disables extensions. If it works, disable extensions one by one to find the culprit.
  - Clear the browser cache: **Settings → Privacy → Clear browsing data → Cached images and files**.
- **Check disk space and permissions:**
  - Make sure the drive isn't full (see the disk-cleanup runbook).
  - If saving to a network or synced folder fails, save to the local **Downloads** folder instead.
- **Confirm it's the browser, not the file/site:**
  - Try the same download in a **different browser**. If it works there, reset/repair the first browser; if it fails everywhere, the file or site is the problem.

## Verify
- The file downloads and appears in your Downloads folder.
- You can open it (if it's an Office file or PDF and won't open, see those runbooks).

## When to escalate (to L2 / IT)
- Downloads are blocked by a company policy / web filter that needs an admin exception.
- Security software quarantines legitimate business files repeatedly.
- Every browser fails to download anything even after cache clear and space check.

## Safety notes
- Only override a "blocked" download for files from a source you trust — the warning is a real malware defense.
- Clearing cache and changing the download folder are safe, reversible actions.

## What ARIA can help with
- ARIA can tell whether the block is a **security warning** (trust decision), a **folder/space** problem (fixable), or a **browser** fault (try another / clear cache), and walk you through each. It never opens the downloaded file's contents.
