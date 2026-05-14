---
id: l1-mac-002
title: "Mac Spotlight can't find files / apps that obviously exist"
category: macos
support_level: L1
severity: medium
estimated_time_minutes: 8
audience: end-user
os_scope: ["macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - spotlight not working mac
  - cant find files spotlight
  - mac search broken
  - mdutil reindex
  - launchpad missing apps
  - spotlight indexing
  - search returns no results mac
  - spotlight excluded folder
tags:
  - macos
  - spotlight
  - search
  - top-50
related: [l1-mac-001-kernel-panic-spinning-beach-ball]
---

# Mac Spotlight broken

### Spotlight returns nothing for files you can see in Finder

The index is broken or excluded. Reindex your drive: System Settings → Spotlight → Privacy tab → drag your Macintosh HD or home folder into the exclusion list → wait 30 seconds → remove it. macOS rebuilds the index. Takes 15-60 minutes depending on file count. During rebuild, search results are partial.

### Spotlight finds files but won't find apps

Apps aren't indexed. Verify Applications folder isn't in the Spotlight Privacy exclude list (System Settings → Spotlight → Privacy). If Applications is listed there, remove it — wait for reindex. Also check: Spotlight Search Results categories — make sure "Applications" is checked.

### Force a full reindex from Terminal

When the UI method doesn't fix it, drop to command line. Open Terminal. Type: `sudo mdutil -E /` then your password. This erases the volume index. macOS rebuilds automatically over the next 30-60 minutes. Watch progress: `mdutil -s /` shows status.

### Indexing seems stuck — same percentage for hours

Activity Monitor → search "mds" — you should see `mds_stores` using CPU and disk. If it's idle, indexing is genuinely paused. Force restart: `sudo killall mds_stores mds` in Terminal. macOS relaunches them. If indexing never resumes, the index database may be corrupt: `sudo mdutil -E /` again.

### Spotlight finds some types but not others (e.g., misses PDFs)

Per-extension indexing failure. Verify the file's content is text-extractable: open a sample PDF — is it scanned-image (image only) or true PDF? Scanned PDFs need OCR before Spotlight indexes them. Adobe Acrobat Pro or PDFpen can OCR. Or use macOS Preview → Tools → Adjust Text Recognition.

### Searching from Finder works, but Spotlight (Cmd+Space) doesn't

Two different search backends. Finder uses Spotlight but with its own scope. Spotlight (Cmd+Space) is system-wide. If Cmd+Space is dead but Finder works, Spotlight launcher process is hung — System Settings → Spotlight → uncheck a category → recheck (forces reset). Or restart Mac.

### When to escalate to L2

Reindex completes but searches still return nothing. mdutil reports errors instead of building. macOS major upgrade broke Spotlight and reindex didn't help — possibly need OS clean install. Spotlight works for system but not for a specific user account — user profile may be corrupt.
