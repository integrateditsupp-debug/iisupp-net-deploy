---
id: l2-drivers-001
title: "Driver rollback / WHQL gating / fleet driver management"
category: drivers
support_level: L2
severity: medium
estimated_time_minutes: 20
audience: admin
prerequisites: ["Intune / Endpoint Manager admin"]
os_scope: ["Windows 10", "Windows 11"]
keywords:
  - driver
  - rollback
  - whql
  - intune driver
  - autopatch
  - oem driver
  - windows update for business
related_articles:
  - l1-windows-001
  - l1-windows-005
  - l2-intune-001
escalation_trigger: "Bad driver hits >5% of fleet, or BSOD pattern after Windows Update, or vendor regression"
last_updated: 2026-05-07
version: 1.0
---

# Driver management at fleet scale

## 1. Symptoms
- Many devices BSOD after recent Windows update.
- Specific device family (laptop model) hits same crash signature.
- Wireless / display / audio regression after driver push.
- Optional driver auto-applied causing instability.

## 2. Resolution
**Pause the bad driver:**
- Intune → Devices → Windows → Windows Updates → Quality update profile → Pause for 7 days.
- Or for driver specifically: WUFB driver policy → Pause specific driver.

**Roll back per-device (urgent):**
- Device Manager → device → Properties → Driver → Roll Back Driver.
- Or `pnputil /enum-drivers` → identify package → `pnputil /delete-driver oem##.inf /uninstall /force`.

**Block driver fleet-wide:**
- Microsoft Update Catalog → identify driver INF + version.
- Intune driver update policy → exclude / block.

**Pin to known-good:**
- Use OEM tooling (Dell Command Update / HP Image Assistant / Lenovo System Update) integrated with Intune for vendor-blessed driver bundles.

## 3. Verification
- BSOD telemetry from MDE drops.
- Affected models stable for 24h.
- WUFB compliance reports policy in effect.

## 4. Escalation
- Vendor regression — open case with OEM.
- Microsoft known-issue page for the update.
- → L3 + vendor.

## 5. Prevention
- Rings: pilot 1% → broad 25% → fleet 100%, with 3-day soak between rings.
- Use Windows Autopatch where possible.
- Don't enable "Optional updates" on managed devices.
- Maintain a driver baseline per device model.
- Subscribe to OEM advisories.

## 6. Notes
- Optional drivers historically caused most regressions.
- For Surface fleet, Surface Driver Update tool is canonical.
- WHQL signing isn't a guarantee of stability — only of basic compatibility.
- For Win11 24H2+, driver telemetry surfacing in Intune is more granular.

## 7. Related
- l1-windows-001 — BSOD user-facing
- l2-intune-001 — Intune compliance

## 8. Keywords
driver, rollback, whql, intune driver, autopatch, oem driver, windows update for business
