# Antivirus Conflicts

## Symptom: Security software blocks, quarantines, or flags a legitimate program.
> User phrasings: "antivirus blocking app", "false positive", "defender quarantined", "security blocking program"

### Cause: False-positive quarantine
**Probability:** 25%
**Detection:** A known-good file vanished after a scan; check system-context.json `security.defender.lastQuarantine` for a recent entry.
**Safe diagnostic:** Review the AV protection history / quarantine list to see the flagged item (read-only).
**Safe fix:** With user confirmation, restore the verified-safe file from quarantine and add a narrow exclusion for that path.
**Escalation:** If the file's safety is uncertain, escalate to the security team for verdict before restoring.

### Cause: Controlled Folder Access blocking writes
**Probability:** 18%
**Detection:** App can read but not save to Documents/Desktop; check system-context.json `security.defender.controlledFolderAccess` enabled flag.
**Safe diagnostic:** Check the ransomware-protection block history in Windows Security (read-only).
**Safe fix:** With user confirmation, add the trusted application to "Allow an app through Controlled Folder Access".
**Escalation:** If policy prevents allow-listing, escalate to security/admin.

### Cause: Two antivirus products conflicting
**Probability:** 18%
**Detection:** Sluggish system with two real-time scanners; check system-context.json `security.installedAv[]` for more than one active product.
**Safe diagnostic:** List registered security products in Windows Security Center (read-only).
**Safe fix:** With user confirmation, keep one AV and properly uninstall the second using its vendor removal tool.
**Escalation:** If removal fails or both are managed, escalate to L2 / security.

### Cause: Outdated signatures flagging a clean file
**Probability:** 15%
**Detection:** Detection name looks generic/heuristic; check system-context.json `security.defender.signatureDate` for a stale date.
**Safe diagnostic:** Note the current signature version and last update time (read-only).
**Safe fix:** With user confirmation, update AV definitions and re-scan the file to clear a stale heuristic flag.
**Escalation:** If it still flags after updating, escalate to security to submit the sample.

### Cause: Firewall blocking the application
**Probability:** 14%
**Detection:** App launches but cannot reach the network; check system-context.json `security.firewall.blockedApps[]` for the program.
**Safe diagnostic:** Review inbound/outbound firewall rules for the app in Windows Defender Firewall (read-only).
**Safe fix:** With user confirmation, add a scoped allow rule for the trusted application's required ports.
**Escalation:** If firewall is centrally managed by GPO, escalate to network/admin.

### Cause: SmartScreen blocking an unsigned app
**Probability:** 10%
**Detection:** "Windows protected your PC" prompt on launch; check system-context.json `security.smartScreen.blocked` flag.
**Safe diagnostic:** Confirm the publisher and signature status of the blocked installer (read-only).
**Safe fix:** With user confirmation, allow the verified-trusted app via the SmartScreen "More info > Run anyway" path.
**Escalation:** If the publisher cannot be verified, do not bypass; escalate to security.
