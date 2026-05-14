---
id: l1-m365-003
title: "Microsoft 365 app says 'your license isn't valid' or features greyed out"
category: m365
support_level: L1
severity: high
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Active M365 license assigned to your account"]
keywords:
  - license isnt valid
  - office activation
  - word excel greyed out
  - sign-in loop office
  - your license isnt valid
  - office account is greyed out
  - this product is unlicensed
  - we couldnt verify your office product
  - subscription has expired
tags:
  - m365
  - office
  - license
  - top-50
related: [l1-m365-001-cant-sign-in, l1-m365-002-license-activation-issues, l1-password-002-locked-after-change]
---

# Office says "license isn't valid" — get unstuck fast

## When this applies

You open Word, Excel, PowerPoint, or Outlook and see:
- "Your license isn't valid" yellow banner
- "Most features are disabled — please activate"
- "Sign in to keep using Office"
- Sign-in dialog loops endlessly
- Toolbar greyed out, can read but not edit

Almost always one of three things: cached stale credentials, license was unassigned/moved, or new account setup not finished.

## Step 1 — Sign out of Office identity

This fixes 60% of cases.

### Windows
1. Open any Office app (Word for example).
2. File → Account.
3. Under "User Information," click **Sign out**.
4. Confirm.
5. Close all Office apps completely (Task Manager → kill any `winword.exe`, `excel.exe`, `outlook.exe`).
6. Wait 30 seconds.
7. Reopen Word → File → Account → Sign in.
8. Use your work email + password + MFA.

### macOS
1. Word → top menu → Sign Out.
2. Word → Quit (Cmd+Q).
3. Reopen → File → Account → Sign in.

## Step 2 — Clear Windows Credential Manager cache

If sign-in loops or won't take:

1. Win + R → `control /name Microsoft.CredentialManager` → Enter.
2. **Windows Credentials** tab.
3. Look for entries containing:
   - `MicrosoftOffice16_Data:SSPI`
   - `MicrosoftOffice16_Data:live.com`
   - Anything with "Office" or your email
4. Click each → **Remove**.
5. Restart computer.
6. Open Office → sign in fresh.

## Step 3 — Reset Office activation (Windows)

If the above didn't work:

1. Win + R → type `cmd` → Enter.
2. Type: `cd "C:\Program Files\Microsoft Office\Office16"` (or Office15 / OfficePro)
3. Type: `cscript ospp.vbs /dstatus` → shows current license state.
4. If state is wrong, type: `cscript ospp.vbs /rearm`
5. Restart Office.

For Click-to-Run (most common):
1. Settings → Apps → Microsoft 365 → Modify → **Online Repair** (takes 5-10 min).
2. Sign in fresh after repair.

## Step 4 — Verify license is still assigned

If above didn't help, the license itself may be gone.

Ask IT / Microsoft 365 admin:
> "Is M365 E3 (or your license type) still assigned to my account? Last 24 hours?"

Sometimes during license cleanup, an admin accidentally removes the license, or a renewal lapse hits. Verify before more troubleshooting.

If admin reassigns → sign out + sign back in (Step 1) → Office activates within 5 minutes.

## Step 5 — macOS-specific reset

If Office on Mac refuses to activate:

1. Quit all Office apps.
2. Finder → Go → Go to Folder (Cmd+Shift+G).
3. Paste: `~/Library/Group Containers/UBF8T346G9.Office`
4. Move the `Licenses` folder to Trash (don't delete other folders — they hold preferences).
5. Reopen Word → sign in.

## Specific scenarios

### "I have multiple Office accounts (personal + work) and they're fighting"
- Sign out of personal account explicitly. Office tries to use whichever was last signed in.
- Best practice: separate Windows user profile for personal vs work.

### "Word/Excel work but Outlook says license invalid"
- Outlook uses a separate profile state. File → Account Settings → Account Settings → remove + re-add the account.

### "Just upgraded from Office 2019 to M365 — old license error"
- Old activation is stuck. Uninstall Office 2019 completely (Programs → Uninstall + use Microsoft's Office removal tool if it doesn't fully go), then install M365 fresh.

### "License greyed out specifically for Visio or Project"
- Visio and Project are separate licenses. Even if you have M365 E3, you might not have Visio assigned. Ask admin.

### "Works at home, not at office (or vice versa)"
- Conditional Access policy blocks Office activation from certain networks. L2 — admin checks tenant policy.

## When to escalate

| Situation | Path |
|---|---|
| License truly not assigned and admin says "I can't add it" | L2 — possibly tenant license shortage, needs procurement |
| Online Repair didn't fix Windows install | L2 — full uninstall + reinstall |
| Sign-in completes but app reverts to "unlicensed" within minutes | L2 — possibly cached profile vs admin reassignment |
| Multiple users in the same org hit this simultaneously | L2 — tenant-wide license issue |
| MFA + license combination failure | L2 — Conditional Access policy |

## Prevention

- Don't fully decommission Office accounts you might need to re-activate later — leave the license assigned until you're sure.
- Keep Office updated. Latest patches fix many activation edge cases.
- If your org churns through hires/exits often, audit license assignments quarterly.
- New hires: pre-assign M365 license BEFORE the user's start date so Office activates cleanly on first sign-in.

## What ARIA can help with

ARIA can walk through sign-out → cache clear → reactivate in order, identify whether your specific error message is local-cache vs admin-side, and draft the IT ticket if admin needs to verify license assignment. ARIA cannot assign or revoke M365 licenses — that's admin scope.
