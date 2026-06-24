# Battery & Power

## Symptom: The laptop battery drains quickly, will not charge, or the system has power problems.
> User phrasings: "battery drains fast", "laptop won't charge", "won't wake from sleep", "battery not detected"

### Cause: Aged or worn battery
**Probability:** 26%
**Detection:** Compare design capacity against full-charge capacity in the battery report; high wear shows as a large gap and short runtime.
**Safe diagnostic:** Read the battery health report (design vs full-charge capacity and cycle count).
**Safe fix:** With user confirmation, calibrate the battery with a full discharge/charge cycle and confirm the wear level.
**Escalation:** If wear exceeds healthy thresholds, escalate to battery replacement.

### Cause: High background drain
**Probability:** 22%
**Detection:** Inspect cpu.load and ram.percentUsed for runaway background apps and a battery report showing high active-power draw.
**Safe diagnostic:** Read the top energy-consuming processes and cpu.load over the drain window.
**Safe fix:** With user confirmation, close or disable the high-drain background app or its autostart entry.
**Escalation:** If drain persists with no clear app, escalate to a clean-boot power audit.

### Cause: Faulty charger or cable
**Probability:** 18%
**Detection:** Check the battery/power state for "plugged in, not charging" and eventLog.errorsBySubsystem for power-source change events.
**Safe diagnostic:** Read the AC adapter detection status and charging state (read-only).
**Safe fix:** With user confirmation, reseat the charger, try a known-good cable/adapter, and confirm the charging state changes.
**Escalation:** If charging fails with a good adapter, escalate to charge-port or board-level service.

### Cause: Power plan settings
**Probability:** 16%
**Detection:** Read the active power plan and sleep/hibernate timeouts; aggressive or misconfigured plans cause fast drain or wake failures.
**Safe diagnostic:** Read the current power plan and its sleep, display, and USB-suspend settings.
**Safe fix:** With user confirmation, switch to Balanced and reset sleep/wake timers to recommended values.
**Escalation:** If wake/sleep still misbehaves, escalate to a power-configuration reset (powercfg restore defaults).

### Cause: BIOS/firmware needs update
**Probability:** 10%
**Detection:** Check eventLog.errorsBySubsystem for ACPI/power events and a firmware version older than the vendor's battery-fix release.
**Safe diagnostic:** Read the current BIOS/firmware version and compare to the vendor's latest.
**Safe fix:** With user confirmation, apply the vendor BIOS/firmware update on AC power following the vendor procedure.
**Escalation:** If power behavior persists post-update, escalate to vendor hardware support.

### Cause: Driver (battery/ACPI) issue
**Probability:** 8%
**Detection:** Inspect drivers for the ACPI Control Method Battery and check eventLog.errorsBySubsystem for ACPI driver faults; battery shows as not detected.
**Safe diagnostic:** Read the battery/ACPI driver status in device manager (read-only).
**Safe fix:** With user confirmation, reinstall the ACPI-compliant battery driver and restart.
**Escalation:** If the battery still is not detected, escalate to hardware connector/board diagnostics.
