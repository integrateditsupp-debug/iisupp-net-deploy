# Boot Issues

## Symptom: The computer fails to start Windows or hangs before the desktop loads.
> User phrasings: "computer won't start", "won't boot", "stuck on logo", "no boot device"

### Cause: Corrupt bootloader/BCD
**Probability:** 26%
**Detection:** Check eventLog.errorsBySubsystem for boot-manager or BCD errors and a "no boot device / inaccessible boot device" message.
**Safe diagnostic:** Read the boot configuration and last boot status from recovery without modifying it.
**Safe fix:** With user confirmation, run Startup Repair, then bootrec /rebuildbcd and /fixboot from Windows Recovery.
**Escalation:** If the BCD cannot be rebuilt, escalate to offline image repair or reinstall while preserving data.

### Cause: Failing disk
**Probability:** 22%
**Detection:** Check eventLog.errorsBySubsystem for disk/storahci errors and read SMART/disk.percentFree health indicators.
**Safe diagnostic:** Read the drive SMART status and surface-error counts (read-only).
**Safe fix:** With user confirmation, back up data immediately, then run chkdsk in read/verify mode.
**Escalation:** If SMART reports impending failure, escalate to drive replacement and image migration.

### Cause: Wrong BIOS boot order
**Probability:** 18%
**Detection:** Confirm firmware boot order lists the system drive first; a stale USB/PXE entry or reset CMOS can mis-order boot devices.
**Safe diagnostic:** Read the current BIOS/UEFI boot priority list.
**Safe fix:** With user confirmation, set the correct system drive as the first boot device and save firmware settings.
**Escalation:** If boot order keeps resetting, escalate to CMOS battery replacement or firmware update.

### Cause: Recent driver or update
**Probability:** 16%
**Detection:** Check eventLog.errorsBySubsystem for a boot-time driver fault or a failed servicing operation tied to the last update/driver install.
**Safe diagnostic:** Read the most recent driver/update events around the first failed boot.
**Safe fix:** With user confirmation, boot to Safe Mode and roll back the offending driver or uninstall the recent update.
**Escalation:** If rollback does not resolve it, escalate to System Restore or in-place repair.

### Cause: Disconnected drive
**Probability:** 12%
**Detection:** Firmware reports no bootable device; a loose SATA/NVMe connection makes the disk absent from drivers and BIOS.
**Safe diagnostic:** Read whether the boot drive is detected in firmware/device list (read-only).
**Safe fix:** With user confirmation, power down and reseat the drive's data and power connectors.
**Escalation:** If the drive still is not detected, escalate to controller/port testing or hardware service.

### Cause: RAM or hardware fault
**Probability:** 6%
**Detection:** Check eventLog.errorsBySubsystem for memory/WHEA hardware errors and stop codes during early boot.
**Safe diagnostic:** Read prior WHEA/memory error events and run Windows Memory Diagnostic (read-only test).
**Safe fix:** With user confirmation, reseat RAM modules and test one stick at a time to isolate a bad module.
**Escalation:** If errors persist, escalate to component replacement or vendor hardware diagnostics.
