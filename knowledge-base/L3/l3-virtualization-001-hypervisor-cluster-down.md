---
id: l3-virtualization-001
title: "Hypervisor cluster down (vSphere / Hyper-V failover cluster)"
category: virtualization
support_level: L3
severity: critical
estimated_time_minutes: 240
audience: it-technician
os_scope: ["VMware ESXi / vCenter", "Windows Server Hyper-V / Failover Cluster"]
prerequisites: []
keywords:
  - hypervisor cluster down
  - vsphere ha
  - host isolation
  - quorum loss
  - witness failure
  - datastore apd pdl
  - csv offline
  - vcenter down
  - split brain
  - failover cluster
  - shared storage outage
  - staged recovery order
related_articles:
  - l3-storage-001
  - l3-disaster-recovery-001
  - l3-networking-001
  - l3-server-001
escalation_trigger: "Engage the hypervisor and storage vendors (severity-1) if shared storage is in APD/PDL, cluster quorum/witness is lost, the management plane is down, or there is any risk of split-brain — do not force VMs online on multiple hosts."
last_updated: 2026-06-24
version: 1.0
---

# Hypervisor cluster down (vSphere / Hyper-V failover cluster)

## 1. Symptoms
- Multiple VMs unreachable; HA did not restart them, or restarted them in a loop.
- Hosts show **Not Responding**, **Isolated**, **Disconnected**, or in Hyper-V **Down/Quarantined/Paused**.
- vCenter / Failover Cluster Manager unreachable, or the cluster reports **no quorum**.
- Datastores show **All Paths Down (APD)** or **Permanent Device Loss (PDL)**; Cluster Shared Volumes (CSV) in **Online (No Access)/Failed/Redirected** state.
- VMs paused-critical (Hyper-V) or in an invalid/inaccessible state (vSphere).
- Cluster events showing isolation responses, failover storms, or witness/quorum loss.

## 2. Likely Causes
- Shared storage outage (SAN/iSCSI/NFS/vSAN) causing APD/PDL or CSV loss — the most common root cause of a whole-cluster outage.
- Management/cluster network partition: hosts can't reach each other or the witness → isolation, quorum loss, or split-brain risk.
- Quorum/witness failure (file-share/disk/cloud witness offline) dropping the cluster below the votes needed to stay online.
- Management plane failure: vCenter (and its DB/PSC) down, or the cluster service hung on key nodes.
- Power event or correlated host failure exceeding HA admission-control capacity.
- Firmware/driver/patch mismatch after a maintenance window left nodes incompatible.
- vSAN/storage-policy degradation taking objects below required availability.

## 3. Questions To Ask User
- What changed in the last 24–48h (patching, firmware, storage work, network change, power event)?
- Which is down — hosts, the shared storage, the management plane (vCenter/cluster), or the network between them?
- How many hosts and how many nodes are affected vs healthy, and is the witness/quorum resource reachable?
- Are VMs hard-down, or running-but-unreachable? Any reports of the same VM appearing on two hosts (split-brain)?
- What is the storage backend and is it reporting healthy from its own console?
- What is the business impact and which workloads are top priority to recover first?
- Do we have active severity-1 support entitlements with the hypervisor and storage vendors?

## 4. Troubleshooting Steps
> L3 triage. Do NOT force VMs to power on across multiple hosts and do NOT force quorum blindly — both can cause split-brain and data corruption. ARIA documents and escalates; a senior engineer drives recovery, with vendors where indicated.
1. **Establish the failure domain first.** Decide whether the root issue is storage, network/quorum, management plane, or compute. Recovering in the wrong order makes things worse.
2. **Check shared storage health from the storage console**, not just the hosts. Confirm whether you are seeing APD (transient, paths may return) vs PDL (device declared permanently lost). Cross-reference with l3-storage-001 if the array/SAN itself is degraded.
3. **Check cluster networking and witness reachability.** Identify management-network partitions and confirm the witness/quorum resource is online. Quorum loss and isolation almost always trace back to network or witness.
4. **Assess split-brain risk explicitly.** If nodes lost contact with each other but retained storage, two nodes could try to own the same VM/volume. Treat preventing split-brain as higher priority than speed.
5. **Check the management plane.** A down vCenter/cluster service hides state but does not by itself stop running VMs — separate "we can't see it" from "it's actually down."
6. **Confirm HA/admission-control state** (vSphere) or **node quarantine/failover thresholds** (Hyper-V) to understand why HA did or didn't act.
7. **Inventory which VMs are genuinely down vs unreachable** so the recovery order can prioritize business-critical workloads.

## 5. Resolution Steps
> Staged recovery order: **storage → network/quorum → cluster/management → VMs.** Section 5 is for a senior engineer; vendor engagement points are mandatory where noted.
1. **Restore shared storage first.** Resolve the SAN/iSCSI/NFS/vSAN outage (see l3-storage-001). For PDL, follow the vendor's device-removal/re-add procedure. **Do not bring VMs up until storage is confirmed stable** — restarting on flaky storage causes corruption.
2. **Restore cluster network and quorum.** Heal the management-network partition; bring the witness back. Recompute quorum only after connectivity is genuinely restored. **Force quorum only as a last resort and ideally with vendor guidance**, having first confirmed no other partition is also alive (split-brain prevention).
3. **Recover the management plane.** Bring vCenter (and its DB/PSC) or the cluster service back; validate it sees true, consistent state before issuing power operations.
4. **Bring hosts back into the cluster** cleanly (exit maintenance/isolation), confirming each sees storage and the network correctly and is firmware/patch-compatible.
5. **Power on VMs in priority order, on one owner each.** Let HA/the cluster place them, or place manually — but ensure each VM starts on exactly one host. Verify guest health before moving to the next tier.
6. **If storage data integrity is in doubt or recovery is unsafe**, this becomes a DR decision: fail over to the DR site or restore from backup (see l3-disaster-recovery-001 / l3-backup-dr-002) — a management call weighing RTO/RPO.

## 6. Verification Steps
- All hosts/nodes **Connected/Up**, out of isolation/maintenance, and quorum healthy with the witness online.
- Datastores/CSVs **online and read/write** from all expected hosts; multipath fully restored.
- vCenter / Failover Cluster Manager healthy and showing consistent state; no orphaned or duplicated VM registrations.
- HA / admission control re-enabled and reporting sufficient failover capacity.
- All priority VMs running on a single owner each, guests healthy, applications validated; no split-brain artifacts.
- Backups/replication resumed and a fresh backup succeeds post-recovery.

## 7. Escalation Trigger
Engage the hypervisor and storage vendors at severity-1 when shared storage is in APD/PDL, quorum/witness is lost, the management plane is down, firmware/patch incompatibility blocks rejoin, or there is any split-brain risk. Never force VMs online on multiple hosts or force quorum without confirming no competing partition is live. Escalate to management for any DR-invocation or potential data-corruption decision.

## 8. Prevention Tips
- Redundant, isolated management/heartbeat networks; redundant storage paths (multipath) end to end.
- A reliable, monitored quorum witness (file-share/cloud witness) and tested quorum behavior.
- Set HA admission control / failover capacity so the cluster can actually absorb the planned number of host failures.
- Patch and update firmware in rolling maintenance windows; keep all nodes on compatible, vendor-supported levels.
- Protect the management plane (vCenter HA / clustered management, backed-up DB) and store its recovery procedure out-of-band.
- Run periodic failover and DR tests; validate that HA restarts VMs and that the cluster survives a witness loss.
- Monitor vSAN/storage-policy compliance and remediate degraded objects promptly.

## 9. User-Friendly Explanation
Your servers run as virtual machines on a cluster of physical hosts that share common storage and are designed to cover for each other if one fails. Right now something broke the cluster's foundation — usually the shared storage or the network the hosts use to coordinate — so the safety automation either couldn't act or couldn't act safely. We recover deliberately and in order: fix the storage, then the host coordination, then the management tools, and only then start the virtual machines — each on exactly one host. Rushing risks "split-brain," where two hosts fight over the same data and corrupt it. If the foundation can't be trusted, we fail over to the disaster-recovery copy instead.

## 10. Internal Technician Notes
- Recovery order is everything: **storage → network/quorum → cluster/management → VMs.** Powering VMs onto unstable storage is a top cause of corruption.
- APD vs PDL matters: APD may self-heal when paths return; PDL needs the vendor device-removal/re-add flow. Don't treat them the same.
- "I can't see it" (vCenter/cluster down) is not the same as "it's down." Confirm actual VM/storage state before acting.
- Split-brain prevention beats speed. Never force-online a VM on a second host or force quorum without proving no other partition is alive.
- Tie storage faults to l3-storage-001 — do not attempt array recovery here; that path has its own do-not-initialize rules.
- Have severity-1 entitlements verified ahead of time for both hypervisor and storage vendors; open cases early with logs.

## 11. Related KB Articles
- l3-storage-001 — Underlying RAID/SAN failure feeding the datastore/LUN outage
- l3-disaster-recovery-001 — DR invocation / failover to recovery site
- l3-networking-001 — Management/heartbeat network partition root cause
- l3-server-001 — Host OS roles and guest-level validation

## 12. Keywords / Search Tags
hypervisor cluster down, vsphere ha, host isolation, quorum loss, witness failure, datastore apd pdl, csv offline, vcenter down, split brain, failover cluster, shared storage outage, staged recovery order
