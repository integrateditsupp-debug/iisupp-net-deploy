---
id: l2-byod-001
title: "BYOD policy: app protection, conditional access, data containers"
category: byod
support_level: L2
severity: medium
estimated_time_minutes: 30
audience: admin
os_scope: ["iOS", "Android", "Windows 10", "Windows 11", "macOS"]
prerequisites: ["Intune", "Conditional Access", "App protection policies"]
keywords:
  - byod
  - bring your own device
  - personal device
  - app protection
  - mam
  - mdm
  - app wrap
  - intune app policy
  - data container
  - work profile
  - jamf
  - work data wipe
related_articles:
  - l2-intune-001
  - l2-azure-ad-001
  - l1-mfa-001
escalation_trigger: "Personal device on shared corporate VPN with no MAM, or jailbroken/rooted device flagged in compliance"
last_updated: 2026-05-08
version: 1.0
---

# BYOD: secure access from personal devices

## 1. Symptoms / triggers
- New hire wants to use their personal MacBook / iPhone / Android.
- Contractor requests email + Teams from their own laptop.
- An exec asks why they can't access SharePoint on their tablet.
- Audit flags personal devices accessing corporate SaaS without MAM.
- A user reports their personal photos were "deleted" by IT (they weren't — work data was wiped).

## 2. Likely causes
1. No clear BYOD policy distinction between MAM (App-only) and MDM (Full-device).
2. Conditional Access lets BYOD in but doesn't enforce app protection.
3. User installed the work app outside the MAM-protected store flow.
4. Old policy assumed MDM enrolment which deters most users.
5. No data-loss-prevention container — copy/paste from Outlook to WhatsApp is unrestricted.

## 3. Questions to ask
1. Does your BYOD model permit MDM (full-device control) or only MAM (per-app control)?
2. Is the device personal-and-occasional, or personal-and-primary work device?
3. What apps must access corporate data — Outlook, Teams, OneDrive, custom LOB?
4. Does the device meet baseline (encryption on, biometric lock, OS within N versions of latest)?
5. Are you in a regulated industry (HIPAA / PCI / GDPR) — that changes the answer.

## 4. Triage rules / decision tree
1. **MAM-only is the default** for personal devices. Don't enrol the personal device in MDM unless the user agrees in writing — otherwise privacy complaints follow.
2. **Conditional Access enforces** — block any sign-in to corporate apps from personal devices that aren't MAM-protected.
3. **Lost / stolen → selective wipe** of work data only. Personal photos and family memories untouched.
4. **Compromise → revoke**, don't try to fix on the device.

## 5. Resolution / setup playbook
**MAM (App protection) — recommended default for BYOD:**
1. Intune → App protection policies → Create for iOS + Android.
2. Apply to: Outlook, Teams, OneDrive, Word, Excel, PowerPoint, Edge.
3. Settings: PIN required, encrypt org data, block backup to personal cloud, block copy-out, app data wipe after 90 days offline.
4. Apply only to BYOD enrolment (don't double-apply to corporate-owned devices that already have MDM).
5. Conditional Access policy: require app-protection compliance for these apps when sign-in is from a personal device.

**MDM (full-device, opt-in) — for users who want all apps:**
1. Intune Company Portal → enrol personal device.
2. Compliance policy: encryption required, OS minimum version, biometric lock, no jailbreak/root.
3. Apple Business Manager (iOS) → User-enrolment splits user vs. work data containers.
4. Android → Work Profile (Android Enterprise).

**Wipe playbook:**
- Selective wipe (data only) — Intune → Devices → Wipe → "Retain enrolment, remove company data".
- Full wipe (MDM only, with user consent) — Intune → Wipe → factory reset.
- Confirm wipe-success before closing the ticket.

## 6. Verification
- Pilot user can read corporate email but cannot copy a body into a personal WhatsApp.
- Conditional Access logs show "Compliant: Yes (App Protection)" for managed-app sign-ins.
- Personal apps (camera, browser, banking) function normally with no IT visibility.
- Selective-wipe test: removes only work data, personal data intact.

## 7. Escalation trigger
- Compliance audit reveals corporate data accessed from non-MAM devices → Block immediately, pivot to remediation.
- User refuses MAM → grant a corporate-owned loaner; do not lower the bar.
- Regulated data (PHI / PCI) leaves the container → Privacy / legal escalation, not just IT.

## 8. Prevention
- Publish the BYOD policy in the employee handbook (one page, plain English).
- Onboarding includes a 5-minute video: "What IT can and cannot see on your personal device."
- Enforce by Conditional Access — don't rely on user goodwill.
- Quarterly review of the device-compliance dashboard.
- Make MAM enrolment self-serve: user opens Outlook on their phone, gets prompted, follows wizard, done.

## 9. User-friendly explanation
"BYOD means you can use your own phone or laptop for work, but only the work apps are protected by IT — your personal photos, contacts, and apps stay private. If your phone is ever lost or you leave the company, IT can wipe just the work data without touching anything personal. The trade is: while you're here, you have to put a PIN on the work apps, and we'll block copy-paste from work to personal apps so company data doesn't accidentally get out."

## 10. Internal technician notes
- Intune App Protection settings catalog: avoid "Block all keyboards except Microsoft" unless the org actually uses SwiftKey enterprise — it's a common usability complaint.
- For Android, the pre-installed Microsoft Authenticator handles MAM enrolment cleanly. For iOS, the Microsoft Intune Company Portal app is required (not the Authenticator).
- Apple User Enrolment (iOS 13+) is the cleanest split — Apple ID for personal stays user's, Managed Apple ID provisioned for work.
- For macOS BYOD, Jamf with User Approved MDM works but is heavier than App Protection on iOS — consider declining MDM on personal Macs and require corporate-owned for power users.
- Conditional Access excluded apps: be explicit. Excluding "Browser" from app-protection policy lets users access OWA in any browser, which defeats the policy.
- For PCI / HIPAA / regulated tenants, default-deny BYOD and require corporate-owned. The MAM-only path is for moderate compliance regimes.

## 11. Related KB articles
- l2-intune-001 — Intune device compliance.
- l2-azure-ad-001 — Conditional Access.
- l1-mfa-001 — MFA setup.

## 12. Keywords / search tags
byod, bring your own device, personal device, app protection, mam, mdm, app wrap, intune app policy, data container, work profile, jamf, work data wipe, selective wipe, user enrolment
