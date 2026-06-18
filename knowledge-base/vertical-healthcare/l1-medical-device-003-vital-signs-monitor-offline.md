---
title: "Vital signs monitor offline"
vertical: healthcare
tier: l1
intent_codes: [DEVICE.MONITOR, NETWORK.CONNECTIVITY, BIOMED.ESCALATION]
keywords: [vital signs, monitor, offline, wifi, biomedical]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

A vital signs monitor shows offline, cannot transmit readings, or is missing from the monitoring dashboard.

## What's happening (1-line cause)

The monitor may have lost power, network connectivity, device registration, or server reachability.

## Fix - try these in order

### 1. Check power and network status

Confirm power, battery, network icon, room location, and whether other monitors nearby are online.

**Escalation:** if several monitors in the same area are offline, go to step 3.

### 2. Reconnect using approved workflow

Ask clinical or biomedical staff to follow the device-approved reconnect process; do not change clinical settings.

**Escalation:** if the monitor stays offline after approved reconnect, go to step 3.

### 3. Verify registration and server path

Have biomedical or IT validate the device registration, VLAN, wireless logs, and monitoring server status.

**Escalation:** open a ticket with biomedical engineering, network support, and the monitoring system vendor.

## Compliance reminder

Avoid screenshots showing readings, demographics, or encounter context. Use device ID, room area, and safe timestamps only. Clinical alarms and patient safety response remain under clinical protocol.

## Related entries

- [[l1-medical-device-002-infusion-pump-wifi-drops]]
- [[l2-hipaa-005-encryption-at-rest-audit]]
