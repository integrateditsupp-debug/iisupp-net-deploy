---
id: l2-onboarding-001
title: "New user onboarding: account, license, device, and access provisioning"
category: onboarding
support_level: L2
severity: medium
estimated_time_minutes: 60
audience: admin
prerequisites: ["Entra User Administrator", "Intune", "License", "Group ownership"]
os_scope: ["Windows", "iOS", "Android", "macOS"]
keywords:
  - onboarding
  - new hire
  - provisioning
  - first day
  - account creation
  - license assignment
  - device deployment
  - autopilot
  - group based licensing
related_articles:
  - l2-intune-001
  - l1-mfa-001
  - l1-password-001
escalation_trigger: "Onboarding for executive / regulated user, or HR system integration failure"
last_updated: 2026-05-07
version: 1.0
---

# New user onboarding

## 1. Inputs (from HR / hiring manager)
- Full name, preferred name, manager.
- Title, department, location, start date.
- Required apps / shared mailboxes / distribution lists.
- Device type (laptop model, mobile).
- Equipment delivery address.
- Any special access (admin, finance, regulated data).

## 2. Sequence
1. **Identity:**
   - Entra → Users → New user. UPN per naming convention.
   - Set Manager. Add to "All Employees" group + dept group.
   - Force password change on first sign-in.
2. **Licensing:**
   - Group-based licensing assigns M365 + add-ons via department group membership. Verify within 15 min: Licenses & apps tab.
3. **Mailbox / DLs:**
   - Membership in shared mailboxes via Entra group.
4. **MFA registration page:**
   - Send user the SSPR / MFA setup link for first-day completion.
5. **Device — Autopilot:**
   - Verify device hardware hash uploaded.
   - Assigned Autopilot profile = User-driven.
   - Targeted compliance + config policies.
6. **Apps:**
   - Required Win32 apps (Office, browser, line-of-business) via Intune.
   - VPN profile, certs.
7. **Access:**
   - JML matrix dictates: file shares, SharePoint sites, Confluence space, GitHub org, etc.
8. **Welcome:**
   - Onboarding email with first-sign-in instructions, support contact, equipment tracking.
9. **Day-1 check:**
   - User reports successful sign-in, MFA, mail flow, OneDrive sync.
10. **Day-7 check:**
    - Compliance status, app coverage, no missing access tickets.

## 3. Verification
- Entra: user active, manager set, group memberships correct.
- Intune: device enrolled, compliant within 24h of activation.
- M365 admin: license assigned, mailbox provisioned.
- User can sign in to Outlook, Teams, OneDrive, primary line-of-business app.

## 4. Escalation
- Executive / privileged user — extra access reviews + SOC notification.
- HR system integration failure — escalate to HRIS team.

## 5. Prevention / Improvement
- Automate via Identity Lifecycle (Entra ID Governance) once HR system has API.
- Standardize device images.
- Record JML matrix in source control; review quarterly.
- Use access packages (Entra ID Governance) for repeatable role grants.

## 6. Notes
- Group-based licensing has reconciliation lag up to 24h in worst case.
- Pre-stage devices: ship to user with hardware hash uploaded; user runs Autopilot from anywhere with internet.
- For regulated industries, document onboarding for audit (separation of duties, approvals).
- Don't send temp password and login link in same email — split channels.

## 7. Related
- l2-intune-001 — Compliance
- l1-mfa-001 — User MFA setup
- l1-password-001 — User password setup

## 8. Keywords
onboarding, new hire, provisioning, first day, account creation, license assignment, device deployment, autopilot, group based licensing
