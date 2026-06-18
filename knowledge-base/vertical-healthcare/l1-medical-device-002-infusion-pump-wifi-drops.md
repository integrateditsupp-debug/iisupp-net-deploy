---
title: "Infusion pump Wi-Fi drops"
vertical: healthcare
tier: l1
intent_codes: [DEVICE.INFUSION, WIFI.ROAMING, BIOMED.ESCALATION]
keywords: [infusion pump, wifi, wireless, drops, biomedical]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

An infusion pump repeatedly drops from Wi-Fi or cannot sync with the approved medication or device system.

## What's happening (1-line cause)

The pump may be outside wireless coverage, on the wrong SSID, using stale credentials, or experiencing roaming issues.

## Fix - try these in order

### 1. Confirm location and coverage

Record the unit, room area, pump model, and whether nearby approved pumps remain connected.

**Escalation:** if multiple pumps drop in the same area, go to step 3.

### 2. Restart through approved biomedical process

Follow the vendor-approved restart or reconnect workflow only if clinical staff confirm it is safe and allowed.

**Escalation:** if the pump reconnects then drops again, go to step 3.

### 3. Validate wireless and device profile

Have IT or biomedical engineering check SSID assignment, certificate/profile age, signal strength, and controller logs.

**Escalation:** open a ticket with biomedical engineering, wireless network support, and the device vendor if drops continue.

## Compliance reminder

Do not record medication names, dosages, patient identifiers, or screen photos in the IT ticket. Clinical safety decisions belong to licensed clinical staff and biomedical policy.

## Related entries

- [[l1-medical-device-001-imaging-modality-not-on-network]]
- [[l2-hipaa-003-mfa-recovery-for-clinical-staff]]
