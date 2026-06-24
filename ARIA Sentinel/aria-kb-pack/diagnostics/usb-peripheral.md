# USB & Peripherals

## Symptom: A USB device or external drive is not recognized or reports an error.
> User phrasings: "usb not recognized", "device not recognized", "usb device error", "external drive not showing"

### Cause: Missing driver or device error code
**Probability:** 22%
**Detection:** Yellow warning in Device Manager; check system-context.json `devices.usb.errorCode` (e.g., Code 28, Code 43).
**Safe diagnostic:** Review the device's status and error code in Device Manager (read-only).
**Safe fix:** With user confirmation, install/update the driver or uninstall the device and re-scan so Windows reinstalls it.
**Escalation:** If no driver is available for the hardware, escalate to OEM / L2.

### Cause: USB selective suspend power management
**Probability:** 18%
**Detection:** Device drops after idle; check system-context.json `power.usbSelectiveSuspend` enabled flag.
**Safe diagnostic:** Inspect the USB Root Hub's Power Management tab in Device Manager (read-only).
**Safe fix:** With user confirmation, disable "Allow the computer to turn off this device" on the USB hubs, or disable USB selective suspend in the power plan.
**Escalation:** If the device still drops, escalate to L2 for hardware testing.

### Cause: Faulty port or cable
**Probability:** 18%
**Detection:** Works on one port but not another; check system-context.json `devices.usb.lastEnumeratedPort` for a failing port.
**Safe diagnostic:** Try the device on a different known-good port and a different cable (read-only swap test).
**Safe fix:** With user confirmation, move the device to a working port or replace the cable.
**Escalation:** If multiple ports are dead, escalate to L2 for motherboard / front-panel diagnosis.

### Cause: External drive needs a letter or shows a format prompt
**Probability:** 16%
**Detection:** Drive appears in Disk Management but not File Explorer; check system-context.json `storage.unmountedVolumes` count.
**Safe diagnostic:** Open Disk Management to confirm the drive is present without a drive letter (read-only).
**Safe fix:** With user confirmation, assign a drive letter to a healthy volume. NEVER format a drive that holds user data without explicit backup approval.
**Escalation:** If the volume is RAW or prompts to format, escalate to L2 for data recovery first.

### Cause: Outdated chipset / USB controller driver
**Probability:** 14%
**Detection:** Multiple USB devices unstable system-wide; check system-context.json `devices.chipsetDriverDate` for an old version.
**Safe diagnostic:** Review the USB controller and chipset driver versions in Device Manager (read-only).
**Safe fix:** With user confirmation, install the OEM chipset/USB controller driver package and reboot.
**Escalation:** If instability continues after the update, escalate to L2.

### Cause: Device firmware fault
**Probability:** 12%
**Detection:** Device errors on every machine it touches; check system-context.json `devices.usb.crossMachineFailures` if tracked.
**Safe diagnostic:** Confirm the device fails on a second computer to isolate it from the host (read-only test).
**Safe fix:** With user confirmation, apply the vendor's firmware update tool per the vendor's instructions.
**Escalation:** If firmware update fails or the device is dead, escalate to the device vendor / RMA.
