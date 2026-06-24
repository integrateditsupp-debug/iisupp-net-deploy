# License & Activation

## Symptom: Windows or Office reports it is not activated or licensed.
> User phrasings: "windows not activated", "office won't activate", "activation error", "product key not working"

### Cause: Hardware change reset digital license
**Probability:** 28%
**Detection:** Check eventLog.errorsBySubsystem for licensing (sppsvc) events after a motherboard or major component swap that invalidates the digital entitlement.
**Safe diagnostic:** Read the activation state and licensing status without altering keys.
**Safe fix:** With user confirmation, run the Activation Troubleshooter and re-link the Microsoft account digital license.
**Escalation:** If re-linking fails, escalate to Microsoft activation support with the entitlement details.

### Cause: Wrong or blocked product key
**Probability:** 22%
**Detection:** Check eventLog.errorsBySubsystem for sppsvc key-validation errors indicating an invalid, mismatched, or blocked key.
**Safe diagnostic:** Read the partial product key and edition reported by the licensing service.
**Safe fix:** With user confirmation, enter the correct edition-matched product key from a verified source.
**Escalation:** If the key is reported blocked or already in use, escalate to procurement/licensing for a valid key.

### Cause: Activation servers unreachable
**Probability:** 20%
**Detection:** Check services and eventLog.errorsBySubsystem for failed outbound connections to activation endpoints; correlate with general network status.
**Safe diagnostic:** Read whether the licensing service can reach activation hosts (connectivity test, read-only).
**Safe fix:** With user confirmation, restore internet/proxy access and retry activation once connectivity is confirmed.
**Escalation:** If a proxy or firewall blocks activation hosts, escalate to network team for allowlist changes.

### Cause: KMS/volume license expired
**Probability:** 16%
**Detection:** Check eventLog.errorsBySubsystem for KMS renewal failures and a licensing status showing an expired or out-of-tolerance activation count.
**Safe diagnostic:** Read the KMS activation status and last successful renewal time.
**Safe fix:** With user confirmation, re-point the client to a reachable KMS host and trigger a renewal.
**Escalation:** If the KMS host itself is down or out of count, escalate to the volume-licensing administrator.

### Cause: Office account sign-in issue
**Probability:** 9%
**Detection:** Check eventLog.errorsBySubsystem for Office licensing errors and a cached credential that no longer matches the assigned subscription.
**Safe diagnostic:** Read which account Office is signed in with and the subscription/license shown.
**Safe fix:** With user confirmation, sign out of Office and sign back in with the correctly licensed account.
**Escalation:** If the subscription shows unassigned, escalate to the M365 admin for license assignment.

### Cause: System clock wrong
**Probability:** 5%
**Detection:** Compare the system date/time against network time; a skewed clock fails the certificate/licensing handshake.
**Safe diagnostic:** Read the current system time and time-zone settings.
**Safe fix:** With user confirmation, enable automatic time sync, correct the time zone, and resync the clock, then retry.
**Escalation:** If the clock drifts again, escalate to CMOS battery replacement or time-service repair.
