# Application Crashes & Hangs

## Symptom: A specific application crashes, hangs, or refuses to open.
> User phrasings: "app keeps crashing", "program won't open", "application not responding", "it keeps closing"

### Cause: Corrupt app data/cache
**Probability:** 24%
**Detection:** Repeated crashes of one app while others are fine; check eventLog.errorsBySubsystem for Application Error/AppCrash entries naming that executable.
**Safe diagnostic:** Read eventLog.errorsBySubsystem for the app's faulting module and locate its cache folder under %LocalAppData% read-only.
**Safe fix:** With user confirmation, rename (do not delete) the app's cache folder so it rebuilds on next launch.
**Escalation:** If clearing cache does not help, escalate for a clean reinstall by a technician.

### Cause: Incompatible/outdated version
**Probability:** 20%
**Detection:** Crashes started after a Windows update or the app is several versions behind; cross-reference eventLog.errorsBySubsystem timestamps with recent updates.
**Safe diagnostic:** Read the installed app version and compare to the vendor's current supported release.
**Safe fix:** With user confirmation, install the latest stable update for that application only.
**Escalation:** If the newest version still crashes, report the build to the vendor and escalate to IT.

### Cause: Conflicting add-in/extension
**Probability:** 17%
**Detection:** App is unstable only with certain plugins/extensions loaded; AppCrash entries in eventLog.errorsBySubsystem point to an add-in DLL.
**Safe diagnostic:** Launch the app in safe/no-add-ins mode read-only (e.g. winword /safe) to confirm stability.
**Safe fix:** With user confirmation, disable the suspect add-in/extension while leaving the rest enabled.
**Escalation:** If disabling add-ins does not resolve it, escalate for full add-in audit.

### Cause: Insufficient resources
**Probability:** 14%
**Detection:** App hangs when system-context.json ram.percentUsed is high or cpu.load is saturated during heavy operations.
**Safe diagnostic:** Read ram.percentUsed and cpu.load at the moment of the hang to confirm resource starvation.
**Safe fix:** With user confirmation, close other heavy apps before reopening the affected program.
**Escalation:** If resources are adequate but it still hangs, escalate for hardware/upgrade review.

### Cause: Corrupt user profile
**Probability:** 10%
**Detection:** App crashes for one Windows account but works under a fresh/other account; profile-service errors may appear in eventLog.errorsBySubsystem.
**Safe diagnostic:** Test the app under a different local user profile read-only to confirm the profile is the variable.
**Safe fix:** With user confirmation, reset the app's per-user settings (not the whole profile) to defaults.
**Escalation:** If only a profile rebuild fixes it, escalate to IT for a guided profile migration.

### Cause: Missing runtime (VC++/.NET)
**Probability:** 8%
**Detection:** App fails on launch with a missing-DLL or runtime error; check eventLog.errorsBySubsystem for SideBySide or .NET Runtime entries.
**Safe diagnostic:** Read the error detail and confirm which Visual C++/.NET runtime the app requires.
**Safe fix:** With user confirmation, install the required Microsoft Visual C++ Redistributable or .NET runtime from Microsoft.
**Escalation:** If the runtime installs but the app still fails, escalate for dependency repair.

### Cause: Antivirus blocking
**Probability:** 7%
**Detection:** App is killed or quarantined at launch; check Defender/AV logs and eventLog.errorsBySubsystem for security-source blocks.
**Safe diagnostic:** Review Get-MpThreatDetection read-only to see if the app was flagged.
**Safe fix:** With user confirmation, add a scoped exclusion for the verified, legitimate application.
**Escalation:** If the app is genuinely flagged as malicious, do not exclude it and escalate to security.
