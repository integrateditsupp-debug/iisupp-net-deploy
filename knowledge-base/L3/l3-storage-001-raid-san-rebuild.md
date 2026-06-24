---
id: l3-storage-001
title: "RAID array / SAN disk failure and rebuild"
category: storage
support_level: L3
severity: critical
estimated_time_minutes: 240
audience: it-technician
os_scope: ["Windows Server", "Linux", "VMware ESXi", "SAN/Storage Appliance"]
prerequisites: []
keywords:
  - raid degraded
  - raid rebuild
  - failed disk
  - hot spare
  - unrecoverable read error
  - ure
  - second drive failure
  - san multipath
  - lun offline
  - controller cache battery
  - storage vendor support
  - do not initialize array
related_articles:
  - l3-disaster-recovery-001
  - l3-backup-dr-002
  - l3-virtualization-001
  - l3-server-001
escalation_trigger: "Engage the storage/array vendor immediately if a second disk fails during rebuild, the array is reported failed/offline, the controller or cache is suspect, or any procedure would re-initialize, recreate, or reformat the array."
last_updated: 2026-06-24
version: 1.0
---

# RAID array / SAN disk failure and rebuild

## 1. Symptoms
- Storage controller or SAN management console reports an array/disk group as **Degraded**, **Critical**, or **Failed/Offline**.
- One or more physical disks show **Failed**, **Predictive Failure (SMART)**, **Foreign**, or **Missing**.
- Audible controller alarm; amber/red drive bay LEDs.
- On hosts: datastores/volumes go read-only, disappear, or throw I/O errors; VMs pause or crash; databases report torn pages or corruption.
- SAN: paths flapping, LUN(s) inaccessible from some or all initiators, multipath showing reduced/failed paths.
- Severe latency or throughput collapse while an array runs in degraded mode or rebuilds.

## 2. Likely Causes
- Single physical disk failure putting a redundant array (RAID 1/5/6/10) into degraded mode.
- Second disk failure (or an Unrecoverable Read Error, URE) during a rebuild — common on large-capacity drives because the rebuild must read every sector of the surviving members.
- RAID controller cache battery/BBU or flash-backup failure causing write-cache to disable (performance) or, in a bad-shutdown scenario, lost cached writes (corruption).
- RAID controller, expander, backplane, or SAS/SATA cabling fault presenting as multiple "failed" disks that are not actually dead.
- Firmware mismatch or bug on controller/disks/expander.
- SAN-side: multipath misconfiguration, fabric/zoning change, LUN masking error, or storage processor (SP) failover event.
- A "foreign config" appearing after disks/controller were moved or after a controller replacement.

## 3. Questions To Ask User
- What exactly does the management console/alarm say — which array, which disk(s), and what state (degraded vs failed vs offline)?
- When did it start, and did anything change just before (firmware update, disk swap, power event, fabric change, host reboot)?
- Is there a hot-spare configured, and has a rebuild already started automatically?
- Has anyone already pulled, reseated, or replaced a drive — or clicked anything in the array tool?
- What is running on this storage (production VMs, databases, file shares) and what is the business impact right now?
- What is the backup situation — last successful backup, where it lives, and has a restore ever been tested?
- Do we have an active support contract with the array/SAN vendor and the entitlement details to open a severity-1 case?

## 4. Troubleshooting Steps
> L3 triage only. Do NOT initialize, recreate, clear the foreign config, or reformat the array. Those actions are frequently irreversible and destroy data. ARIA triages, documents, and escalates; a senior storage engineer (with vendor support) performs invasive recovery.
1. **Stop and assess before touching hardware.** Capture the full controller/SAN status, event logs, and a screenshot of the array state. Note disk serials, slots, and the exact reported condition of each member.
2. **Determine degraded vs failed.** A *degraded* redundant array is still serving data on its remaining parity/mirror; a *failed* array has lost more members than its redundancy tolerates and is offline. The recovery path is very different — get this right first.
3. **Assess rebuild risk before any rebuild begins.** On RAID 5 with large drives, a single additional URE during rebuild can fail the whole rebuild. If a rebuild has not auto-started, confirm a verified backup exists before initiating one.
4. **Check for "phantom" multi-disk failures.** If several disks failed simultaneously, suspect the controller, expander, backplane, or cabling rather than the disks. Multiple genuine simultaneous disk deaths are rare; a shared-component fault is more likely — do not assume the data is lost.
5. **Verify controller cache/battery health.** A failed BBU/flash-backup disables write-back cache and can indicate cached writes were at risk during the event. Record its state; do not force-clear cache.
6. **SAN/multipath checks.** Confirm fabric zoning, LUN masking, and multipath (MPIO/native) path state. A LUN "outage" is often a connectivity/path problem, not a disk problem — validate from multiple hosts.
7. **Confirm backup recoverability early**, in parallel, so a restore decision can be made quickly if recovery is not safe.

## 5. Resolution Steps
> Sections 5 steps are for a senior engineer, typically in a live session with the vendor. Mandatory human/vendor engagement is called out inline.
1. **Single failed disk, array still degraded-but-redundant (the safe path):**
   - Confirm the replacement disk meets vendor spec (size/type/firmware). Identify the correct physical slot using the management tool's locate/blink function — never by guessing.
   - Replace the failed disk; allow the controller to rebuild onto the new disk (or onto the hot-spare, then copyback). Monitor rebuild progress and watch for additional errors.
   - Keep the array on backup power and avoid heavy I/O during rebuild to reduce the chance of a URE-triggered second failure.
2. **Second failure or URE during rebuild, or array reported FAILED/OFFLINE:** STOP. **Engage the storage/array vendor's severity-1 support immediately.** Do not attempt to force-online, re-initialize, or recreate the array — these typically destroy any chance of vendor-led recovery and the data.
3. **Suspected controller / backplane / cabling fault:** Replace the suspect component **under vendor guidance**. After a controller swap, import the existing/foreign configuration only as directed by the vendor — never clear it blindly.
4. **Cache/BBU fault:** Replace the battery/flash-backup module per vendor procedure; the vendor confirms whether any cached writes were lost and whether a filesystem/database consistency check is required.
5. **SAN path/LUN issue:** Correct zoning/masking/multipath; bring paths back; have the vendor confirm SP/controller health before returning the LUN to production.
6. **If recovery is not safe or not possible — restore from backup:** This is a management decision (data loss/RPO vs downtime). Restore to healthy hardware/array from the most recent verified backup, then validate integrity before returning to production.

## 6. Verification Steps
- Array/disk group reports **Optimal/Healthy**; all member disks **Online**; no hot-spare consumed without copyback completing.
- Rebuild/copyback completed at 100% with no media/URE errors logged.
- Controller cache/BBU healthy and write-back re-enabled (if appropriate).
- SAN: all expected multipaths present and active/optimal from every host; LUN(s) online and read/write.
- Host/filesystem/database consistency check clean (chkdsk/fsck, DB DBCC/integrity check) where a bad shutdown or cache loss occurred.
- Applications, VMs, and file shares back online; latency/throughput normal; recent backup succeeds post-recovery.

## 7. Escalation Trigger
Engage the storage/array vendor's severity-1 support immediately if: a second disk fails or a URE occurs during rebuild; the array is reported failed/offline; the controller, cache/BBU, backplane, or expander is suspect; a "foreign config" appears after hardware changes; or any contemplated action would initialize, recreate, clear, or reformat the array. Engage management for the restore-vs-recover business decision and any potential data-loss event.

## 8. Prevention Tips
- Use RAID levels matched to capacity and risk: prefer RAID 6 (or RAID 10) over RAID 5 for large-capacity drives because of rebuild-time URE exposure.
- Configure and test hot-spares; verify copyback works.
- Monitor SMART/predictive-failure and replace at-risk disks proactively, before a hard failure.
- Keep controller, disk, and expander firmware on vendor-recommended levels (in a maintenance window, tested).
- Verify BBU/flash-backup health on a schedule; replace aging batteries proactively.
- Maintain (and **regularly test**) backups that are independent of this array; the rebuild risk means backups are the real safety net.
- Document the array layout, disk serials/slots, and vendor support entitlements before an incident.
- For SAN: document zoning, masking, and multipath; validate redundancy by failing paths during a planned test.

## 9. User-Friendly Explanation
Your storage system spreads data across several disks with built-in redundancy, so it can survive a disk failing. Right now a disk has failed (or is at risk), and the system is running without its safety margin. Replacing a disk and letting it rebuild is usually routine — but on large disks the rebuild is a stressful read of everything left, and a second problem during that window is the dangerous part. To protect your data, we are being deliberate: we will not "reset" or recreate the storage, because that can erase everything. If recovery looks risky, we bring in the storage vendor and may restore from backup instead. The priority is your data, not speed.

## 10. Internal Technician Notes
- The single most important rule: **never initialize/recreate/clear-foreign-config to "fix" a failed array.** That is the classic data-loss mistake. When in doubt, stop and call the vendor.
- Degraded ≠ failed. Confirm the actual state before acting; the wrong assumption leads to the wrong (sometimes destructive) action.
- Treat simultaneous multi-disk "failures" as a controller/backplane/cabling fault until proven otherwise — don't write the data off.
- RAID is availability, not backup. A verified, independent, tested backup is what actually saves the customer here.
- Record disk serials/slots and use locate LEDs; pulling the wrong drive from a degraded array turns a recoverable event into a total loss.
- Get the vendor case opened early with logs attached; severity-1 entitlement and a support contract are prerequisites — verify them before the incident, not during.

## 11. Related KB Articles
- l3-disaster-recovery-001 — DR runbook / recovery infrastructure
- l3-backup-dr-002 — Immutable / offline backup the restore depends on
- l3-virtualization-001 — Hypervisor cluster impacted by datastore/LUN outage
- l3-server-001 — Host-side roles and filesystem consistency

## 12. Keywords / Search Tags
raid degraded, raid rebuild, failed disk, hot spare, unrecoverable read error, ure, second drive failure, san multipath, lun offline, controller cache battery, storage vendor support, do not initialize array
