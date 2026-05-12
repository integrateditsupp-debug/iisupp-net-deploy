---
id: l1-mobile-be-001
title: "iOS 18 / Android 15 — Apple Intelligence on iPhone, Gemini on Pixel, work profile changes"
category: mobile
support_level: L1
severity: low
estimated_time_minutes: 25
audience: end-user
os_scope: ["iOS 18+", "iPadOS 18+", "Android 15+"]
tech_generation: bleeding-edge
year_range: "iOS 18 GA Sep 2024; Android 15 GA Oct 2024; iOS 19 / Android 16 expected H2 2026"
eol_status: "Current. Apple typically 5+ years of iOS updates per device; Google 7 years on Pixel 8+."
prerequisites: ["iPhone 15 Pro+ or 16+ for Apple Intelligence", "Pixel 8+ / Galaxy S24+ for full Gemini features"]
keywords:
  - ios 18
  - ios 19
  - ipados 18
  - android 15
  - android 16
  - apple intelligence
  - genmoji on iphone
  - private cloud compute
  - gemini nano
  - pixel ai
  - circle to search
  - work profile
  - byod
  - mobile device management
  - mdm
  - intune mobile
  - jamf
related_articles:
  - l1-mac-be-001-macos-16-apple-intelligence
  - l1-windows-be-001-windows-11-25h1-copilot-plus
  - l2-byod-001-bring-your-own-device
escalation_trigger: "Company-issued device on iOS 18+ / Android 15+ enrolled in MDM and AI features need to be policy-controlled → L2 to configure MDM payload."
last_updated: 2026-05-11
version: 1.0
---

# iOS 18 / Android 15 — Apple Intelligence on iPhone, Gemini on Pixel, work profile changes

## 1. Symptoms
- Employee got Apple Intelligence on their iPhone and asks if it's safe for work data.
- Pixel user has Gemini Nano + Circle to Search and wants to know how to use them with work content.
- IT wants to control which AI features run on managed phones / tablets.
- BYOD user complains the "work profile" on Android 15 behaves differently after the update.
- User updated and lost a setting they had before.

## 2. Likely Causes / Context
1. **iOS 18 introduced Apple Intelligence** on iPhone 15 Pro / 16+ — Writing Tools, Genmoji, Image Playground, smarter Siri, ChatGPT handoff. Same architecture as macOS 16 (mostly on-device; complex queries via Private Cloud Compute).
2. **Android 15 has Private Space** (lockable separate user space) + Theft Detection Lock + new MDM controls.
3. **Pixel 9 series got Gemini Nano** in OS with more on-device intelligence. Circle to Search is system-wide.
4. **Work profile** UI redesigned on Android 15 with new "Notifications respect work hours" flag.

## 3. Questions To Ask User
1. iPhone or Android, and exact model?
2. iOS / Android version? (iOS: Settings → General → About. Android: Settings → About phone → Software information.)
3. Personal device, work device, BYOD with work profile?
4. Are you in an MDM (Intune / Jamf / Kandji / Workspace ONE)?
5. Which specific feature is the question about?

## 4. Triage by question

**"Is Apple Intelligence safe with my work email?"**
- If signed into a work Microsoft / Google account → Writing Tools applies to the text on screen. Outlook + Mail apps support Writing Tools.
- Stays on-device for short text. Goes to Private Cloud Compute (PCC) for complex requests. PCC is Apple's encrypted server enclave — Apple cannot read it; technical brief at https://security.apple.com/documentation/private-cloud-compute
- ChatGPT handoff is **opt-in per request** with a visible permission dialog.
- For regulated data (HIPAA, PCI) → discuss MDM disable per Path B below.

**"Can I run Genmoji / Image Playground in iMessage on my work phone?"**
- Yes if Apple Intelligence is allowed by MDM.
- Genmoji are images, not Unicode — recipients on older iOS see a fallback sticker.
- Image Playground blocks photorealistic / political / sensitive prompts.

**"What's new with Circle to Search on Pixel?"**
- Long-press home gesture → circle anything on screen → Google searches / translates / explains it.
- Works in any app, including Gmail, Slack, Teams.
- Sensitive content: doesn't bypass app-level screenshot blocks (banking apps that block screenshots also block Circle to Search).

**"My work profile changed after Android 15 update — apps look different."**
- Android 15 introduced "Private Space" — separate locked container, distinct from work profile.
- Work profile gained per-app pause / per-app notification policies. IT can mandate quiet hours.
- Cross-profile sharing tightened: copy/paste between personal ↔ work requires per-app permission.

## 5. Resolution / Configuration

**Path A — Personal device, want full features:**
1. iOS: Settings → Apple Intelligence & Siri → enable. Download foundation models (~7 GB) on Wi-Fi + power.
2. Android: Settings → Google → Gemini → set as digital assistant. Pixel: Settings → System → Gemini features.

**Path B — Work device under MDM, restrict AI features:**
1. **Intune (iOS):** Configuration Profile → iOS device restrictions → "Allow Apple Intelligence" = NO. Granular: allowGenmoji, allowImagePlayground, allowChatGPT separate toggles.
2. **Jamf Pro (iOS):** Configuration Profile → Restrictions → Functionality → Apple Intelligence ON/OFF + per-feature.
3. **Intune (Android Enterprise):** App configuration policy → Google Workspace / Gmail / Outlook → set "AI features" key to "blocked" per app.
4. **Workspace ONE (Android):** Profile → Restrictions → AI-related toggles.
5. **For DLP:** Microsoft Purview Mobile DLP, Lookout for Work, Zimperium — flag AI tool usage with corporate data.

**Path C — BYOD with work profile, more privacy needed:**
1. Android 15: enable Private Space → Settings → Security & privacy → Private Space → set up.
2. Move personal apps + accounts into Private Space — work profile / IT can't see them.
3. Theft Detection Lock: Settings → Security & privacy → Theft protection — auto-locks if motion + network change patterns suggest grabbed phone.

**Path D — Mixed personal + work on iOS:**
1. iOS supports multiple Apple IDs per app (Mail, Calendar, Notes) but ONE iCloud per device.
2. For full separation: use Apple Configurator + Apple Business Manager to enroll as supervised device with managed Apple Account.
3. Apple Intelligence in supervised mode obeys MDM allow/deny down to per-feature.

## 6. Verification Steps
- iOS: Settings → Apple Intelligence & Siri shows enabled (or blocked by config profile).
- Android: Settings → Apps → Gemini works (or shows "Disabled by your organization").
- Test feature: Writing Tools on a sample email; Genmoji in iMessage; Circle to Search on a photo.

## 7. Escalation Trigger
- Company-issued phones across 20+ users need consistent AI policy → L2 to push MDM config profile fleet-wide.
- BYOD with mixed regulated data (PHI) → MDM with strict app DLP, escalate to L2/L3 for design.
- User reports AI feature surfaced sensitive content unexpectedly (e.g., Writing Tools rewrote PII while drafting an email to wrong recipient) → escalate as a security review.

## 8. Prevention Tips
- **Set MDM AI policy before rollout** — easier to relax later than to claw back exposed data.
- **Train staff** on what Apple Intelligence / Gemini does on-device vs in the cloud.
- **App permission audit quarterly** — review which apps have access to AI features + accessibility services.
- **Theft Detection Lock + Find My Device** — turn ON for every phone.

## 9. User-Friendly Explanation
Your phone has new AI features built in. On iPhone it's called Apple Intelligence — Writing Tools, Genmoji, smarter Siri. Most of it runs on your phone without sending anything to anyone. On Pixel and newer Samsung phones, it's Gemini Nano + Circle to Search. If your phone is a work phone, IT can turn these on or off based on company policy. If it's your personal phone, you decide.

## 10. Internal Technician Notes
- iOS 18 supported devices: iPhone XS (2018) and later get iOS 18 base. Apple Intelligence requires iPhone 15 Pro / Pro Max OR any iPhone 16. iPads with M-series chip.
- Android 15 supported: Pixel 6 and later for direct OEM update; Samsung Galaxy S22+ via One UI 7; Xiaomi, OnePlus, Motorola — vendor-specific timelines.
- Apple PCC architecture brief: Apple-designed Apple Silicon servers, stateless processing, signed code with Secure Enclave attestation, independent security researcher access.
- Android private space implementation: bind-mount user (multi-user Android API), encrypted, separate launcher icon (or hidden), unlocks with separate auth.
- Gemini Nano: ~3.25B parameter model running on Tensor G3+ NPU (Pixel 8+) and Snapdragon 8 Gen 3+ NPU (Samsung). Runs entirely on-device.
- iOS Configuration Profile reference: `com.apple.applicationaccess` payload with `allowAppleIntelligence` boolean.
- Android Enterprise MDM: managed configuration via Google Play managed configurations — per-app JSON keys.

## 11. Related KB Articles
- `l1-mac-be-001` — macOS 16 Apple Intelligence
- `l1-windows-be-001` — Windows 11 Copilot+ PC
- `l2-byod-001` — Bring your own device

## 12. Keywords / Search Tags
ios 18, ios 19, ipados, android 15, android 16, apple intelligence, genmoji, image playground, private cloud compute, pcc, gemini nano, circle to search, pixel ai, private space, theft detection lock, work profile, byod, mdm, intune, jamf, workspace one
