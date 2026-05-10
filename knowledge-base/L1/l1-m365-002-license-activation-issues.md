---
id: l1-m365-002
title: "Microsoft 365 license / activation issues — apps in reduced functionality"
category: m365
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - office activation
  - reduced functionality
  - license
  - subscription expired
  - product deactivated
  - sign in to activate office
related_articles:
  - l1-m365-001
  - l2-licensing-001
escalation_trigger: "License unassigned in admin center or tenant has no available licenses for required SKU"
last_updated: 2026-05-07
version: 1.0
---

# Microsoft 365 license / activation issues

## 1. Symptoms
- Yellow banner across Office apps: "Most features have been turned off because your license isn't active."
- Read-only mode in Word/Excel/Outlook.
- Title bar shows "(Unlicensed Product)".
- "Sign in to activate Office" prompt every launch.
- Account & Privacy pane shows "Subscription Expired" or "Sign in".

## 2. Likely Causes
1. License removed from user account in M365 admin center.
2. Office is signed in with the wrong account (personal vs work).
3. Multiple Office installs (Office 2019 + M365) conflict.
4. Activation server unreachable due to firewall/proxy.
5. Subscription truly expired (trial, billing failure).
6. User attempted >5 device installs (per-user M365 cap).

## 3. Questions To Ask User
1. What account name appears in File → Account in any Office app?
2. Is this your work account (`name@company.com`) or personal (`@outlook.com`)?
3. Have you recently switched companies, gotten a new email, or had role change?
4. Is this a brand-new PC or one you've used Office on before?
5. Are coworkers also affected?

## 4. Troubleshooting Steps
1. Open Word → File → Account → confirm signed-in user.
2. If wrong account: Sign Out → close Word → reopen → Sign In with correct work account.
3. Confirm activation: Account pane → "Activated Office" or "Manage Account".
4. Check for duplicate Office installs: Settings → Apps → look for Office 2019 / Office 2016 alongside Microsoft 365.

## 5. Resolution Steps
**If wrong account signed in:**
1. File → Account → Sign Out → confirm.
2. Close all Office apps (verify in Task Manager).
3. Reopen Word, sign in with correct work email.
4. Activation completes silently if license is assigned.

**If duplicate installs:**
1. Settings → Apps → Installed apps.
2. Uninstall any non-current Office version.
3. Repair the M365 install: right-click Microsoft 365 Apps → Modify → Quick Repair (then Online Repair if needed).

**If proxy / network blocking activation:**
1. Confirm device can reach `https://officeclient.microsoft.com`, `https://login.microsoftonline.com`, `https://activation.sls.microsoft.com`.
2. On corporate proxy, request whitelisting per Microsoft's published M365 endpoint list.

**If license truly missing:**
1. Tenant admin (or L2): M365 admin center → Users → Active users → user → Licenses & apps → ensure correct SKU assigned.
2. After assignment, allow up to 30 minutes for propagation; user signs out + back in.

## 6. Verification Steps
- File → Account shows green check + "Microsoft 365 Apps for Enterprise" (or assigned SKU) + activation date.
- All Office features (Track Changes, advanced editing) available — no read-only banner.
- No "(Unlicensed Product)" in title bar.
- Outlook can send/receive normally.

## 7. Escalation Trigger
- License is shown unassigned in admin portal and reassign attempt fails.
- Tenant has no available licenses (need procurement).
- After repair + reactivation, banner returns within 24h.
- → Escalate to **L2** with: UPN, error message, license SKU expected, output of File → Account screenshot.

## 8. Prevention Tips
- Never install personal Office over a work-account Office on the same PC.
- During role change, IT should pre-assign new license before old account is removed.
- Monitor M365 admin Service Health page for activation outages.
- Keep Office on Current Channel — older builds have known activation bugs.

## 9. User-Friendly Explanation
"Your Office apps can't confirm your subscription right now. Most often it's signed in with a different account than the one with your license, or the license needs to be reassigned. We'll check who you're signed in as, sign you back in with the right account, and your full Office should come back. If we still see issues, we'll get a quick admin to verify your license is active."

## 10. Internal Technician Notes
- Activation status from CLI: `cscript "C:\Program Files\Microsoft Office\Office16\OSPP.VBS" /dstatus`.
- Force re-activation token grab: `cscript "...\OSPP.VBS" /act`.
- Click-to-Run repair from CLI: `"C:\Program Files\Common Files\Microsoft Shared\ClickToRun\OfficeC2RClient.exe" /update user`.
- For per-device licenses (shared computer scenario), check `HKLM\SOFTWARE\Microsoft\Office\ClickToRun\Configuration → SharedComputerLicensing = 1`.
- License removal lag: changes in M365 admin can take up to 24h in worst case but typically <30 min.
- For VL / KMS scenarios (rare in pure cloud), verify KMS host availability with `slmgr /dlv`.

## 11. Related KB Articles
- l1-m365-001 — Can't sign in to Microsoft 365
- l2-licensing-001 — License assignment, group-based licensing, and reclaim

## 12. Keywords / Search Tags
office activation, reduced functionality, license, subscription expired, product deactivated, unlicensed product, sign in to activate
