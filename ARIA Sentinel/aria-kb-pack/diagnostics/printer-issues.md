# Printer Issues

## Symptom: A document will not print, or the printer shows as unavailable.
> User phrasings: "printer won't print", "print job stuck", "printer offline", "can't add printer"

### Cause: Stuck print spooler
**Probability:** 30%
**Detection:** Check services for the Print Spooler (spooler) state and queue depth; stalled jobs and a hung spooler show in services and eventLog.errorsBySubsystem.
**Safe diagnostic:** Read the spooler service status and list queued jobs without deleting them.
**Safe fix:** With user confirmation, stop the spooler, clear C:\Windows\System32\spool\PRINTERS, then restart the spooler service.
**Escalation:** If jobs re-stick after clearing, capture spooler crash events and escalate to driver replacement or printer firmware review.

### Cause: Printer offline or disconnected
**Probability:** 22%
**Detection:** Confirm USB/network link and whether the device flag in services/printer state reads Offline; correlate with eventLog.errorsBySubsystem for connection drops.
**Safe diagnostic:** Read the printer connection status and ping the device IP or check the USB device presence.
**Safe fix:** With user confirmation, untick "Use Printer Offline" and reseat the USB cable or reconnect to the print queue.
**Escalation:** If it returns to offline, replace the cable/port or escalate to network team for switch-port or VLAN checks.

### Cause: Wrong default printer
**Probability:** 18%
**Detection:** Read the configured default printer; Windows "let Windows manage my default printer" often points jobs at the last-used device.
**Safe diagnostic:** Read the current default printer name and the list of installed printers.
**Safe fix:** With user confirmation, disable Windows-managed defaults and set the intended printer as default.
**Escalation:** If the default keeps changing, escalate to GPO/print-management policy review.

### Cause: Outdated or corrupt driver
**Probability:** 15%
**Detection:** Inspect drivers for the print device version/date and check eventLog.errorsBySubsystem for spooler or driver faults.
**Safe diagnostic:** Read the installed print driver version and compare against the vendor's current release.
**Safe fix:** With user confirmation, remove the corrupt driver and install the latest vendor driver, then re-add the printer.
**Escalation:** If driver install fails, escalate to a clean spooler/driver-store reset or vendor support.

### Cause: Network printer IP changed
**Probability:** 10%
**Detection:** Compare the port IP saved on the queue against the printer's current IP; a DHCP lease change breaks the static port mapping.
**Safe diagnostic:** Read the printer port configuration and the device's current network IP.
**Safe fix:** With user confirmation, update the printer port to the new IP or switch the queue to a DNS hostname.
**Escalation:** If the IP keeps moving, escalate to network team for a DHCP reservation or static assignment.

### Cause: Paper, ink, or hardware error
**Probability:** 5%
**Detection:** Read the device status panel and eventLog.errorsBySubsystem for jam, toner-low, or door-open codes reported by the printer.
**Safe diagnostic:** Read the printer's reported error/status code without altering hardware.
**Safe fix:** With user confirmation, guide the user to clear the jam, reseat consumables, or close the cover, then retry.
**Escalation:** If hardware faults persist, escalate to on-site service or vendor warranty repair.
