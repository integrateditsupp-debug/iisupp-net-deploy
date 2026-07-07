---
id: l1-pdf-001
title: "PDF won't open, or opens in the browser — set Acrobat / Reader as default"
category: pdf
support_level: L1
severity: medium
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Adobe Acrobat or Adobe Reader is installed (or you're happy using the browser/Edge viewer)"]
keywords:
  - pdf wont open
  - pdf opens in edge instead of acrobat
  - pdf opens in browser
  - set adobe as default pdf
  - make acrobat default pdf reader
  - there was an error opening this document
  - pdf opens in wrong app
  - change default pdf app
  - adobe reader not opening pdf
  - acrobat wont open pdf
tags:
  - pdf
  - acrobat
  - default-app
  - top-50
related: [l1-files-001-office-file-wont-open, l1-browser-002-default-keeps-reverting, l1-windows-006-app-wont-open]
---

# PDF won't open, or opens in the wrong app — set the default PDF reader

## Symptoms
- Double-clicking a PDF opens it in Edge or a browser tab instead of Adobe Acrobat / Reader (or vice-versa).
- "There was an error opening this document. Access denied."
- Acrobat / Reader launches but the PDF is blank or won't render.
- PDFs from email attachments won't open at all.

## Likely causes
- The default app for `.pdf` changed (common after a Windows update).
- The file was blocked because it came from the internet / email.
- Protected View or a damaged Acrobat install.
- A genuinely corrupt PDF.

## Safe steps
- **Set the PDF default app (fixes "opens in the wrong app"):**
  - Windows **Settings → Apps → Default apps**.
  - In "Set a default for a file type," search for **.pdf**.
  - Click the current app → choose **Adobe Acrobat** / **Adobe Acrobat Reader** (or **Microsoft Edge** if you prefer the browser viewer) → **Set default**.
  - Alternative per-file: right-click a PDF → **Open with → Choose another app** → pick the app → tick **Always use this app**.
- **Unblock a file that came from email/internet:**
  - Right-click the PDF → **Properties** → on the General tab, if you see **"Security: This file came from another computer…"**, tick **Unblock** → **OK** → reopen.
- **Turn off Protected Mode if Acrobat opens but stays blank:**
  - Acrobat/Reader → **Edit → Preferences → Security (Enhanced)** → untick **Enable Protected Mode at startup** → restart Acrobat, reopen the PDF. (Re-enable it afterward if your workplace requires it.)
- **Confirm it's not one bad file:**
  - Open a *different* PDF. If that one opens fine, the original file is corrupt — ask the sender to re-share it, or open it once in a browser (drag it onto an Edge/Chrome window), which is a more forgiving viewer.
- **Repair Acrobat / Reader if all PDFs fail:**
  - Acrobat/Reader → **Help → Repair Installation** → follow the prompts.

## Verify
- Double-clicking any PDF opens it in the app you chose.
- The PDF renders fully (pages, text, and images).
- Email-attachment PDFs open without the "access denied" error.

## When to escalate (to L2 / IT)
- The default keeps reverting after every restart or update (may be enforced by policy).
- Acrobat won't repair or is a managed/licensed install the user can't change.
- Many users lost their PDF association at once after a fleet update.

## Safety notes
- Changing a file-type default and unblocking a file you expected are safe, reversible actions.
- Only unblock PDFs from senders you trust; if a PDF arrived unexpectedly, treat it as suspicious (see the phishing runbook).

## What ARIA can help with
- ARIA can tell whether the problem is the *default app* (fixed in Settings), a *blocked file* (Unblock), or a *corrupt document* (re-share), and walk you to the exact screen. It never opens or reads the PDF's contents.
