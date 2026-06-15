---
id: l3-hybrid-ad-001
title: "Hybrid AD: Azure AD Connect / Cloud Sync / password writeback"
category: active-directory
support_level: L3
severity: high
estimated_time_minutes: 90
audience: technician
prerequisites: ["AD admin", "Entra global admin"]
os_scope: ["Windows Server"]
keywords:
  - azure ad connect
  - aad connect
  - hybrid identity
  - sync
  - password hash sync
  - pass-through auth
  - federation
  - cloud sync
  - writeback
related_articles:
  - l2-active-directory-001
  - l3-sso-saml-001
escalation_trigger: "Sync engine corruption, federation outage, mass attribute conflict"
last_updated: 2026-05-07
version: 1.0
---

# Hybrid AD architecture

## 1. Sync options
- **Azure AD Connect (full):** Heavy-weight, highly customizable, on-prem server. EOS 2027.
- **Cloud Sync:** Lightweight agents, multi-forest, auto-update. Microsoft direction for new deployments.
- **Federation (ADFS / Ping):** legacy auth path; minimize for security + agility — prefer cloud auth (PHS or PTA).

## 2. Auth modes
- **Password Hash Sync (PHS):** simplest; cloud auth. Recommended for most.
- **Pass-through Auth (PTA):** auth happens on-prem; agents on DCs. Use if compliance requires no password hash in cloud.
- **Federated (ADFS):** enterprise-class; complex; consider replacing.

## 3. Common operations
**Re-run sync after change:**
- `Start-ADSyncSyncCycle -PolicyType Delta` (small change).
- `Start-ADSyncSyncCycle -PolicyType Initial` (full; long for big tenants).

**Filter scope:**
- Sync rules + OU filtering. Don't sync service accounts that don't need cloud presence.

**Conflicts:**
- Source of authority defaults to AD for synced attributes; resolve duplicate UPNs / proxyAddresses on-prem first.

**Password writeback:**
- Required for SSPR to write changes back to AD.
- Permission: AAD Connect service account needs Reset Password + Change Password on sync OUs.

## 4. Health
- Microsoft Entra Health → Connect Health.
- Monitor sync errors daily.
- Cert/firmware on AAD Connect server current.
- Backup / image of AAD Connect server.
- Failover: staging mode on second server.

## 5. Migration to Cloud Sync
- Plan: assess sync rules complexity (Cloud Sync is more constrained but simpler).
- Run side-by-side in pilot; cut over OUs incrementally.
- AAD Connect → Cloud Sync coexistence supported.

## 6. Verification
- Sync errors zero.
- New / changed users appear in cloud within 30 min.
- Password writeback working (test SSPR).
- Connect Health green.

## 7. Escalation
- Sync engine corruption.
- Mass duplicate-attribute conflicts.
- Federation outage (ADFS).
- → Microsoft case + L3 architecture.

## 8. Prevention
- Document sync filters + sync rules.
- Don't customize sync rules without compelling reason — reduces upgrade surface.
- Move to Cloud Sync where possible.
- Phase out ADFS in favor of cloud auth.
- Monthly review of sync errors.

## 9. Notes
- AAD Connect EOS 2027 — plan migration now.
- Cloud Sync supports multi-forest natively.
- For federation, certificate rollover is critical — automate or alert.
- Group writeback (preview) lets cloud groups land in AD.

## 10. Related Articles
- l2-active-directory-001 — Account ops
- l3-sso-saml-001 — Federation

## 11. Keywords
azure ad connect, aad connect, hybrid identity, sync, password hash sync, pass-through auth, federation, cloud sync, writeback
