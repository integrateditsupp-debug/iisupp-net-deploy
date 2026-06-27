---
id: l1-mobile-001
title: "Mobile device setup — iOS / Android work email + enrollment"
category: mobile
support_level: L1
severity: medium
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
keywords:
  - mobile
  - iphone
  - ipad
  - android
  - work phone
  - email setup
  - outlook mobile
  - mfa
  - authenticator
  - intune
  - company portal
  - enrollment
related_articles: []
escalation_trigger: "See the Escalate section in the body."
last_updated: 2026-06-27
version: 1.0
status: active
---
# Mobile device setup (iOS / Android)

## Corporate email
- Use the Outlook mobile app (modern auth). Add the work email and complete MFA when prompted.
- Native Mail (iOS): add an Exchange account; if Conditional Access requires it, the device must be enrolled first.

## MFA / Authenticator
- Install Microsoft Authenticator → add your work/school account → scan the QR from aka.ms/mfasetup → approve a test sign-in.

## Intune / Company Portal enrollment
- Install Company Portal → sign in with the work account → follow enrollment → install the management profile → wait for compliance to turn green.
- Android may ask for a personal vs work-profile choice; pick per your policy.

## Lost / stolen
- From Intune/Endpoint, locate, then Retire (remove work data) or Wipe per policy. Reset MFA if the device may be compromised.

## Escalate
- Enrollment fails compliance, the device isn't supported, or DEP/ABM (supervised) issues → MDM admin.

## Keywords
mobile, iphone, ipad, android, work phone, email setup, outlook mobile, mfa, authenticator, intune, company portal, enrollment
