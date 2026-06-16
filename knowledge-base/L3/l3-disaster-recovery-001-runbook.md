---
id: l3-disaster-recovery-001
title: "Disaster recovery runbook: RTO/RPO, restore order, validation"
category: backup-dr
support_level: L3
severity: critical
estimated_time_minutes: 240
audience: technician
prerequisites: ["DR plan owner", "Backup system admin", "Storage admin"]
os_scope: ["All"]
keywords:
  - disaster recovery
  - dr
  - rto
  - rpo
  - veeam
  - rubrik
  - cohesity
  - immutable
  - 3-2-1
  - tabletop
  - bcp
related_articles:
  - l3-security-001
  - l2-malware-001
escalation_trigger: "Real disaster, ransomware-induced restore, regulatory deadline"
last_updated: 2026-05-07
version: 1.0
---

# Disaster recovery runbook

## 1. Plan design
- **RTO (Recovery Time Objective):** how fast you must be back. Per app/tier.
- **RPO (Recovery Point Objective):** how much data you can lose. Per app/tier.
- **Tier matrix:** Tier 1 (RTO 1h / RPO 5m), Tier 2 (4h/1h), Tier 3 (24h/24h).

## 2. Backup architecture (3-2-1-1-0)
- **3** copies of data.
- On **2** different media.
- **1** offsite.
- **1** offline / immutable / air-gapped.
- **0** errors after restore validation.

## 3. Restore order (typical enterprise)
1. **Identity** — DCs / Entra / SSO.
2. **DNS / DHCP** — foundational.
3. **Storage / file shares.**
4. **Database tier (Tier 1 apps).**
5. **App servers (Tier 1).**
6. **Email / collaboration.**
7. **Tier 2 apps.**
8. **End-user workstations** (often re-image, not restore).

## 4. Activation
1. Declare DR per chain of command.
2. Stand up war room.
3. Communicate to stakeholders.
4. Begin restore in priority order.
5. Validate at each step before proceeding.
6. Track RTO clock vs targets.

## 5. Validation
- App functional (not just "service running").
- Data integrity check (checksums vs known-good).
- Access controls preserved.
- Monitoring restored.
- User acceptance test for primary workflows.

## 6. Common pitfalls
- Backups not restorable — discovered only on disaster day.
- DNS / AD circular dependency.
- License servers / KMS missing from priority list.
- Network configs not in backup.
- Underestimated RTO due to network/storage bandwidth.

## 7. Tabletop / drill
- Quarterly tabletop with leadership.
- Annual full restore drill in isolated environment.
- Document time taken vs RTO; flag gaps.

## 8. Special considerations
- **Ransomware DR:** assume backups may be compromised; restore from immutable / air-gapped tier; validate before reconnecting to prod network.
- **Cloud DR:** test cross-region failover; validate IAM / endpoints.
- **Data sovereignty:** restore region must comply with regulation.

## 9. Related Articles
- l3-security-001 — IR (often paired with DR)
- l2-malware-001 — Malware preceding DR

## 10. Keywords
disaster recovery, dr, rto, rpo, veeam, rubrik, cohesity, immutable, 3-2-1, tabletop, bcp
