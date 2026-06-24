# Update Stuck

## Symptom: A Windows update will not download, install, or finish.
> User phrasings: "update stuck", "windows update won't install", "stuck downloading update", "update failed"

### Cause: Corrupt Windows Update cache (SoftwareDistribution)
**Probability:** 28%
**Detection:** Check eventLog.errorsBySubsystem for WindowsUpdateClient failures and a SoftwareDistribution\Download folder that is bloated or locked.
**Safe diagnostic:** Read the update history error codes and the size/age of the SoftwareDistribution download cache.
**Safe fix:** With user confirmation, stop wuauserv/BITS, rename SoftwareDistribution and catroot2 to .old, then restart the services.
**Escalation:** If updates still fail after cache reset, escalate to DISM/SFC component-store repair.

### Cause: Low disk space
**Probability:** 22%
**Detection:** Inspect disk.percentFree on the system volume; updates need several GB of free space to stage and apply.
**Safe diagnostic:** Read disk.percentFree and the largest reclaimable categories without deleting anything.
**Safe fix:** With user confirmation, run Disk Cleanup / clear temp and old update files to free space, then retry the update.
**Escalation:** If space cannot be freed safely, escalate to storage expansion or profile-data migration.

### Cause: Update service stopped
**Probability:** 18%
**Detection:** Check services for wuauserv (Windows Update), BITS, and Cryptographic Services being disabled or not running.
**Safe diagnostic:** Read the start type and running state of the update-related services.
**Safe fix:** With user confirmation, set the services to their default start type and start them.
**Escalation:** If services will not stay running, escalate to malware scan or registry/service-config repair.

### Cause: Pending reboot
**Probability:** 14%
**Detection:** Check eventLog.errorsBySubsystem and registry pending-reboot flags that block a new update from completing.
**Safe diagnostic:** Read whether a reboot-pending flag is set without forcing a restart.
**Safe fix:** With user confirmation, save work and perform a normal restart to clear the pending operation, then resume the update.
**Escalation:** If the pending flag survives reboot, escalate to stuck-servicing-operation cleanup.

### Cause: Corrupt component store
**Probability:** 12%
**Detection:** Check eventLog.errorsBySubsystem for CBS/servicing errors (e.g., 0x80073712) indicating missing or damaged store files.
**Safe diagnostic:** Read the CBS log error codes and run a read-only DISM /CheckHealth.
**Safe fix:** With user confirmation, run DISM /RestoreHealth followed by SFC /scannow to repair the store.
**Escalation:** If the store cannot be repaired, escalate to an in-place repair install of Windows.

### Cause: Conflicting third-party update
**Probability:** 6%
**Detection:** Check services and eventLog.errorsBySubsystem for a third-party patch agent or antivirus locking update files.
**Safe diagnostic:** Read which non-Microsoft update/security agents are active during the failure window.
**Safe fix:** With user confirmation, temporarily pause the conflicting agent and retry the Windows update.
**Escalation:** If conflicts persist, escalate to vendor coordination or patch-window scheduling.
