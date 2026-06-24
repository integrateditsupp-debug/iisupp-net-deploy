# Audio Issues

## Symptom: Sound is missing, too quiet, or distorted from the computer.
> User phrasings: "no sound", "audio not working", "i can't hear anything", "sound is distorted"

### Cause: Wrong default output device
**Probability:** 26%
**Detection:** Audio plays to an unexpected endpoint (e.g. HDMI monitor) instead of speakers/headset; multiple endpoints present.
**Safe diagnostic:** List output devices read-only via Get-AudioDevice -List or Sound settings to see the active default.
**Safe fix:** With user confirmation, set the intended speakers/headset as the default playback device.
**Escalation:** If the correct device is missing entirely, escalate to driver/hardware checks.

### Cause: Muted/low volume
**Probability:** 22%
**Detection:** System or per-app volume is muted or near zero in the volume mixer.
**Safe diagnostic:** Read the master and per-app volume levels read-only in the volume mixer.
**Safe fix:** With user confirmation, unmute and raise the system and the affected app's volume.
**Escalation:** If volume controls do not respond, escalate to audio service/driver review.

### Cause: Audio service stopped
**Probability:** 18%
**Detection:** No app produces sound and the Windows Audio service is not running; service errors may appear in eventLog.errorsBySubsystem.
**Safe diagnostic:** Read service state read-only via Get-Service Audiosrv,AudioEndpointBuilder.
**Safe fix:** With user confirmation, restart the Windows Audio (Audiosrv) service.
**Escalation:** If the service will not stay running, escalate for deeper service/dependency repair.

### Cause: Outdated/corrupt audio driver
**Probability:** 16%
**Detection:** Distortion, static, or no devices listed; audio driver faults show in eventLog.errorsBySubsystem and Device Manager flags the device.
**Safe diagnostic:** Read device status read-only via Get-PnpDevice -Class AudioEndpoint -Status Error.
**Safe fix:** With user confirmation, update the audio driver via Windows Update or the vendor package.
**Escalation:** If audio is still broken, escalate to reinstall/roll back the driver by a technician.

### Cause: Exclusive-mode app conflict
**Probability:** 10%
**Detection:** One app grabs the device in exclusive mode so others go silent; symptoms tied to a specific conferencing/DAW app.
**Safe diagnostic:** Read the device's Advanced playback properties read-only to check exclusive-mode allowance.
**Safe fix:** With user confirmation, disable "Allow applications to take exclusive control" for that device.
**Escalation:** If conflicts continue, escalate to review the offending app's audio settings.

### Cause: Bad cable/port
**Probability:** 8%
**Detection:** Hardware-only failure that software cannot detect; no audio even with a correct, unmuted default device and healthy driver.
**Safe diagnostic:** Confirm software is correct, then advise read-only physical inspection of cable/jack seating.
**Safe fix:** With user confirmation, suggest reseating or trying a different cable/port or known-good headset.
**Escalation:** If a port is faulty, escalate for hardware repair or a USB audio adapter.
