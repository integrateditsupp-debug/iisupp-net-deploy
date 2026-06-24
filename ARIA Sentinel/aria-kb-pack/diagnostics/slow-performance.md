# Slow Performance

## Symptom: The computer responds slowly and tasks take much longer than usual.
> User phrasings: "computer is slow", "everything takes forever", "my pc is lagging", "system is sluggish"

### Cause: High RAM (memory) usage
**Probability:** 30%
**Detection:** RAM pressure is high when system-context.json ram.percentUsed is above ~85%, forcing Windows to page memory to disk.
**Safe diagnostic:** Read system-context.json ram.percentUsed and list top memory consumers via Get-Process | Sort-Object WS -Descending | Select-Object -First 5.
**Safe fix:** With user confirmation, close the largest non-essential memory hog (e.g. extra browser windows) and restart that single app.
**Escalation:** If RAM stays pinned after closing apps, recommend a reboot and, if recurring, a RAM upgrade assessment by a technician.

### Cause: High CPU usage
**Probability:** 22%
**Detection:** Sustained load shows up as system-context.json cpu.load near 100% over several samples.
**Safe diagnostic:** Read cpu.load and identify the top CPU process via Get-Process | Sort-Object CPU -Descending | Select-Object -First 5.
**Safe fix:** With user confirmation, end a single runaway non-system process (for example a stuck updater or report renderer).
**Escalation:** If a system process (e.g. antimalware service) holds CPU persistently, schedule scans for off-hours and escalate to a technician.

### Cause: Disk almost full / slow disk
**Probability:** 18%
**Detection:** A nearly full or slow drive is indicated when system-context.json disk.percentFree drops below ~10%.
**Safe diagnostic:** Read disk.percentFree and run a read-only cleanup preview with cleanmgr /sageset analysis or Get-PSDrive C.
**Safe fix:** With user confirmation, empty the Recycle Bin and clear Windows Temp/Disk Cleanup safe categories to recover space.
**Escalation:** If free space stays critical or the disk benchmarks slow, recommend SSD upgrade or drive health check (SMART) by a technician.

### Cause: Too many startup programs
**Probability:** 14%
**Detection:** Many auto-start entries lengthen boot and steal early CPU/RAM; correlate with high cpu.load and ram.percentUsed right after login.
**Safe diagnostic:** List startup items read-only via Get-CimInstance Win32_StartupCommand or Task Manager's Startup tab.
**Safe fix:** With user confirmation, disable one obviously non-essential startup item (e.g. a chat helper) without uninstalling it.
**Escalation:** If boot remains slow after trimming startup, escalate for a deeper startup/services audit.

### Cause: Malware / background process
**Probability:** 9%
**Detection:** Unexplained sustained cpu.load or network activity plus unfamiliar process names; check eventLog.errorsBySubsystem for security/service anomalies.
**Safe diagnostic:** Run a read-only quick scan status check via Get-MpComputerStatus and review running processes.
**Safe fix:** With user confirmation, trigger a Microsoft Defender quick scan (Start-MpScan -ScanType QuickScan).
**Escalation:** If threats are detected or scans fail, isolate the machine and escalate to security/IT for remediation.

### Cause: Outdated/failing drivers
**Probability:** 7%
**Detection:** Driver faults often appear in system-context.json eventLog.errorsBySubsystem under storage, display, or system sources.
**Safe diagnostic:** Read eventLog.errorsBySubsystem and list devices with issues via Get-PnpDevice -Status Error.
**Safe fix:** With user confirmation, check for vendor/Windows Update driver updates without forcing a manual driver swap.
**Escalation:** If errors persist after updating, escalate for driver rollback or hardware diagnostics by a technician.
