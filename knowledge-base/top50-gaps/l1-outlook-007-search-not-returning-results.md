---
id: l1-outlook-007
title: "Outlook search returns no results — rebuild the search index"
category: outlook
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Outlook opens normally"]
keywords:
  - outlook search not working
  - outlook search no results
  - search returns nothing
  - something went wrong and your search couldn't be completed
  - rebuild outlook search index
  - instant search not working
  - outlook search only shows old emails
  - windows search index outlook
  - no matches found outlook
tags:
  - outlook
  - search
  - indexing
  - top-50
related: [l1-outlook-001-not-receiving-emails, l1-outlook-006-profile-ost-rebuild, l1-windows-003-slow-pc-performance]
---

# Outlook search returns no results — rebuild the search index

## Symptoms
- Searching your mailbox returns nothing, or only very old messages.
- "Something went wrong and your search couldn't be completed."
- "We're still indexing your items. Search results may be incomplete."
- Results are missing recent emails you know exist.

## Likely causes
- The Windows Search index is incomplete, paused, or corrupt.
- Outlook isn't included in the indexed locations.
- The index got wiped by a recent update and is still rebuilding.
- A very large mailbox that hasn't finished its first index.

## Safe steps (try in order)
- **Check indexing status first:**
  - In Outlook, click the Search box → **Search** tab → **Search Tools** → **Indexing Status**.
  - If it says thousands of items remain, let it finish (keep Outlook open, plugged in) before doing anything else.
- **Confirm Outlook is an indexed location:**
  - Windows **Settings → Search → Searching Windows → Advanced Search Indexer Settings** (or Control Panel → Indexing Options).
  - Click **Modify** and make sure **Microsoft Outlook** is ticked → OK.
- **Narrow the scope if results look partial:**
  - In the Search box, use the scope dropdown → choose **All Mailboxes** or **Current Mailbox** instead of **Current Folder**.
- **Rebuild the index (the reliable fix):**
  - Control Panel → **Indexing Options** → **Advanced** → **Rebuild** → **OK**.
  - The index clears and repopulates in the background; search is incomplete until it finishes (can take from minutes to a few hours on large mailboxes).
  - Leave the PC on and Outlook open while it rebuilds.
- **If the whole Windows Search service looks stuck:**
  - Press **Win + R**, type `services.msc`, find **Windows Search**, and restart it (right-click → Restart). This is a standard, safe service restart.

## Verify
- Indexing Status reports "Outlook has finished indexing."
- A search for a known recent sender or subject returns it immediately.
- Results include both old and brand-new messages.

## When to escalate (to L2 / IT)
- Rebuild completes but search is still empty or errors out.
- The same failure hits many users at once (possible server-side / Exchange search issue).
- Search works in Outlook on the web but never in the desktop app after a full rebuild.

## Safety notes
- Rebuilding the index only re-reads content that already exists — no email is deleted or moved.
- Restarting the Windows Search service is a routine, reversible action.

## What ARIA can help with
- ARIA can confirm whether indexing is simply still in progress (so you just wait) versus genuinely broken (so you rebuild), and walk you through the Indexing Options rebuild step by step. It surfaces the status only — it never reads the contents of your mailbox.
