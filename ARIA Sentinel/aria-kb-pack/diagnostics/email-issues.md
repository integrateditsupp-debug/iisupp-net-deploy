# Email Issues (Outlook)

## Symptom: Outlook fails to open, will not send/receive, or appears frozen.
> User phrasings: "outlook won't open", "email not syncing", "can't send email", "outlook stuck"

### Cause: Corrupt OST/PST data file
**Probability:** 25%
**Detection:** Outlook hangs on "Loading Profile" or shows "data file cannot be accessed"; check system-context.json `apps.outlook.lastCrash` for repeated startup failures.
**Safe diagnostic:** Locate the OST/PST under %LOCALAPPDATA%\Microsoft\Outlook and note its size and last-modified date (read-only).
**Safe fix:** With user confirmation, run ScanPST (Inbox Repair Tool) against the data file, or rename the OST so Outlook rebuilds it from the server on next launch.
**Escalation:** If PST is the only copy of mail and repair fails, escalate to L2 for recovery before any further action.

### Cause: Faulty or conflicting COM add-in
**Probability:** 20%
**Detection:** Outlook opens only in Safe Mode; check system-context.json `apps.outlook.addins` for recently installed or unsigned add-ins.
**Safe diagnostic:** Start Outlook with `outlook.exe /safe` to confirm the add-in is the trigger (read-only test).
**Safe fix:** With user confirmation, disable suspect add-ins via File > Options > Add-ins > COM Add-ins, then restart normally.
**Escalation:** If a business-critical add-in is the culprit, escalate to the add-in vendor or L2.

### Cause: Wrong SMTP/IMAP server settings
**Probability:** 15%
**Detection:** Send/receive errors 0x800CCC0E or 0x80042109; check system-context.json `network.dnsReachable` for the mail host.
**Safe diagnostic:** Review account settings (server names, ports, SSL/TLS) under File > Account Settings without changing values.
**Safe fix:** With user confirmation, correct the SMTP/IMAP host, port, and encryption to the provider's documented values.
**Escalation:** If correct settings still fail, escalate to the mail provider or L2 for DNS/MX verification.

### Cause: Oversized mailbox at quota
**Probability:** 12%
**Detection:** "Mailbox is full" warnings; check system-context.json `apps.outlook.mailboxQuotaPct` near or at 100%.
**Safe diagnostic:** Open Mailbox Cleanup tools to view folder sizes and largest items (read-only).
**Safe fix:** With user confirmation, empty Deleted Items and archive old mail to a local PST to free quota.
**Escalation:** If quota cannot be reduced enough, escalate to admin for a mailbox size increase.

### Cause: Corrupt Outlook profile
**Probability:** 13%
**Detection:** Crash immediately after splash, or autodiscover loops; check system-context.json `apps.outlook.profileError` flag.
**Safe diagnostic:** Inspect existing profiles via Control Panel > Mail > Show Profiles (read-only).
**Safe fix:** With user confirmation, create a fresh Outlook profile and set it as default, leaving the old profile intact.
**Escalation:** If a new profile also fails, escalate to L2 to check Office installation integrity.

### Cause: Expired password or authentication
**Probability:** 10%
**Detection:** Repeated credential prompts that never accept; check system-context.json `identity.passwordExpiry` if surfaced.
**Safe diagnostic:** Confirm whether webmail signs in with the same credentials (read-only).
**Safe fix:** With user confirmation, clear cached Outlook credentials in Windows Credential Manager and re-authenticate / re-run MFA.
**Escalation:** If the account is locked or MFA is broken, escalate to identity admin.

### Cause: Antivirus mail scanning interference
**Probability:** 5%
**Detection:** Send/receive stalls at a fixed percentage; check system-context.json `security.avMailScan` enabled flag.
**Safe diagnostic:** Review the AV product's email-protection module for an enabled mail-scan plug-in (read-only).
**Safe fix:** With user confirmation, disable the AV email-scanning integration (not the AV itself) and re-test send/receive.
**Escalation:** If disabling does not help or AV policy is locked, escalate to the security team.
