---
id: l2-deployment-001
title: "Device deployment: Autopilot, image hygiene, app rings"
category: deployment
support_level: L2
severity: medium
estimated_time_minutes: 45
audience: admin
prerequisites: ["Intune", "Endpoint Manager"]
os_scope: ["Windows 10", "Windows 11"]
keywords:
  - deployment
  - autopilot
  - oobe
  - app rings
  - configuration profiles
  - device images
  - white glove
related_articles:
  - l2-onboarding-001
  - l2-intune-001
escalation_trigger: "Pilot fails wide rollout, or Autopilot service incident, or compliance gap on deployment"
last_updated: 2026-05-07
version: 1.0
---

# Device deployment lifecycle

## 1. Approach
- **Autopilot user-driven** for general fleet — user runs OOBE, Autopilot configures.
- **Pre-provisioning (white glove)** for high-touch — IT runs first phase, user finishes from anywhere.
- No traditional imaging (avoid MDT/SCCM OS imaging unless legacy reason).

## 2. Setup
1. Vendor uploads hardware hashes to Autopilot at procurement.
2. Profile (Deployment profile): user-driven, named org, Azure AD join, locale.
3. ESP profile: required apps + timeout (60 min default).
4. Compliance + Configuration profiles assigned to dynamic device group filtering by Autopilot tag.
5. App ring: Pilot (1%) → Wave 1 (10%) → Wave 2 (50%) → All.

## 3. Verification on deployment
- Device enrolls, runs ESP, completes in <60 min.
- Compliance Yes within 24h.
- All required apps present.
- User-facing: Outlook signed in, OneDrive synced, Teams signed in, browser homed correctly.

## 4. Quality gates
- Define KPIs: mean time to ready, deployment success rate, # of in-flight failures.
- Track via Endpoint analytics + Intune reports.
- Failures auto-page on-call.

## 5. Escalation
- Autopilot service incident — Microsoft.
- Mass enrollment failure — L3 + Microsoft case.
- Pilot regression — pause wave, investigate.

## 6. Prevention / Quality
- Maintain golden config, version-controlled.
- Don't push experimental apps to broad ring.
- Pilot drivers + Windows Updates separately from app changes.
- Test on every model in active fleet quarterly.

## 7. Notes
- For Win11 24H2+ Autopilot device preparation phase replaces ESP for some scenarios.
- Use `Get-WindowsAutopilotInfo -Online` at procurement for any unmanaged stock.
- For shared devices (kiosks), Shared PC mode + Autopilot self-deploying mode.
- For user state migration, OneDrive Known Folder Move handles 95% of cases — no USMT needed.

## 8. Related
- l2-intune-001 — Compliance + enrollment
- l2-onboarding-001 — User onboarding flow

## 9. Keywords
deployment, autopilot, oobe, app rings, configuration profiles, device images, white glove
