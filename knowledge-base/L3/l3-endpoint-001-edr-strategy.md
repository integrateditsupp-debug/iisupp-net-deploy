---
id: l3-endpoint-001
title: "Endpoint security architecture: EDR + AppLocker/WDAC + Windows Hardening"
category: endpoint
support_level: L3
severity: high
estimated_time_minutes: 90
audience: technician
prerequisites: ["Endpoint security architect", "Defender / 3rd-party EDR admin"]
os_scope: ["Windows 10", "Windows 11"]
keywords:
  - edr
  - applocker
  - wdac
  - device guard
  - credential guard
  - hvci
  - bitlocker
  - hardening
  - cis
  - stig
related_articles:
  - l2-endpoint-001
  - l3-security-001
escalation_trigger: "Strategic shift, vendor selection, mass roll-out planning"
last_updated: 2026-05-07
version: 1.0
---

# Endpoint security architecture

## 1. Layered model
- **Identity:** Phishing-resistant MFA, PIM, Conditional Access.
- **Device:** Compliance, BitLocker, TPM, Secure Boot, HVCI, Credential Guard.
- **OS hardening:** CIS / STIG baselines, ASR, AV, EDR.
- **App control:** AppLocker (legacy) or WDAC (modern) — block unsigned/unauthorized.
- **Browser:** SmartScreen, isolation, web filter.
- **Telemetry:** EDR + SIEM + XDR.
- **User awareness:** Phishing training, reporting tools.

## 2. EDR selection
- Defender for Endpoint native to Microsoft stack — best integration, lowest cost when bundled.
- 3rd party (CrowdStrike, SentinelOne) — strong if heterogeneous OS or mature SOC integration.
- Don't run two EDRs in active mode — they fight.

## 3. WDAC rollout
- Audit mode 60-90 days.
- Build allow list from observed binaries (managed installer + ISG).
- Block unsigned scripts, unsigned executables, vulnerable drivers.
- Enforce mode by ring: pilot → wave → fleet.
- Exceptions documented + signed off.

## 4. Hardening baselines
- CIS L1/L2 — sensible defaults.
- STIG — for regulated environments.
- Microsoft Security Compliance Toolkit baselines.
- Apply via Intune; audit compliance.

## 5. BitLocker + TPM
- Tenant-wide encryption.
- Pre-boot PIN for high-value users (architects, executives).
- Recovery keys escrowed.
- Encrypt OS + data drives.

## 6. Credential Guard / HVCI
- Credential Guard isolates LSASS — defeats most credential dumping.
- HVCI (Hypervisor-protected Code Integrity) enforces driver signing in kernel.
- Default in Win11; enable explicitly on Win10.
- Validate driver compat before fleet rollout.

## 7. Browser isolation
- Microsoft Edge with Application Guard for untrusted sites (legacy; deprecated path).
- Modern: containerization (Mandiant Sandbox / vendor RBI) for high-risk users.
- SmartScreen always on.

## 8. Verification
- Compliance dashboard 95%+.
- WDAC enforcing, audit log clean.
- BitLocker 100% on managed.
- Credential Guard / HVCI enabled and reporting.
- EDR coverage 100%, alerts triaged within SLA.

## 9. Escalation
- Vendor regression breaking compatibility.
- WDAC enforcement breaking critical app.
- → Architecture review.

## 10. Related Articles
- l2-endpoint-001 — ASR rules
- l3-security-001 — IR

## 11. Keywords
edr, applocker, wdac, device guard, credential guard, hvci, bitlocker, hardening, cis, stig
