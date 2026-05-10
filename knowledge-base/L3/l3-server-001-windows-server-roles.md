---
id: l3-server-001
title: "Windows Server: role health, patching strategy, sysprep / reference image"
category: servers
support_level: L3
severity: high
estimated_time_minutes: 60
audience: technician
prerequisites: ["Server admin"]
os_scope: ["Windows Server 2019/2022/2025"]
keywords:
  - windows server
  - server role
  - patching
  - cluster
  - storage spaces direct
  - sconfig
  - server core
  - sysprep
related_articles:
  - l3-disaster-recovery-001
  - l2-deployment-001
escalation_trigger: "Cluster split-brain, storage corruption, datacenter-wide outage"
last_invalidated: 2026-05-07
version: 1.0
---

# Windows Server operations

## 1. Patching strategy
- Rings: Dev → QA → Pilot prod (1 server per role) → Wave 1 (50%) → Wave 2 (100%).
- Reboot windows align with maintenance windows.
- For clusters: drain → patch → validate → next.
- Skip a month at most — never go >60d on prod.
- Baseline via Update Compliance / Defender Vulnerability Management.

## 2. Server roles + monitoring
- DCs: replication, time, FRS/SYSVOL.
- File servers: shares, dedup, capacity.
- Hyper-V: cluster health, storage, snapshots cleared.
- ADFS: federation, claims.
- DNS/DHCP/IIS/SQL — each with role-appropriate baselines.

## 3. Reference image / build
- Server Core preferred for security + footprint (no GUI, less attack surface).
- Use DSC / Ansible / configuration as code, not snowflakes.
- Sysprep + capture for golden image (rare with Azure / cloud-first).
- Document per-role hardening (CIS baseline applied).

## 4. Cluster operations (S2D, FCI)
- Drain: `Suspend-ClusterNode -Drain` before patch.
- Validate health: `Get-ClusterFaultDomain`, `Get-ClusterPhysicalDisk`.
- Storage: `Get-StoragePool`, `Get-VirtualDisk` health = Healthy.
- Repair: `Repair-VirtualDisk` with caution; large rebuilds take hours.
- Quorum: dynamic quorum + cloud witness for small clusters.

## 5. Verification
- Roles healthy per dashboard.
- Patches applied per ring.
- Backups validated.
- DR drill annually.

## 6. Escalation
- Cluster split-brain.
- Storage Spaces Direct corruption.
- Datacenter outage.

## 7. Prevention
- Inventory + lifecycle plan per server.
- Move toward cloud-native services where economically sensible (retire on-prem servers).
- Automate everything; reduce snowflakes.
- Capacity + performance baselines.
- Don't let servers age out of support.

## 8. Notes
- Windows Server 2025 + Hot Patching reduces reboot frequency for some roles.
- For SQL FCI vs AG vs Azure SQL MI — pick by RTO/RPO + cost.
- For RDS, separate Connection Broker, Gateway, Session Hosts; don't co-locate.

## 9. Related
- l3-disaster-recovery-001 — DR
- l2-deployment-001 — Deployment

## 10. Keywords
windows server, server role, patching, cluster, storage spaces direct, sconfig, server core, sysprep
