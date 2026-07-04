---
id: diagnostics/time-clock-sync
intent: break-fix
vertical: generic
safe_recipe: w32tm-resync
---

# Computer Clock Wrong / Time Out of Sync — Windows

## Symptom: Clock shows incorrect time; calendar appointments or logins are affected.
> User phrasings: "clock showing wrong time", "time is off", "calendar appointments off", "wrong time on computer", "time keeps changing", "clock out of sync", "time wrong windows", "meetings at wrong time"

### Cause: Windows Time Service not synced (most common)
**Probability:** 50%
**Detection:** Taskbar clock is minutes or hours off; Outlook/Teams meetings appear shifted; check system-context.json `time.clockSkewSeconds` for skew > 300 seconds.
**Safe diagnostic:** Read the current clock skew and the Windows Time service status (read-only).
**Safe fix:** With user confirmation, run `w32tm /resync /force` in an elevated prompt to force a time sync with the configured NTP server. Also confirm "Set time automatically" is ON in Settings → Time & Language → Date & Time.
**Escalation:** If time drifts again within minutes, the CMOS battery may be dead (hardware) or a Group Policy is overriding the time source on a domain-joined machine — escalate to IT.

### Cause: Wrong or missing time zone
**Probability:** 20%
**Detection:** Clock shows a consistent offset (e.g. always 1 or 2 hours off) rather than drift; check `time.timezone` in system-context.
**Safe diagnostic:** Read the configured time zone setting (read-only).
**Safe fix:** With user confirmation, correct the time zone in Settings → Time & Language → Date & Time (or right-click taskbar clock → Adjust date/time).
**Escalation:** If the user can't change the time zone due to a locked Group Policy, escalate to IT to push the correct zone.

### Cause: Clock skew breaking authentication (Kerberos / MFA)
**Probability:** 20%
**Detection:** User can't sign in to Windows, VPN, or work apps; the time is more than ~5 minutes off; Kerberos authentication requires clocks within 5 minutes.
**Safe diagnostic:** Confirm the sign-in failure message references authentication or certificate errors, and confirm the clock is off (read-only).
**Safe fix:** After correcting the clock (see Cause 1), retry the sign-in. No direct auth change is needed — fixing the clock is the fix.
**Escalation:** If auth still fails after clock is correct, escalate to identity admin (the issue may be a locked account or an expired certificate, not just time).

### Cause: Time sync blocked by firewall (NTP port 123 UDP)
**Probability:** 10%
**Detection:** `w32tm /resync` returns an error like "The computer did not resync because no time data was available."
**Safe diagnostic:** Run `w32tm /stripchart /computer:time.windows.com /samples:3` to test reachability (read-only).
**Safe fix:** If the corporate firewall blocks NTP outbound, IT must allow UDP 123 to the approved NTP source or configure an internal NTP relay. Escalate to IT.
**Escalation:** Escalate to network/IT if the NTP port is blocked.

> **Note:** This article covers standard Windows clock/time issues. It does NOT cover healthcare appointment scheduling systems, electronic health records, or any patient-portal time settings.

### Cause: Hyper-V or VM guest clock drift causing persistent time skew
**Probability:** 8
**Detection:** Issue occurs on a virtual machine (Azure VM, Hyper-V guest, VMware); clock is correct after sync but drifts again quickly; host-based time sync may conflict with Windows Time service.
**Safe diagnostic:** In an elevated Command Prompt: `systeminfo | findstr "Hyper-V"` to confirm VM environment (read-only); check if the VM integration services include time synchronization.
**Safe fix:** With IT confirmation: on Hyper-V guests, disable the Hyper-V Time Synchronization integration service in the VM settings, then configure Windows Time against a reliable NTP source (w32tm /config /manualpeerlist:"time.windows.com" /syncfromflags:manual /reliable:YES /update && w32tm /resync).
**Escalation:** Escalate to IT/infrastructure team if the VM is Azure-hosted or managed by a hypervisor admin — modifying integration services requires host-level access.
