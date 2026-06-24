# Display Issues

## Symptom: The screen is blank, flickering, wrongly sized, or a monitor is not detected.
> User phrasings: "black screen", "screen is flickering", "wrong resolution", "second monitor not detected"

### Cause: GPU/graphics driver crash
**Probability:** 26%
**Detection:** Flicker, black flashes, or recovery after a stall point to the graphics driver; eventLog.errorsBySubsystem shows display-source TDR/Display events (Event ID 4101 nvlddmkm/amdkmdag).
**Safe diagnostic:** Read eventLog.errorsBySubsystem for display TDR entries read-only and confirm the GPU driver version.
**Safe fix:** With user confirmation, update the GPU/graphics driver via Windows Update or the vendor (NVIDIA/AMD/Intel).
**Escalation:** If crashes continue, escalate for a clean driver reinstall or GPU hardware check.

### Cause: Wrong resolution/refresh
**Probability:** 20%
**Detection:** Image is stretched, blurry, or out of range while the display itself works fine.
**Safe diagnostic:** Read current and supported modes read-only via Get-DisplayResolution or Display settings.
**Safe fix:** With user confirmation, set the monitor's native resolution and a supported refresh rate.
**Escalation:** If native mode is unavailable, escalate to driver/EDID troubleshooting.

### Cause: Loose/bad cable
**Probability:** 18%
**Detection:** Intermittent black screen, flicker, or signal loss not tied to software; the OS may still detect the panel inconsistently.
**Safe diagnostic:** Confirm software settings are correct, then advise read-only inspection of the video cable seating.
**Safe fix:** With user confirmation, suggest reseating or swapping the HDMI/DP/USB-C cable or trying another port.
**Escalation:** If signal issues continue with a known-good cable, escalate for port/panel hardware service.

### Cause: Multi-monitor detection
**Probability:** 16%
**Detection:** A connected second monitor does not appear; the extra display is absent from Display settings and Get-PnpDevice monitors list.
**Safe diagnostic:** Read connected displays read-only and trigger a detect from Display settings without changing layout.
**Safe fix:** With user confirmation, force a detect (Win+P / "Detect") and set the projection mode to Extend.
**Escalation:** If the monitor is still missing, escalate to verify the input source, cable, and GPU port.

### Cause: Power/sleep wake issue
**Probability:** 12%
**Detection:** Black screen after sleep while the system is otherwise running; Kernel-Power/sleep entries in eventLog.errorsBySubsystem.
**Safe diagnostic:** Read recent power/wake events read-only via Get-WinEvent for Kernel-Power.
**Safe fix:** With user confirmation, adjust the affected power/sleep timeout setting or update the display driver.
**Escalation:** If displays fail to wake reliably, escalate for power-management and driver review.

### Cause: Overheating GPU
**Probability:** 8%
**Detection:** Artifacts or display drops under heavy graphics load; thermal/WHEA events in eventLog.errorsBySubsystem with high cpu.load alongside GPU stress.
**Safe diagnostic:** Read thermal/WHEA event entries read-only and correlate with periods of heavy graphics use.
**Safe fix:** With user confirmation, recommend improving airflow/cleaning vents and reducing graphics load.
**Escalation:** If thermal artifacts persist, escalate for GPU cooling service or hardware diagnostics.
