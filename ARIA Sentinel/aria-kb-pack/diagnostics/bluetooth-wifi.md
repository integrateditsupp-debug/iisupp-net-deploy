# Bluetooth & Wi-Fi

## Symptom: Wireless connections drop, fail to connect, or Bluetooth devices will not pair.
> User phrasings: "wifi keeps dropping", "bluetooth won't pair", "can't connect to wifi", "bluetooth not finding devices"

### Cause: Outdated or corrupt wireless driver
**Probability:** 25%
**Detection:** Adapter shows error or disappears intermittently; check system-context.json `devices.wifi.driverDate` for an old or mismatched driver.
**Safe diagnostic:** View the adapter and its driver version in Device Manager > Network adapters (read-only).
**Safe fix:** With user confirmation, update the wireless driver via Windows Update or the OEM package, or roll back a recently changed driver.
**Escalation:** If no working driver exists for the hardware, escalate to L2 / OEM support.

### Cause: Power management turning the radio off
**Probability:** 20%
**Detection:** Drops occur on idle or after sleep; check system-context.json `power.plan` and adapter power-saving state.
**Safe diagnostic:** Inspect the adapter's Power Management tab in Device Manager (read-only).
**Safe fix:** With user confirmation, uncheck "Allow the computer to turn off this device to save power" for the Wi-Fi and Bluetooth radios.
**Escalation:** If drops persist with power saving off, escalate to L2 for hardware testing.

### Cause: Interference or out-of-range signal
**Probability:** 18%
**Detection:** Weak RSSI or drops only at distance; check system-context.json `network.wifi.signalStrength` for low values.
**Safe diagnostic:** Note signal strength and connected band (2.4 vs 5 GHz) from the network status (read-only).
**Safe fix:** With user confirmation, move closer to the access point or reconnect on the less-congested band.
**Escalation:** If coverage is structurally poor, escalate to network team for AP placement review.

### Cause: Corrupt saved network profile
**Probability:** 15%
**Detection:** Connects to other SSIDs but not this one; check system-context.json `network.wifi.profileError` if present.
**Safe diagnostic:** List saved networks via `netsh wlan show profiles` (read-only).
**Safe fix:** With user confirmation, "Forget" the problem network and reconnect by re-entering the key.
**Escalation:** If reconnect still fails on a known-good network, escalate to L2.

### Cause: Bluetooth Support Service stopped
**Probability:** 12%
**Detection:** Bluetooth toggle missing or greyed; check system-context.json `services.bthserv.state` not running.
**Safe diagnostic:** Check the Bluetooth Support Service status in services.msc (read-only).
**Safe fix:** With user confirmation, set the Bluetooth Support Service to Automatic and start it.
**Escalation:** If the service will not start or crashes, escalate to L2.

### Cause: Airplane mode or hardware radio switch enabled
**Probability:** 10%
**Detection:** All radios off at once; check system-context.json `network.airplaneMode` flag.
**Safe diagnostic:** Confirm airplane-mode tile and any physical Wi-Fi switch / Fn key state (read-only).
**Safe fix:** With user confirmation, turn off airplane mode and re-enable Wi-Fi/Bluetooth toggles.
**Escalation:** If radios stay off after disabling airplane mode, escalate to L2 for hardware-switch check.
