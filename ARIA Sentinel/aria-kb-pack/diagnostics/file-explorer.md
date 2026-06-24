# File Explorer Problems

## Symptom: File Explorer fails to open, crashes, or becomes slow and unresponsive.
> User phrasings: "file explorer won't open", "explorer keeps crashing", "folders are slow", "explorer not responding"

### Cause: Corrupt thumbnail/icon cache
**Probability:** 26%
**Detection:** Check eventLog.errorsBySubsystem for explorer.exe faults when opening image-heavy folders; a bloated thumbnail cache slows rendering.
**Safe diagnostic:** Read the size of the thumbnail/icon cache and recent explorer.exe error events.
**Safe fix:** With user confirmation, close Explorer, clear the thumbnail and icon cache, and restart the shell.
**Escalation:** If crashes continue after clearing, escalate to shell-extension and SFC review.

### Cause: Shell extension conflict
**Probability:** 24%
**Detection:** Check eventLog.errorsBySubsystem for explorer.exe faulting modules pointing at a third-party context-menu or preview handler.
**Safe diagnostic:** Read the loaded non-Microsoft shell extensions and the faulting-module name from crash events.
**Safe fix:** With user confirmation, disable the suspect third-party shell extension and restart Explorer.
**Escalation:** If the culprit cannot be isolated, escalate to a clean-boot bisection of shell extensions.

### Cause: Windows Search service issue
**Probability:** 18%
**Detection:** Check services for the Windows Search (WSearch) state and eventLog.errorsBySubsystem for index corruption causing Explorer hangs.
**Safe diagnostic:** Read the Windows Search service status and index health (read-only).
**Safe fix:** With user confirmation, restart the Windows Search service or rebuild the search index.
**Escalation:** If indexing keeps corrupting, escalate to index-location move or profile repair.

### Cause: Mapped network drive timeout
**Probability:** 16%
**Detection:** Explorer hangs enumerating a mapped drive; check eventLog.errorsBySubsystem for SMB/network errors on the share path.
**Safe diagnostic:** Read which mapped drives are present and test reachability of the share host (read-only).
**Safe fix:** With user confirmation, reconnect or temporarily disconnect the unreachable mapped drive to restore responsiveness.
**Escalation:** If the share is chronically unreachable, escalate to network/file-server team.

### Cause: Corrupt user profile
**Probability:** 10%
**Detection:** Check eventLog.errorsBySubsystem for profile-service errors; Explorer misbehaves only for one account.
**Safe diagnostic:** Read profile-load events and test Explorer behavior under a separate account.
**Safe fix:** With user confirmation, repair the profile or migrate data to a fresh local profile.
**Escalation:** If the profile cannot be repaired, escalate to full profile rebuild and data migration.

### Cause: Low resources
**Probability:** 6%
**Detection:** Inspect ram.percentUsed and cpu.load; Explorer becomes unresponsive under memory pressure or sustained CPU saturation.
**Safe diagnostic:** Read ram.percentUsed and cpu.load at the time Explorer lags.
**Safe fix:** With user confirmation, close memory/CPU-heavy apps to relieve pressure and restart Explorer.
**Escalation:** If resources are chronically maxed, escalate to RAM upgrade or workload review.
