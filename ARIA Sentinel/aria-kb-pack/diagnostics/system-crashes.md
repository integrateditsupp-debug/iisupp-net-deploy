# System Crashes (BSOD, Freeze, Restart Loops)

## Symptom: The whole computer crashes, freezes, blue-screens, or reboots on its own.
> User phrasings: "blue screen", "computer keeps restarting", "my pc froze", "bsod"

### Cause: Faulty/outdated driver
**Probability:** 26%
**Detection:** BSOD bugcheck codes (e.g. DRIVER_IRQL_NOT_LESS_OR_EQUAL) name a .sys file; driver faults also surface in eventLog.errorsBySubsystem under system/display sources.
**Safe diagnostic:** Read eventLog.errorsBySubsystem and inspect the minidump faulting module read-only (Get-WinEvent BugCheck).
**Safe fix:** With user confirmation, update the implicated driver via Windows Update or vendor package.
**Escalation:** If crashes continue, escalate to roll back or fully reinstall the driver and run hardware diagnostics.

### Cause: Failing RAM
**Probability:** 20%
**Detection:** Random BSODs (MEMORY_MANAGEMENT) and corruption unrelated to one app; correlate with ram.percentUsed spikes and memory-source entries in eventLog.errorsBySubsystem.
**Safe diagnostic:** Schedule a read-only Windows Memory Diagnostic on next reboot (mdsched) without changing config.
**Safe fix:** With user confirmation, run the memory diagnostic and review its results.
**Escalation:** If errors are reported, escalate for RAM reseating/replacement by a technician.

### Cause: Overheating
**Probability:** 16%
**Detection:** Freezes/shutdowns under load with hot exhaust or loud fans; thermal/WHEA events appear in eventLog.errorsBySubsystem and cpu.load is high beforehand.
**Safe diagnostic:** Read cpu.load trends and review thermal event entries read-only.
**Safe fix:** With user confirmation, recommend cleaning vents and ensuring airflow; reduce heavy background load.
**Escalation:** If thermal shutdowns persist, escalate for fan/heatsink service and thermal paste by a technician.

### Cause: Corrupt system files
**Probability:** 14%
**Detection:** Crashes plus errors in core Windows components; eventLog.errorsBySubsystem shows repeated service or kernel faults.
**Safe diagnostic:** Run a read-only integrity scan via sfc /verifyonly to detect (not change) corruption.
**Safe fix:** With user confirmation, repair with DISM /Online /Cleanup-Image /RestoreHealth then sfc /scannow.
**Escalation:** If repairs fail, escalate for in-place upgrade repair or recovery imaging.

### Cause: Failing disk
**Probability:** 12%
**Detection:** Freezes with disk I/O errors; storage-source errors in eventLog.errorsBySubsystem and low disk.percentFree can worsen instability.
**Safe diagnostic:** Read disk SMART status read-only via Get-PhysicalDisk | Get-StorageReliabilityCounter and review disk.percentFree.
**Safe fix:** With user confirmation, run chkdsk in read-only scan mode (chkdsk C: without /f first).
**Escalation:** If SMART reports degradation, back up immediately and escalate for drive replacement.

### Cause: Recent Windows update
**Probability:** 7%
**Detection:** Crashes/restart loops began right after an update; correlate update install time with new eventLog.errorsBySubsystem entries.
**Safe diagnostic:** Read the recent update history read-only via Get-HotFix to see what changed.
**Safe fix:** With user confirmation, pause further updates and uninstall the specific problem update.
**Escalation:** If removing the update does not stabilize the system, escalate for restore-point recovery.

### Cause: PSU/hardware fault
**Probability:** 5%
**Detection:** Sudden full power-offs with no BSOD and no software trace; eventLog.errorsBySubsystem shows Kernel-Power 41 unexpected-shutdown events.
**Safe diagnostic:** Read Kernel-Power/WHEA events read-only to distinguish power loss from software crash.
**Safe fix:** With user confirmation, suggest reseating power connections and testing on a known-good outlet/cable.
**Escalation:** If unexpected power-offs continue, escalate for PSU/motherboard hardware service.
