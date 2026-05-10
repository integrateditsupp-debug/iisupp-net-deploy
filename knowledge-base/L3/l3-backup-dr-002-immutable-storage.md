---
id: l3-backup-dr-002
title: "Immutable / air-gapped backup design (anti-ransomware)"
category: backup-dr
support_level: L3
severity: high
estimated_time_minutes: 60
audience: technician
prerequisites: ["Backup admin", "Storage admin"]
os_scope: ["Multi-platform"]
keywords:
  - immutable backup
  - air gap
  - object lock
  - ransomware proof
  - 3-2-1-1-0
  - veeam hardened repository
  - aws s3 object lock
  - azure backup vault
related_articles:
  - l3-disaster-recovery-001
  - l2-malware-001
escalation_trigger: "Active ransomware event, restore validation failure, immutable tier compromised"
last_updated: 2026-05-07
version: 1.0
---

# Immutable / air-gapped backup design

## 1. Why
Ransomware deletes or encrypts backups before encrypting prod. Immutable + air-gapped tiers survive.

## 2. Architecture options
- **Object Lock (S3, Azure Blob immutable, GCS):** time-bound lock prevents delete/overwrite, even by admin with credentials.
- **Veeam Hardened Repository (Linux):** XFS reflinks + Linux-only access, immutable flag.
- **Tape (LTO):** physical air gap when removed from library.
- **Snapshot replication to isolated tenant / VPC:** access only via break-glass.
- **Vendor PBBA (Data Domain Retention Lock, Rubrik LiveSync):** policy-based immutability.

## 3. Design
- Tier 1 (operational): fast restore, standard storage. RTO short.
- Tier 2 (immutable): protected against logical attack. RPO acceptable.
- Tier 3 (air gap / offline): worst-case recovery. Long retrieval time, full integrity guarantee.

## 4. Operational discipline
- Test restores monthly (random sample).
- Validate immutability flag set as expected.
- Separate credential domain for backup admins; no overlap with prod admin.
- MFA + PIM for backup tooling.
- Monitor for delete attempts.

## 5. Restore procedure (post-ransomware)
1. Identify clean restore point (predates compromise).
2. Restore to isolated rebuild environment.
3. Verify integrity (checksums).
4. Scan for IoCs before reconnecting to network.
5. Restore service with elevated monitoring for 30+ days.

## 6. Verification
- Immutability flag verified on every protected backup chain.
- Restore test successful (full app + data + access).
- Air-gapped tier inventory matches expectations.

## 7. Escalation
- Immutable tier compromised — major incident.
- Restore validation fails — DR plan invalid.
- → IR + DR runbook activation.

## 8. Prevention
- Defense in depth: immutability + offline + monitoring.
- Don't rely on a single technology.
- Document chain-of-custody for offline tier.
- Rotate keys / credentials.

## 9. Notes
- Time-bound vs governance-mode object lock — pick based on legal hold needs.
- Cloud-tier immutability not silver bullet — credentials still attackable.
- Consider 7-day immutability minimum for operational tier; 30-90d for compliance.

## 10. Related Articles
- l3-disaster-recovery-001 — Full DR runbook
- l2-malware-001 — Ransomware triage

## 11. Keywords
immutable backup, air gap, object lock, ransomware proof, 3-2-1-1-0, veeam hardened repository, aws s3 object lock, azure backup vault
