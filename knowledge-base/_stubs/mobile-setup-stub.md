---
id: stub-mobile-setup
title: "Mobile device setup — iOS / Android (stub)"
category: mobile
support_level: L1
status: stub
keywords: [iphone, ipad, android, email setup, outlook mobile, mfa, authenticator, intune, company portal, enrollment, wipe]
---
## Corporate email
- Recommend the Outlook mobile app (modern auth). Add account with the work email; complete MFA when prompted.
- Native Mail (iOS): add Exchange account; if Conditional Access requires it, the device must be enrolled first.
## MFA / Authenticator
- Install Microsoft Authenticator → add work/school account → scan the QR from aka.ms/mfasetup → approve a test sign-in.
## Intune / Company Portal enrollment
- iOS/Android: install Company Portal → sign in with work account → follow enrollment → install the management profile → wait for compliance to go green.
- Android: may need a personal vs work-profile choice; pick per policy.
## Lost/stolen
- From Intune/Endpoint, locate, then Retire (remove work data) or Wipe per policy. Reset MFA if compromised.
## Escalate
- Enrollment fails compliance, device not supported, or DEP/ABM (supervised) issues → MDM admin.
