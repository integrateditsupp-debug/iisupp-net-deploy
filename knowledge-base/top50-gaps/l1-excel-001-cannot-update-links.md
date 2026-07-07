---
id: l1-excel-001
title: "Excel 'cannot update links to other workbooks' — broken external references"
category: excel
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["The workbook pulls values from another Excel file (external links)"]
keywords:
  - excel cannot update links
  - this workbook contains links to other data sources
  - cannot update some of the links
  - excel external references broken
  - edit links excel
  - break links excel
  - ref error linked workbook
  - excel automatic update of links
  - linked workbook moved
  - excel asking to update values
tags:
  - excel
  - links
  - external-references
  - finance
  - top-50
related: [l1-files-001-office-file-wont-open, l1-onedrive-003-version-conflict, l1-office-002-reenable-disabled-addin]
---

# Excel "cannot update links to other workbooks" — broken external references

## Symptoms
- On open: "This workbook contains links to one or more external sources that could be unsafe."
- "Excel cannot update some of the links in your workbook."
- Cells that pull from another file show old values, `#REF!`, or `#N/A`.
- A prompt to **Update** or **Don't Update** appears every time you open the file.

## Likely causes
- The linked source workbook was moved, renamed, or is on a drive you can't reach right now.
- The source file is open/locked by someone else.
- The link points to a local path that changed when the file moved to OneDrive/SharePoint.
- The link is stale and should simply be removed.

## Safe steps
- **See exactly what the links point to (do this first, it's read-only):**
  - **Data** tab → **Edit Links** (in "Queries & Connections") → the dialog lists each source file and its **Status**.
  - Click **Check Status** to see which sources are **OK**, **Error**, or **Source open**.
- **Reconnect a moved/renamed source:**
  - In **Edit Links**, select the broken source → **Change Source…** → browse to the file's new location → **OK**.
  - If the source now lives in OneDrive/SharePoint, point the link at the synced/local copy so the path resolves.
- **If the source is on a network/VPN drive:**
  - Make sure the drive is mapped and reachable (open the folder in File Explorer first), then reopen and **Update**. On VPN, connect before opening the workbook.
- **Refresh once everything resolves:**
  - **Edit Links → Update Values**. Errors should clear to real numbers.
- **Remove links you no longer need (make a copy first):**
  - Save a backup copy of the workbook.
  - **Edit Links → Break Link** — this converts linked cells to their last values (the formulas to the other file are removed and **cannot be undone**, which is why you keep a backup).
- **Stop the prompt on every open (optional):**
  - **File → Options → Advanced → General** → untick **"Ask to update automatic links."** (Only do this if you understand the links; it hides the warning, it doesn't fix a broken source.)

## Verify
- **Edit Links → Check Status** shows every source as **OK**.
- The previously broken cells show correct, current values (no `#REF!`).
- Opening the file no longer errors on links.

## When to escalate (to L2 / IT)
- The source workbook lives on a share you can't access (needs a permission/mapping fix).
- Links point to a decommissioned server or a migrated SharePoint path that needs remapping across many files.
- Breaking links would lose formulas the business still needs — get IT/finance to plan the migration.

## Safety notes
- Viewing and checking links (**Edit Links → Check Status**) changes nothing.
- **Break Link is not reversible** — always save a backup copy first.

## What ARIA can help with
- ARIA can explain which sources are broken vs. simply unreachable-right-now, and guide **Change Source** vs. **Break Link** (always after a backup). It reads the link status only — never the numbers in your workbook.
