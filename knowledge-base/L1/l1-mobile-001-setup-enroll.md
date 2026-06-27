---
id: l1-mobile-001
title: "Set up work email & enroll a mobile device (iOS / Android)"
category: mobile
support_level: L1
severity: medium
estimated_time_minutes: 15
audience: end-user
os_scope: ["iOS", "Android"]
prerequisites: ["A work account with a license", "MFA registered"]
keywords:
  - mobile
  - iphone
  - ipad
  - android
  - set up email
  - work phone
  - enroll
  - intune
  - company portal
  - mdm
  - byod
  - work profile
---

# Mobile device setup & enrollment

## 1. Set up work email (Outlook app — recommended)
1. Install **Microsoft Outlook** (App Store / Google Play).
2. Add account → enter your **work email** → sign in with your password + **MFA**.
3. Approve the MFA prompt; mail + calendar sync.

## 2. Native Mail (iOS)
Settings → Mail → Accounts → Add → **Microsoft Exchange** → work email → sign in (modern auth + MFA).

## 3. Enroll the device (Intune / Company Portal)
1. Install **Intune Company Portal**.
2. Sign in with your work account → follow enrollment → accept the management profile.
3. iOS: install the MDM profile in Settings when prompted. Android: set up the **work profile**.
4. The device becomes compliant; Conditional Access then allows work apps + email.

## 4. BYOD vs corporate
Personal device → a **work profile** keeps personal data separate; IT manages only work apps.

## 5. Troubleshooting
- Email won't sync → confirm MFA approved + password current.
- "Device not compliant" → finish Company Portal enrollment first.
